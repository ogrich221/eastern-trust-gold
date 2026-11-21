ALTER TABLE public.bank_accounts ADD COLUMN IF NOT EXISTS account_number text;

WITH numbered AS (
  SELECT id,
         '8204' || lpad((1000 + row_number() OVER (ORDER BY created_at, id))::text, 4, '0') || lpad(regexp_replace(coalesce(last_four, '0000'), '[^0-9]', '', 'g'), 4, '0') AS acct_no
  FROM public.bank_accounts
  WHERE account_number IS NULL OR trim(account_number) = ''
)
UPDATE public.bank_accounts b
SET account_number = numbered.acct_no
FROM numbered
WHERE b.id = numbered.id;

CREATE UNIQUE INDEX IF NOT EXISTS bank_accounts_account_number_key
  ON public.bank_accounts (account_number)
  WHERE account_number IS NOT NULL;

CREATE SEQUENCE IF NOT EXISTS public.bank_account_number_seq START WITH 5000 INCREMENT BY 1;

CREATE OR REPLACE FUNCTION public.ensure_bank_account_number()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  seq_num bigint;
  clean_four text;
BEGIN
  clean_four := right(lpad(regexp_replace(coalesce(NEW.last_four, ''), '[^0-9]', '', 'g'), 4, '0'), 4);
  IF NEW.account_number IS NULL OR trim(NEW.account_number) = '' THEN
    seq_num := nextval('public.bank_account_number_seq');
    NEW.account_number := '8204' || lpad((seq_num % 10000)::text, 4, '0') || clean_four;
  ELSE
    NEW.account_number := regexp_replace(NEW.account_number, '[^0-9]', '', 'g');
    IF length(NEW.account_number) >= 4 THEN
      NEW.last_four := right(NEW.account_number, 4);
    END IF;
  END IF;
  RETURN NEW;
END $function$;

DROP TRIGGER IF EXISTS bank_accounts_ensure_account_number ON public.bank_accounts;
CREATE TRIGGER bank_accounts_ensure_account_number
  BEFORE INSERT ON public.bank_accounts
  FOR EACH ROW
  EXECUTE FUNCTION public.ensure_bank_account_number();

CREATE OR REPLACE FUNCTION public.customer_user_transfer(
  _from uuid,
  _recipient_name text,
  _to_account_number text,
  _amount numeric,
  _memo text,
  _key text,
  _pin_hash text DEFAULT NULL::text
)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  src public.bank_accounts%ROWTYPE;
  dst public.bank_accounts%ROWTYPE;
  sender_name text;
  sender_email text;
  out_id uuid;
  me uuid := auth.uid();
  pin text;
  clean_acct text := regexp_replace(coalesce(_to_account_number, ''), '[^0-9]', '', 'g');
  clean_recip text := trim(coalesce(_recipient_name, ''));
  clean_memo text := coalesce(' — ' || nullif(trim(_memo), ''), '');
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'NOT_SIGNED_IN'; END IF;
  SELECT transfer_pin_hash INTO pin FROM public.profiles WHERE id = me;
  IF pin IS NOT NULL AND (_pin_hash IS NULL OR _pin_hash <> pin) THEN RAISE EXCEPTION 'PIN_INVALID'; END IF;
  IF _key IS NULL OR length(_key) < 8 OR length(_key) > 100 THEN RAISE EXCEPTION 'INVALID_REQUEST'; END IF;
  IF _memo IS NOT NULL AND length(_memo) > 140 THEN RAISE EXCEPTION 'MEMO_TOO_LONG'; END IF;
  IF length(clean_recip) < 2 OR length(clean_recip) > 120 THEN RAISE EXCEPTION 'INVALID_RECIPIENT'; END IF;
  IF length(clean_acct) < 8 OR length(clean_acct) > 20 THEN RAISE EXCEPTION 'INVALID_ACCOUNT_NUMBER'; END IF;

  SELECT * INTO src FROM public.bank_accounts WHERE id = _from AND user_id = me AND is_active = true;
  IF NOT FOUND THEN RAISE EXCEPTION 'ACCOUNT_NOT_FOUND'; END IF;
  IF src.account_type NOT IN ('checking', 'savings') THEN RAISE EXCEPTION 'SOURCE_NOT_ALLOWED'; END IF;

  SELECT * INTO dst FROM public.bank_accounts WHERE account_number = clean_acct AND account_type = 'checking' AND is_active = true LIMIT 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'RECIPIENT_NOT_FOUND'; END IF;
  IF dst.id = src.id OR dst.user_id = me THEN RAISE EXCEPTION 'SAME_ACCOUNT'; END IF;

  SELECT nullif(trim(coalesce(first_name, '') || ' ' || coalesce(last_name, '')), '') INTO sender_name
    FROM public.profiles WHERE id = me;
  SELECT email INTO sender_email FROM auth.users WHERE id = me;

  out_id := public.admin_post_transaction(
    src.id, 'DEBIT', _amount, src.currency,
    'Transfer to ' || clean_recip || ' (•••• ' || dst.last_four || ')' || clean_memo,
    NULL, 'Customer transfer', _key || ':out'
  );
  PERFORM public.admin_post_transaction(
    dst.id, 'CREDIT', _amount, src.currency,
    'Transfer from ' || coalesce(sender_name, sender_email, 'Eastern Trust customer') || ' (•••• ' || src.last_four || ')' || clean_memo,
    NULL, 'Customer transfer', _key || ':in'
  );
  RETURN out_id;
