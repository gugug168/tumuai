-- ============================================================
-- Performance Optimization Indexes for tools table
-- ============================================================
-- 目标: 优化 tools-cache.ts 的查询性能
-- 创建时间: 2026-02-02
-- ============================================================

-- 根据顾问报告，以下现有索引未被使用，将被删除：
-- - tools_date_added
-- - tools_rating
-- - tools_website_status
-- - tools_normalized_url
-- - tools_status_upvotes (多个版本)
-- - tools_features_gin
-- - tools_status_views
-- - tools_featured_status

-- ============================================================
-- 步骤 1: 删除未使用的索引
-- ============================================================

drop index if exists tools_date_added;
drop index if exists tools_rating;
drop index if exists tools_website_status;
drop index if exists tools_normalized_url;
drop index if exists tools_idx_tools_date_added;
drop index if exists tools_idx_tools_rating;
drop index if exists tools_idx_tools_website_status;
drop index if exists tools_idx_tools_normalized_url;
drop index if exists tools_status_upvotes;
drop index if exists tools_idx_tools_status_upvotes;
drop index if exists tools_tools_status_upvotes_idx;
drop index if exists tools_features_gin;
drop index if exists tools_idx_tools_features_gin;
drop index if exists tools_status_views;
drop index if exists tools_idx_tools_status_views;
drop index if exists tools_featured_status;
drop index if exists tools_idx_tools_featured_status;

-- ============================================================
-- 步骤 2: 创建优化的索引
-- ============================================================

-- 主查询索引 (status + upvotes) - 用于默认排序
-- 查询: WHERE status = 'published' ORDER BY upvotes DESC
create index concurrently if not exists idx_tools_published_upvotes
on tools (status, upvotes desc nulls last);

-- 按日期排序索引
-- 查询: WHERE status = 'published' ORDER BY date_added DESC
create index concurrently if not exists idx_tools_published_date_added
on tools (status, date_added desc nulls last);

-- 按评分排序索引
-- 查询: WHERE status = 'published' ORDER BY rating DESC
create index concurrently if not exists idx_tools_published_rating
on tools (status, rating desc nulls last);

-- 按浏览量排序索引
-- 查询: WHERE status = 'published' ORDER BY views DESC
create index concurrently if not exists idx_tools_published_views
on tools (status, views desc nulls last);

-- Featured 工具索引
-- 查询: WHERE status = 'published' AND featured = true ORDER BY upvotes DESC
create index concurrently if not exists idx_tools_published_featured
on tools (status, featured, upvotes desc nulls last);

-- 分类 GIN 索引 (用于数组 overlap 查询)
-- 查询: WHERE status = 'published' AND categories && ['category']
create index concurrently if not exists idx_tools_categories_gin
on tools using gin (categories)
where status = 'published';

-- Features GIN 索引
-- 查询: WHERE status = 'published' AND features && ['feature']
create index concurrently if not exists idx_tools_features_gin
on tools using gin (features)
where status = 'published';

-- 定价筛选索引
-- 查询: WHERE status = 'published' AND pricing = 'Paid'
create index concurrently if not exists idx_tools_published_pricing
on tools (status, pricing, upvotes desc nulls last);

-- ============================================================
-- 步骤 3: 修复 RLS 策略性能问题
-- ============================================================

-- 当前的 RLS 策略使用了 auth.uid() 直接调用
-- 应该改用 (select auth.uid()) 来提升性能
-- 注意: 这需要在 Supabase Dashboard 的 SQL Editor 中手动执行

-- 查看 RLS 策略:
-- select * from pg_policies where tablename = 'tools';

-- 修复 RLS 策略的 SQL (需要手动验证后执行):
-- alter policy "Tools are manageable by admins" on tools
-- using (
--   (select auth.uid()) in (
--     select user_id from user_profiles where is_admin = true
--   )
-- );

-- ============================================================
-- 步骤 4: 更新统计信息
-- ============================================================

analyze tools;

-- ============================================================
-- 验证查询
-- ============================================================

-- 查看所有索引:
-- select indexname, indexdef from pg_indexes where tablename = 'tools' order by indexname;

-- 分析主查询计划:
-- explain analyze
-- select id, name, tagline, upvotes
-- from tools
-- where status = 'published'
-- order by upvotes desc
-- limit 12;

-- ============================================================
-- 注意事项
-- ============================================================

-- 1. 使用 CONCURRENTLY 创建索引可以避免锁定表，但耗时更长
-- 2. 如果创建失败，可以去掉 CONCURRENTLY 关键字重试
-- 3. 索引创建完成后，需要监控查询性能是否改善
-- 4. 未使用的索引应该定期清理，避免影响写入性能
