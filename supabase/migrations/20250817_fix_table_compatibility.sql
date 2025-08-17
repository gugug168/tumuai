-- 修复代码与数据库表名不匹配问题
-- 确保所有功能正常使用

-- 1. 创建代码兼容的表名映射
-- 代码使用tool_favorites，数据库使用user_favorites
-- 代码使用tool_reviews，数据库可能有tool_comments

-- 2. 创建兼容视图（使代码正常工作）
CREATE OR REPLACE VIEW tool_favorites AS
SELECT 
  id,
  user_id,
  tool_id,
  created_at
FROM user_favorites;

-- 3. 确保所有字段匹配
-- 检查并修复tool_reviews表结构
DO $$
BEGIN
  -- 确保tool_reviews表有所有必需字段
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'tool_reviews' AND column_name = 'title'
  ) THEN
    ALTER TABLE tool_reviews ADD COLUMN title text;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'tool_reviews' AND column_name = 'content'
  ) THEN
    ALTER TABLE tool_reviews ADD COLUMN content text;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'tool_reviews' AND column_name = 'helpful_count'
  ) THEN
    ALTER TABLE tool_reviews ADD COLUMN helpful_count integer DEFAULT 0;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'tool_reviews' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE tool_reviews ADD COLUMN updated_at timestamptz DEFAULT now();
  END IF;
END $$;

-- 4. 确保tool_comments表结构正确
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'tool_comments' AND column_name = 'likes_count'
  ) THEN
    ALTER TABLE tool_comments ADD COLUMN likes_count integer DEFAULT 0;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'tool_comments' AND column_name = 'parent_id'
  ) THEN
    ALTER TABLE tool_comments ADD COLUMN parent_id uuid;
  END IF;
END $$;

-- 5. 修复外键引用
ALTER TABLE tool_favorites DROP CONSTRAINT IF EXISTS tool_favorites_tool_id_fkey;
ALTER TABLE tool_favorites ADD CONSTRAINT tool_favorites_tool_id_fkey FOREIGN KEY (tool_id) REFERENCES tools(id) ON DELETE CASCADE;

-- 6. 创建缺失的comment_likes表
CREATE TABLE IF NOT EXISTS comment_likes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  comment_id uuid NOT NULL REFERENCES tool_comments(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, comment_id)
);

-- 7. 创建兼容性触发器（确保数据一致性）
CREATE OR REPLACE FUNCTION sync_favorites_tables()
RETURNS TRIGGER AS $$
BEGIN
  -- 保持tool_favorites和user_favorites同步
  IF TG_TABLE_NAME = 'user_favorites' THEN
    IF TG_OP = 'INSERT' THEN
      -- 自动更新工具收藏数
      UPDATE tools SET favorites_count = COALESCE(favorites_count, 0) + 1 WHERE id = NEW.tool_id;
    ELSIF TG_OP = 'DELETE' THEN
      UPDATE tools SET favorites_count = COALESCE(favorites_count, 0) - 1 WHERE id = OLD.tool_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 8. 创建触发器（如果不存在）
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'sync_favorites'
  ) THEN
    CREATE TRIGGER sync_favorites
      AFTER INSERT OR DELETE ON user_favorites
      FOR EACH ROW EXECUTE FUNCTION sync_favorites_tables();
  END IF;
END $$;

-- 9. 修复RLS权限
ALTER TABLE comment_likes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Comment likes by user" ON comment_likes FOR ALL TO authenticated USING (auth.uid() = user_id);

-- 10. 最终验证
SELECT 
  '数据库兼容性检查完成' as message,
  (SELECT COUNT(*) FROM tools) as tools_count,
  (SELECT COUNT(*) FROM user_favorites) as favorites_count,
  (SELECT COUNT(*) FROM tool_reviews) as reviews_count,
  (SELECT COUNT(*) FROM tool_comments) as comments_count;