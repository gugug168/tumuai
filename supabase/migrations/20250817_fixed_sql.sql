-- 修复PostgreSQL版本兼容性问题
-- 移除IF NOT EXISTS语法，使用兼容的写法

-- 1. 修复收藏功能：确保tool_favorites兼容
-- 如果tool_favorites视图已存在则删除
DROP VIEW IF EXISTS tool_favorites;

-- 创建兼容视图
CREATE OR REPLACE VIEW tool_favorites AS
SELECT 
  id,
  user_id,
  tool_id,
  created_at
FROM user_favorites;

-- 2. 确保tools表有所有必需字段（使用兼容语法）
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='tools' AND column_name='favorites_count') THEN
        ALTER TABLE tools ADD COLUMN favorites_count integer DEFAULT 0;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='tools' AND column_name='reviews_count') THEN
        ALTER TABLE tools ADD COLUMN reviews_count integer DEFAULT 0;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='tools' AND column_name='comments_count') THEN
        ALTER TABLE tools ADD COLUMN comments_count integer DEFAULT 0;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='tools' AND column_name='rating') THEN
        ALTER TABLE tools ADD COLUMN rating decimal DEFAULT 0;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='tools' AND column_name='upvotes') THEN
        ALTER TABLE tools ADD COLUMN upvotes integer DEFAULT 0;
    END IF;
END $$;

-- 3. 确保评论表结构完整
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='tool_comments' AND column_name='likes_count') THEN
        ALTER TABLE tool_comments ADD COLUMN likes_count integer DEFAULT 0;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='tool_comments' AND column_name='parent_id') THEN
        ALTER TABLE tool_comments ADD COLUMN parent_id uuid;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='tool_comments' AND column_name='content') THEN
        ALTER TABLE tool_comments ADD COLUMN content text NOT NULL DEFAULT '';
    END IF;
END $$;

-- 4. 确保评价表结构完整
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='tool_reviews' AND column_name='title') THEN
        ALTER TABLE tool_reviews ADD COLUMN title text;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='tool_reviews' AND column_name='content') THEN
        ALTER TABLE tool_reviews ADD COLUMN content text;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='tool_reviews' AND column_name='helpful_count') THEN
        ALTER TABLE tool_reviews ADD COLUMN helpful_count integer DEFAULT 0;
    END IF;
END $$;

-- 5. 创建缺失的评论点赞表（使用兼容语法）
CREATE TABLE IF NOT EXISTS comment_likes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    comment_id uuid NOT NULL REFERENCES tool_comments(id) ON DELETE CASCADE,
    created_at timestamptz DEFAULT now(),
    UNIQUE(user_id, comment_id)
);

-- 6. 修复外键约束（使用兼容语法）
DO $$
BEGIN
    -- 删除现有约束（如果存在）
    ALTER TABLE user_favorites DROP CONSTRAINT IF EXISTS user_favorites_tool_id_fkey;
    ALTER TABLE tool_reviews DROP CONSTRAINT IF EXISTS tool_reviews_tool_id_fkey;
    ALTER TABLE tool_comments DROP CONSTRAINT IF EXISTS tool_comments_tool_id_fkey;
    
    -- 添加新的外键约束
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'user_favorites_tool_id_fkey'
    ) THEN
        ALTER TABLE user_favorites ADD CONSTRAINT user_favorites_tool_id_fkey 
        FOREIGN KEY (tool_id) REFERENCES tools(id) ON DELETE CASCADE;
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'tool_reviews_tool_id_fkey'
    ) THEN
        ALTER TABLE tool_reviews ADD CONSTRAINT tool_reviews_tool_id_fkey 
        FOREIGN KEY (tool_id) REFERENCES tools(id) ON DELETE CASCADE;
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'tool_comments_tool_id_fkey'
    ) THEN
        ALTER TABLE tool_comments ADD CONSTRAINT tool_comments_tool_id_fkey 
        FOREIGN KEY (tool_id) REFERENCES tools(id) ON DELETE CASCADE;
    END IF;
END $$;

