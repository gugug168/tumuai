-- =====================================================
-- Civil AI Hub 数据库性能监控查询集合
-- =====================================================

-- 1. 索引使用情况分析
-- 查看最常用的索引
SELECT 
    schemaname,
    tablename,
    indexname,
    idx_scan as "使用次数",
    idx_tup_read as "读取行数",
    idx_tup_fetch as "获取行数",
    pg_size_pretty(pg_relation_size(indexrelid)) as "索引大小"
FROM pg_stat_user_indexes 
WHERE schemaname = 'public'
  AND tablename IN ('tools', 'categories', 'tool_categories')
ORDER BY idx_scan DESC;

-- 查看未使用的索引（需要考虑删除）
SELECT 
    schemaname,
    tablename,
    indexname,
    idx_scan as "使用次数",
    pg_size_pretty(pg_relation_size(indexrelid)) as "浪费空间"
FROM pg_stat_user_indexes 
WHERE idx_scan = 0 
  AND schemaname = 'public'
  AND indexname NOT LIKE '%_pkey'  -- 排除主键
ORDER BY pg_relation_size(indexrelid) DESC;

-- 2. 表空间使用分析
SELECT 
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as "总大小",
    pg_size_pretty(pg_relation_size(schemaname||'.'||tablename)) as "表大小",
    pg_size_pretty(pg_indexes_size(schemaname||'.'||tablename)) as "索引大小",
    pg_stat_get_tuples_inserted(c.oid) as "插入行数",
    pg_stat_get_tuples_updated(c.oid) as "更新行数",
    pg_stat_get_tuples_deleted(c.oid) as "删除行数",
    pg_stat_get_live_tuples(c.oid) as "活跃行数",
    pg_stat_get_dead_tuples(c.oid) as "死行数"
FROM pg_tables pt
JOIN pg_class c ON pt.tablename = c.relname
WHERE schemaname = 'public'
  AND tablename IN ('tools', 'categories', 'tool_categories', 'admin_users', 'tool_submissions')
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- 3. 慢查询分析（需要启用 pg_stat_statements 扩展）
-- 显示最耗时的查询
SELECT 
    query,
    calls as "调用次数",
    total_exec_time as "总耗时(ms)",
    mean_exec_time as "平均耗时(ms)",
    max_exec_time as "最大耗时(ms)",
    rows as "影响行数",
    100.0 * shared_blks_hit / nullif(shared_blks_hit + shared_blks_read, 0) as "缓存命中率%"
FROM pg_stat_statements 
WHERE query LIKE '%tools%' OR query LIKE '%categories%'
ORDER BY mean_exec_time DESC
LIMIT 10;

-- 4. 连接和活动监控
SELECT 
    pid,
    usename as "用户",
    application_name as "应用",
    client_addr as "客户端IP",
    state as "状态",
    query_start as "查询开始时间",
    state_change as "状态变更时间",
    EXTRACT(epoch FROM (now() - query_start)) as "运行时长(秒)",
    substring(query, 1, 100) as "查询片段"
FROM pg_stat_activity 
WHERE state != 'idle'
  AND query NOT LIKE '%pg_stat_activity%'
ORDER BY query_start ASC;

-- 5. 锁等待监控
SELECT 
    blocked_locks.pid as "被阻塞PID",
    blocked_activity.usename as "被阻塞用户",
    blocking_locks.pid as "阻塞PID",
    blocking_activity.usename as "阻塞用户",
    blocked_activity.query as "被阻塞查询",
    blocking_activity.query as "阻塞查询"
FROM pg_catalog.pg_locks blocked_locks
JOIN pg_catalog.pg_stat_activity blocked_activity ON blocked_activity.pid = blocked_locks.pid
JOIN pg_catalog.pg_locks blocking_locks 
    ON blocking_locks.locktype = blocked_locks.locktype
    AND blocking_locks.database IS NOT DISTINCT FROM blocked_locks.database
    AND blocking_locks.relation IS NOT DISTINCT FROM blocked_locks.relation
    AND blocking_locks.page IS NOT DISTINCT FROM blocked_locks.page
    AND blocking_locks.tuple IS NOT DISTINCT FROM blocked_locks.tuple
    AND blocking_locks.virtualxid IS NOT DISTINCT FROM blocked_locks.virtualxid
    AND blocking_locks.transactionid IS NOT DISTINCT FROM blocked_locks.transactionid
    AND blocking_locks.classid IS NOT DISTINCT FROM blocked_locks.classid
    AND blocking_locks.objid IS NOT DISTINCT FROM blocked_locks.objid
    AND blocking_locks.objsubid IS NOT DISTINCT FROM blocked_locks.objsubid
    AND blocking_locks.pid != blocked_locks.pid
JOIN pg_catalog.pg_stat_activity blocking_activity ON blocking_activity.pid = blocking_locks.pid
WHERE NOT blocked_locks.granted;

-- 6. 缓存命中率监控
SELECT 
    'Buffer Cache Hit Rate' as "指标",
    ROUND(100.0 * sum(blks_hit) / (sum(blks_hit) + sum(blks_read)), 2) || '%' as "命中率"
