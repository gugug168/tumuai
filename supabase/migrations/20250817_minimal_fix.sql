-- 最小化修复：解决收藏和评论功能问题
-- 兼容PostgreSQL 11+版本

-- 1. 修复收藏功能：创建兼容视图
DROP VIEW IF EXISTS tool_favorites;
CREATE VIEW tool_favorites AS
SELECT id, user_id, tool_id, created_at FROM user_favorites;

-- 2. 确保所有必需的字段存在
-- 检查并添加tools表的统计字段
ALTER TABLE tools ADD COLUMN IF NOT EXISTS favorites_count integer DEFAULT 0;
ALTER TABLE tools ADD COLUMN IF NOT EXISTS reviews_count integer DEFAULT 0;
ALTER TABLE tools ADD COLUMN IF NOT EXISTS comments_count integer DEFAULT 0;

-- 3. 确保评论表完整
ALTER TABLE tool_comments ADD COLUMN IF NOT EXISTS likes_count integer DEFAULT 0;
ALTER TABLE tool_comments ADD COLUMN IF NOT EXISTS parent_id uuid;

-- 4. 确保评价表完整
ALTER TABLE tool_reviews ADD COLUMN IF NOT EXISTS title text;
ALTER TABLE tool_reviews ADD COLUMN IF NOT EXISTS content text;
ALTER TABLE tool_reviews ADD COLUMN IF NOT EXISTS helpful_count integer DEFAULT 0;

-- 5. 创建评论点赞表
CREATE TABLE IF NOT EXISTS comment_likes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    comment_id uuid NOT NULL REFERENCES tool_comments(id) ON DELETE CASCADE,
    created_at timestamptz DEFAULT now(),
    UNIQUE(user_id, comment_id)
);

-- 6. 修复外键约束（如果缺失）
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'user_favorites_tool_id_fkey'
    ) THEN
        ALTER TABLE user_favorites ADD CONSTRAINT user_favorites_tool_id_fkey 
        FOREIGN KEY (tool_id) REFERENCES tools(id) ON DELETE CASCADE;
    END IF;
END $$;

-- 7. 启用RLS权限
ALTER TABLE user_favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE tool_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE tool_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE comment_likes ENABLE ROW LEVEL SECURITY;

-- 8. 创建基本权限策略（使用简单语法）
CREATE POLICY user_favorites_policy ON user_favorites FOR ALL TO authenticated USING (auth.uid() = user_id);
CREATE POLICY tool_reviews_select_policy ON tool_reviews FOR SELECT TO public USING (true);
CREATE POLICY tool_reviews_policy ON tool_reviews FOR ALL TO authenticated USING (auth.uid() = user_id);
CREATE POLICY tool_comments_select_policy ON tool_comments FOR SELECT TO public USING (true);
CREATE POLICY tool_comments_policy ON tool_comments FOR ALL TO authenticated USING (auth.uid() = user_id);
CREATE POLICY comment_likes_policy ON comment_likes FOR ALL TO authenticated USING (auth.uid() = user_id);

-- 9. 简单验证
SELECT '修复完成' as message, 
       (SELECT COUNT(*) FROM tools) as tools,
       (SELECT COUNT(*) FROM user_favorites) as favorites;