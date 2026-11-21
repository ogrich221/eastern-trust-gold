CREATE TABLE public.customer_transfer_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  txn_id uuid NOT NULL REFERENCES public.account_transactions(id),
  credit_txn_id uuid REFERENCES public.account_transactions(id),
  transfer_kind text NOT NULL CHECK (transfer_kind IN ('DOMESTIC', 'PAYMENT')),
  sender_user_id uuid NOT NULL,
  from_account_id uuid NOT NULL REFERENCES public.bank_accounts(id),
  to_account_id uuid REFERENCES public.bank_accounts(id),
  recipient_user_id uuid,
  recipient_name text NOT NULL,
  recipient_account_number text,
  amount numeric(18,2) NOT NULL CHECK (amount > 0),
  currency text NOT NULL,
  memo text,
  status text NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'COMPLETED', 'CANCELLED')),
  reviewed_by text,
  review_reason text,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX customer_transfer_requests_status_idx ON public.customer_transfer_requests (status, created_at DESC);
CREATE INDEX customer_transfer_requests_sender_idx ON public.customer_transfer_requests (sender_user_id, created_at DESC);

GRANT SELECT ON public.customer_transfer_requests TO authenticated;
GRANT ALL ON public.customer_transfer_requests TO service_role;

ALTER TABLE public.customer_transfer_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Customers view own transfer requests"
  ON public.customer_transfer_requests
  FOR SELECT
  TO authenticated
  USING (auth.uid() = sender_user_id);

CREATE POLICY "Admins view all transfer requests"
  ON public.customer_transfer_requests
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admins update transfer requests"
  ON public.customer_transfer_requests
  FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE OR REPLACE FUNCTION public.protect_ledger() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'Ledger entries cannot be deleted'; END IF;

  IF (to_jsonb(NEW) - 'transaction_date' - 'status' - 'reversed_by_id' - 'reversal_reason' - 'reversed_at')
     IS DISTINCT FROM
     (to_jsonb(OLD) - 'transaction_date' - 'status' - 'reversed_by_id' - 'reversal_reason' - 'reversed_at') THEN
    RAISE EXCEPTION 'Ledger entries are immutable';
  END IF;

  -- Same-status update: only transaction_date may change.
  IF NEW.status IS NOT DISTINCT FROM OLD.status
     AND NEW.reversed_by_id IS NOT DISTINCT FROM OLD.reversed_by_id
     AND NEW.reversal_reason IS NOT DISTINCT FROM OLD.reversal_reason
     AND NEW.reversed_at IS NOT DISTINCT FROM OLD.reversed_at THEN
    RETURN NEW;
  END IF;

  -- One-way verification: PENDING -> COMPLETED with no reversal metadata changes.
  IF OLD.status = 'PENDING' AND NEW.status = 'COMPLETED'
     AND NEW.reversed_by_id IS NOT DISTINCT FROM OLD.reversed_by_id
     AND NEW.reversal_reason IS NOT DISTINCT FROM OLD.reversal_reason
     AND NEW.reversed_at IS NOT DISTINCT FROM OLD.reversed_at THEN
    RETURN NEW;
  END IF;

  -- One-way reversal: COMPLETED or PENDING -> REVERSED once.
  IF OLD.status IN ('COMPLETED', 'PENDING') AND NEW.status = 'REVERSED' AND OLD.reversed_by_id IS NULL THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Ledger entries are immutable';
END $$;

