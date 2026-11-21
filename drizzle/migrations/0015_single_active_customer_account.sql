ALTER TABLE public.bank_accounts ADD COLUMN is_active boolean NOT NULL DEFAULT true;
WITH ranked AS (SELECT id, row_number() OVER (PARTITION BY user_id ORDER BY CASE WHEN account_type='checking' THEN 0 ELSE 1 END, created_at,id) pos FROM public.bank_accounts) UPDATE public.bank_accounts a SET is_active=false FROM ranked r WHERE a.id=r.id AND (r.pos>1 OR a.account_type<>'checking');
CREATE UNIQUE INDEX bank_accounts_one_active_per_customer ON public.bank_accounts(user_id) WHERE is_active;
ALTER TABLE public.bank_accounts ADD CONSTRAINT active_account_is_checking CHECK (NOT is_active OR account_type='checking');
COMMENT ON COLUMN public.bank_accounts.is_active IS 'Only one active checking account per customer; inactive accounts retain historical balances and ledger references.';
CREATE OR REPLACE FUNCTION public.open_starter_accounts() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN
INSERT INTO public.bank_accounts(user_id,account_type,name,last_four,available_balance,current_balance,credit_limit,currency) VALUES(NEW.id,'checking','Everyday Checking',lpad((floor(random()*10000))::int::text,4,'0'),0,0,NULL,'USD') ON CONFLICT DO NOTHING;
RETURN NEW; END $$;
CREATE OR REPLACE FUNCTION public.require_active_transaction_account() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$ BEGIN
PERFORM id FROM public.bank_accounts WHERE id=NEW.account_id AND user_id=NEW.user_id AND is_active FOR UPDATE;
IF NOT FOUND THEN RAISE EXCEPTION 'ACCOUNT_ARCHIVED: Use the customer''s remaining checking account.'; END IF;
RETURN NEW; END $$;
CREATE TRIGGER require_active_transaction_account BEFORE INSERT ON public.account_transactions FOR EACH ROW EXECUTE FUNCTION public.require_active_transaction_account();
CREATE OR REPLACE FUNCTION public.protect_archived_account_balance() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$ BEGIN
IF NOT OLD.is_active AND (NEW.available_balance IS DISTINCT FROM OLD.available_balance OR NEW.current_balance IS DISTINCT FROM OLD.current_balance OR NEW.currency IS DISTINCT FROM OLD.currency OR NEW.user_id IS DISTINCT FROM OLD.user_id) THEN RAISE EXCEPTION 'ACCOUNT_ARCHIVED: Archived financial records cannot be modified.'; END IF;
RETURN NEW; END $$;
CREATE TRIGGER protect_archived_account_balance BEFORE UPDATE ON public.bank_accounts FOR EACH ROW EXECUTE FUNCTION public.protect_archived_account_balance();