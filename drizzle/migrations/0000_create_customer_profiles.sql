CREATE TABLE public.profiles (
  id uuid PRIMARY KEY,
  first_name text NOT NULL CHECK (char_length(first_name) BETWEEN 1 AND 80),
  last_name text NOT NULL CHECK (char_length(last_name) BETWEEN 1 AND 80),
  phone text NOT NULL CHECK (char_length(phone) BETWEEN 7 AND 30),
  address text NOT NULL CHECK (char_length(address) BETWEEN 5 AND 240),
  city text NOT NULL CHECK (char_length(city) BETWEEN 1 AND 100),
  postal_code text NOT NULL CHECK (char_length(postal_code) BETWEEN 2 AND 20),
  security_question_one text NOT NULL CHECK (char_length(security_question_one) BETWEEN 5 AND 200),
  security_answer_one_hash text NOT NULL CHECK (char_length(security_answer_one_hash) = 64),
  security_question_two text NOT NULL CHECK (char_length(security_question_two) BETWEEN 5 AND 200),
  security_answer_two_hash text NOT NULL CHECK (char_length(security_answer_two_hash) = 64),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Customers can view their own profile" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "Customers can create their own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "Customers can update their own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE OR REPLACE FUNCTION public.set_profile_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;
CREATE TRIGGER profiles_set_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_profile_updated_at();