CREATE OR REPLACE FUNCTION public.admin_post_transaction(
  _account_id uuid, _type text, _amount numeric, _currency text, _description text,
  _reference text, _admin text, _idempotency_key text, _reverses uuid DEFAULT NULL, _reversal_reason text DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE acct public.bank_accounts%ROWTYPE; existing uuid; new_id uuid; before numeric; after numeric; sign int; orig public.account_transactions%ROWTYPE;
BEGIN
  SELECT id INTO existing FROM public.account_transactions WHERE idempotency_key = _idempotency_key;
  IF existing IS NOT NULL THEN RETURN existing; END IF;
  IF _type NOT IN ('CREDIT','DEBIT') THEN RAISE EXCEPTION 'INVALID_TYPE'; END IF;
  IF _amount IS NULL OR _amount <= 0 OR _amount <> round(_amount, 2) OR _amount > 1000000000 THEN RAISE EXCEPTION 'INVALID_AMOUNT'; END IF;
  IF _reverses IS NOT NULL THEN
    SELECT * INTO orig FROM public.account_transactions WHERE id = _reverses FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
    IF orig.status NOT IN ('COMPLETED', 'PENDING') OR orig.reverses_id IS NOT NULL THEN RAISE EXCEPTION 'NOT_REVERSIBLE'; END IF;
  END IF;
  SELECT * INTO acct FROM public.bank_accounts WHERE id = _account_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'ACCOUNT_NOT_FOUND'; END IF;
  IF upper(_currency) <> acct.currency THEN RAISE EXCEPTION 'CURRENCY_MISMATCH'; END IF;
  sign := CASE WHEN _type = 'CREDIT' THEN 1 ELSE -1 END;
  before := acct.available_balance;
  after := before + sign * _amount;
  IF after < 0 AND NOT acct.allow_overdraft AND _reverses IS NULL THEN RAISE EXCEPTION 'INSUFFICIENT_FUNDS'; END IF;
  INSERT INTO public.account_transactions (account_id, user_id, txn_type, amount, currency, balance_before, balance_after, description, admin_name, reference, idempotency_key, reverses_id, reversal_reason)
    VALUES (acct.id, acct.user_id, _type, _amount, acct.currency, before, after, _description, _admin, nullif(_reference,''), _idempotency_key, _reverses, _reversal_reason)
    RETURNING id INTO new_id;
  UPDATE public.bank_accounts SET available_balance = after,
    current_balance = current_balance + (CASE WHEN account_type = 'credit' THEN -sign ELSE sign END) * _amount
    WHERE id = acct.id;
  IF _reverses IS NOT NULL THEN
    UPDATE public.account_transactions SET status = 'REVERSED', reversed_by_id = new_id, reversal_reason = _reversal_reason, reversed_at = now() WHERE id = _reverses;
  END IF;
  INSERT INTO public.admin_audit_log (admin_id, target_user_id, action, details) VALUES ('00000000-0000-0000-0000-000000000000', acct.user_id,
    CASE WHEN _reverses IS NOT NULL THEN 'reverse_transaction' ELSE lower(_type) END,
    jsonb_build_object('by', _admin, 'transaction_id', new_id, 'account_id', acct.id, 'amount', _amount, 'currency', acct.currency, 'balance_before', before, 'balance_after', after, 'reason', _description, 'reference', _reference, 'reverses', _reverses));
  RETURN new_id;
END $$;

CREATE OR REPLACE FUNCTION public.post_pending_customer_debit(
  _account_id uuid, _amount numeric, _currency text, _description text,
  _reference text, _actor text, _idempotency_key text
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE acct public.bank_accounts%ROWTYPE; existing uuid; new_id uuid; before numeric; after numeric;
BEGIN
  SELECT id INTO existing FROM public.account_transactions WHERE idempotency_key = _idempotency_key;
  IF existing IS NOT NULL THEN RETURN existing; END IF;
  IF _amount IS NULL OR _amount <= 0 OR _amount <> round(_amount, 2) OR _amount > 1000000000 THEN RAISE EXCEPTION 'INVALID_AMOUNT'; END IF;
  SELECT * INTO acct FROM public.bank_accounts WHERE id = _account_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'ACCOUNT_NOT_FOUND'; END IF;
  IF NOT acct.is_active THEN RAISE EXCEPTION 'ARCHIVED_ACCOUNT_LOCKED'; END IF;
  IF upper(_currency) <> acct.currency THEN RAISE EXCEPTION 'CURRENCY_MISMATCH'; END IF;
  before := acct.available_balance;
  after := before - _amount;
  IF after < 0 AND NOT acct.allow_overdraft THEN RAISE EXCEPTION 'INSUFFICIENT_FUNDS'; END IF;
  INSERT INTO public.account_transactions (
    account_id, user_id, txn_type, amount, currency, balance_before, balance_after,
    description, admin_name, status, reference, idempotency_key
  ) VALUES (
    acct.id, acct.user_id, 'DEBIT', _amount, acct.currency, before, after,
    _description, _actor, 'PENDING', nullif(_reference,''), _idempotency_key
  ) RETURNING id INTO new_id;
  UPDATE public.bank_accounts SET available_balance = after,
    current_balance = current_balance + (CASE WHEN account_type = 'credit' THEN 1 ELSE -1 END) * _amount
    WHERE id = acct.id;
  RETURN new_id;
END $$;

REVOKE ALL ON FUNCTION public.post_pending_customer_debit(uuid,numeric,text,text,text,text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.post_pending_customer_debit(uuid,numeric,text,text,text,text,text) TO service_role;

CREATE OR REPLACE FUNCTION public.customer_user_transfer(
  _from uuid,
  _recipient_name text,
  _to_account_number text,
  _amount numeric,
  _memo text,
  _key text,
  _pin_hash text DEFAULT NULL::text
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  src public.bank_accounts%ROWTYPE;
  dst public.bank_accounts%ROWTYPE;
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

  out_id := public.post_pending_customer_debit(
    src.id, _amount, src.currency,
    'Transfer to ' || clean_recip || ' (•••• ' || dst.last_four || ')' || clean_memo,
    NULL, 'Customer transfer', _key || ':out'
  );

  IF NOT EXISTS (SELECT 1 FROM public.customer_transfer_requests WHERE txn_id = out_id) THEN
    INSERT INTO public.customer_transfer_requests (
      txn_id, transfer_kind, sender_user_id, from_account_id, to_account_id,
      recipient_user_id, recipient_name, recipient_account_number, amount, currency, memo, status
    ) VALUES (
      out_id, 'DOMESTIC', me, src.id, dst.id,
      dst.user_id, clean_recip, dst.account_number, _amount, src.currency, nullif(trim(_memo), ''), 'PENDING'
    );
  END IF;

  RETURN out_id;
END $$;

CREATE OR REPLACE FUNCTION public.customer_payment(
  _from uuid, _payee text, _amount numeric, _memo text, _key text, _pin_hash text DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE src public.bank_accounts%ROWTYPE; me uuid := auth.uid(); pin text; out_id uuid;
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'NOT_SIGNED_IN'; END IF;
  SELECT transfer_pin_hash INTO pin FROM public.profiles WHERE id = me;
  IF pin IS NOT NULL AND (_pin_hash IS NULL OR _pin_hash <> pin) THEN RAISE EXCEPTION 'PIN_INVALID'; END IF;
  IF _key IS NULL OR length(_key) < 8 OR length(_key) > 100 THEN RAISE EXCEPTION 'INVALID_REQUEST'; END IF;
  IF _payee IS NULL OR length(trim(_payee)) < 2 OR length(_payee) > 80 THEN RAISE EXCEPTION 'INVALID_PAYEE'; END IF;
  IF _memo IS NOT NULL AND length(_memo) > 140 THEN RAISE EXCEPTION 'MEMO_TOO_LONG'; END IF;
  SELECT * INTO src FROM public.bank_accounts WHERE id = _from AND user_id = me AND is_active = true;
  IF NOT FOUND THEN RAISE EXCEPTION 'ACCOUNT_NOT_FOUND'; END IF;
  IF src.account_type NOT IN ('checking','savings','credit') THEN RAISE EXCEPTION 'SOURCE_NOT_ALLOWED'; END IF;

  out_id := public.post_pending_customer_debit(
    src.id, _amount, src.currency,
    'Payment to ' || trim(_payee) || coalesce(' — ' || nullif(trim(_memo),''), ''),
    NULL, 'Customer payment', _key
  );

  IF NOT EXISTS (SELECT 1 FROM public.customer_transfer_requests WHERE txn_id = out_id) THEN
    INSERT INTO public.customer_transfer_requests (
      txn_id, transfer_kind, sender_user_id, from_account_id,
      recipient_name, amount, currency, memo, status
    ) VALUES (
      out_id, 'PAYMENT', me, src.id,
      trim(_payee), _amount, src.currency, nullif(trim(_memo), ''), 'PENDING'
    );
  END IF;

  RETURN out_id;
END $$;

CREATE OR REPLACE FUNCTION public.customer_wire(
  _from uuid, _amount numeric, _currency text, _recipient_name text, _recipient_bank text,
  _swift text, _account_number text, _country text, _memo text, _key text, _pin_hash text DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
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
  SELECT * INTO src FROM public.bank_accounts WHERE id = _from AND user_id = me AND is_active = true;
  IF NOT FOUND THEN RAISE EXCEPTION 'ACCOUNT_NOT_FOUND'; END IF;
  IF src.account_type NOT IN ('checking','savings') THEN RAISE EXCEPTION 'SOURCE_NOT_ALLOWED'; END IF;

  txn := public.post_pending_customer_debit(
    src.id, _amount, src.currency,
    'International wire to ' || trim(_recipient_name) || ' (' || trim(_country) || ', ' || _currency || ')' || coalesce(' — ' || nullif(trim(_memo),''), ''),
    upper(trim(_swift)), 'Customer wire', _key
  );

  SELECT id INTO wire FROM public.international_wires WHERE txn_id = txn;
  IF wire IS NULL THEN
    INSERT INTO public.international_wires (txn_id, user_id, account_id, recipient_name, recipient_bank, swift_bic, account_number, country, currency, amount, memo)
    VALUES (txn, me, src.id, trim(_recipient_name), trim(_recipient_bank), upper(trim(_swift)), trim(_account_number), trim(_country), _currency, _amount, nullif(trim(_memo),''))
    RETURNING id INTO wire;
  END IF;
  RETURN wire;
END $$;

CREATE OR REPLACE FUNCTION public.admin_review_customer_transfer(
  _request_id uuid,
  _action text,
  _admin text,
  _reason text,
  _idempotency_key text
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  req public.customer_transfer_requests%ROWTYPE;
  src public.bank_accounts%ROWTYPE;
  sender_name text;
  sender_email text;
  credit_id uuid;
  clean_memo text;
  actor text := coalesce(nullif(trim(_admin), ''), 'Admin');
  clean_reason text := trim(coalesce(_reason, ''));
BEGIN
  IF _action NOT IN ('approve', 'cancel') THEN RAISE EXCEPTION 'INVALID_ACTION'; END IF;
  IF length(clean_reason) < 3 THEN RAISE EXCEPTION 'INVALID_REASON'; END IF;
  IF _idempotency_key IS NULL OR length(_idempotency_key) < 8 OR length(_idempotency_key) > 100 THEN RAISE EXCEPTION 'INVALID_REQUEST'; END IF;

  SELECT * INTO req FROM public.customer_transfer_requests WHERE id = _request_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
  IF req.status <> 'PENDING' THEN RAISE EXCEPTION 'ALREADY_PROCESSED'; END IF;

  IF _action = 'approve' THEN
    IF req.transfer_kind = 'DOMESTIC' THEN
      IF req.to_account_id IS NULL THEN RAISE EXCEPTION 'RECIPIENT_NOT_FOUND'; END IF;
      SELECT * INTO src FROM public.bank_accounts WHERE id = req.from_account_id;
      SELECT nullif(trim(coalesce(first_name, '') || ' ' || coalesce(last_name, '')), '') INTO sender_name
        FROM public.profiles WHERE id = req.sender_user_id;
      SELECT email INTO sender_email FROM auth.users WHERE id = req.sender_user_id;
      clean_memo := coalesce(' — ' || nullif(trim(req.memo), ''), '');

      credit_id := public.admin_post_transaction(
        req.to_account_id, 'CREDIT', req.amount, req.currency,
        'Transfer from ' || coalesce(sender_name, sender_email, 'Eastern Trust customer') || ' (•••• ' || coalesce(src.last_four, '0000') || ')' || clean_memo,
        req.txn_id::text, actor, _idempotency_key || ':in'
      );
    END IF;

    UPDATE public.account_transactions
      SET status = 'COMPLETED'
      WHERE id = req.txn_id AND status = 'PENDING';

    UPDATE public.customer_transfer_requests
      SET status = 'COMPLETED',
          credit_txn_id = credit_id,
          reviewed_by = actor,
          review_reason = clean_reason,
          reviewed_at = now()
      WHERE id = req.id;

    INSERT INTO public.admin_audit_log (admin_id, target_user_id, action, details) VALUES (
      '00000000-0000-0000-0000-000000000000',
      req.sender_user_id,
      'transfer_approved',
      jsonb_build_object(
        'by', actor,
        'request_id', req.id,
        'transfer_kind', req.transfer_kind,
        'txn_id', req.txn_id,
        'credit_txn_id', credit_id,
        'amount', req.amount,
        'currency', req.currency,
        'recipient', req.recipient_name,
        'reason', clean_reason
      )
    );
  ELSE
    PERFORM public.admin_post_transaction(
      req.from_account_id, 'CREDIT', req.amount, req.currency,
      CASE WHEN req.transfer_kind = 'PAYMENT' THEN 'Payment declined refund: ' ELSE 'Transfer declined refund: ' END || req.recipient_name,
      req.txn_id::text, actor, _idempotency_key || ':refund', req.txn_id, clean_reason
    );

    UPDATE public.customer_transfer_requests
      SET status = 'CANCELLED',
          reviewed_by = actor,
          review_reason = clean_reason,
          reviewed_at = now()
      WHERE id = req.id;

    INSERT INTO public.admin_audit_log (admin_id, target_user_id, action, details) VALUES (
      '00000000-0000-0000-0000-000000000000',
      req.sender_user_id,
      'transfer_cancelled',
      jsonb_build_object(
        'by', actor,
        'request_id', req.id,
        'transfer_kind', req.transfer_kind,
        'txn_id', req.txn_id,
        'amount', req.amount,
        'currency', req.currency,
        'recipient', req.recipient_name,
        'reason', clean_reason
      )
    );
  END IF;

  RETURN req.id;
END $$;

REVOKE ALL ON FUNCTION public.admin_review_customer_transfer(uuid,text,text,text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_review_customer_transfer(uuid,text,text,text,text) TO service_role;