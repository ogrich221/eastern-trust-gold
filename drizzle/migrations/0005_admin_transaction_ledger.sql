ALTER TABLE public.bank_accounts ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'USD';
ALTER TABLE public.bank_accounts ADD COLUMN IF NOT EXISTS allow_overdraft boolean NOT NULL DEFAULT false;

CREATE TABLE public.account_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL,
  user_id uuid NOT NULL,
  txn_type text NOT NULL CHECK (txn_type IN ('CREDIT','DEBIT')),
  amount numeric(18,2) NOT NULL CHECK (amount > 0),
  currency text NOT NULL,
  balance_before numeric(18,2) NOT NULL,
  balance_after numeric(18,2) NOT NULL,
  description text NOT NULL CHECK (length(description) BETWEEN 3 AND 300),
  admin_name text NOT NULL,
  status text NOT NULL DEFAULT 'COMPLETED' CHECK (status IN ('PENDING','COMPLETED','FAILED','REVERSED')),
  reference text,
  idempotency_key text NOT NULL UNIQUE,
  reverses_id uuid REFERENCES public.account_transactions(id),
  reversed_by_id uuid REFERENCES public.account_transactions(id),
  reversal_reason text,
  reversed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX account_transactions_account_idx ON public.account_transactions (account_id, created_at DESC);
CREATE INDEX account_transactions_user_idx ON public.account_transactions (user_id, created_at DESC);
CREATE INDEX account_transactions_created_idx ON public.account_transactions (created_at DESC);
CREATE UNIQUE INDEX account_transactions_one_reversal ON public.account_transactions (reverses_id) WHERE reverses_id IS NOT NULL;

GRANT SELECT ON public.account_transactions TO authenticated;
GRANT ALL ON public.account_transactions TO service_role;
ALTER TABLE public.account_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Customers view own transactions" ON public.account_transactions FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- Immutability: only the reversal link fields may change, once, from COMPLETED to REVERSED. No deletes.
CREATE OR REPLACE FUNCTION public.protect_ledger() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'Ledger entries cannot be deleted'; END IF;
  IF OLD.status <> 'COMPLETED' OR NEW.status <> 'REVERSED' OR OLD.reversed_by_id IS NOT NULL
     OR NEW.amount <> OLD.amount OR NEW.account_id <> OLD.account_id OR NEW.txn_type <> OLD.txn_type
     OR NEW.balance_before <> OLD.balance_before OR NEW.balance_after <> OLD.balance_after
     OR NEW.description <> OLD.description OR NEW.admin_name <> OLD.admin_name OR NEW.created_at <> OLD.created_at
     OR NEW.currency <> OLD.currency OR NEW.idempotency_key <> OLD.idempotency_key THEN
    RAISE EXCEPTION 'Ledger entries are immutable';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER account_transactions_immutable BEFORE UPDATE OR DELETE ON public.account_transactions FOR EACH ROW EXECUTE FUNCTION public.protect_ledger();

CREATE OR REPLACE FUNCTION public.protect_audit() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN RAISE EXCEPTION 'Audit records cannot be changed'; END $$;
DROP TRIGGER IF EXISTS admin_audit_log_immutable ON public.admin_audit_log;
CREATE TRIGGER admin_audit_log_immutable BEFORE UPDATE OR DELETE ON public.admin_audit_log FOR EACH ROW EXECUTE FUNCTION public.protect_audit();

-- Atomic post: locks the account row, checks balance, writes ledger + balance + audit in one transaction.
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
    IF orig.status <> 'COMPLETED' OR orig.reverses_id IS NOT NULL THEN RAISE EXCEPTION 'NOT_REVERSIBLE'; END IF;
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
REVOKE ALL ON FUNCTION public.admin_post_transaction(uuid,text,numeric,text,text,text,text,text,uuid,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_post_transaction(uuid,text,numeric,text,text,text,text,text,uuid,text) TO service_role;