FROM pg_stat_database
WHERE datname = current_database()
UNION ALL
SELECT 
    'Index Cache Hit Rate',
    ROUND(100.0 * sum(idx_blks_hit) / (sum(idx_blks_hit) + sum(idx_blks_read)), 2) || '%'
FROM pg_stat_database
WHERE datname = current_database();

-- 7. 业务指标监控
-- 工具统计趋势
SELECT 
    DATE(created_at) as "日期",
    COUNT(*) as "新增工具数",
    COUNT(*) FILTER (WHERE status = 'published') as "发布工具数",
    COUNT(*) FILTER (WHERE featured = true) as "精选工具数",
    AVG(upvotes) as "平均点赞数",
    AVG(views) as "平均浏览数"
FROM tools 
WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY DATE(created_at)
ORDER BY DATE(created_at) DESC;

-- 分类使用统计
WITH category_stats AS (
    SELECT 
        c.name as "分类名称",
        COUNT(t.id) as "工具数量",
        AVG(t.upvotes) as "平均点赞",
        AVG(t.views) as "平均浏览",
        AVG(t.rating) as "平均评分"
    FROM categories c
    LEFT JOIN tools t ON t.category_id = c.id AND t.status = 'published'
    WHERE c.is_active = true
    GROUP BY c.id, c.name
)
SELECT * FROM category_stats ORDER BY "工具数量" DESC;

-- 8. 数据质量检查
-- 检查数据完整性问题
SELECT 
    'tools.name 为空' as "问题类型",
    COUNT(*) as "问题数量"
FROM tools 
WHERE name IS NULL OR trim(name) = ''
UNION ALL
SELECT 
    'tools.website_url 格式错误',
    COUNT(*)
FROM tools 
WHERE website_url IS NULL OR NOT (website_url ~* '^https?://[^\s]+$')
UNION ALL
SELECT 
    'tools.rating 超出范围',
    COUNT(*)
FROM tools 
WHERE rating IS NOT NULL AND (rating < 0 OR rating > 5)
UNION ALL
SELECT 
    'tools.upvotes 为负数',
    COUNT(*)
FROM tools 
WHERE upvotes < 0;

-- 9. 性能基准测试
-- 主要查询性能测试
EXPLAIN (ANALYZE, BUFFERS) 
SELECT id, name, tagline, logo_url, pricing, rating, upvotes 
FROM tools 
WHERE status = 'published' 
ORDER BY upvotes DESC 
LIMIT 20;

-- 搜索查询性能测试
EXPLAIN (ANALYZE, BUFFERS) 
SELECT id, name, tagline, description
FROM tools 
WHERE status = 'published' 
  AND to_tsvector('simple', name || ' ' || tagline || ' ' || coalesce(description, '')) 
      @@ plainto_tsquery('simple', 'AI design')
LIMIT 10;

-- 分类筛选查询性能测试
EXPLAIN (ANALYZE, BUFFERS) 
SELECT t.* 
FROM tools t 
WHERE t.status = 'published' 
  AND t.categories && ARRAY['AI结构设计', 'BIM软件']
ORDER BY t.upvotes DESC 
LIMIT 20;

-- 10. 自动化监控建议
-- 创建性能监控函数
CREATE OR REPLACE FUNCTION get_database_health_summary()
RETURNS TABLE(
    metric_name TEXT,
    metric_value TEXT,
    status TEXT
) AS $$
DECLARE
    cache_hit_rate DECIMAL;
    connection_count INTEGER;
    long_running_queries INTEGER;
    table_bloat_ratio DECIMAL;
BEGIN
    -- 计算缓存命中率
    SELECT ROUND(100.0 * sum(blks_hit) / (sum(blks_hit) + sum(blks_read)), 2)
    INTO cache_hit_rate
    FROM pg_stat_database WHERE datname = current_database();
    
    -- 计算连接数
    SELECT count(*) INTO connection_count
    FROM pg_stat_activity WHERE state = 'active';
    
    -- 计算长时间运行的查询数量
    SELECT count(*) INTO long_running_queries
    FROM pg_stat_activity 
    WHERE state = 'active' 
      AND query_start < now() - interval '5 minutes';
    
    -- 返回健康状态
    RETURN QUERY
    SELECT 
        'Buffer Cache Hit Rate'::TEXT,
        cache_hit_rate::TEXT || '%',
        CASE WHEN cache_hit_rate >= 95 THEN 'Good'
             WHEN cache_hit_rate >= 85 THEN 'Warning'
             ELSE 'Critical' END
    UNION ALL
    SELECT 
        'Active Connections',
        connection_count::TEXT,
        CASE WHEN connection_count <= 20 THEN 'Good'
             WHEN connection_count <= 50 THEN 'Warning'
             ELSE 'Critical' END
    UNION ALL
    SELECT 
        'Long Running Queries',
        long_running_queries::TEXT,
        CASE WHEN long_running_queries = 0 THEN 'Good'
             WHEN long_running_queries <= 2 THEN 'Warning'
             ELSE 'Critical' END;
END;
$$ LANGUAGE plpgsql;

-- 使用健康检查函数
SELECT * FROM get_database_health_summary();