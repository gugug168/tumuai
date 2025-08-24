-- =====================================================
-- Civil AI Hub 数据库优化脚本
-- 执行前请先备份数据库！
-- =====================================================

-- 1. 创建自定义枚举类型
DO $$ BEGIN
    CREATE TYPE pricing_type AS ENUM ('Free', 'Freemium', 'Paid', 'Trial');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE status_type AS ENUM ('published', 'draft', 'pending', 'archived');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. 核心性能索引（按优先级排序）
-- 高优先级：工具列表查询索引
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tools_status_upvotes 
ON tools(status, upvotes DESC) 
WHERE status = 'published';

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tools_status_date_added 
ON tools(status, date_added DESC) 
WHERE status = 'published';

-- 精选工具索引
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tools_featured_published 
ON tools(featured, status, upvotes DESC) 
WHERE featured = true AND status = 'published';

-- 全文搜索索引（替代ILIKE查询）
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tools_search_gin 
ON tools USING gin(to_tsvector('simple', name || ' ' || tagline || ' ' || coalesce(description, '')));

-- 分类查询索引
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tools_categories_gin 
ON tools USING gin(categories);

-- 工具详情查询索引
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tools_id_status 
ON tools(id, status) 
WHERE status = 'published';

-- 统计字段索引
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tools_views 
ON tools(views DESC) 
WHERE status = 'published';

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tools_rating 
ON tools(rating DESC) 
WHERE status = 'published' AND rating IS NOT NULL;

-- 3. 分类表索引
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_categories_active_sort 
ON categories(is_active, sort_order, name) 
WHERE is_active = true;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_categories_slug 
ON categories(slug) 
WHERE is_active = true;

