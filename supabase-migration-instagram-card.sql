-- Tambahan untuk panel Instagram Homepage; aman dijalankan ulang.
-- Tidak mengubah konten, policy, maupun URL sosial existing.
ALTER TABLE public.site_settings
  ADD COLUMN IF NOT EXISTS instagram_image_url TEXT;

NOTIFY pgrst, 'reload schema';
