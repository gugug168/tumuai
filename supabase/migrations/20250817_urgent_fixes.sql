-- 紧急修复：解决用户收藏和评论功能问题
-- 针对用户反馈的"点击收藏无反应"和"评论后不显示"问题

-- 1. 修复收藏功能：确保tool_favorites表正确连接
-- 创建兼容视图，让代码中的tool_favorites查询能正常工作
CREATE OR REPLACE VIEW tool_favorites AS
SELECT 
  id,
  user_id,
  tool_id,
  created_at
FROM user_favorites;

-- 2. 确保tools表有所有必需字段
ALTER TABLE tools 
ADD COLUMN IF NOT EXISTS favorites_count integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS reviews_count integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS comments_count integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS rating decimal DEFAULT 0,
ADD COLUMN IF NOT EXISTS upvotes integer DEFAULT 0;

-- 3. 确保评论表结构完整
ALTER TABLE tool_comments
ADD COLUMN IF NOT EXISTS likes_count integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS parent_id uuid,
ADD COLUMN IF NOT EXISTS content text NOT NULL DEFAULT '';

-- 4. 确保评价表结构完整
ALTER TABLE tool_reviews
ADD COLUMN IF NOT EXISTS title text,
ADD COLUMN IF NOT EXISTS content text,
ADD COLUMN IF NOT EXISTS helpful_count integer DEFAULT 0;

-- 5. 创建缺失的评论点赞表
CREATE TABLE IF NOT EXISTS comment_likes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  comment_id uuid NOT NULL REFERENCES tool_comments(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, comment_id)
);

-- 6. 修复外键约束
ALTER TABLE user_favorites DROP CONSTRAINT IF EXISTS user_favorites_tool_id_fkey;
ALTER TABLE user_favorites ADD CONSTRAINT user_favorites_tool_id_fkey FOREIGN KEY (tool_id) REFERENCES tools(id) ON DELETE CASCADE;

ALTER TABLE tool_reviews DROP CONSTRAINT IF EXISTS tool_reviews_tool_id_fkey;
ALTER TABLE tool_reviews ADD CONSTRAINT tool_reviews_tool_id_fkey FOREIGN KEY (tool_id) REFERENCES tools(id) ON DELETE CASCADE;

ALTER TABLE tool_comments DROP CONSTRAINT IF EXISTS tool_comments_tool_id_fkey;
ALTER TABLE tool_comments ADD CONSTRAINT tool_comments_tool_id_fkey FOREIGN KEY (tool_id) REFERENCES tools(id) ON DELETE CASCADE;

-- 7. 创建自动统计触发器
CREATE OR REPLACE FUNCTION update_tool_counts()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_TABLE_NAME = 'user_favorites' THEN
    IF TG_OP = 'INSERT' THEN
      UPDATE tools SET favorites_count = favorites_count + 1 WHERE id = NEW.tool_id;
    ELSIF TG_OP = 'DELETE' THEN
      UPDATE tools SET favorites_count = favorites_count - 1 WHERE id = OLD.tool_id;
    END IF;
  END IF;
  
  IF TG_TABLE_NAME = 'tool_reviews' THEN
    IF TG_OP = 'INSERT' THEN
      UPDATE tools SET reviews_count = reviews_count + 1 WHERE id = NEW.tool_id;
    ELSIF TG_OP = 'DELETE' THEN
      UPDATE tools SET reviews_count = reviews_count - 1 WHERE id = OLD.tool_id;
    END IF;
  END IF;
  
  IF TG_TABLE_NAME = 'tool_comments' THEN
    IF TG_OP = 'INSERT' THEN
      UPDATE tools SET comments_count = comments_count + 1 WHERE id = NEW.tool_id;
    ELSIF TG_OP = 'DELETE' THEN
      UPDATE tools SET comments_count = comments_count - 1 WHERE id = OLD.tool_id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 创建触发器（如果不存在）
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

-- 8. 修复RLS权限
ALTER TABLE user_favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE tool_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE tool_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE comment_likes ENABLE ROW LEVEL SECURITY;

-- 9. 创建权限策略
CREATE POLICY IF NOT EXISTS "用户只能操作自己的收藏" ON user_favorites FOR ALL TO authenticated USING (auth.uid() = user_id);
CREATE POLICY IF NOT EXISTS "评价对所有用户可见" ON tool_reviews FOR SELECT TO public USING (true);
CREATE POLICY IF NOT EXISTS "用户只能操作自己的评价" ON tool_reviews FOR ALL TO authenticated USING (auth.uid() = user_id);
CREATE POLICY IF NOT EXISTS "评论对所有用户可见" ON tool_comments FOR SELECT TO public USING (true);
CREATE POLICY IF NOT EXISTS "用户只能操作自己的评论" ON tool_comments FOR ALL TO authenticated USING (auth.uid() = user_id);
CREATE POLICY IF NOT EXISTS "评论点赞限制" ON comment_likes FOR ALL TO authenticated USING (auth.uid() = user_id);

-- 10. 最终验证查询
SELECT 
  '数据库修复完成' as status,
  (SELECT COUNT(*) FROM tools) as tools_count,
  (SELECT COUNT(*) FROM user_favorites) as favorites_count,
  (SELECT COUNT(*) FROM tool_reviews) as reviews_count,
  (SELECT COUNT(*) FROM tool_comments) as comments_count;