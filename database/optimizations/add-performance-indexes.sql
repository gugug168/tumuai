-- ============================================
-- Civil AI Hub - 性能优化索引
-- ============================================
-- 目标: 减少查询时间 50%+
-- 创建时间: 2025-01-29
-- ============================================

-- 1. 工具表状态和热度排序索引
-- 用于: 获取已发布工具并按热度排序
-- 查询: SELECT * FROM tools WHERE status = 'published' ORDER BY upvotes DESC
CREATE INDEX IF NOT EXISTS tools_status_upvotes_idx
  ON tools(status, upvotes DESC);

-- 2. 工具表状态和精选索引
-- 用于: 获取精选工具
-- 查询: SELECT * FROM tools WHERE status = 'published' AND featured = true
CREATE INDEX IF NOT EXISTS tools_status_featured_idx
  ON tools(status, featured)
  WHERE featured = true;

-- 3. 工具表状态和日期排序索引
-- 用于: 按最新收录排序
-- 查询: SELECT * FROM tools WHERE status = 'published' ORDER BY date_added DESC
CREATE INDEX IF NOT EXISTS tools_status_date_idx
  ON tools(status, date_added DESC);

-- 4. 工具表评分排序索引
-- 用于: 按评分排序
-- 查询: SELECT * FROM tools WHERE status = 'published' ORDER BY rating DESC NULLS LAST
CREATE INDEX IF NOT EXISTS tools_status_rating_idx
  ON tools(status, rating DESC NULLS LAST);

-- 5. 工具表浏览量排序索引
-- 用于: 按浏览量排序
-- 查询: SELECT * FROM tools WHERE status = 'published' ORDER BY views DESC
CREATE INDEX IF NOT EXISTS tools_status_views_idx
  ON tools(status, views DESC);

-- 6. 用户收藏表复合索引
-- 用于: 检查用户收藏状态和批量查询
-- 查询: SELECT * FROM user_favorites WHERE user_id = $1 AND tool_id = ANY($2)
CREATE INDEX IF NOT EXISTS user_favorites_user_tool_idx
  ON user_favorites(user_id, tool_id);

-- 7. 用户收藏表用户索引
-- 用于: 获取用户所有收藏
-- 查询: SELECT * FROM user_favorites WHERE user_id = $1
CREATE INDEX IF NOT EXISTS user_favorites_user_idx
  ON user_favorites(user_id);

-- 8. 工具表分类 GIN 索引
-- 用于: 分类筛选 (数组包含查询)
-- 查询: SELECT * FROM tools WHERE status = 'published' AND categories && $1
CREATE INDEX IF NOT EXISTS tools_categories_gin_idx
  ON tools USING GIN (categories);

-- 9. 工具表功能 GIN 索引
-- 用于: 功能特性筛选 (数组包含查询)
-- 查询: SELECT * FROM tools WHERE status = 'published' AND features && $1
CREATE INDEX IF NOT EXISTS tools_features_gin_idx
  ON tools USING GIN (features);

-- 10. 工具表定价索引
-- 用于: 按定价模式筛选
-- 查询: SELECT * FROM tools WHERE status = 'published' AND pricing = $1
CREATE INDEX IF NOT EXISTS tools_status_pricing_idx
  ON tools(status, pricing);

-- ============================================
-- 索引分析
-- ============================================

-- 查看索引大小
SELECT
  schemaname,
  tablename,
  indexname,
  pg_size_pretty(pg_relation_size(indexname::text)) AS index_size
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename IN ('tools', 'user_favorites')
ORDER BY pg_relation_size(indexname::text) DESC;

-- 查看索引使用情况
SELECT
  schemaname,
  tablename,
  indexname,
  idx_scan AS index_scans,
  idx_tup_read AS tuples_read,
  idx_tup_fetch AS tuples_fetched
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
  AND tablename IN ('tools', 'user_favorites')
ORDER BY idx_scan DESC;

-- ============================================
-- 验证查询计划
-- ============================================

-- 验证热度排序查询
EXPLAIN ANALYZE
SELECT id, name, upvotes
FROM tools
WHERE status = 'published'
ORDER BY upvotes DESC
LIMIT 12;

-- 验证分类筛选查询
EXPLAIN ANALYZE
SELECT id, name, categories
FROM tools
WHERE status = 'published'
  AND categories && ARRAY['AI结构设计']
ORDER BY upvotes DESC
LIMIT 12;

-- 验证用户收藏查询
EXPLAIN ANALYZE
SELECT tool_id
FROM user_favorites
WHERE user_id = 'user-id-here'
  AND tool_id = ANY(ARRAY['tool1', 'tool2', 'tool3']);
