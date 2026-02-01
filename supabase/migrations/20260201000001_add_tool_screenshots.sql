-- Tool screenshots storage + schema
-- Date: 2026-02-01

-- 1) Add screenshots column to tools (public URLs stored in Supabase Storage)
ALTER TABLE public.tools
  ADD COLUMN IF NOT EXISTS screenshots text[];

COMMENT ON COLUMN public.tools.screenshots IS 'Public screenshot URLs (uploaded to Supabase Storage bucket tool-screenshots)';

-- 2) Create a public bucket for screenshots
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'tool-screenshots',
  'tool-screenshots',
  true,
  10485760, -- 10MB per file
  '{image/jpeg,image/jpg,image/png,image/gif,image/webp}'
) ON CONFLICT (id) DO NOTHING;

-- 3) Policies (open, consistent with existing tool-logos migration; tighten later if needed)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Anyone can view tool screenshots'
  ) THEN
    CREATE POLICY "Anyone can view tool screenshots" ON storage.objects
    FOR SELECT USING (bucket_id = 'tool-screenshots');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Anyone can upload tool screenshots'
  ) THEN
    CREATE POLICY "Anyone can upload tool screenshots" ON storage.objects
    FOR INSERT WITH CHECK (bucket_id = 'tool-screenshots');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Anyone can update tool screenshots'
  ) THEN
    CREATE POLICY "Anyone can update tool screenshots" ON storage.objects
    FOR UPDATE USING (bucket_id = 'tool-screenshots');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Anyone can delete tool screenshots'
  ) THEN
    CREATE POLICY "Anyone can delete tool screenshots" ON storage.objects
    FOR DELETE USING (bucket_id = 'tool-screenshots');
  END IF;
END $$;
