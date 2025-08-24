-- =============================================================================
-- Civil AI Hub - PostgreSQL数据库优化脚本
-- 版本: 1.0
-- 创建时间: 2025-08-23
-- 
-- 说明: 本脚本包含针对Civil AI Hub项目的全面数据库优化
-- 执行前请确保：
-- 1. 已备份数据库
-- 2. 在测试环境验证
-- 3. 在维护窗口执行
-- =============================================================================

-- 启用必要的扩展
CREATE EXTENSION IF NOT EXISTS pg_trgm;          -- 三元组相似度搜索
CREATE EXTENSION IF NOT EXISTS pg_stat_statements; -- 查询统计
CREATE EXTENSION IF NOT EXISTS btree_gin;        -- B-tree GIN索引支持

-- =============================================================================
-- 第一阶段：核心索引优化（立即执行 - 高优先级）
-- =============================================================================

-- 1.1 工具表基础性能索引
-- 最频繁查询：按状态和点赞数排序的工具列表
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tools_status_upvotes 
ON tools (status, upvotes DESC) 
WHERE status = 'published';

-- 最新工具查询：按状态和添加时间排序
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tools_status_date_added 
ON tools (status, date_added DESC) 
WHERE status = 'published';

-- 精选工具快速查询
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tools_featured_published 
ON tools (featured, status, upvotes DESC) 
WHERE featured = true AND status = 'published';

-- 工具详情查询优化：ID + 状态验证
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tools_id_status 
ON tools (id, status) 
WHERE status = 'published';

-- 定价筛选索引
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tools_status_pricing 
ON tools (status, pricing, upvotes DESC) 
WHERE status = 'published';

-- =============================================================================
-- 第二阶段：数组字段搜索优化（高优先级）
-- =============================================================================

-- 2.1 分类数组GIN索引 - 支持高效的数组包含查询
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tools_categories_gin 
ON tools USING GIN (categories)
WHERE status = 'published';

-- 2.2 功能数组GIN索引
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tools_features_gin 
ON tools USING GIN (features)
WHERE status = 'published';

-- 2.3 复合GIN索引：状态 + 分类 + 排序字段
-- 注意：此索引较大，仅在分类筛选频繁时创建
-- CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tools_status_categories_composite 
-- ON tools USING GIN (categories) 
-- INCLUDE (status, upvotes, date_added)
-- WHERE status = 'published';

-- =============================================================================
-- 第三阶段：全文搜索优化（中等优先级）
-- =============================================================================

-- 3.1 添加全文搜索向量列
-- 注意：此操作会锁表，建议在维护窗口执行
DO $$ 
BEGIN
    -- 检查列是否已存在
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'tools' 
        AND column_name = 'search_vector'
    ) THEN
        -- 添加搜索向量列
        ALTER TABLE tools 
        ADD COLUMN search_vector tsvector 
        GENERATED ALWAYS AS (
            setweight(to_tsvector('english', coalesce(name, '')), 'A') ||
            setweight(to_tsvector('english', coalesce(tagline, '')), 'B') ||
            setweight(to_tsvector('english', coalesce(description, '')), 'C')
        ) STORED;
        
        RAISE NOTICE '✅ 已添加search_vector列';
    ELSE
        RAISE NOTICE '⚠️ search_vector列已存在，跳过添加';
    END IF;
END $$;

-- 3.2 全文搜索GIN索引
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tools_search_vector_gin 
ON tools USING GIN (search_vector)
WHERE status = 'published';

-- 3.3 三元组相似度索引（中文搜索友好）
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tools_name_trigram 
ON tools USING GIN (name gin_trgm_ops)
WHERE status = 'published';

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tools_tagline_trigram 
ON tools USING GIN (tagline gin_trgm_ops)
WHERE status = 'published';

-- =============================================================================
-- 第四阶段：统计和管理索引（低优先级）
-- =============================================================================

-- 4.1 浏览量统计优化
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tools_status_views 
ON tools (status, views DESC) 
WHERE status = 'published';

-- 4.2 评分统计索引
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tools_status_rating 
ON tools (status, rating DESC, review_count DESC) 
WHERE status = 'published' AND rating > 0;

-- 4.3 时间范围查询索引
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tools_created_at 
ON tools (created_at DESC)
WHERE status = 'published';

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tools_updated_at 
ON tools (updated_at DESC)
WHERE status = 'published';

-- =============================================================================
-- 第五阶段：查询优化函数和存储过程
-- =============================================================================

-- 5.1 原子浏览量增加函数（解决N+1问题）
CREATE OR REPLACE FUNCTION increment_tool_views(tool_id_param text)
RETURNS integer AS $$
DECLARE
    new_views integer;
