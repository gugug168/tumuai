-- 全面数据库结构检查和修复
-- 确保所有代码与数据库完全兼容

-- 📋 数据库表清单检查
-- ✅ admin_logs - 管理员操作日志
-- ✅ admin_users - 管理员权限
-- ✅ categories - 工具分类
-- ✅ comment_likes - 评论点赞
-- ✅ tool_comments - 工具评论
-- ✅ tool_favorites - 工具收藏（可能是旧表名）
-- ✅ tool_reviews - 工具评论（当前使用）
-- ✅ tool_submissions - 工具提交
-- ✅ tools - 工具主表
-- ✅ user_favorites - 用户收藏（当前使用）
-- ✅ user_profiles - 用户资料

-- 1. 确保表结构一致性
-- 检查tools表是否完整
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'tools' AND column_name = 'favorites_count'
  ) THEN
    ALTER TABLE tools ADD COLUMN favorites_count integer DEFAULT 0;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'tools' AND column_name = 'reviews_count'
  ) THEN
    ALTER TABLE tools ADD COLUMN reviews_count integer DEFAULT 0;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'tools' AND column_name = 'date_added'
  ) THEN
    ALTER TABLE tools ADD COLUMN date_added timestamptz DEFAULT now();
  END IF;
END $$;

-- 2. 确保用户收藏表结构正确
DO $$
BEGIN
  -- 统一表结构，删除重复表
  IF EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_name = 'tool_favorites'
  ) THEN
    -- 迁移数据从tool_favorites到user_favorites（如果需要）
    INSERT INTO user_favorites (user_id, tool_id, created_at)
    SELECT user_id, tool_id, created_at FROM tool_favorites
    ON CONFLICT (user_id, tool_id) DO NOTHING;
  END IF;
END $$;

-- 3. 确保评论表结构正确
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_name = 'tool_comments'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_name = 'tool_reviews'
  ) THEN
    -- 如果tool_comments不存在但tool_reviews存在，确保tool_reviews有comment字段
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'tool_reviews' AND column_name = 'comment'
    ) THEN
      ALTER TABLE tool_reviews ADD COLUMN comment text;
    END IF;
  END IF;
END $$;

-- 4. 修复可能缺失的字段
ALTER TABLE tools 
ADD COLUMN IF NOT EXISTS upvotes integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS views integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS rating decimal DEFAULT 0,
ADD COLUMN IF NOT EXISTS review_count integer DEFAULT 0;

-- 5. 创建缺失的触发器（如果缺失）
CREATE OR REPLACE FUNCTION update_tool_stats()
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
      UPDATE tools SET rating = (SELECT AVG(rating) FROM tool_reviews WHERE tool_id = NEW.tool_id) WHERE id = NEW.tool_id;
    ELSIF TG_OP = 'DELETE' THEN
      UPDATE tools SET reviews_count = COALESCE(reviews_count, 0) - 1 WHERE id = OLD.tool_id;
      UPDATE tools SET rating = (SELECT AVG(rating) FROM tool_reviews WHERE tool_id = OLD.tool_id) WHERE id = OLD.tool_id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 6. 创建触发器（如果不存在）
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_favorites_count'
  ) THEN
    CREATE TRIGGER update_favorites_count
      AFTER INSERT OR DELETE ON user_favorites
      FOR EACH ROW EXECUTE FUNCTION update_tool_stats();
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_reviews_count'
  ) THEN
    CREATE TRIGGER update_reviews_count
      AFTER INSERT OR DELETE ON tool_reviews
      FOR EACH ROW EXECUTE FUNCTION update_tool_stats();
  END IF;
END $$;

-- 7. 修复RLS权限
ALTER TABLE user_favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE tool_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE tool_comments ENABLE ROW LEVEL SECURITY;

-- 8. 标准化权限策略
CREATE POLICY IF NOT EXISTS "User favorites by owner" ON user_favorites FOR ALL TO authenticated USING (auth.uid() = user_id);
CREATE POLICY IF NOT EXISTS "Tool reviews visible to all" ON tool_reviews FOR SELECT TO public USING (true);
CREATE POLICY IF NOT EXISTS "Tool reviews by owner" ON tool_reviews FOR ALL TO authenticated USING (auth.uid() = user_id);
CREATE POLICY IF NOT EXISTS "Tool comments visible to all" ON tool_comments FOR SELECT TO public USING (true);
CREATE POLICY IF NOT EXISTS "Tool comments by owner" ON tool_comments FOR ALL TO authenticated USING (auth.uid() = user_id);

-- 9. 修复外键约束
ALTER TABLE user_favorites DROP CONSTRAINT IF EXISTS user_favorites_tool_id_fkey;
ALTER TABLE user_favorites ADD CONSTRAINT user_favorites_tool_id_fkey FOREIGN KEY (tool_id) REFERENCES tools(id) ON DELETE CASCADE;

ALTER TABLE tool_reviews DROP CONSTRAINT IF EXISTS tool_reviews_tool_id_fkey;
ALTER TABLE tool_reviews ADD CONSTRAINT tool_reviews_tool_id_fkey FOREIGN KEY (tool_id) REFERENCES tools(id) ON DELETE CASCADE;

-- 10. 最终验证查询
SELECT 
  'Database structure check complete' as status,
  (SELECT COUNT(*) FROM tools) as tools_count,
  (SELECT COUNT(*) FROM categories) as categories_count,
  (SELECT COUNT(*) FROM admin_users) as admin_count,
  (SELECT COUNT(*) FROM user_favorites) as favorites_count,
  (SELECT COUNT(*) FROM tool_reviews) as reviews_count;