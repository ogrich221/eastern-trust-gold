ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_url text;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_avatar_url_len CHECK (avatar_url IS NULL OR length(avatar_url) <= 1000000);