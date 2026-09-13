-- Warna kartu jadwal opsional. NULL berarti mengikuti warna otomatis dari mapel/ruangan.
ALTER TABLE public.jadwal
  ADD COLUMN IF NOT EXISTS color_override TEXT;

ALTER TABLE public.jadwal
  DROP CONSTRAINT IF EXISTS jadwal_color_override_check;

ALTER TABLE public.jadwal
  ADD CONSTRAINT jadwal_color_override_check
  CHECK (color_override IS NULL OR color_override IN (
    'blue', 'lime', 'cyan', 'gray', 'sky', 'amber',
    'pink', 'purple', 'green', 'emerald', 'aqua', 'orange'
  ));

NOTIFY pgrst, 'reload schema';
