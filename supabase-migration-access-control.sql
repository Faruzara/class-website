-- Phase 2: role permissions and revocable device sessions.
-- Run once in Supabase SQL Editor before using Owner Temporary Access/Sessions.

ALTER TABLE admin_slots ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;
ALTER TABLE admin_slots ADD COLUMN IF NOT EXISTS activation_expires_at TIMESTAMPTZ;
ALTER TABLE temp_keys ADD COLUMN IF NOT EXISTS activation_expires_at TIMESTAMPTZ;
ALTER TABLE temp_keys ALTER COLUMN created_by_slot DROP NOT NULL;
ALTER TABLE temp_keys ADD COLUMN IF NOT EXISTS created_by_role TEXT NOT NULL DEFAULT 'admin';
ALTER TABLE temp_keys ADD COLUMN IF NOT EXISTS permissions TEXT[] NOT NULL DEFAULT ARRAY['homepage','schedule','members','gallery','moments']::TEXT[];
ALTER TABLE temp_keys ADD COLUMN IF NOT EXISTS revoked_at TIMESTAMPTZ;
ALTER TABLE temp_keys ADD COLUMN IF NOT EXISTS revoked_by TEXT;
ALTER TABLE temp_keys ADD COLUMN IF NOT EXISTS revoked_reason TEXT;

-- Permanent Admin slots no longer use expiry or activation deadlines.
UPDATE admin_slots SET expires_at = NULL, activation_expires_at = NULL WHERE key_hash IS NOT NULL;

ALTER TABLE temp_keys DROP CONSTRAINT IF EXISTS temp_keys_created_by_role_check;
ALTER TABLE temp_keys ADD CONSTRAINT temp_keys_created_by_role_check CHECK (created_by_role IN ('owner', 'admin'));
ALTER TABLE temp_keys DROP CONSTRAINT IF EXISTS temp_keys_permissions_check;
ALTER TABLE temp_keys ADD CONSTRAINT temp_keys_permissions_check CHECK (
  permissions <@ ARRAY['homepage','schedule','members','gallery','moments']::TEXT[]
  AND cardinality(permissions) > 0
);

CREATE TABLE IF NOT EXISTS access_sessions (
  id UUID PRIMARY KEY,
  role TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'temp_admin')),
  slot_id SMALLINT REFERENCES admin_slots(id) ON DELETE CASCADE,
  temp_key_id UUID REFERENCES temp_keys(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  permissions TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  device_label TEXT NOT NULL DEFAULT 'Unknown device',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  CHECK (
    (role = 'owner' AND slot_id IS NULL AND temp_key_id IS NULL)
    OR (role = 'admin' AND slot_id IS NOT NULL AND temp_key_id IS NULL)
    OR (role = 'temp_admin' AND slot_id IS NULL AND temp_key_id IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS access_sessions_active_idx
  ON access_sessions (revoked_at, expires_at, last_seen_at DESC);
CREATE INDEX IF NOT EXISTS access_sessions_slot_idx ON access_sessions (slot_id);
CREATE INDEX IF NOT EXISTS access_sessions_temp_idx ON access_sessions (temp_key_id);

ALTER TABLE access_sessions ENABLE ROW LEVEL SECURITY;
-- No public policies: all access goes through server-side service_role.