-- 7. 创建自动统计触发器（使用兼容语法）
CREATE OR REPLACE FUNCTION update_tool_counts()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_TABLE_NAME = 'user_favorites' THEN
        IF TG_OP = 'INSERT' THEN
            UPDATE tools SET favorites_count = COALESCE(favorites_count, 0) + 1 WHERE id = NEW.tool_id;
        ELSIF TG_OP = 'DELETE' THEN
            UPDATE tools SET favorites_count = COALESCE(favorites_count, 0) - 1 WHERE id = OLD.tool_id;
        END IF;
    END IF;
    
    IF TG_TABLE_NAME = 'tool_reviews' THEN
        IF TG_OP = 'INSERT' THEN
            UPDATE tools SET reviews_count = COALESCE(reviews_count, 0) + 1 WHERE id = NEW.tool_id;
        ELSIF TG_OP = 'DELETE' THEN
            UPDATE tools SET reviews_count = COALESCE(reviews_count, 0) - 1 WHERE id = OLD.tool_id;
        END IF;
    END IF;
    
    IF TG_TABLE_NAME = 'tool_comments' THEN
        IF TG_OP = 'INSERT' THEN
            UPDATE tools SET comments_count = COALESCE(comments_count, 0) + 1 WHERE id = NEW.tool_id;
        ELSIF TG_OP = 'DELETE' THEN
            UPDATE tools SET comments_count = COALESCE(comments_count, 0) - 1 WHERE id = OLD.tool_id;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 8. 创建触发器（使用兼容语法）
DO $$
BEGIN
    -- 收藏触发器
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger WHERE tgname = 'update_counts_favorites'
    ) THEN
        CREATE TRIGGER update_counts_favorites
            AFTER INSERT OR DELETE ON user_favorites
            FOR EACH ROW EXECUTE FUNCTION update_tool_counts();
    END IF;
    
    -- 评价触发器
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger WHERE tgname = 'update_counts_reviews'
    ) THEN
        CREATE TRIGGER update_counts_reviews
            AFTER INSERT OR DELETE ON tool_reviews
            FOR EACH ROW EXECUTE FUNCTION update_tool_counts();
    END IF;
    
    -- 评论触发器
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger WHERE tgname = 'update_counts_comments'
    ) THEN
        CREATE TRIGGER update_counts_comments
            AFTER INSERT OR DELETE ON tool_comments
            FOR EACH ROW EXECUTE FUNCTION update_tool_counts();
    END IF;
END $$;

-- 9. 修复RLS权限（使用兼容语法）
DO $$
BEGIN
    -- 启用RLS
    ALTER TABLE user_favorites ENABLE ROW LEVEL SECURITY;
    ALTER TABLE tool_reviews ENABLE ROW LEVEL SECURITY;
    ALTER TABLE tool_comments ENABLE ROW LEVEL SECURITY;
    ALTER TABLE comment_likes ENABLE ROW LEVEL SECURITY;
    
    -- 创建权限策略（使用传统语法）
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'user_favorites' AND policyname = 'user_favorites_policy'
    ) THEN
        CREATE POLICY user_favorites_policy ON user_favorites FOR ALL TO authenticated USING (auth.uid() = user_id);
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'tool_reviews' AND policyname = 'tool_reviews_select_policy'
    ) THEN
        CREATE POLICY tool_reviews_select_policy ON tool_reviews FOR SELECT TO public USING (true);
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'tool_reviews' AND policyname = 'tool_reviews_policy'
    ) THEN
        CREATE POLICY tool_reviews_policy ON tool_reviews FOR ALL TO authenticated USING (auth.uid() = user_id);
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'tool_comments' AND policyname = 'tool_comments_select_policy'
    ) THEN
        CREATE POLICY tool_comments_select_policy ON tool_comments FOR SELECT TO public USING (true);
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'tool_comments' AND policyname = 'tool_comments_policy'
    ) THEN
        CREATE POLICY tool_comments_policy ON tool_comments FOR ALL TO authenticated USING (auth.uid() = user_id);
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'comment_likes' AND policyname = 'comment_likes_policy'
    ) THEN
        CREATE POLICY comment_likes_policy ON comment_likes FOR ALL TO authenticated USING (auth.uid() = user_id);
    END IF;
END $$;

-- 10. 验证修复结果
SELECT 
    '数据库兼容性修复完成' as status,
    (SELECT COUNT(*) FROM tools) as tools_count,
    (SELECT COUNT(*) FROM user_favorites) as favorites_count,
    (SELECT COUNT(*) FROM tool_reviews) as reviews_count,
    (SELECT COUNT(*) FROM tool_comments) as comments_count;