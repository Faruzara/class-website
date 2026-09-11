-- Phase 3: sumber pengumuman dan feedback publik.
-- Jalankan satu kali di Supabase SQL Editor.

ALTER TABLE pengumuman
  ADD COLUMN IF NOT EXISTS announcement_type TEXT NOT NULL DEFAULT 'admin';

ALTER TABLE pengumuman
  DROP CONSTRAINT IF EXISTS pengumuman_announcement_type_check;

ALTER TABLE pengumuman
  ADD CONSTRAINT pengumuman_announcement_type_check
  CHECK (announcement_type IN ('admin', 'system'));

CREATE TABLE IF NOT EXISTS feedback_submissions (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  type        TEXT NOT NULL CHECK (type IN ('bug', 'feature')),
  message     TEXT NOT NULL CHECK (char_length(message) BETWEEN 10 AND 1000),
  page_path   TEXT,
  status      TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'reviewed', 'resolved')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS feedback_submissions_status_created_idx
  ON feedback_submissions (status, created_at DESC);

ALTER TABLE feedback_submissions ENABLE ROW LEVEL SECURITY;

-- Tidak ada policy publik. Pengiriman dan pengelolaan selalu melewati API server.
