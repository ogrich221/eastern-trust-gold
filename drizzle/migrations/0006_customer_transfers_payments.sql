REVOKE EXECUTE ON FUNCTION public.admin_post_transaction(uuid, text, numeric, text, text, text, text, text, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_post_transaction(uuid, text, numeric, text, text, text, text, text, uuid, text) TO service_role;

CREATE OR REPLACE FUNCTION public.customer_transfer(_from uuid, _to_account uuid, _to_email text, _amount numeric, _memo text, _key text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE src public.bank_accounts%ROWTYPE; dst public.bank_accounts%ROWTYPE; recipient uuid; out_id uuid; me uuid := auth.uid(); label text;
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'NOT_SIGNED_IN'; END IF;
  IF _key IS NULL OR length(_key) < 8 OR length(_key) > 100 THEN RAISE EXCEPTION 'INVALID_REQUEST'; END IF;
  IF _memo IS NOT NULL AND length(_memo) > 140 THEN RAISE EXCEPTION 'MEMO_TOO_LONG'; END IF;
  SELECT * INTO src FROM public.bank_accounts WHERE id = _from AND user_id = me;
  IF NOT FOUND THEN RAISE EXCEPTION 'ACCOUNT_NOT_FOUND'; END IF;
  IF src.account_type NOT IN ('checking','savings') THEN RAISE EXCEPTION 'SOURCE_NOT_ALLOWED'; END IF;
  IF _to_account IS NOT NULL THEN
    SELECT * INTO dst FROM public.bank_accounts WHERE id = _to_account AND user_id = me;
    IF NOT FOUND THEN RAISE EXCEPTION 'RECIPIENT_NOT_FOUND'; END IF;
    label := 'Transfer to ' || dst.name;
  ELSE
    SELECT id INTO recipient FROM auth.users WHERE lower(email) = lower(trim(coalesce(_to_email,''))) AND email_confirmed_at IS NOT NULL;
    IF recipient IS NULL OR recipient = me THEN RAISE EXCEPTION 'RECIPIENT_NOT_FOUND'; END IF;
    SELECT * INTO dst FROM public.bank_accounts WHERE user_id = recipient AND account_type = 'checking';
    IF NOT FOUND THEN RAISE EXCEPTION 'RECIPIENT_NOT_FOUND'; END IF;
    label := 'Transfer to Eastern Trust customer';
  END IF;
  IF dst.id = src.id THEN RAISE EXCEPTION 'SAME_ACCOUNT'; END IF;
  out_id := public.admin_post_transaction(src.id, 'DEBIT', _amount, src.currency, label || coalesce(' — ' || nullif(trim(_memo),''), ''), NULL, 'Customer transfer', _key || ':out');
  PERFORM public.admin_post_transaction(dst.id, 'CREDIT', _amount, src.currency,
    CASE WHEN _to_account IS NOT NULL THEN 'Transfer from ' || src.name ELSE 'Transfer from Eastern Trust customer' END || coalesce(' — ' || nullif(trim(_memo),''), ''),
    NULL, 'Customer transfer', _key || ':in');
  RETURN out_id;
END $$;

CREATE OR REPLACE FUNCTION public.customer_payment(_from uuid, _payee text, _amount numeric, _memo text, _key text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE src public.bank_accounts%ROWTYPE; me uuid := auth.uid();
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'NOT_SIGNED_IN'; END IF;
  IF _key IS NULL OR length(_key) < 8 OR length(_key) > 100 THEN RAISE EXCEPTION 'INVALID_REQUEST'; END IF;
  IF _payee IS NULL OR length(trim(_payee)) < 2 OR length(_payee) > 80 THEN RAISE EXCEPTION 'INVALID_PAYEE'; END IF;
  IF _memo IS NOT NULL AND length(_memo) > 140 THEN RAISE EXCEPTION 'MEMO_TOO_LONG'; END IF;
  SELECT * INTO src FROM public.bank_accounts WHERE id = _from AND user_id = me;
  IF NOT FOUND THEN RAISE EXCEPTION 'ACCOUNT_NOT_FOUND'; END IF;
  IF src.account_type NOT IN ('checking','savings','credit') THEN RAISE EXCEPTION 'SOURCE_NOT_ALLOWED'; END IF;
  RETURN public.admin_post_transaction(src.id, 'DEBIT', _amount, src.currency,
    'Payment to ' || trim(_payee) || coalesce(' — ' || nullif(trim(_memo),''), ''), NULL, 'Customer payment', _key);
END $$;

REVOKE EXECUTE ON FUNCTION public.customer_transfer(uuid, uuid, text, numeric, text, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.customer_payment(uuid, text, numeric, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.customer_transfer(uuid, uuid, text, numeric, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.customer_payment(uuid, text, numeric, text, text) TO authenticated;