BEGIN
    UPDATE tools 
    SET views = views + 1,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = tool_id_param 
      AND status = 'published'
    RETURNING views INTO new_views;
    
    IF new_views IS NULL THEN
        RAISE EXCEPTION 'Tool not found or not published: %', tool_id_param;
    END IF;
    
    RETURN new_views;
END;
$$ LANGUAGE plpgsql;

-- 5.2 批量浏览量更新函数
CREATE OR REPLACE FUNCTION batch_increment_tool_views(tool_increments jsonb)
RETURNS void AS $$
BEGIN
    UPDATE tools 
    SET views = views + (tool_increments->>tools.id)::integer,
        updated_at = CURRENT_TIMESTAMP
    FROM jsonb_each_text(tool_increments) AS j(tool_id, increment_val)
    WHERE tools.id = j.tool_id 
      AND tools.status = 'published'
      AND (tool_increments->>tools.id) IS NOT NULL;
END;
$$ LANGUAGE plpgsql;

-- 5.3 高性能工具搜索函数
CREATE OR REPLACE FUNCTION search_tools_optimized(
    search_query text DEFAULT '',
    filter_categories text[] DEFAULT NULL,
    filter_features text[] DEFAULT NULL,
    filter_pricing text DEFAULT NULL,
    sort_by text DEFAULT 'upvotes',
    sort_order text DEFAULT 'desc',
    limit_count integer DEFAULT 20,
    offset_count integer DEFAULT 0
)
RETURNS TABLE (
    id text,
    name text,
    tagline text,
    logo_url text,
    categories text[],
    features text[],
    pricing text,
    rating numeric,
    views integer,
    upvotes integer,
    date_added timestamp,
    search_rank real
) AS $$
DECLARE
    query_sql text;
    where_conditions text[] := ARRAY['status = ''published'''];
    order_clause text;
