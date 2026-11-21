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

COMMENT ON FUNCTION public.protect_ledger() IS 'Protects financial ledger fields and entry timestamps. transaction_date may be corrected through the audited admin function.';

CREATE OR REPLACE FUNCTION public.admin_edit_transaction_date(
  _transaction_id uuid,
  _transaction_date date,
  _reason text,
  _admin text
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_user uuid;
  previous_date date;
BEGIN
  IF _transaction_date IS NULL THEN RAISE EXCEPTION 'INVALID_TRANSACTION_DATE'; END IF;
  IF _reason IS NULL OR char_length(trim(_reason)) < 3 OR char_length(trim(_reason)) > 300 THEN
    RAISE EXCEPTION 'INVALID_REASON';
  END IF;

  SELECT user_id, transaction_date
  INTO target_user, previous_date
  FROM public.account_transactions
  WHERE id = _transaction_id
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;

  UPDATE public.account_transactions
  SET transaction_date = _transaction_date
  WHERE id = _transaction_id;

  INSERT INTO public.admin_audit_log (admin_id, target_user_id, action, details)
  VALUES (
    '00000000-0000-0000-0000-000000000000',
    target_user,
    'edit_transaction_date',
    jsonb_build_object(
      'by', _admin,
      'transaction_id', _transaction_id,
      'previous_date', previous_date,
      'transaction_date', _transaction_date,
      'reason', trim(_reason),
      'entered_at', now()
    )
  );

  RETURN _transaction_id;
END $$;

REVOKE ALL ON FUNCTION public.admin_edit_transaction_date(uuid,date,text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_edit_transaction_date(uuid,date,text,text) TO service_role;

COMMENT ON FUNCTION public.admin_edit_transaction_date(uuid,date,text,text) IS 'Corrects only a transaction calendar date and writes an immutable administrative audit record.';