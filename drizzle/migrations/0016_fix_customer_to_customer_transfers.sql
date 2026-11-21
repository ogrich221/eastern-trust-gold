CREATE OR REPLACE FUNCTION public.set_transfer_pin(_pin_hash text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'NOT_SIGNED_IN'; END IF;
  IF _pin_hash IS NULL OR length(_pin_hash) <> 64 THEN RAISE EXCEPTION 'INVALID_PIN'; END IF;
  INSERT INTO public.profiles (
    id, first_name, last_name, phone, address, city, postal_code,
    security_question_one, security_answer_one_hash,
    security_question_two, security_answer_two_hash,
    transfer_pin_hash
  )
  VALUES (
    auth.uid(), '', '', '', '', '', '',
    '', '',
    '', '',
    _pin_hash
  )
  ON CONFLICT (id) DO UPDATE
    SET transfer_pin_hash = EXCLUDED.transfer_pin_hash,
        updated_at = now();
END $function$;

CREATE OR REPLACE FUNCTION public.customer_transfer(
  _from uuid,
  _to_account uuid,
  _to_email text,
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
  recipient uuid;
  recipient_email text;
  sender_email text;
  recipient_name text;
  sender_name text;
  out_id uuid;
  me uuid := auth.uid();
  out_label text;
  in_label text;
  pin text;
  clean_memo text := coalesce(' — ' || nullif(trim(_memo), ''), '');
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'NOT_SIGNED_IN'; END IF;
  SELECT transfer_pin_hash INTO pin FROM public.profiles WHERE id = me;
  IF pin IS NOT NULL AND (_pin_hash IS NULL OR _pin_hash <> pin) THEN RAISE EXCEPTION 'PIN_INVALID'; END IF;
  IF _key IS NULL OR length(_key) < 8 OR length(_key) > 100 THEN RAISE EXCEPTION 'INVALID_REQUEST'; END IF;
  IF _memo IS NOT NULL AND length(_memo) > 140 THEN RAISE EXCEPTION 'MEMO_TOO_LONG'; END IF;

  SELECT * INTO src FROM public.bank_accounts WHERE id = _from AND user_id = me AND is_active = true;
  IF NOT FOUND THEN RAISE EXCEPTION 'ACCOUNT_NOT_FOUND'; END IF;
  IF src.account_type NOT IN ('checking', 'savings') THEN RAISE EXCEPTION 'SOURCE_NOT_ALLOWED'; END IF;

  IF _to_account IS NOT NULL THEN
    SELECT * INTO dst FROM public.bank_accounts WHERE id = _to_account AND user_id = me AND is_active = true;
    IF NOT FOUND THEN RAISE EXCEPTION 'RECIPIENT_NOT_FOUND'; END IF;
    out_label := 'Transfer to ' || dst.name;
    in_label := 'Transfer from ' || src.name;
  ELSE
    SELECT id, email INTO recipient, recipient_email
      FROM auth.users
      WHERE lower(email) = lower(trim(coalesce(_to_email, '')))
      LIMIT 1;
    IF recipient IS NULL THEN RAISE EXCEPTION 'RECIPIENT_NOT_FOUND'; END IF;
    IF recipient = me THEN RAISE EXCEPTION 'SAME_ACCOUNT'; END IF;

    SELECT * INTO dst
      FROM public.bank_accounts
      WHERE user_id = recipient AND account_type = 'checking' AND is_active = true
      LIMIT 1;
    IF NOT FOUND THEN RAISE EXCEPTION 'RECIPIENT_NOT_FOUND'; END IF;

    SELECT nullif(trim(coalesce(first_name, '') || ' ' || coalesce(last_name, '')), '') INTO recipient_name
      FROM public.profiles WHERE id = recipient;
    SELECT nullif(trim(coalesce(first_name, '') || ' ' || coalesce(last_name, '')), '') INTO sender_name
      FROM public.profiles WHERE id = me;
    SELECT email INTO sender_email FROM auth.users WHERE id = me;

    out_label := 'Transfer to ' || coalesce(recipient_name, recipient_email, 'Eastern Trust customer');
    in_label := 'Transfer from ' || coalesce(sender_name, sender_email, 'Eastern Trust customer');
  END IF;

  IF dst.id = src.id THEN RAISE EXCEPTION 'SAME_ACCOUNT'; END IF;

  out_id := public.admin_post_transaction(
    src.id, 'DEBIT', _amount, src.currency,
    out_label || clean_memo, NULL, 'Customer transfer', _key || ':out'
  );
  PERFORM public.admin_post_transaction(
    dst.id, 'CREDIT', _amount, src.currency,
    in_label || clean_memo, NULL, 'Customer transfer', _key || ':in'
  );
  RETURN out_id;
END $function$;

GRANT EXECUTE ON FUNCTION public.set_transfer_pin(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.customer_transfer(uuid, uuid, text, numeric, text, text, text) TO authenticated, service_role;