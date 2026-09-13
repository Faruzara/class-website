-- Read-only migration audit. This query does not alter schema or data.
-- Run it in Supabase SQL Editor and inspect rows whose status is MISSING.

WITH checks(sequence, migration_file, requirement, installed) AS (
  VALUES
    (1, 'supabase-migration-v2.sql', 'admin_slots.key_ciphertext', EXISTS (
      SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'admin_slots' AND column_name = 'key_ciphertext'
    )),
    (1, 'supabase-migration-v2.sql', 'temp_keys.key_ciphertext', EXISTS (
      SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'temp_keys' AND column_name = 'key_ciphertext'
    )),
    (1, 'supabase-migration-v2.sql', 'anggota image positioning', NOT EXISTS (
      SELECT 1 FROM (VALUES ('object_fit'), ('object_position_x'), ('object_position_y')) AS expected(column_name)
      WHERE NOT EXISTS (
        SELECT 1 FROM information_schema.columns c
        WHERE c.table_schema = 'public' AND c.table_name = 'anggota' AND c.column_name = expected.column_name
      )
    )),
    (1, 'supabase-migration-v2.sql', 'site_settings table', to_regclass('public.site_settings') IS NOT NULL),
    (1, 'supabase-migration-v2.sql', 'jadwal period columns', NOT EXISTS (
      SELECT 1 FROM (VALUES ('subject'), ('day'), ('week'), ('room'), ('start_period'), ('end_period')) AS expected(column_name)
      WHERE NOT EXISTS (
        SELECT 1 FROM information_schema.columns c
        WHERE c.table_schema = 'public' AND c.table_name = 'jadwal' AND c.column_name = expected.column_name
      )
    )),
    (1, 'supabase-migration-v2.sql', 'web-kelas storage bucket', EXISTS (
      SELECT 1 FROM storage.buckets WHERE id = 'web-kelas' AND public = TRUE
    )),

    (2, 'supabase-migration-access-control.sql', 'temp_keys access columns', NOT EXISTS (
      SELECT 1 FROM (VALUES ('created_by_role'), ('permissions'), ('revoked_at'), ('revoked_by'), ('revoked_reason'), ('activation_expires_at')) AS expected(column_name)
      WHERE NOT EXISTS (
        SELECT 1 FROM information_schema.columns c
        WHERE c.table_schema = 'public' AND c.table_name = 'temp_keys' AND c.column_name = expected.column_name
      )
    )),
    (2, 'supabase-migration-access-control.sql', 'access_sessions table', to_regclass('public.access_sessions') IS NOT NULL),
    (2, 'supabase-migration-access-control.sql', 'access_sessions indexes',
      to_regclass('public.access_sessions_active_idx') IS NOT NULL
      AND to_regclass('public.access_sessions_slot_idx') IS NOT NULL
      AND to_regclass('public.access_sessions_temp_idx') IS NOT NULL
    ),

    (3, 'supabase-migration-login-audit.sql', 'activity_logs audit columns', NOT EXISTS (
      SELECT 1 FROM (VALUES ('device_label'), ('user_agent'), ('event_status'), ('session_id')) AS expected(column_name)
      WHERE NOT EXISTS (
        SELECT 1 FROM information_schema.columns c
        WHERE c.table_schema = 'public' AND c.table_name = 'activity_logs' AND c.column_name = expected.column_name
      )
    )),
    (3, 'supabase-migration-login-audit.sql', 'login security index', to_regclass('public.activity_logs_login_security_idx') IS NOT NULL),

    (4, 'supabase-migration-notifications-feedback.sql', 'pengumuman.announcement_type', EXISTS (
      SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'pengumuman' AND column_name = 'announcement_type'
    )),
    (4, 'supabase-migration-notifications-feedback.sql', 'feedback_submissions table', to_regclass('public.feedback_submissions') IS NOT NULL),

    (5, 'supabase-migration-announcement-expiry.sql', 'pengumuman.pinned_until', EXISTS (
      SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'pengumuman' AND column_name = 'pinned_until'
    )),
    (5, 'supabase-migration-announcement-expiry.sql', 'announcement expiry index', to_regclass('public.pengumuman_public_expiry_idx') IS NOT NULL),

    (6, 'supabase-migration-gallery-focus.sql', 'gallery positioning columns', NOT EXISTS (
      SELECT 1 FROM (VALUES ('object_position_x'), ('object_position_y')) AS expected(column_name)
      WHERE NOT EXISTS (
        SELECT 1 FROM information_schema.columns c
        WHERE c.table_schema = 'public' AND c.table_name = 'galeri' AND c.column_name = expected.column_name
      )
    )),
    (7, 'supabase-migration-instagram-card.sql', 'site_settings.instagram_image_url', EXISTS (
      SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'site_settings' AND column_name = 'instagram_image_url'
    )),
    (8, 'supabase-migration-tiktok-card.sql', 'site_settings.tiktok_image_url', EXISTS (
      SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'site_settings' AND column_name = 'tiktok_image_url'
    )),
    (9, 'supabase-migration-hero-image-lock.sql', 'site_settings.hero_image_locked', EXISTS (
      SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'site_settings' AND column_name = 'hero_image_locked'
    )),
    (10, 'supabase-migration-per-image-locks.sql', 'per-image lock columns', NOT EXISTS (
      SELECT 1 FROM (VALUES
        ('anggota', 'foto_locked'),
        ('galeri', 'is_locked'),
        ('site_settings', 'instagram_image_locked'),
        ('site_settings', 'tiktok_image_locked')
      ) AS expected(table_name, column_name)
      WHERE NOT EXISTS (
        SELECT 1 FROM information_schema.columns c
        WHERE c.table_schema = 'public' AND c.table_name = expected.table_name AND c.column_name = expected.column_name
      )
    )),

    (11, 'supabase-migration-moments.sql', 'moments table', to_regclass('public.moments') IS NOT NULL),
    (11, 'supabase-migration-moments.sql', 'moments lifetime trigger', EXISTS (
      SELECT 1
      FROM pg_trigger t
      JOIN pg_class c ON c.oid = t.tgrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relname = 'moments' AND t.tgname = 'moments_lifetime' AND NOT t.tgisinternal
    )),
    (11, 'supabase-migration-moments.sql', 'moments functions',
      to_regprocedure('public.set_moment_lifetime()') IS NOT NULL
      AND to_regprocedure('public.list_moments(boolean)') IS NOT NULL
    ),
    (11, 'supabase-migration-moments.sql', 'private moments bucket', EXISTS (
      SELECT 1 FROM storage.buckets
      WHERE id = 'moments' AND public = FALSE AND file_size_limit = 5242880
        AND allowed_mime_types @> ARRAY['image/jpeg']::text[]
    )),
    (11, 'supabase-migration-moments.sql', 'restrictive moments storage policy', EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'storage' AND tablename = 'objects'
        AND policyname IN ('moments private server only', 'project media server only')
    )),

    (12, 'supabase-migration-moments-captured-at.sql', 'moments.captured_at', EXISTS (
      SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'moments' AND column_name = 'captured_at'
    )),

    (13, 'supabase-migration-moments-views.sql', 'moment_views table', to_regclass('public.moment_views') IS NOT NULL),
    (13, 'supabase-migration-moments-views.sql', 'moment view functions',
      to_regprocedure('public.list_unviewed_moments(uuid,integer)') IS NOT NULL
      AND to_regprocedure('public.mark_moment_viewed(uuid,uuid)') IS NOT NULL
    ),

    (14, 'supabase-migration-rls-hardening.sql', 'all application tables force RLS', NOT EXISTS (
      SELECT 1
      FROM unnest(ARRAY[
        'admin_slots', 'temp_keys', 'access_sessions', 'activity_logs',
        'feedback_submissions', 'moments', 'moment_views', 'pengumuman',
        'jadwal', 'anggota', 'galeri', 'site_settings'
      ]) AS expected(table_name)
      LEFT JOIN pg_class c ON c.oid = to_regclass(format('public.%I', expected.table_name))
      WHERE c.oid IS NULL OR NOT c.relrowsecurity OR NOT c.relforcerowsecurity
    )),
    (14, 'supabase-migration-rls-hardening.sql', 'sensitive tables deny client roles', NOT EXISTS (
      SELECT 1
      FROM unnest(ARRAY[
        'admin_slots', 'temp_keys', 'access_sessions', 'activity_logs',
        'feedback_submissions', 'moments', 'moment_views'
      ]) AS expected(table_name)
      WHERE has_table_privilege('anon', format('public.%I', expected.table_name), 'SELECT,INSERT,UPDATE,DELETE')
         OR has_table_privilege('authenticated', format('public.%I', expected.table_name), 'SELECT,INSERT,UPDATE,DELETE')
    )),
    (14, 'supabase-migration-rls-hardening.sql', 'public content is read-only', NOT EXISTS (
      SELECT 1
      FROM unnest(ARRAY['pengumuman', 'jadwal', 'anggota', 'galeri', 'site_settings']) AS expected(table_name)
      WHERE NOT has_table_privilege('anon', format('public.%I', expected.table_name), 'SELECT')
         OR has_table_privilege('anon', format('public.%I', expected.table_name), 'INSERT,UPDATE,DELETE')
         OR has_table_privilege('authenticated', format('public.%I', expected.table_name), 'INSERT,UPDATE,DELETE')
    )),
    (14, 'supabase-migration-rls-hardening.sql', 'moment RPCs are server-only', NOT EXISTS (
      SELECT 1
      FROM unnest(ARRAY[
        'public.set_moment_lifetime()',
        'public.list_moments(boolean)',
        'public.list_unviewed_moments(uuid,integer)',
        'public.mark_moment_viewed(uuid,uuid)'
      ]) AS expected(signature)
      WHERE has_function_privilege('anon', expected.signature, 'EXECUTE')
         OR has_function_privilege('authenticated', expected.signature, 'EXECUTE')
         OR NOT has_function_privilege('service_role', expected.signature, 'EXECUTE')
    )),
    (14, 'supabase-migration-rls-hardening.sql', 'project storage is server-write-only', EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'storage' AND tablename = 'objects'
        AND policyname = 'project media server only'
    )),

    (15, 'supabase-migration-schedule-color.sql', 'jadwal.color_override', EXISTS (
      SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'jadwal' AND column_name = 'color_override'
    ))
), summary AS (
  SELECT
    sequence,
    migration_file,
    bool_and(installed) AS complete,
    string_agg(requirement, ', ' ORDER BY requirement) FILTER (WHERE NOT installed) AS missing
  FROM checks
  GROUP BY sequence, migration_file
)
SELECT
  migration_file,
  CASE WHEN complete THEN 'OK' ELSE 'MISSING' END AS status,
  COALESCE(missing, '-') AS missing_requirements
FROM summary
ORDER BY sequence;
