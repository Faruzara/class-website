-- Run AFTER supabase-migration-moments.sql. Safe to run again.
BEGIN;
ALTER TABLE public.moments ADD COLUMN IF NOT EXISTS captured_at TIMESTAMPTZ;
-- Existing photographs have no reliable shutter timestamp: leave NULL.
-- The UI uses their existing created_at (publish time) as a legacy fallback.
-- Do not alter created_at/expires_at or the existing 24-hour lifetime trigger.
NOTIFY pgrst, 'reload schema';
COMMIT;
