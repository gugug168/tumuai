-- ============================================================
-- 高级性能优化索引 - Phase 2 (2025-02-05)
-- ============================================================
-- 目标: 进一步优化查询性能，针对高频筛选场景
-- 依赖: 20260202_performance_indexes.sql
-- ============================================================

-- ============================================================
-- 新增: 复合索引用于多条件筛选
-- ============================================================

-- 定价 + 排序复合索引（用于 pricing + sortBy 组合）
-- 查询: WHERE status = 'published' AND pricing = 'Free' ORDER BY upvotes DESC
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tools_published_pricing_upvotes
ON tools (status, pricing, upvotes DESC NULLS LAST)
WHERE status = 'published';

-- 定价 + 日期复合索引
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tools_published_pricing_date
ON tools (status, pricing, date_added DESC NULLS LAST)
WHERE status = 'published';

-- 定价 + 评分复合索引
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tools_published_pricing_rating
ON tools (status, pricing, rating DESC NULLS LAST)
WHERE status = 'published';

-- ============================================================
-- 新增: 全文搜索优化
-- ============================================================

-- 为名称和简介添加三元组索引（用于模糊搜索）
-- 需要 pg_trgm 扩展
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tools_name_trgm
ON tools USING gin (name gin_trgm_ops)
WHERE status = 'published';

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tools_tagline_trgm
ON tools USING gin (tagline gin_trgm_ops)
WHERE status = 'published';

-- ============================================================
-- 新增: 热门工具查询优化
-- ============================================================

-- 精选 + 热门组合索引（首页featured工具）
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tools_published_featured_upvotes
ON tools (status, featured, upvotes DESC NULLS LAST)
WHERE status = 'published' AND featured = true;

-- ============================================================
-- 新增: 管理后台查询优化
-- ============================================================

-- 待审核工具索引
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tools_pending_status
ON tools (status, date_added DESC)
WHERE status = 'pending';

-- 所有状态工具索引（管理员统计）
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tools_all_status
ON tools (status, date_added DESC);

-- ============================================================
-- 新增: 用户收藏相关查询优化
-- ============================================================

-- user_favorites 表索引（如果尚未存在）
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_favorites_user_id
ON user_favorites (user_id, created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_favorites_tool_id
ON user_favorites (tool_id);

-- ============================================================
-- 维护: 更新统计信息
-- ============================================================

ANALYZE tools;
ANALYZE user_favorites;

-- ============================================================
-- 验证查询（执行后可运行这些查询检查索引使用情况）
-- ============================================================

-- 查看所有工具表索引
-- SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'tools' ORDER BY indexname;

-- 检查索引大小
-- SELECT
--   indexname,
--   pg_size_pretty(pg_relation_size(indexrelid)) AS size
-- FROM pg_stat_user_indexes
-- WHERE schemaname = 'public' AND tablename = 'tools'
-- ORDER BY pg_relation_size(indexrelid) DESC;

-- 分析特定查询计划
-- EXPLAIN ANALYZE
-- SELECT * FROM tools
-- WHERE status = 'published'
--   AND categories && ARRAY['AI Assistant']
--   AND pricing = 'Free'
-- ORDER BY upvotes DESC
-- LIMIT 12;

-- ============================================================
-- 注意事项
-- ============================================================

-- 1. 这些索引是增量添加的，基于现有的 20260202_performance_indexes.sql
-- 2. 使用 CONCURRENTLY 避免表锁定
-- 3. 索引会占用额外存储空间，但显著提升查询性能
-- 4. 建议在非高峰期执行索引创建
