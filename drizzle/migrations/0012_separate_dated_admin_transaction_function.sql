ALTER FUNCTION public.admin_post_transaction(uuid,text,numeric,text,text,text,text,text,uuid,text,date) RENAME TO admin_post_transaction_with_date;

COMMENT ON FUNCTION public.admin_post_transaction_with_date(uuid,text,numeric,text,text,text,text,text,uuid,text,date) IS 'Posts an immutable ledger entry with an admin-selected transaction date while created_at retains the actual entry time.';