DROP TRIGGER IF EXISTS profiles_grant_owner_admin ON public.profiles;
COMMENT ON FUNCTION public.grant_owner_admin() IS 'DEPRECATED: admin portal uses its own independent login';