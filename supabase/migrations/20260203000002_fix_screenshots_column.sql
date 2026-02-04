-- 修复 screenshots 列问题
-- Date: 2026-02-03

-- 确保 screenshots 列存在
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tools'
    AND column_name = 'screenshots'
  ) THEN
    ALTER TABLE public.tools ADD COLUMN screenshots text[];
  END IF;
END $$;

-- 添加注释
COMMENT ON COLUMN public.tools.screenshots IS 'Public screenshot URLs (uploaded to Supabase Storage bucket tool-screenshots)';
