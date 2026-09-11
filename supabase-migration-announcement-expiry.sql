-- Expiring public announcements and configurable pinned duration.
-- Run once in Supabase SQL Editor.

ALTER TABLE pengumuman ADD COLUMN IF NOT EXISTS pinned_until TIMESTAMPTZ;

-- Give existing pinned announcements a migration grace period.
UPDATE pengumuman
SET pinned_until = NOW() + INTERVAL '7 days'
WHERE is_pinned = TRUE AND pinned_until IS NULL;

CREATE INDEX IF NOT EXISTS pengumuman_public_expiry_idx
  ON pengumuman (is_pinned, pinned_until, created_at DESC);