END $function$;

CREATE OR REPLACE FUNCTION public.admin_user_transfer(
  _from_account_id uuid,
  _to_account_number text,
  _recipient_name text,
  _amount numeric,
  _memo text,
  _admin text,
  _idempotency_key text,
  _transaction_date date DEFAULT NULL::date
)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  src public.bank_accounts%ROWTYPE;
  dst public.bank_accounts%ROWTYPE;
  sender_name text;
  sender_email text;
  out_id uuid;
  clean_acct text := regexp_replace(coalesce(_to_account_number, ''), '[^0-9]', '', 'g');
  clean_recip text := trim(coalesce(_recipient_name, ''));
  clean_memo text := coalesce(' — ' || nullif(trim(_memo), ''), '');
  effective_date date := coalesce(_transaction_date, (now() AT TIME ZONE 'UTC')::date);
BEGIN
  IF _idempotency_key IS NULL OR length(_idempotency_key) < 8 OR length(_idempotency_key) > 100 THEN RAISE EXCEPTION 'INVALID_REQUEST'; END IF;
  IF _memo IS NOT NULL AND length(_memo) > 140 THEN RAISE EXCEPTION 'MEMO_TOO_LONG'; END IF;
  IF length(clean_recip) < 2 OR length(clean_recip) > 120 THEN RAISE EXCEPTION 'INVALID_RECIPIENT'; END IF;
  IF length(clean_acct) < 8 OR length(clean_acct) > 20 THEN RAISE EXCEPTION 'INVALID_ACCOUNT_NUMBER'; END IF;

  SELECT * INTO src FROM public.bank_accounts WHERE id = _from_account_id AND is_active = true;
  IF NOT FOUND THEN RAISE EXCEPTION 'ACCOUNT_NOT_FOUND'; END IF;

  SELECT * INTO dst FROM public.bank_accounts WHERE account_number = clean_acct AND account_type = 'checking' AND is_active = true LIMIT 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'RECIPIENT_NOT_FOUND'; END IF;
  IF dst.id = src.id OR dst.user_id = src.user_id THEN RAISE EXCEPTION 'SAME_ACCOUNT'; END IF;

  SELECT nullif(trim(coalesce(first_name, '') || ' ' || coalesce(last_name, '')), '') INTO sender_name
    FROM public.profiles WHERE id = src.user_id;
  SELECT email INTO sender_email FROM auth.users WHERE id = src.user_id;

  out_id := public.admin_post_transaction_with_date(
    src.id, 'DEBIT', _amount, src.currency,
    'Transfer to ' || clean_recip || ' (•••• ' || dst.last_four || ')' || clean_memo,
    NULL, coalesce(nullif(trim(_admin), ''), 'Admin'), _idempotency_key || ':out',
    NULL, NULL, effective_date
  );
  PERFORM public.admin_post_transaction_with_date(
    dst.id, 'CREDIT', _amount, src.currency,
    'Transfer from ' || coalesce(sender_name, sender_email, 'Eastern Trust customer') || ' (•••• ' || src.last_four || ')' || clean_memo,
    NULL, coalesce(nullif(trim(_admin), ''), 'Admin'), _idempotency_key || ':in',
    NULL, NULL, effective_date
  );
  RETURN out_id;
END $function$;

GRANT EXECUTE ON FUNCTION public.customer_user_transfer(uuid, text, text, numeric, text, text, text) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.admin_user_transfer(uuid, text, text, numeric, text, text, text, date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_user_transfer(uuid, text, text, numeric, text, text, text, date) TO service_role;