-- 4. 管理相关索引
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_admin_users_user_id 
ON admin_users(user_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tool_submissions_status_created 
ON tool_submissions(status, created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_admin_logs_admin_created 
ON admin_logs(admin_id, created_at DESC);

-- 5. 数据完整性约束
-- 工具表约束
DO $$ BEGIN
    ALTER TABLE tools 
    ADD CONSTRAINT chk_tools_name_length CHECK (length(trim(name)) >= 1 AND length(name) <= 200);
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE tools 
    ADD CONSTRAINT chk_tools_tagline_length CHECK (length(trim(tagline)) >= 1 AND length(tagline) <= 500);
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE tools 
    ADD CONSTRAINT chk_tools_website_url_format CHECK (website_url ~* '^https?://[^\s]+$');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE tools 
    ADD CONSTRAINT chk_tools_upvotes_positive CHECK (upvotes >= 0);
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE tools 
    ADD CONSTRAINT chk_tools_views_positive CHECK (views >= 0);
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE tools 
    ADD CONSTRAINT chk_tools_rating_range CHECK (rating >= 0 AND rating <= 5);
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE tools 
    ADD CONSTRAINT chk_tools_review_count_positive CHECK (review_count >= 0);
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 6. 外键约束（如果category_id字段存在）
DO $$ BEGIN
    ALTER TABLE tools 
    ADD CONSTRAINT fk_tools_category 
    FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL;
EXCEPTION
    WHEN duplicate_object THEN null;
    WHEN undefined_column THEN null;
END $$;

-- 7. 唯一约束
DO $$ BEGIN
    ALTER TABLE tools 
    ADD CONSTRAINT unq_tools_website_url UNIQUE (website_url);
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE categories 
    ADD CONSTRAINT unq_categories_name UNIQUE (name);
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 8. 自动更新时间戳触发器
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_tools_updated_at ON tools;
CREATE TRIGGER trigger_tools_updated_at
    BEFORE UPDATE ON tools
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trigger_categories_updated_at ON categories;
CREATE TRIGGER trigger_categories_updated_at
    BEFORE UPDATE ON categories
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 9. 工具-分类关联表（推荐替代数组字段）
CREATE TABLE IF NOT EXISTS tool_categories (
    tool_id UUID NOT NULL REFERENCES tools(id) ON DELETE CASCADE,
    category_id UUID NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
    is_primary BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (tool_id, category_id)
);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tool_categories_tool_id 
ON tool_categories(tool_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tool_categories_category_id 
ON tool_categories(category_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tool_categories_primary 
ON tool_categories(category_id, is_primary) 
WHERE is_primary = true;

-- 10. 统计表（用于缓存复杂统计查询）
CREATE TABLE IF NOT EXISTS tool_stats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    total_tools INTEGER DEFAULT 0,
    published_tools INTEGER DEFAULT 0,
    featured_tools INTEGER DEFAULT 0,
    total_categories INTEGER DEFAULT 0,
    total_views BIGINT DEFAULT 0,
    total_upvotes BIGINT DEFAULT 0,
    avg_rating DECIMAL(3,2) DEFAULT 0,
    last_updated TIMESTAMPTZ DEFAULT NOW()
);

-- 插入初始统计数据
INSERT INTO tool_stats (total_tools, published_tools, featured_tools, total_categories, total_views, total_upvotes, avg_rating)
SELECT 
    COUNT(*) as total_tools,
    COUNT(*) FILTER (WHERE status = 'published') as published_tools,
    COUNT(*) FILTER (WHERE featured = true AND status = 'published') as featured_tools,
    (SELECT COUNT(*) FROM categories WHERE is_active = true) as total_categories,
    COALESCE(SUM(views), 0) as total_views,
    COALESCE(SUM(upvotes), 0) as total_upvotes,
    ROUND(AVG(rating), 2) as avg_rating
FROM tools
WHERE status = 'published'
ON CONFLICT DO NOTHING;

-- 11. 性能监控视图
CREATE OR REPLACE VIEW v_database_performance AS
SELECT 
    'tools' as table_name,
    pg_size_pretty(pg_total_relation_size('tools')) as table_size,
    pg_size_pretty(pg_indexes_size('tools')) as indexes_size,
    (SELECT COUNT(*) FROM tools) as row_count,
    (SELECT COUNT(*) FROM tools WHERE status = 'published') as published_count
UNION ALL
SELECT 
    'categories' as table_name,
    pg_size_pretty(pg_total_relation_size('categories')) as table_size,
    pg_size_pretty(pg_indexes_size('categories')) as indexes_size,
    (SELECT COUNT(*) FROM categories) as row_count,
    (SELECT COUNT(*) FROM categories WHERE is_active = true) as active_count;

-- 12. 慢查询优化建议
CREATE OR REPLACE VIEW v_query_optimization_suggestions AS
SELECT 
    'Add compound index for search queries' as suggestion,
    'CREATE INDEX idx_tools_search_compound ON tools(status, name, tagline);' as sql_command,
    'High' as priority
UNION ALL
SELECT 
    'Consider partitioning tools table by date_added when > 1M records',
    'ALTER TABLE tools PARTITION BY RANGE (date_added);',
    'Medium'
UNION ALL
SELECT 
    'Add covering index for list queries',
    'CREATE INDEX idx_tools_list_covering ON tools(status, upvotes DESC) INCLUDE (id, name, tagline, logo_url);',
    'Medium';

-- 执行完成提示
SELECT 'Database optimization completed successfully!' as status;

-- =====================================================
-- 验证脚本 - 检查优化效果
-- =====================================================

-- 检查索引创建情况
SELECT 
    schemaname, 
    tablename, 
    indexname, 
    indexdef 
FROM pg_indexes 
WHERE schemaname = 'public' 
  AND tablename IN ('tools', 'categories', 'tool_categories')
ORDER BY tablename, indexname;

-- 检查约束创建情况
SELECT 
    conname as constraint_name,
    conrelid::regclass as table_name,
    contype as constraint_type,
    pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint 
WHERE conrelid::regclass::text IN ('tools', 'categories')
ORDER BY conrelid::regclass, conname;

-- 检查触发器
SELECT 
    trigger_name,
    table_name,
    action_timing,
    event_manipulation
FROM information_schema.triggers 
WHERE table_schema = 'public'
  AND table_name IN ('tools', 'categories');

-- 性能测试查询示例
EXPLAIN ANALYZE 
SELECT id, name, tagline, logo_url, pricing, rating, upvotes 
FROM tools 
WHERE status = 'published' 
ORDER BY upvotes DESC 
LIMIT 20;

EXPLAIN ANALYZE 
SELECT * FROM tools 
WHERE status = 'published' 
  AND to_tsvector('simple', name || ' ' || tagline || ' ' || coalesce(description, '')) 
      @@ plainto_tsquery('simple', 'AI design');