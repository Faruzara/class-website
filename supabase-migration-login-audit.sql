-- Phase 5: structured login audit context for the Owner Activity Log.
-- Run once in Supabase SQL Editor. Existing app versions remain compatible.

ALTER TABLE activity_logs ADD COLUMN IF NOT EXISTS device_label TEXT;
ALTER TABLE activity_logs ADD COLUMN IF NOT EXISTS user_agent TEXT;
ALTER TABLE activity_logs ADD COLUMN IF NOT EXISTS event_status TEXT NOT NULL DEFAULT 'info';
ALTER TABLE activity_logs ADD COLUMN IF NOT EXISTS session_id UUID;

ALTER TABLE activity_logs DROP CONSTRAINT IF EXISTS activity_logs_event_status_check;
ALTER TABLE activity_logs ADD CONSTRAINT activity_logs_event_status_check
  CHECK (event_status IN ('success', 'failure', 'info'));

CREATE INDEX IF NOT EXISTS activity_logs_login_security_idx
  ON activity_logs (action, ip_address, created_at DESC);
