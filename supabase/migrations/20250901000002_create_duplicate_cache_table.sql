-- AI智能填入功能：重复检测缓存表
-- 创建时间：2025-09-01
-- 目的：缓存重复网站检测结果，提升API响应速度

-- 创建重复检测缓存表
CREATE TABLE IF NOT EXISTS website_duplicate_cache (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  original_url text NOT NULL,                      -- 用户输入的原始URL
  normalized_url text NOT NULL,                    -- 标准化后的URL
  exists boolean NOT NULL,                         -- 是否存在重复
  existing_tool_id uuid REFERENCES tools(id),     -- 如果存在重复，对应的工具ID
  cached_at timestamp with time zone DEFAULT now(), -- 缓存时间
  expires_at timestamp with time zone DEFAULT (now() + interval '1 hour'), -- 过期时间
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- 创建索引
CREATE UNIQUE INDEX IF NOT EXISTS idx_cache_normalized_url_unique 
ON website_duplicate_cache(normalized_url);

CREATE INDEX IF NOT EXISTS idx_cache_expires_at 
ON website_duplicate_cache(expires_at);

CREATE INDEX IF NOT EXISTS idx_cache_created_at 
ON website_duplicate_cache(created_at DESC);

-- 创建自动清理过期缓存的函数
CREATE OR REPLACE FUNCTION cleanup_expired_duplicate_cache()
RETURNS integer AS $$
DECLARE
  deleted_count integer;
BEGIN
  DELETE FROM website_duplicate_cache 
  WHERE expires_at < now();
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- 创建缓存表更新时间的触发器函数
CREATE OR REPLACE FUNCTION update_cache_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 创建更新时间触发器
CREATE TRIGGER trigger_cache_updated_at
  BEFORE UPDATE ON website_duplicate_cache
  FOR EACH ROW
  EXECUTE FUNCTION update_cache_updated_at();

-- 启用RLS（行级安全）
ALTER TABLE website_duplicate_cache ENABLE ROW LEVEL SECURITY;

-- 创建RLS策略：只有经过认证的用户可以访问
CREATE POLICY "authenticated_users_can_access_cache" ON website_duplicate_cache
  FOR ALL USING (auth.role() = 'authenticated');

-- 创建RLS策略：匿名用户可以读取（用于公开API）
CREATE POLICY "anonymous_users_can_read_cache" ON website_duplicate_cache
  FOR SELECT USING (true);

-- 添加表注释
COMMENT ON TABLE website_duplicate_cache IS 'AI智能填入：网站重复检测缓存表';
COMMENT ON COLUMN website_duplicate_cache.original_url IS '用户输入的原始URL';
COMMENT ON COLUMN website_duplicate_cache.normalized_url IS '标准化后的URL，用于唯一性检测';
COMMENT ON COLUMN website_duplicate_cache.exists IS '是否存在重复网站';
COMMENT ON COLUMN website_duplicate_cache.existing_tool_id IS '如果存在重复，对应的工具ID';
COMMENT ON COLUMN website_duplicate_cache.expires_at IS '缓存过期时间，默认1小时';

COMMENT ON FUNCTION cleanup_expired_duplicate_cache() IS 'AI智能填入：清理过期的重复检测缓存';
COMMENT ON FUNCTION update_cache_updated_at() IS 'AI智能填入：自动更新缓存表的updated_at字段';