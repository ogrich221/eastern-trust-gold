CREATE TABLE public.bank_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  account_type text NOT NULL CHECK (account_type IN ('checking','savings','credit','investment')),
  name text NOT NULL,
  last_four text NOT NULL,
  available_balance numeric(14,2) NOT NULL DEFAULT 0,
  current_balance numeric(14,2) NOT NULL DEFAULT 0,
  credit_limit numeric(14,2),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, account_type)
);
GRANT SELECT ON public.bank_accounts TO authenticated;
GRANT ALL ON public.bank_accounts TO service_role;
ALTER TABLE public.bank_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Customers can view their own accounts" ON public.bank_accounts FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.open_starter_accounts()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.bank_accounts (user_id, account_type, name, last_four, available_balance, current_balance, credit_limit) VALUES
    (NEW.id,'checking','Everyday Checking',lpad((floor(random()*10000))::int::text,4,'0'),0.00,0.00,NULL),
    (NEW.id,'credit','Gold Rewards Card',lpad((floor(random()*10000))::int::text,4,'0'),0.00,0.00,0.00)
  ON CONFLICT (user_id, account_type) DO UPDATE SET
    available_balance = 0.00,
    current_balance = 0.00;
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.open_starter_accounts() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER profiles_open_starter_accounts AFTER INSERT ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.open_starter_accounts();