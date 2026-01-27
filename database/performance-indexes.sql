-- ============================================================
-- tumuai.net 性能优化 - 数据库索引
-- ============================================================
-- 说明：
-- 1. 这些索引可以显著提升 tools 表的查询性能
-- 2. 部分索引 (Partial Index) 只对 status='published' 的行创建索引
-- 3. GIN 索引用于数组字段 (categories, features) 的查询优化
-- ============================================================

-- ============================================================
-- 步骤1：检查现有索引
-- ============================================================
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'tools';

-- ============================================================
-- 步骤2：创建性能优化索引
-- ============================================================

-- 索引1：状态 + 投票数排序索引（最常用）
-- 用途：首页工具列表按 upvotes 排序
CREATE INDEX IF NOT EXISTS idx_tools_status_upvotes
ON tools (status, upvotes DESC)
WHERE status = 'published';

-- 索引2：分类数组索引（GIN）
-- 用途：按分类筛选工具
CREATE INDEX IF NOT EXISTS idx_tools_categories_gin
ON tools USING GIN (categories)
WHERE status = 'published';

-- 索引3：功能特性数组索引（GIN）
-- 用途：按功能特性筛选工具
CREATE INDEX IF NOT EXISTS idx_tools_features_gin
ON tools USING GIN (features)
WHERE status = 'published';

-- 索引4：状态 + 日期排序索引
-- 用途：按日期排序获取最新工具
CREATE INDEX IF NOT EXISTS idx_tools_status_date_added
ON tools (status, date_added DESC)
WHERE status = 'published';

-- 索引5：状态 + 浏览量排序索引
-- 用途：按浏览量排序工具
CREATE INDEX IF NOT EXISTS idx_tools_status_views
ON tools (status, views DESC)
WHERE status = 'published';

-- 索引6：状态 + 评分排序索引
-- 用途：按评分排序工具
CREATE INDEX IF NOT EXISTS idx_tools_status_rating
ON tools (status, rating DESC)
WHERE status = 'published';

-- 索引7：精选工具索引
-- 用途：获取首页精选工具
CREATE INDEX IF NOT EXISTS idx_tools_featured_status
ON tools (featured, status, upvotes DESC)
WHERE featured = true AND status = 'published';

-- 索引8：全文搜索优化（可选）
-- 用途：加速名称和描述的模糊搜索
-- 注意：需要先创建 to_tsvector 列或使用表达式索引
-- CREATE INDEX IF NOT EXISTS idx_tools_fulltext_search
-- ON tools USING GIN (to_tsvector('english', coalesce(name, '') || ' ' || coalesce(tagline, '') || ' ' || coalesce(description, '')))
-- WHERE status = 'published';

-- ============================================================
-- 步骤3：分析查询计划（验证索引效果）
-- ============================================================

-- 查看首页查询的执行计划
EXPLAIN ANALYZE
SELECT id, name, tagline, logo_url, categories, features, pricing, rating, views, upvotes, date_added
FROM tools
WHERE status = 'published'
ORDER BY upvotes DESC
LIMIT 12;

-- 查看分类筛选查询的执行计划
EXPLAIN ANALYZE
SELECT *
FROM tools
WHERE status = 'published'
AND categories && ARRAY['结构分析', 'CAD']
ORDER BY upvotes DESC;

-- ============================================================
-- 步骤4：索引维护（定期执行）
-- ============================================================

-- 分析表以更新统计信息
ANALYZE tools;

-- 清理死锁和优化表
VACUUM ANALYZE tools;

-- ============================================================
-- 预期性能提升
-- ============================================================
-- - 首页列表查询: ~200ms → ~50ms (75% 提升)
-- - 分类筛选查询: ~300ms → ~80ms (73% 提升)
-- - 功能筛选查询: ~400ms → ~100ms (75% 提升)
-- ============================================================
