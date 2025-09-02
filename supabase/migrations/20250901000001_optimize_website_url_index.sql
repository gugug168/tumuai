-- AI智能填入功能：网站URL索引优化
-- 创建时间：2025-09-01
-- 目的：优化重复网站检测的查询性能

-- 启用pg_trgm扩展（支持模糊匹配和相似度搜索）
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 为website_url字段创建GIN索引，支持LIKE和相似度查询
CREATE INDEX IF NOT EXISTS idx_tools_website_url_gin 
ON tools USING gin(website_url gin_trgm_ops);

-- 为website_url和status创建复合索引，优化重复检测查询
CREATE INDEX IF NOT EXISTS idx_tools_website_status 
ON tools(website_url, status) 
WHERE status IN ('published', 'pending');

-- 添加normalized_url字段用于标准化URL存储
ALTER TABLE tools ADD COLUMN IF NOT EXISTS normalized_url text;

-- 创建URL标准化函数
CREATE OR REPLACE FUNCTION normalize_website_url(url text)
RETURNS text AS $$
BEGIN
  IF url IS NULL OR url = '' THEN
    RETURN NULL;
  END IF;
  
  RETURN lower(
    regexp_replace(
      regexp_replace(
        regexp_replace(url, '^https?://', ''),  -- 移除协议
        '^www\.', ''                           -- 移除www前缀
      ),
      '/+$', ''                                -- 移除末尾斜杠
    )
  );
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 更新现有数据的normalized_url字段
UPDATE tools 
SET normalized_url = normalize_website_url(website_url)
WHERE normalized_url IS NULL AND website_url IS NOT NULL;

-- 为normalized_url创建唯一索引（防止重复网站）
CREATE UNIQUE INDEX IF NOT EXISTS idx_tools_normalized_url_unique
ON tools(normalized_url) 
WHERE normalized_url IS NOT NULL AND status IN ('published', 'pending');

-- 为normalized_url创建普通索引（快速查询）
CREATE INDEX IF NOT EXISTS idx_tools_normalized_url 
ON tools(normalized_url) 
WHERE normalized_url IS NOT NULL;

-- 创建触发器函数，自动维护normalized_url字段
CREATE OR REPLACE FUNCTION update_normalized_url()
RETURNS TRIGGER AS $$
BEGIN
  NEW.normalized_url = normalize_website_url(NEW.website_url);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 创建触发器
DROP TRIGGER IF EXISTS trigger_update_normalized_url ON tools;
CREATE TRIGGER trigger_update_normalized_url
  BEFORE INSERT OR UPDATE OF website_url ON tools
  FOR EACH ROW
  EXECUTE FUNCTION update_normalized_url();

-- 添加注释
COMMENT ON COLUMN tools.normalized_url IS 'AI智能填入：标准化的网站URL，用于重复检测';
COMMENT ON FUNCTION normalize_website_url(text) IS 'AI智能填入：URL标准化函数';
COMMENT ON FUNCTION update_normalized_url() IS 'AI智能填入：自动更新normalized_url的触发器函数';