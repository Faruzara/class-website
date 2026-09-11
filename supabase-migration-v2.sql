-- Jalankan sekali di Supabase SQL Editor untuk upgrade schema existing.

-- Simpan generated key secara terenkripsi agar dapat ditampilkan kembali
-- sampai dipakai, direvoke, atau expired.
ALTER TABLE admin_slots ADD COLUMN IF NOT EXISTS key_ciphertext TEXT;
ALTER TABLE temp_keys ADD COLUMN IF NOT EXISTS key_ciphertext TEXT;
ALTER TABLE admin_slots ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;
ALTER TABLE admin_slots ADD COLUMN IF NOT EXISTS activation_expires_at TIMESTAMPTZ;
ALTER TABLE temp_keys ADD COLUMN IF NOT EXISTS activation_expires_at TIMESTAMPTZ;
UPDATE admin_slots SET activation_expires_at = LEAST(COALESCE(expires_at, assigned_at + INTERVAL '5 minutes'), assigned_at + INTERVAL '5 minutes') WHERE activation_expires_at IS NULL AND key_hash IS NOT NULL AND last_login IS NULL AND assigned_at IS NOT NULL;
UPDATE temp_keys SET activation_expires_at = LEAST(expires_at, created_at + INTERVAL '5 minutes') WHERE activation_expires_at IS NULL AND is_used = FALSE;

ALTER TABLE anggota ADD COLUMN IF NOT EXISTS object_fit TEXT NOT NULL DEFAULT 'cover';
ALTER TABLE anggota ADD COLUMN IF NOT EXISTS object_position_x SMALLINT NOT NULL DEFAULT 50;
ALTER TABLE anggota ADD COLUMN IF NOT EXISTS object_position_y SMALLINT NOT NULL DEFAULT 50;
ALTER TABLE anggota DROP CONSTRAINT IF EXISTS anggota_object_fit_check;
ALTER TABLE anggota ADD CONSTRAINT anggota_object_fit_check CHECK (object_fit IN ('cover', 'contain'));
ALTER TABLE anggota DROP CONSTRAINT IF EXISTS anggota_object_position_x_check;
ALTER TABLE anggota ADD CONSTRAINT anggota_object_position_x_check CHECK (object_position_x BETWEEN 0 AND 100);
ALTER TABLE anggota DROP CONSTRAINT IF EXISTS anggota_object_position_y_check;
ALTER TABLE anggota ADD CONSTRAINT anggota_object_position_y_check CHECK (object_position_y BETWEEN 0 AND 100);

-- Homepage dan social settings (singleton row).
CREATE TABLE IF NOT EXISTS site_settings (
  id                SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  hero_image_url    TEXT,
  about_text        TEXT NOT NULL DEFAULT 'Kelas yang tumbuh lewat ketelitian, kerja sama, dan semangat belajar di bidang teknik pemesinan.',
  instagram_url     TEXT,
  tiktok_url        TEXT,
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
INSERT INTO site_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS hero_object_fit TEXT NOT NULL DEFAULT 'cover';
ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS creator_github_url TEXT;
ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS hero_object_position_x SMALLINT NOT NULL DEFAULT 50;
ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS hero_object_position_y SMALLINT NOT NULL DEFAULT 50;
ALTER TABLE site_settings DROP CONSTRAINT IF EXISTS site_settings_hero_object_fit_check;
ALTER TABLE site_settings ADD CONSTRAINT site_settings_hero_object_fit_check CHECK (hero_object_fit IN ('cover', 'contain'));
ALTER TABLE site_settings DROP CONSTRAINT IF EXISTS site_settings_hero_position_x_check;
ALTER TABLE site_settings ADD CONSTRAINT site_settings_hero_position_x_check CHECK (hero_object_position_x BETWEEN 0 AND 100);
ALTER TABLE site_settings DROP CONSTRAINT IF EXISTS site_settings_hero_position_y_check;
ALTER TABLE site_settings ADD CONSTRAINT site_settings_hero_position_y_check CHECK (hero_object_position_y BETWEEN 0 AND 100);
ALTER TABLE site_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "publik baca site settings" ON site_settings;
CREATE POLICY "publik baca site settings" ON site_settings FOR SELECT USING (TRUE);

-- Upgrade tabel jadwal lama tanpa menghapus data existing.
ALTER TABLE jadwal ADD COLUMN IF NOT EXISTS subject TEXT;
ALTER TABLE jadwal ADD COLUMN IF NOT EXISTS day TEXT;
ALTER TABLE jadwal ADD COLUMN IF NOT EXISTS week SMALLINT;
ALTER TABLE jadwal ADD COLUMN IF NOT EXISTS room TEXT;
ALTER TABLE jadwal ADD COLUMN IF NOT EXISTS start_period SMALLINT;
ALTER TABLE jadwal ADD COLUMN IF NOT EXISTS end_period SMALLINT;

-- Salin field lama yang masih dapat digunakan.
UPDATE jadwal SET subject = COALESCE(subject, mata_pelajaran) WHERE subject IS NULL;
UPDATE jadwal SET day = COALESCE(day, hari) WHERE day IS NULL;
UPDATE jadwal SET room = COALESCE(room, ruang) WHERE room IS NULL;
UPDATE jadwal SET week = 1 WHERE week IS NULL;
UPDATE jadwal SET start_period = urutan WHERE start_period IS NULL;
UPDATE jadwal SET end_period = urutan WHERE end_period IS NULL;

-- Field waktu lama dibuat nullable agar editor periode baru dapat menambah item.
ALTER TABLE jadwal ALTER COLUMN jam_mulai DROP NOT NULL;
ALTER TABLE jadwal ALTER COLUMN jam_selesai DROP NOT NULL;
ALTER TABLE jadwal ALTER COLUMN mata_pelajaran DROP NOT NULL;
ALTER TABLE jadwal ALTER COLUMN hari DROP NOT NULL;
ALTER TABLE jadwal ALTER COLUMN urutan DROP NOT NULL;

-- Validasi data baru.
ALTER TABLE jadwal DROP CONSTRAINT IF EXISTS jadwal_week_check;
ALTER TABLE jadwal ADD CONSTRAINT jadwal_week_check CHECK (week IN (1, 2));
ALTER TABLE jadwal DROP CONSTRAINT IF EXISTS jadwal_period_check;
ALTER TABLE jadwal ADD CONSTRAINT jadwal_period_check CHECK (
  start_period > 0 AND end_period >= start_period
);

-- Bucket publik untuk hero, anggota, dan galeri. Operasi tulis tetap melalui service role.
INSERT INTO storage.buckets (id, name, public)
VALUES ('web-kelas', 'web-kelas', TRUE)
ON CONFLICT (id) DO UPDATE SET public = TRUE;
