-- ============================================
-- SCHEMA DATABASE — jalankan di Supabase SQL Editor
-- ============================================

-- Ekstensi UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── ADMIN SLOTS ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS admin_slots (
  id           SMALLINT PRIMARY KEY,  -- hanya 1, 2, 3
  label        TEXT NOT NULL DEFAULT '',
  key_hash     TEXT,                  -- NULL = slot kosong
  key_ciphertext TEXT,                -- key asli terenkripsi, NULL setelah dipakai
  is_active    BOOLEAN NOT NULL DEFAULT FALSE,
  assigned_at  TIMESTAMPTZ,
  expires_at   TIMESTAMPTZ,
  activation_expires_at TIMESTAMPTZ,
  last_login   TIMESTAMPTZ
);

-- Isi 3 slot awal
INSERT INTO admin_slots (id, label) VALUES
  (1, 'Admin 1'),
  (2, 'Admin 2'),
  (3, 'Cadangan')
ON CONFLICT (id) DO NOTHING;

-- ── TEMP KEYS ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS temp_keys (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  key_hash         TEXT NOT NULL,
  key_ciphertext   TEXT,
  label            TEXT NOT NULL,          -- wajib: "untuk siapa"
  created_by_slot  SMALLINT REFERENCES admin_slots(id),
  created_by_role  TEXT NOT NULL DEFAULT 'admin' CHECK (created_by_role IN ('owner', 'admin')),
  permissions      TEXT[] NOT NULL DEFAULT ARRAY['homepage','schedule','members','gallery','moments']::TEXT[],
  expires_at       TIMESTAMPTZ NOT NULL,
  activation_expires_at TIMESTAMPTZ,
  is_used          BOOLEAN NOT NULL DEFAULT FALSE,
  session_token    TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_at       TIMESTAMPTZ,
  revoked_by       TEXT,
  revoked_reason   TEXT
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
  revoked_at TIMESTAMPTZ
);

-- ── ACTIVITY LOGS ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS activity_logs (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  actor_role   TEXT NOT NULL,             -- 'owner' | 'admin' | 'temp_admin'
  actor_label  TEXT NOT NULL,
  action       TEXT NOT NULL,
  detail       TEXT,
  ip_address   TEXT,
  device_label TEXT,
  user_agent   TEXT,
  event_status TEXT NOT NULL DEFAULT 'info' CHECK (event_status IN ('success', 'failure', 'info')),
  session_id   UUID,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── PENGUMUMAN ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pengumuman (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  judul       TEXT NOT NULL,
  konten      TEXT NOT NULL,
  kategori    TEXT NOT NULL DEFAULT 'umum',
  is_pinned   BOOLEAN NOT NULL DEFAULT FALSE,
  pinned_until TIMESTAMPTZ,
  announcement_type TEXT NOT NULL DEFAULT 'admin' CHECK (announcement_type IN ('admin', 'system')),
  created_by  TEXT NOT NULL DEFAULT '',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── FEEDBACK PUBLIK ───────────────────────────────────
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

-- ── JADWAL ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS jadwal (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  subject        TEXT NOT NULL,
  day            TEXT NOT NULL,
  week           SMALLINT NOT NULL CHECK (week IN (1, 2)),
  room           TEXT,
  start_period   SMALLINT NOT NULL CHECK (start_period > 0),
  end_period     SMALLINT NOT NULL CHECK (end_period >= start_period),
  color_override TEXT CHECK (color_override IS NULL OR color_override IN (
    'blue', 'lime', 'cyan', 'gray', 'sky', 'amber',
    'pink', 'purple', 'green', 'emerald', 'aqua', 'orange'
  )),
  UNIQUE (day, week, start_period, subject)
);

-- ── ANGGOTA ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS anggota (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nomor_absen   SMALLINT NOT NULL UNIQUE,
  nama          TEXT NOT NULL,
  jabatan       TEXT,
  foto_url      TEXT,
  object_fit    TEXT NOT NULL DEFAULT 'cover' CHECK (object_fit IN ('cover', 'contain')),
  object_position_x SMALLINT NOT NULL DEFAULT 50 CHECK (object_position_x BETWEEN 0 AND 100),
  object_position_y SMALLINT NOT NULL DEFAULT 50 CHECK (object_position_y BETWEEN 0 AND 100),
  foto_locked  BOOLEAN NOT NULL DEFAULT FALSE,
  is_visible    BOOLEAN NOT NULL DEFAULT TRUE
);

-- ── GALERI ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS galeri (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  judul          TEXT NOT NULL,
  deskripsi      TEXT,
  foto_url       TEXT NOT NULL,
  thumbnail_url  TEXT,
  object_position_x NUMERIC(5,2) NOT NULL DEFAULT 50 CHECK (object_position_x BETWEEN 0 AND 100),
  object_position_y NUMERIC(5,2) NOT NULL DEFAULT 50 CHECK (object_position_y BETWEEN 0 AND 100),
  kategori       TEXT,
  urutan         SMALLINT NOT NULL DEFAULT 0,
  is_locked      BOOLEAN NOT NULL DEFAULT FALSE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── SITE SETTINGS ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS site_settings (
  id                SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  hero_image_url    TEXT,
  hero_object_fit   TEXT NOT NULL DEFAULT 'cover' CHECK (hero_object_fit IN ('cover', 'contain')),
  hero_object_position_x SMALLINT NOT NULL DEFAULT 50 CHECK (hero_object_position_x BETWEEN 0 AND 100),
  hero_object_position_y SMALLINT NOT NULL DEFAULT 50 CHECK (hero_object_position_y BETWEEN 0 AND 100),
  hero_image_locked BOOLEAN NOT NULL DEFAULT FALSE,
  about_text        TEXT NOT NULL DEFAULT 'Kelas yang tumbuh lewat ketelitian, kerja sama, dan semangat belajar di bidang teknik pemesinan.',
  instagram_url     TEXT,
  instagram_image_locked BOOLEAN NOT NULL DEFAULT FALSE,
  tiktok_url        TEXT,
  tiktok_image_locked BOOLEAN NOT NULL DEFAULT FALSE,
  creator_github_url TEXT,
  schedule_week_offset SMALLINT NOT NULL DEFAULT 0 CHECK (schedule_week_offset IN (0, 1)),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO site_settings (id) VALUES (1)
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- Publik hanya bisa baca; tulis hanya via service_role
-- ============================================
ALTER TABLE pengumuman   ENABLE ROW LEVEL SECURITY;
ALTER TABLE jadwal        ENABLE ROW LEVEL SECURITY;
ALTER TABLE anggota       ENABLE ROW LEVEL SECURITY;
ALTER TABLE galeri        ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_slots   ENABLE ROW LEVEL SECURITY;
ALTER TABLE temp_keys     ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE access_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE site_settings  ENABLE ROW LEVEL SECURITY;
ALTER TABLE feedback_submissions ENABLE ROW LEVEL SECURITY;

-- Publik: hanya SELECT di tabel konten
CREATE POLICY "publik baca pengumuman"   ON pengumuman   FOR SELECT USING (TRUE);
CREATE POLICY "publik baca jadwal"        ON jadwal        FOR SELECT USING (TRUE);
CREATE POLICY "publik baca anggota"       ON anggota       FOR SELECT USING (is_visible = TRUE);
CREATE POLICY "publik baca galeri"        ON galeri        FOR SELECT USING (TRUE);
CREATE POLICY "publik baca site settings" ON site_settings FOR SELECT USING (TRUE);

-- Semua operasi write hanya lewat service_role (tidak ada policy publik untuk write)
