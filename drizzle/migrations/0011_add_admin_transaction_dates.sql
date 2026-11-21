ALTER TABLE public.account_transactions ADD COLUMN transaction_date date;

ALTER TABLE public.account_transactions DISABLE TRIGGER account_transactions_immutable;
UPDATE public.account_transactions
SET transaction_date = (created_at AT TIME ZONE 'UTC')::date
WHERE transaction_date IS NULL;
ALTER TABLE public.account_transactions ENABLE TRIGGER account_transactions_immutable;

ALTER TABLE public.account_transactions ALTER COLUMN transaction_date SET NOT NULL;
ALTER TABLE public.account_transactions ALTER COLUMN transaction_date SET DEFAULT ((now() AT TIME ZONE 'UTC')::date);
CREATE INDEX account_transactions_transaction_date_idx ON public.account_transactions (transaction_date DESC, created_at DESC);

CREATE OR REPLACE FUNCTION public.protect_ledger() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'Ledger entries cannot be deleted'; END IF;
  IF OLD.status <> 'COMPLETED' OR NEW.status <> 'REVERSED' OR OLD.reversed_by_id IS NOT NULL
     OR NEW.amount <> OLD.amount OR NEW.account_id <> OLD.account_id OR NEW.txn_type <> OLD.txn_type
     OR NEW.balance_before <> OLD.balance_before OR NEW.balance_after <> OLD.balance_after
     OR NEW.description <> OLD.description OR NEW.admin_name <> OLD.admin_name OR NEW.created_at <> OLD.created_at
     OR NEW.transaction_date <> OLD.transaction_date
     OR NEW.currency <> OLD.currency OR NEW.idempotency_key <> OLD.idempotency_key THEN
    RAISE EXCEPTION 'Ledger entries are immutable';
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.admin_post_transaction(
  _account_id uuid, _type text, _amount numeric, _currency text, _description text,
  _reference text, _admin text, _idempotency_key text, _reverses uuid DEFAULT NULL,
  _reversal_reason text DEFAULT NULL, _transaction_date date DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  acct public.bank_accounts%ROWTYPE;
  existing uuid;
  new_id uuid;
  before numeric;
  after numeric;
  sign int;
  orig public.account_transactions%ROWTYPE;
  effective_date date := coalesce(_transaction_date, (now() AT TIME ZONE 'UTC')::date);
BEGIN
  SELECT id INTO existing FROM public.account_transactions WHERE idempotency_key = _idempotency_key;
  IF existing IS NOT NULL THEN RETURN existing; END IF;
  IF _type NOT IN ('CREDIT','DEBIT') THEN RAISE EXCEPTION 'INVALID_TYPE'; END IF;
  IF _amount IS NULL OR _amount <= 0 OR _amount <> round(_amount, 2) OR _amount > 1000000000 THEN RAISE EXCEPTION 'INVALID_AMOUNT'; END IF;
  IF _reverses IS NOT NULL THEN
    SELECT * INTO orig FROM public.account_transactions WHERE id = _reverses FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
    IF orig.status <> 'COMPLETED' OR orig.reverses_id IS NOT NULL THEN RAISE EXCEPTION 'NOT_REVERSIBLE'; END IF;
  END IF;
  SELECT * INTO acct FROM public.bank_accounts WHERE id = _account_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'ACCOUNT_NOT_FOUND'; END IF;
  IF upper(_currency) <> acct.currency THEN RAISE EXCEPTION 'CURRENCY_MISMATCH'; END IF;
  sign := CASE WHEN _type = 'CREDIT' THEN 1 ELSE -1 END;
  before := acct.available_balance;
  after := before + sign * _amount;
  IF after < 0 AND NOT acct.allow_overdraft AND _reverses IS NULL THEN RAISE EXCEPTION 'INSUFFICIENT_FUNDS'; END IF;
  INSERT INTO public.account_transactions (
    account_id, user_id, txn_type, amount, currency, balance_before, balance_after,
    description, admin_name, reference, idempotency_key, reverses_id, reversal_reason, transaction_date
  ) VALUES (
    acct.id, acct.user_id, _type, _amount, acct.currency, before, after, _description,
    _admin, nullif(_reference,''), _idempotency_key, _reverses, _reversal_reason, effective_date
  ) RETURNING id INTO new_id;
  UPDATE public.bank_accounts SET available_balance = after,
    current_balance = current_balance + (CASE WHEN account_type = 'credit' THEN -sign ELSE sign END) * _amount
    WHERE id = acct.id;
  IF _reverses IS NOT NULL THEN
    UPDATE public.account_transactions SET status = 'REVERSED', reversed_by_id = new_id, reversal_reason = _reversal_reason, reversed_at = now() WHERE id = _reverses;
  END IF;
  INSERT INTO public.admin_audit_log (admin_id, target_user_id, action, details) VALUES (
    '00000000-0000-0000-0000-000000000000', acct.user_id,
    CASE WHEN _reverses IS NOT NULL THEN 'reverse_transaction' ELSE lower(_type) END,
    jsonb_build_object(
      'by', _admin, 'transaction_id', new_id, 'account_id', acct.id, 'amount', _amount,
      'currency', acct.currency, 'balance_before', before, 'balance_after', after,
      'reason', _description, 'reference', _reference, 'reverses', _reverses,
      'transaction_date', effective_date, 'entered_at', now()
    )
  );
  RETURN new_id;
END $$;

REVOKE ALL ON FUNCTION public.admin_post_transaction(uuid,text,numeric,text,text,text,text,text,uuid,text,date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_post_transaction(uuid,text,numeric,text,text,text,text,text,uuid,text,date) TO service_role;