CREATE OR REPLACE FUNCTION public.grant_owner_admin()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM auth.users WHERE id = NEW.id AND lower(email) = 'ogrichindeed@gmail.com' AND email_confirmed_at IS NOT NULL) THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin') ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.grant_owner_admin() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER profiles_grant_owner_admin AFTER INSERT ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.grant_owner_admin();