BEGIN
    -- 构建搜索条件
    IF search_query IS NOT NULL AND length(trim(search_query)) > 0 THEN
        -- 优先使用全文搜索，降级到三元组搜索
        where_conditions := where_conditions || ARRAY[
            '(search_vector @@ plainto_tsquery(''english'', ''' || search_query || ''') OR ' ||
            'name % ''' || search_query || ''' OR tagline % ''' || search_query || ''')'
        ];
    END IF;
    
    -- 分类筛选
    IF filter_categories IS NOT NULL AND array_length(filter_categories, 1) > 0 THEN
        where_conditions := where_conditions || ARRAY['categories @> ARRAY[''' || array_to_string(filter_categories, ''',''') || ''']'];
    END IF;
    
    -- 功能筛选
    IF filter_features IS NOT NULL AND array_length(filter_features, 1) > 0 THEN
        where_conditions := where_conditions || ARRAY['features @> ARRAY[''' || array_to_string(filter_features, ''',''') || ''']'];
    END IF;
    
    -- 定价筛选
    IF filter_pricing IS NOT NULL THEN
        where_conditions := where_conditions || ARRAY['pricing = ''' || filter_pricing || ''''];
    END IF;
    
    -- 构建排序子句
    CASE sort_by
        WHEN 'upvotes' THEN order_clause := 'upvotes';
        WHEN 'views' THEN order_clause := 'views';
        WHEN 'rating' THEN order_clause := 'rating';
        WHEN 'date_added' THEN order_clause := 'date_added';
        WHEN 'name' THEN order_clause := 'name';
        ELSE order_clause := 'upvotes';
    END CASE;
    
    IF sort_order = 'desc' THEN
        order_clause := order_clause || ' DESC';
    ELSE
        order_clause := order_clause || ' ASC';
    END IF;
    
    -- 如果有搜索查询，添加相关性排序
    IF search_query IS NOT NULL AND length(trim(search_query)) > 0 THEN
        order_clause := 'search_rank DESC, ' || order_clause;
    END IF;
    
    -- 构建最终查询
    query_sql := 'SELECT t.id, t.name, t.tagline, t.logo_url, t.categories, t.features, 
                         t.pricing, t.rating, t.views, t.upvotes, t.date_added, ';
                         
    IF search_query IS NOT NULL AND length(trim(search_query)) > 0 THEN
        query_sql := query_sql || 'COALESCE(ts_rank(t.search_vector, plainto_tsquery(''english'', ''' || search_query || ''')), 0) + 
                                   COALESCE(similarity(t.name, ''' || search_query || '''), 0) * 0.5 + 
                                   COALESCE(similarity(t.tagline, ''' || search_query || '''), 0) * 0.3 AS search_rank ';
    ELSE
        query_sql := query_sql || '0 AS search_rank ';
    END IF;
    
    query_sql := query_sql || 'FROM tools t WHERE ' || array_to_string(where_conditions, ' AND ') ||
                 ' ORDER BY ' || order_clause || ', t.id DESC' ||
                 ' LIMIT ' || limit_count || ' OFFSET ' || offset_count;
    
    RETURN QUERY EXECUTE query_sql;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- 第六阶段：性能监控和统计
-- =============================================================================

-- 6.1 查询性能基准测试函数
CREATE OR REPLACE FUNCTION benchmark_query(
    query_sql text, 
    iterations integer DEFAULT 10
)
RETURNS TABLE (
    avg_duration_ms numeric,
    min_duration_ms numeric,
    max_duration_ms numeric,
    total_duration_ms numeric,
    iterations_run integer
) AS $$
DECLARE
    start_time timestamp;
    end_time timestamp;
    duration_ms numeric;
    total_ms numeric := 0;
    min_ms numeric := 999999;
    max_ms numeric := 0;
    i integer;
BEGIN
    FOR i IN 1..iterations LOOP
        start_time := clock_timestamp();
        EXECUTE query_sql;
        end_time := clock_timestamp();
        
        duration_ms := EXTRACT(EPOCH FROM (end_time - start_time)) * 1000;
        total_ms := total_ms + duration_ms;
        min_ms := LEAST(min_ms, duration_ms);
        max_ms := GREATEST(max_ms, duration_ms);
    END LOOP;
    
    RETURN QUERY SELECT 
        ROUND(total_ms / iterations, 2),
        ROUND(min_ms, 2),
        ROUND(max_ms, 2),
        ROUND(total_ms, 2),
        iterations;
END;
$$ LANGUAGE plpgsql;

-- 6.2 慢查询分析视图
CREATE OR REPLACE VIEW v_slow_queries AS
SELECT 
    query,
    calls,
    total_time,
    round(mean_time::numeric, 2) as mean_time_ms,
    round(max_time::numeric, 2) as max_time_ms,
    round(min_time::numeric, 2) as min_time_ms,
    rows,
    round(100.0 * shared_blks_hit / nullif(shared_blks_hit + shared_blks_read, 0), 2) AS cache_hit_percent
FROM pg_stat_statements 
WHERE mean_time > 50  -- 超过50ms的查询
ORDER BY mean_time DESC;

-- 6.3 索引使用统计视图
CREATE OR REPLACE VIEW v_index_usage AS
SELECT 
    schemaname,
    tablename,
    indexname,
    idx_scan as index_scans,
    idx_tup_read as tuples_read,
    idx_tup_fetch as tuples_fetched,
    pg_size_pretty(pg_relation_size(indexrelid)) as index_size,
    CASE 
        WHEN idx_scan = 0 THEN '🔴 未使用'
        WHEN idx_scan < 100 THEN '🟡 使用较少'
        ELSE '🟢 正常使用'
    END as usage_status
FROM pg_stat_user_indexes 
WHERE schemaname = 'public'
ORDER BY idx_scan DESC;

-- 6.4 表统计信息视图
CREATE OR REPLACE VIEW v_table_stats AS
SELECT 
    schemaname,
    tablename,
    n_live_tup as live_rows,
    n_dead_tup as dead_rows,
    round(100.0 * n_dead_tup / GREATEST(n_live_tup + n_dead_tup, 1), 2) as dead_row_percent,
    last_vacuum,
    last_autovacuum,
    last_analyze,
    last_autoanalyze,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as total_size
FROM pg_stat_user_tables 
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- =============================================================================
-- 第七阶段：数据完整性和维护
-- =============================================================================

-- 7.1 数据完整性检查函数
CREATE OR REPLACE FUNCTION check_data_integrity()
RETURNS TABLE (
    check_name text,
    status text,
    details text
) AS $$
BEGIN
    -- 检查工具数据完整性
    RETURN QUERY
    SELECT 
        'Tools with missing required fields'::text,
        CASE WHEN COUNT(*) = 0 THEN '✅ 通过' ELSE '❌ 失败' END,
        '发现 ' || COUNT(*) || ' 条记录缺少必要字段'
    FROM tools 
    WHERE name IS NULL OR name = '' 
       OR tagline IS NULL OR tagline = '' 
       OR website_url IS NULL OR website_url = ''
       OR status IS NULL;
    
    -- 检查孤立数据
    RETURN QUERY
    SELECT 
        'Tools with invalid status'::text,
        CASE WHEN COUNT(*) = 0 THEN '✅ 通过' ELSE '❌ 失败' END,
        '发现 ' || COUNT(*) || ' 条状态异常记录'
    FROM tools 
    WHERE status NOT IN ('published', 'draft', 'pending', 'archived');
    
    -- 检查数组字段
    RETURN QUERY
    SELECT 
        'Tools with invalid array fields'::text,
        CASE WHEN COUNT(*) = 0 THEN '✅ 通过' ELSE '❌ 失败' END,
        '发现 ' || COUNT(*) || ' 条数组字段异常记录'
    FROM tools 
    WHERE categories IS NULL 
       OR features IS NULL;
    
    -- 检查数值字段
    RETURN QUERY
    SELECT 
        'Tools with invalid numeric fields'::text,
        CASE WHEN COUNT(*) = 0 THEN '✅ 通过' ELSE '❌ 失败' END,
        '发现 ' || COUNT(*) || ' 条数值字段异常记录'
    FROM tools 
    WHERE upvotes < 0 
       OR views < 0 
       OR rating < 0 
       OR rating > 5 
       OR review_count < 0;
END;
$$ LANGUAGE plpgsql;

-- 7.2 清理重复数据函数
CREATE OR REPLACE FUNCTION clean_duplicate_tools()
RETURNS integer AS $$
DECLARE
    cleaned_count integer := 0;
BEGIN
    -- 删除完全重复的工具（保留最新的）
    WITH duplicate_tools AS (
        SELECT id, 
               ROW_NUMBER() OVER (
                   PARTITION BY name, website_url 
                   ORDER BY created_at DESC
               ) as rn
        FROM tools
    )
    DELETE FROM tools 
    WHERE id IN (
        SELECT id FROM duplicate_tools WHERE rn > 1
    );
    
    GET DIAGNOSTICS cleaned_count = ROW_COUNT;
    
    RETURN cleaned_count;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- 执行验证和清理
-- =============================================================================

-- 更新表统计信息
ANALYZE tools;

-- 显示索引创建结果
DO $$
BEGIN
    RAISE NOTICE '=============================================================================';
    RAISE NOTICE '✅ Civil AI Hub数据库优化脚本执行完成';
    RAISE NOTICE '=============================================================================';
    RAISE NOTICE '已创建的索引数量：%', (
        SELECT COUNT(*) 
        FROM pg_indexes 
        WHERE tablename = 'tools' 
        AND indexname LIKE 'idx_tools_%'
    );
    RAISE NOTICE '=============================================================================';
    RAISE NOTICE '请执行以下命令验证优化效果：';
    RAISE NOTICE '1. SELECT * FROM v_index_usage;';
    RAISE NOTICE '2. SELECT * FROM v_slow_queries LIMIT 10;';
    RAISE NOTICE '3. SELECT * FROM check_data_integrity();';
    RAISE NOTICE '=============================================================================';
END $$;

-- =============================================================================
-- 优化建议查询（手动执行以验证效果）
-- =============================================================================

/*
-- 📊 验证索引效果的测试查询

-- 1. 基础工具列表查询性能测试
SELECT * FROM benchmark_query(
    'SELECT id,name,tagline,logo_url,categories,features,pricing,rating,views,upvotes,date_added 
     FROM tools WHERE status = ''published'' ORDER BY upvotes DESC LIMIT 60',
    20
);

-- 2. 分类筛选查询性能测试
SELECT * FROM benchmark_query(
    'SELECT * FROM tools WHERE status = ''published'' AND categories @> ARRAY[''AI结构设计''] ORDER BY upvotes DESC LIMIT 20',
    20
);

-- 3. 全文搜索查询性能测试
SELECT * FROM benchmark_query(
    'SELECT *, ts_rank(search_vector, plainto_tsquery(''english'', ''AI'')) as rank 
     FROM tools WHERE status = ''published'' AND search_vector @@ plainto_tsquery(''english'', ''AI'') 
     ORDER BY rank DESC LIMIT 20',
    20
);

-- 4. 查看查询执行计划
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT) 
SELECT id,name,tagline,logo_url,categories,features,pricing,rating,views,upvotes,date_added
FROM tools 
WHERE status = 'published' 
ORDER BY upvotes DESC 
LIMIT 60;

-- 5. 检查索引使用情况
SELECT * FROM v_index_usage ORDER BY index_scans DESC;

-- 6. 检查慢查询
SELECT * FROM v_slow_queries LIMIT 10;

-- 7. 数据完整性检查
SELECT * FROM check_data_integrity();

*/