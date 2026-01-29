-- ============================================
-- Civil AI Hub - 性能索引创建脚本
-- 复制整个文件到 Supabase Dashboard 的 SQL Editor 中执行
-- ============================================

-- 1. 工具表状态和热度排序索引
CREATE INDEX IF NOT EXISTS tools_status_upvotes_idx
  ON tools(status, upvotes DESC);

-- 2. 工具表状态和精选索引 (部分索引)
CREATE INDEX IF NOT EXISTS tools_status_featured_idx
  ON tools(status, featured)
  WHERE featured = true;

-- 3. 工具表状态和日期排序索引
CREATE INDEX IF NOT EXISTS tools_status_date_idx
  ON tools(status, date_added DESC);

-- 4. 工具表评分排序索引
CREATE INDEX IF NOT EXISTS tools_status_rating_idx
  ON tools(status, rating DESC NULLS LAST);

-- 5. 工具表浏览量排序索引
CREATE INDEX IF NOT EXISTS tools_status_views_idx
  ON tools(status, views DESC);

-- 6. 用户收藏表复合索引
CREATE INDEX IF NOT EXISTS user_favorites_user_tool_idx
  ON user_favorites(user_id, tool_id);

-- 7. 用户收藏表用户索引
CREATE INDEX IF NOT EXISTS user_favorites_user_idx
  ON user_favorites(user_id);

-- 8. 工具表分类 GIN 索引 (数组包含查询)
CREATE INDEX IF NOT EXISTS tools_categories_gin_idx
  ON tools USING GIN (categories);

-- 9. 工具表功能 GIN 索引 (数组包含查询)
CREATE INDEX IF NOT EXISTS tools_features_gin_idx
  ON tools USING GIN (features);

-- 10. 工具表定价索引
CREATE INDEX IF NOT EXISTS tools_status_pricing_idx
  ON tools(status, pricing);

-- ============================================
-- 验证索引创建成功
-- ============================================

-- 查看所有创建的索引
SELECT
  schemaname,
  tablename,
  indexname,
  pg_size_pretty(pg_relation_size(indexname::text)) AS index_size,
  CASE
    WHEN indexdef LIKE '%DESC%' THEN 'DESC'
    ELSE 'ASC'
  END AS direction
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename IN ('tools', 'user_favorites')
ORDER BY tablename, indexname;

-- ============================================
-- 分析表以更新统计信息
-- ============================================

ANALYZE tools;
ANALYZE user_favorites;

-- ============================================
-- 验证查询计划 (可选)
-- ============================================

-- 验证热度排序查询是否使用索引
EXPLAIN (ANALYZE, BUFFERS)
SELECT id, name, upvotes
FROM tools
WHERE status = 'published'
ORDER BY upvotes DESC
LIMIT 12;

-- 验证分类筛选是否使用 GIN 索引
EXPLAIN (ANALYZE, BUFFERS)
SELECT id, name, categories
FROM tools
WHERE status = 'published'
  AND categories && ARRAY['AI结构设计']
ORDER BY upvotes DESC
LIMIT 12;
