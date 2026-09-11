-- Tambahan latar TikTok, aman dijalankan ulang dan tidak mengubah data lama.
ALTER TABLE public.site_settings
  ADD COLUMN IF NOT EXISTS tiktok_image_url TEXT;

NOTIFY pgrst, 'reload schema';
