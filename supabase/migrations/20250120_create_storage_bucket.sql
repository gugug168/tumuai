-- 创建工具图标存储桶
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'tool-logos',
  'tool-logos',
  true,
  5242880, -- 5MB
  '{image/jpeg,image/jpg,image/png,image/gif,image/webp}'
) ON CONFLICT (id) DO NOTHING;

-- 设置存储桶的公共访问策略
CREATE POLICY "Anyone can view tool logos" ON storage.objects
FOR SELECT USING (bucket_id = 'tool-logos');

CREATE POLICY "Anyone can upload tool logos" ON storage.objects
FOR INSERT WITH CHECK (bucket_id = 'tool-logos');

CREATE POLICY "Anyone can update tool logos" ON storage.objects
FOR UPDATE USING (bucket_id = 'tool-logos');

CREATE POLICY "Anyone can delete tool logos" ON storage.objects
FOR DELETE USING (bucket_id = 'tool-logos');
