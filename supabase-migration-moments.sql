-- Moments only. Run separately in Supabase SQL Editor after existing migrations.
BEGIN;

CREATE TABLE IF NOT EXISTS public.moments (
  id UUID PRIMARY KEY,
  image_path TEXT NOT NULL UNIQUE,
  preview_path TEXT NOT NULL UNIQUE,
  width INTEGER NOT NULL CHECK (width BETWEEN 1 AND 1920),
  height INTEGER NOT NULL CHECK (height BETWEEN 1 AND 1920),
  orientation TEXT NOT NULL CHECK (orientation IN ('portrait', 'landscape', 'square')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'published', 'failed', 'deleting')),
  created_by_role TEXT NOT NULL CHECK (created_by_role IN ('owner', 'admin', 'temp_admin')),
  created_by_label TEXT NOT NULL,
  created_by_ref TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '24 hours'),
  CHECK (image_path = 'moments/' || id::text || '/original.jpg'),
  CHECK (preview_path = 'moments/' || id::text || '/preview.jpg'),
  CHECK (expires_at = created_at + INTERVAL '24 hours'),
  CHECK (orientation = CASE WHEN width > height THEN 'landscape' WHEN height > width THEN 'portrait' ELSE 'square' END)
);

-- Publication starts the 24-hour lifetime, not the browser's clock/upload start.
CREATE OR REPLACE FUNCTION public.set_moment_lifetime()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.created_at := now();
  ELSIF NEW.status = 'published' AND OLD.status = 'pending' THEN
    NEW.created_at := now();
  ELSE
    NEW.created_at := OLD.created_at;
  END IF;
  NEW.expires_at := NEW.created_at + INTERVAL '24 hours';
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS moments_lifetime ON public.moments;
CREATE TRIGGER moments_lifetime BEFORE INSERT OR UPDATE ON public.moments
FOR EACH ROW EXECUTE FUNCTION public.set_moment_lifetime();

CREATE INDEX IF NOT EXISTS moments_active_expiry ON public.moments (expires_at DESC) WHERE status = 'published';
ALTER TABLE public.moments ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.moments FROM anon, authenticated;
GRANT ALL ON public.moments TO service_role;

-- Only server-side service_role can call this. Public responses are mapped DTOs.
-- Failed/interrupted uploads remain traceable for Owner cleanup, never public.
CREATE OR REPLACE FUNCTION public.list_moments(p_manage BOOLEAN DEFAULT FALSE)
RETURNS SETOF public.moments LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
  SELECT * FROM public.moments
  WHERE (status = 'published' AND expires_at > now())
     OR (p_manage AND (status IN ('failed', 'deleting') OR (status = 'pending' AND created_at < now() - INTERVAL '2 minutes')))
  ORDER BY created_at DESC, id;
$$;
REVOKE ALL ON FUNCTION public.set_moment_lifetime() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.list_moments(BOOLEAN) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.set_moment_lifetime() TO service_role;
GRANT EXECUTE ON FUNCTION public.list_moments(BOOLEAN) TO service_role;

-- Never put original Moments in the existing public web-kelas bucket.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('moments', 'moments', FALSE, 5242880, ARRAY['image/jpeg'])
ON CONFLICT (id) DO UPDATE SET public = FALSE, file_size_limit = 5242880, allowed_mime_types = ARRAY['image/jpeg'];
-- No anon/authenticated storage policies: only server service_role accesses it.
-- A restrictive guard also blocks accidental broad policies from other buckets.
DROP POLICY IF EXISTS "moments private server only" ON storage.objects;
CREATE POLICY "moments private server only" ON storage.objects AS RESTRICTIVE
FOR ALL TO anon, authenticated
USING (bucket_id <> 'moments') WITH CHECK (bucket_id <> 'moments');
NOTIFY pgrst, 'reload schema';
COMMIT;
