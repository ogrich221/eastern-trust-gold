-- Transfer PIN on profiles (nullable; existing customers set one later)
ALTER TABLE public.profiles ADD COLUMN transfer_pin_hash text;

-- International wire transfer records (money movement itself is a ledger entry)
CREATE TABLE public.international_wires (
  id uuid primary key default gen_random_uuid(),
  txn_id uuid not null references public.account_transactions(id),
  user_id uuid not null,
  account_id uuid not null references public.bank_accounts(id),
  recipient_name text not null,
  recipient_bank text not null,
  swift_bic text not null,
  account_number text not null,
  country text not null,
  currency text not null,
  amount numeric not null,
  memo text,
  status text not null default 'PENDING',
  created_at timestamp with time zone not null default now()
);
GRANT SELECT ON public.international_wires TO authenticated;
GRANT ALL ON public.international_wires TO service_role;
ALTER TABLE public.international_wires ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Customers view own wires" ON public.international_wires FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins view all wires" ON public.international_wires FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins update wires" ON public.international_wires FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Set or replace the caller's transfer PIN (client sends a SHA-256 hash)
CREATE OR REPLACE FUNCTION public.set_transfer_pin(_pin_hash text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'NOT_SIGNED_IN'; END IF;
  IF _pin_hash IS NULL OR length(_pin_hash) <> 64 THEN RAISE EXCEPTION 'INVALID_PIN'; END IF;
  UPDATE public.profiles SET transfer_pin_hash = _pin_hash, updated_at = now() WHERE id = auth.uid();
  IF NOT FOUND THEN RAISE EXCEPTION 'PROFILE_NOT_FOUND'; END IF;
END $$;
GRANT EXECUTE ON FUNCTION public.set_transfer_pin(text) TO authenticated;

-- Recreate customer_payment with PIN enforcement (old signature replaced)
DROP FUNCTION public.customer_payment(uuid, text, numeric, text, text);
CREATE FUNCTION public.customer_payment(_from uuid, _payee text, _amount numeric, _memo text, _key text, _pin_hash text DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE src public.bank_accounts%ROWTYPE; me uuid := auth.uid(); pin text;
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'NOT_SIGNED_IN'; END IF;
  SELECT transfer_pin_hash INTO pin FROM public.profiles WHERE id = me;
  IF pin IS NOT NULL AND (_pin_hash IS NULL OR _pin_hash <> pin) THEN RAISE EXCEPTION 'PIN_INVALID'; END IF;
  IF _key IS NULL OR length(_key) < 8 OR length(_key) > 100 THEN RAISE EXCEPTION 'INVALID_REQUEST'; END IF;
  IF _payee IS NULL OR length(trim(_payee)) < 2 OR length(_payee) > 80 THEN RAISE EXCEPTION 'INVALID_PAYEE'; END IF;
  IF _memo IS NOT NULL AND length(_memo) > 140 THEN RAISE EXCEPTION 'MEMO_TOO_LONG'; END IF;
  SELECT * INTO src FROM public.bank_accounts WHERE id = _from AND user_id = me;
  IF NOT FOUND THEN RAISE EXCEPTION 'ACCOUNT_NOT_FOUND'; END IF;
  IF src.account_type NOT IN ('checking','savings','credit') THEN RAISE EXCEPTION 'SOURCE_NOT_ALLOWED'; END IF;
  RETURN public.admin_post_transaction(src.id, 'DEBIT', _amount, src.currency,
    'Payment to ' || trim(_payee) || coalesce(' — ' || nullif(trim(_memo),''), ''), NULL, 'Customer payment', _key);
END $$;
GRANT EXECUTE ON FUNCTION public.customer_payment(uuid, text, numeric, text, text, text) TO authenticated;

-- Recreate customer_transfer with PIN enforcement
DROP FUNCTION public.customer_transfer(uuid, uuid, text, numeric, text, text);
CREATE FUNCTION public.customer_transfer(_from uuid, _to_account uuid, _to_email text, _amount numeric, _memo text, _key text, _pin_hash text DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE src public.bank_accounts%ROWTYPE; dst public.bank_accounts%ROWTYPE; recipient uuid; out_id uuid; me uuid := auth.uid(); label text; pin text;
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'NOT_SIGNED_IN'; END IF;
  SELECT transfer_pin_hash INTO pin FROM public.profiles WHERE id = me;
  IF pin IS NOT NULL AND (_pin_hash IS NULL OR _pin_hash <> pin) THEN RAISE EXCEPTION 'PIN_INVALID'; END IF;
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
GRANT EXECUTE ON FUNCTION public.customer_transfer(uuid, uuid, text, numeric, text, text, text) TO authenticated;

-- International wire transfer (African destination countries are not supported)
CREATE OR REPLACE FUNCTION public.customer_wire(_from uuid, _amount numeric, _currency text, _recipient_name text, _recipient_bank text, _swift text, _account_number text, _country text, _memo text, _key text, _pin_hash text DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE src public.bank_accounts%ROWTYPE; me uuid := auth.uid(); pin text; txn uuid; wire uuid;
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'NOT_SIGNED_IN'; END IF;
  SELECT transfer_pin_hash INTO pin FROM public.profiles WHERE id = me;
  IF pin IS NOT NULL AND (_pin_hash IS NULL OR _pin_hash <> pin) THEN RAISE EXCEPTION 'PIN_INVALID'; END IF;
  IF _key IS NULL OR length(_key) < 8 OR length(_key) > 100 THEN RAISE EXCEPTION 'INVALID_REQUEST'; END IF;
  IF _recipient_name IS NULL OR length(trim(_recipient_name)) < 2 OR length(_recipient_name) > 120 THEN RAISE EXCEPTION 'INVALID_RECIPIENT'; END IF;
  IF _recipient_bank IS NULL OR length(trim(_recipient_bank)) < 2 OR length(_recipient_bank) > 120 THEN RAISE EXCEPTION 'INVALID_BANK'; END IF;
  IF _swift IS NULL OR length(trim(_swift)) < 8 OR length(_swift) > 11 THEN RAISE EXCEPTION 'INVALID_SWIFT'; END IF;
  IF _account_number IS NULL OR length(trim(_account_number)) < 4 OR length(_account_number) > 34 THEN RAISE EXCEPTION 'INVALID_ACCOUNT_NUMBER'; END IF;
  IF _currency IS NULL OR _currency !~ '^[A-Z]{3}$' THEN RAISE EXCEPTION 'INVALID_CURRENCY'; END IF;
  IF _country IS NULL OR length(trim(_country)) < 2 THEN RAISE EXCEPTION 'INVALID_COUNTRY'; END IF;
  IF _memo IS NOT NULL AND length(_memo) > 140 THEN RAISE EXCEPTION 'MEMO_TOO_LONG'; END IF;
  IF lower(trim(_country)) IN ('algeria','angola','benin','botswana','burkina faso','burundi','cabo verde','cameroon','central african republic','chad','comoros','congo','democratic republic of the congo','djibouti','egypt','equatorial guinea','eritrea','eswatini','ethiopia','gabon','gambia','ghana','guinea','guinea-bissau','ivory coast','kenya','lesotho','liberia','libya','madagascar','malawi','mali','mauritania','mauritius','morocco','mozambique','namibia','niger','nigeria','rwanda','sao tome and principe','senegal','seychelles','sierra leone','somalia','south africa','south sudan','sudan','tanzania','togo','tunisia','uganda','zambia','zimbabwe') THEN RAISE EXCEPTION 'COUNTRY_NOT_SUPPORTED'; END IF;
  SELECT * INTO src FROM public.bank_accounts WHERE id = _from AND user_id = me;
  IF NOT FOUND THEN RAISE EXCEPTION 'ACCOUNT_NOT_FOUND'; END IF;
  IF src.account_type NOT IN ('checking','savings') THEN RAISE EXCEPTION 'SOURCE_NOT_ALLOWED'; END IF;
  txn := public.admin_post_transaction(src.id, 'DEBIT', _amount, src.currency,
    'International wire to ' || trim(_recipient_name) || ' (' || trim(_country) || ', ' || _currency || ')' || coalesce(' — ' || nullif(trim(_memo),''), ''),
    upper(trim(_swift)), 'Customer wire', _key);
  INSERT INTO public.international_wires (txn_id, user_id, account_id, recipient_name, recipient_bank, swift_bic, account_number, country, currency, amount, memo)
  VALUES (txn, me, src.id, trim(_recipient_name), trim(_recipient_bank), upper(trim(_swift)), trim(_account_number), trim(_country), _currency, _amount, nullif(trim(_memo),''))
  RETURNING id INTO wire;
  RETURN wire;
END $$;
GRANT EXECUTE ON FUNCTION public.customer_wire(uuid, numeric, text, text, text, text, text, text, text, text, text) TO authenticated;