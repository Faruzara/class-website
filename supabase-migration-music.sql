-- SoundCloud playlist and dashboard-managed public client ID.
CREATE TABLE IF NOT EXISTS music_settings (
  id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  soundcloud_client_id TEXT,
  soundcloud_client_id_status TEXT NOT NULL DEFAULT 'unchecked'
    CHECK (soundcloud_client_id_status IN ('unchecked', 'valid', 'expired', 'error')),
  soundcloud_client_id_checked_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
INSERT INTO music_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS music_tracks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  soundcloud_url TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL CHECK (char_length(title) BETWEEN 1 AND 200),
  artist TEXT NOT NULL CHECK (char_length(artist) BETWEEN 1 AND 160),
  artwork_url TEXT,
  duration_ms INTEGER CHECK (duration_ms IS NULL OR duration_ms >= 0),
  position INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS music_tracks_public_order_idx ON music_tracks (is_active, position, created_at);
ALTER TABLE music_tracks ENABLE ROW LEVEL SECURITY;
ALTER TABLE music_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "publik baca musik aktif" ON music_tracks;
CREATE POLICY "publik baca musik aktif" ON music_tracks FOR SELECT USING (is_active = TRUE);
NOTIFY pgrst, 'reload schema';
