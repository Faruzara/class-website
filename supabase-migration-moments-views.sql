-- Run AFTER supabase-migration-moments.sql AND
-- supabase-migration-moments-captured-at.sql. Safe to run again.
BEGIN;

CREATE TABLE IF NOT EXISTS public.moment_views (
  moment_id UUID NOT NULL REFERENCES public.moments(id) ON DELETE CASCADE,
  viewer_id UUID NOT NULL,
  viewed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (moment_id, viewer_id)
);
CREATE INDEX IF NOT EXISTS moment_views_viewer_moment
  ON public.moment_views (viewer_id, moment_id);
ALTER TABLE public.moment_views ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.moment_views FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON public.moment_views TO service_role;

-- Anonymous UUID is only a tracking identifier, never an editor credential.
-- Only the existing server service-role client may call these functions.
CREATE OR REPLACE FUNCTION public.list_unviewed_moments(p_viewer_id UUID, p_limit INTEGER DEFAULT NULL)
RETURNS SETOF public.moments LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
  SELECT m.* FROM public.moments m
  WHERE m.status = 'published' AND m.expires_at > now()
    AND NOT EXISTS (
      SELECT 1 FROM public.moment_views v
      WHERE v.moment_id = m.id AND v.viewer_id = p_viewer_id
    )
  ORDER BY COALESCE(m.captured_at, m.created_at) ASC, m.id ASC
  LIMIT p_limit;
$$;

-- Called only AFTER the browser has decoded and displayed the original.
-- Idempotent acknowledgement; retries/parallel requests cannot duplicate a view.
CREATE OR REPLACE FUNCTION public.mark_moment_viewed(p_moment_id UUID, p_viewer_id UUID)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.moment_views WHERE moment_id = p_moment_id AND viewer_id = p_viewer_id) THEN
    RETURN TRUE;
  END IF;
  INSERT INTO public.moment_views (moment_id, viewer_id)
  SELECT id, p_viewer_id FROM public.moments
  WHERE id = p_moment_id AND status = 'published' AND expires_at > now()
  ON CONFLICT (moment_id, viewer_id) DO NOTHING;
  RETURN EXISTS (SELECT 1 FROM public.moment_views WHERE moment_id = p_moment_id AND viewer_id = p_viewer_id);
END;
$$;
REVOKE ALL ON FUNCTION public.list_unviewed_moments(UUID, INTEGER) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mark_moment_viewed(UUID, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.list_unviewed_moments(UUID, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION public.mark_moment_viewed(UUID, UUID) TO service_role;
NOTIFY pgrst, 'reload schema';
COMMIT;
