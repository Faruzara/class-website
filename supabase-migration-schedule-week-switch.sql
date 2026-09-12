-- Sinkronisasi manual pola Week 1/2 tanpa mematikan pergantian mingguan otomatis.
-- 0 memakai pola kalender asli; 1 membalik pola kalender.
ALTER TABLE public.site_settings
  ADD COLUMN IF NOT EXISTS schedule_week_offset SMALLINT NOT NULL DEFAULT 0;

ALTER TABLE public.site_settings
  DROP CONSTRAINT IF EXISTS site_settings_schedule_week_offset_check;

ALTER TABLE public.site_settings
  ADD CONSTRAINT site_settings_schedule_week_offset_check
  CHECK (schedule_week_offset IN (0, 1));

NOTIFY pgrst, 'reload schema';
