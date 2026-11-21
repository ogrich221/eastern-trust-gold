CREATE OR REPLACE FUNCTION public.protect_ledger() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'Ledger entries cannot be deleted'; END IF;

  -- Only transaction_date and the established reversal metadata may ever differ.
  IF (to_jsonb(NEW) - 'transaction_date' - 'status' - 'reversed_by_id' - 'reversal_reason' - 'reversed_at')
     IS DISTINCT FROM
     (to_jsonb(OLD) - 'transaction_date' - 'status' - 'reversed_by_id' - 'reversal_reason' - 'reversed_at') THEN
    RAISE EXCEPTION 'Ledger entries are immutable';
  END IF;

  -- A same-status update may change only transaction_date; all reversal metadata must stay unchanged.
  IF NEW.status IS NOT DISTINCT FROM OLD.status
     AND NEW.reversed_by_id IS NOT DISTINCT FROM OLD.reversed_by_id
     AND NEW.reversal_reason IS NOT DISTINCT FROM OLD.reversal_reason
     AND NEW.reversed_at IS NOT DISTINCT FROM OLD.reversed_at THEN
    RETURN NEW;
  END IF;

  -- Otherwise, this must be the established one-way completed-to-reversed transition.
  IF OLD.status <> 'COMPLETED' OR NEW.status <> 'REVERSED' OR OLD.reversed_by_id IS NOT NULL THEN
    RAISE EXCEPTION 'Ledger entries are immutable';
  END IF;

  RETURN NEW;
END $$;

COMMENT ON FUNCTION public.protect_ledger() IS 'Protects every financial ledger field and entry timestamp. Allows audited same-status transaction_date corrections and established reversal metadata updates only.';