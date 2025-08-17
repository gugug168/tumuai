-- 最终修复：解决收藏和评论功能问题
-- 适用于Supabase PostgreSQL

-- 1. 检查tool_favorites是表还是视图
-- 如果存在tool_favorites表，重命名为user_favorites（如果user_favorites不存在）
DO $$
BEGIN
    -- 如果tool_favorites表存在而user_favorites不存在，迁移数据
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'tool_favorites') 
       AND NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_favorites') THEN
        
        ALTER TABLE tool_favorites RENAME TO user_favorites;
        
    -- 如果两个表都存在，合并数据后删除tool_favorites
    ELSIF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'tool_favorites') 
          AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_favorites') THEN
        
        -- 合并数据（避免重复）
        INSERT INTO user_favorites (user_id, tool_id, created_at)
        SELECT user_id, tool_id, created_at FROM tool_favorites
        ON CONFLICT (user_id, tool_id) DO NOTHING;
        
        DROP TABLE IF EXISTS tool_favorites;
    END IF;
END $$;

-- 2. 确保user_favorites表存在且结构正确
CREATE TABLE IF NOT EXISTS user_favorites (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    tool_id uuid NOT NULL REFERENCES tools(id) ON DELETE CASCADE,
    created_at timestamptz DEFAULT now(),
    UNIQUE(user_id, tool_id)
);

-- 3. 确保tools表有统计字段
ALTER TABLE tools 
    ADD COLUMN IF NOT EXISTS favorites_count integer DEFAULT 0,
    ADD COLUMN IF NOT EXISTS reviews_count integer DEFAULT 0,
    ADD COLUMN IF NOT EXISTS comments_count integer DEFAULT 0;

-- 4. 确保评论相关表存在
CREATE TABLE IF NOT EXISTS tool_comments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    tool_id uuid NOT NULL REFERENCES tools(id) ON DELETE CASCADE,
    parent_id uuid,
    content text NOT NULL,
    likes_count integer DEFAULT 0,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS tool_reviews (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    tool_id uuid NOT NULL REFERENCES tools(id) ON DELETE CASCADE,
    rating integer NOT NULL CHECK (rating >= 1 AND rating <= 5),
    title text,
    content text,
    helpful_count integer DEFAULT 0,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS comment_likes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    comment_id uuid NOT NULL REFERENCES tool_comments(id) ON DELETE CASCADE,
    created_at timestamptz DEFAULT now(),
    UNIQUE(user_id, comment_id)
);

-- 5. 启用RLS权限
ALTER TABLE user_favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE tool_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE tool_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE comment_likes ENABLE ROW LEVEL SECURITY;

-- 6. 创建权限策略（使用传统语法）
DO $$
BEGIN
    -- 删除可能存在的旧策略
    DROP POLICY IF EXISTS user_favorites_policy ON user_favorites;
    DROP POLICY IF EXISTS tool_reviews_select_policy ON tool_reviews;
    DROP POLICY IF EXISTS tool_reviews_policy ON tool_reviews;
    DROP POLICY IF EXISTS tool_comments_select_policy ON tool_comments;
    DROP POLICY IF EXISTS tool_comments_policy ON tool_comments;
    DROP POLICY IF EXISTS comment_likes_policy ON comment_likes;
    
    -- 创建新策略
    CREATE POLICY user_favorites_policy ON user_favorites FOR ALL TO authenticated USING (auth.uid() = user_id);
    CREATE POLICY tool_reviews_select_policy ON tool_reviews FOR SELECT TO public USING (true);
    CREATE POLICY tool_reviews_policy ON tool_reviews FOR ALL TO authenticated USING (auth.uid() = user_id);
    CREATE POLICY tool_comments_select_policy ON tool_comments FOR SELECT TO public USING (true);
    CREATE POLICY tool_comments_policy ON tool_comments FOR ALL TO authenticated USING (auth.uid() = user_id);
    CREATE POLICY comment_likes_policy ON comment_likes FOR ALL TO authenticated USING (auth.uid() = user_id);
END $$;

-- 7. 创建触发器函数（自动更新统计）
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

-- 8. 创建触发器
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_counts_favorites') THEN
        CREATE TRIGGER update_counts_favorites
            AFTER INSERT OR DELETE ON user_favorites
            FOR EACH ROW EXECUTE FUNCTION update_tool_counts();
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_counts_reviews') THEN
        CREATE TRIGGER update_counts_reviews
            AFTER INSERT OR DELETE ON tool_reviews
            FOR EACH ROW EXECUTE FUNCTION update_tool_counts();
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_counts_comments') THEN
        CREATE TRIGGER update_counts_comments
            AFTER INSERT OR DELETE ON tool_comments
            FOR EACH ROW EXECUTE FUNCTION update_tool_counts();
    END IF;
END $$;

-- 9. 最终验证
SELECT 
    '数据库修复完成' as status,
    (SELECT COUNT(*) FROM tools) as tools_count,
    (SELECT COUNT(*) FROM user_favorites) as favorites_count,
    (SELECT COUNT(*) FROM tool_reviews) as reviews_count,
    (SELECT COUNT(*) FROM tool_comments) as comments_count;