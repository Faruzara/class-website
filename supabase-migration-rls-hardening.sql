-- Final RLS hardening for every table used by the application.
-- Run after all existing migrations. Safe to run again.
BEGIN;

-- Reset application-table policies and privileges to a known baseline.
DO $hardening$
DECLARE
  table_name TEXT;
  policy_row RECORD;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'admin_slots',
    'temp_keys',
    'access_sessions',
    'activity_logs',
    'feedback_submissions',
    'moments',
    'moment_views',
    'pengumuman',
    'jadwal',
    'anggota',
    'galeri',
    'site_settings'
  ]
  LOOP
    IF to_regclass(format('public.%I', table_name)) IS NULL THEN
      RAISE EXCEPTION 'Required table public.% is missing. Run the earlier migrations first.', table_name;
    END IF;

    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY', table_name);
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM PUBLIC, anon, authenticated', table_name);
    EXECUTE format('GRANT ALL ON TABLE public.%I TO service_role', table_name);

    FOR policy_row IN
      SELECT policyname
      FROM pg_policies
      WHERE schemaname = 'public' AND tablename = table_name
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', policy_row.policyname, table_name);
    END LOOP;
  END LOOP;
END
$hardening$;

-- Public content is read-only. Expired announcements are hidden at the
-- database boundary too, instead of only being filtered by the interface.
GRANT SELECT ON public.pengumuman, public.jadwal, public.anggota,
  public.galeri, public.site_settings TO anon, authenticated;

CREATE POLICY "public read visible announcements"
  ON public.pengumuman
  FOR SELECT TO anon, authenticated
  USING (
    (is_pinned = TRUE AND (pinned_until IS NULL OR pinned_until > now()))
    OR
    (is_pinned = FALSE AND created_at > now() - INTERVAL '24 hours')
  );

CREATE POLICY "public read schedule"
  ON public.jadwal
  FOR SELECT TO anon, authenticated
  USING (TRUE);

CREATE POLICY "public read visible members"
  ON public.anggota
  FOR SELECT TO anon, authenticated
  USING (is_visible = TRUE);

CREATE POLICY "public read gallery"
  ON public.galeri
  FOR SELECT TO anon, authenticated
  USING (TRUE);

CREATE POLICY "public read site settings"
  ON public.site_settings
  FOR SELECT TO anon, authenticated
  USING (id = 1);

-- Moments RPCs are callable only through the server-side service-role client.
REVOKE ALL ON FUNCTION public.set_moment_lifetime() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.list_moments(BOOLEAN) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.list_unviewed_moments(UUID, INTEGER) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mark_moment_viewed(UUID, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.set_moment_lifetime() TO service_role;
GRANT EXECUTE ON FUNCTION public.list_moments(BOOLEAN) TO service_role;
GRANT EXECUTE ON FUNCTION public.list_unviewed_moments(UUID, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION public.mark_moment_viewed(UUID, UUID) TO service_role;

-- A restrictive policy wins even if an old permissive storage policy exists.
-- Public web-kelas files remain deliverable by their public URLs, while all
-- Storage API writes for both project buckets stay server-only.
DROP POLICY IF EXISTS "moments private server only" ON storage.objects;
DROP POLICY IF EXISTS "project media server only" ON storage.objects;
CREATE POLICY "project media server only"
  ON storage.objects AS RESTRICTIVE
  FOR ALL TO anon, authenticated
  USING (bucket_id NOT IN ('web-kelas', 'moments'))
  WITH CHECK (bucket_id NOT IN ('web-kelas', 'moments'));

-- Future tables/functions stay private until deliberately exposed.
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  REVOKE ALL ON TABLES FROM PUBLIC, anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC, anon, authenticated;

NOTIFY pgrst, 'reload schema';
COMMIT;

-- Verification: five rows should be PUBLIC_READ; all others SERVER_ONLY.
SELECT
  c.relname AS table_name,
  c.relrowsecurity AS rls_enabled,
  c.relforcerowsecurity AS rls_forced,
  CASE
    WHEN c.relname IN ('pengumuman', 'jadwal', 'anggota', 'galeri', 'site_settings')
      THEN 'PUBLIC_READ'
    ELSE 'SERVER_ONLY'
  END AS expected_access,
  COALESCE(string_agg(DISTINCT p.policyname, ', ' ORDER BY p.policyname), '-') AS policies,
  has_table_privilege('anon', format('public.%I', c.relname), 'SELECT') AS anon_can_select,
  has_table_privilege('anon', format('public.%I', c.relname), 'INSERT,UPDATE,DELETE') AS anon_can_write,
  has_table_privilege('authenticated', format('public.%I', c.relname), 'INSERT,UPDATE,DELETE') AS authenticated_can_write
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
LEFT JOIN pg_policies p ON p.schemaname = n.nspname AND p.tablename = c.relname
WHERE n.nspname = 'public'
  AND c.relkind = 'r'
  AND c.relname = ANY (ARRAY[
    'admin_slots', 'temp_keys', 'access_sessions', 'activity_logs',
    'feedback_submissions', 'moments', 'moment_views', 'pengumuman',
    'jadwal', 'anggota', 'galeri', 'site_settings'
  ])
GROUP BY c.relname, c.relrowsecurity, c.relforcerowsecurity
ORDER BY expected_access, c.relname;
