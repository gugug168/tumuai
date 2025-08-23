-- 为 tools 表添加 status 列
ALTER TABLE tools 
ADD COLUMN IF NOT EXISTS status text DEFAULT 'published' CHECK (status IN ('published', 'draft', 'archived'));

-- 将现有的所有工具设置为已发布状态
UPDATE tools SET status = 'published' WHERE status IS NULL;

-- 为 status 列创建索引以提高查询性能
CREATE INDEX IF NOT EXISTS idx_tools_status ON tools(status);

-- 为 tools 表添加评论，说明状态含义
COMMENT ON COLUMN tools.status IS '工具状态: published=已发布, draft=草稿, archived=已归档';
