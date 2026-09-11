-- Jalankan di Supabase SQL Editor sebelum memakai pengaturan fokus Gallery.
-- File asli dan posisi Gallery lama tidak diubah: default tetap 50% 50%.
BEGIN;

ALTER TABLE public.galeri
  ADD COLUMN IF NOT EXISTS object_position_x NUMERIC(5,2) NOT NULL DEFAULT 50
    CONSTRAINT galeri_object_position_x_check CHECK (object_position_x BETWEEN 0 AND 100),
  ADD COLUMN IF NOT EXISTS object_position_y NUMERIC(5,2) NOT NULL DEFAULT 50
    CONSTRAINT galeri_object_position_y_check CHECK (object_position_y BETWEEN 0 AND 100);

NOTIFY pgrst, 'reload schema';
COMMIT;
