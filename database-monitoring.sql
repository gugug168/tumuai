-- =============================================================================
-- Civil AI Hub - PostgreSQL 数据库监控和维护脚本
-- 版本: 1.0
-- 创建时间: 2025-08-23
-- 
-- 说明: 用于监控数据库性能、分析查询效果、维护数据质量的工具脚本
-- 建议: 定期运行监控查询，设置告警机制
-- =============================================================================

-- =============================================================================
-- 第一部分：性能监控查询
-- =============================================================================

-- 1.1 实时查询性能分析
-- 查看当前最耗时的查询
SELECT 
  query,
  calls,
  total_time,
  round(mean_time::numeric, 2) as avg_time_ms,
  round(max_time::numeric, 2) as max_time_ms,
  rows,
  round(100.0 * shared_blks_hit / nullif(shared_blks_hit + shared_blks_read, 0), 2) AS hit_ratio_percent,
  round(total_time * 100.0 / sum(total_time) OVER(), 2) AS time_percent
FROM pg_stat_statements 
WHERE mean_time > 10 -- 超过10ms的查询
ORDER BY mean_time DESC 
LIMIT 20;

-- 1.2 数据库连接和活跃查询监控
SELECT 
  pid,
  usename,
  application_name,
  client_addr,
  state,
  query_start,
  state_change,
  extract(epoch from (now() - query_start)) as runtime_seconds,
  left(query, 100) as query_preview
FROM pg_stat_activity 
WHERE state != 'idle' 
  AND query NOT LIKE '%pg_stat_activity%'
ORDER BY runtime_seconds DESC;

-- 1.3 锁等待监控
SELECT 
  blocked_locks.pid AS blocked_pid,
  blocked_activity.usename AS blocked_user,
  blocking_locks.pid AS blocking_pid,
  blocking_activity.usename AS blocking_user,
  blocked_activity.query AS blocked_statement,
  blocking_activity.query AS blocking_statement,
  extract(epoch from (now() - blocked_activity.query_start)) as blocked_duration
FROM pg_catalog.pg_locks blocked_locks
JOIN pg_catalog.pg_stat_activity blocked_activity ON blocked_activity.pid = blocked_locks.pid
JOIN pg_catalog.pg_locks blocking_locks ON blocking_locks.locktype = blocked_locks.locktype
  AND blocking_locks.DATABASE IS NOT DISTINCT FROM blocked_locks.DATABASE
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
WHERE NOT blocked_locks.GRANTED;

-- =============================================================================
-- 第二部分：索引性能分析
-- =============================================================================

-- 2.1 索引使用情况分析
SELECT 
  schemaname,
  tablename,
  indexname,
  idx_scan as scans,
  idx_tup_read as tuples_read,
  idx_tup_fetch as tuples_fetched,
  pg_size_pretty(pg_relation_size(indexrelid)) as index_size,
  CASE 
    WHEN idx_scan = 0 THEN '🔴 从未使用'
    WHEN idx_scan < 10 THEN '🟡 很少使用'
    WHEN idx_scan < 100 THEN '🟠 偶尔使用'
    ELSE '🟢 经常使用'
  END as usage_level,
  round(100.0 * idx_tup_fetch / GREATEST(idx_tup_read, 1), 2) as fetch_ratio_percent
FROM pg_stat_user_indexes 
WHERE schemaname = 'public' 
ORDER BY idx_scan DESC, pg_relation_size(indexrelid) DESC;

-- 2.2 查找未使用的大索引（建议删除）
SELECT 
  schemaname,
  tablename,
  indexname,
  pg_size_pretty(pg_relation_size(indexrelid)) as wasted_size,
  'DROP INDEX CONCURRENTLY ' || indexname || ';' as drop_command
FROM pg_stat_user_indexes 
WHERE idx_scan = 0 
  AND schemaname = 'public'
  AND pg_relation_size(indexrelid) > 1024 * 1024 -- 超过1MB的未使用索引
ORDER BY pg_relation_size(indexrelid) DESC;

-- 2.3 索引膨胀分析
WITH index_bloat AS (
  SELECT
    schemaname,
    tablename,
    indexname,
    pg_size_pretty(pg_relation_size(indexrelid)) as index_size,
    round(100 * (pg_relation_size(indexrelid) / GREATEST(pg_relation_size(schemaname||'.'||tablename), 1))::numeric, 2) as index_ratio
  FROM pg_stat_user_indexes
  WHERE schemaname = 'public'
)
SELECT *,
  CASE 
    WHEN index_ratio > 50 THEN '🔴 可能过度膨胀'
    WHEN index_ratio > 20 THEN '🟡 需要关注'
    ELSE '🟢 正常'
  END as bloat_status
FROM index_bloat
ORDER BY index_ratio DESC;

-- =============================================================================
-- 第三部分：表统计和维护分析
-- =============================================================================

-- 3.1 表大小和膨胀分析
SELECT 
  schemaname,
  tablename,
  n_live_tup as live_rows,
  n_dead_tup as dead_rows,
  round(100.0 * n_dead_tup / GREATEST(n_live_tup + n_dead_tup, 1), 2) as dead_ratio_percent,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as total_size,
  pg_size_pretty(pg_relation_size(schemaname||'.'||tablename)) as table_size,
  pg_size_pretty(pg_indexes_size(schemaname||'.'||tablename)) as indexes_size,
  last_vacuum,
  last_autovacuum,
  last_analyze,
  last_autoanalyze,
  CASE 
    WHEN n_dead_tup::float / GREATEST(n_live_tup + n_dead_tup, 1) > 0.1 THEN '🔴 需要VACUUM'
    WHEN n_dead_tup::float / GREATEST(n_live_tup + n_dead_tup, 1) > 0.05 THEN '🟡 关注膨胀'
    ELSE '🟢 状态良好'
  END as maintenance_status
FROM pg_stat_user_tables 
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- 3.2 工具表的详细统计信息
SELECT 
  'tools' as table_name,
  (SELECT count(*) FROM tools WHERE status = 'published') as published_tools,
  (SELECT count(*) FROM tools WHERE status = 'draft') as draft_tools,
  (SELECT count(*) FROM tools WHERE status = 'pending') as pending_tools,
  (SELECT count(*) FROM tools WHERE status = 'archived') as archived_tools,
  (SELECT avg(upvotes) FROM tools WHERE status = 'published') as avg_upvotes,
  (SELECT avg(views) FROM tools WHERE status = 'published') as avg_views,
  (SELECT avg(rating) FROM tools WHERE status = 'published' AND rating > 0) as avg_rating,
  (SELECT count(*) FROM tools WHERE created_at > now() - interval '7 days') as new_tools_this_week,
  (SELECT count(*) FROM tools WHERE updated_at > now() - interval '24 hours') as updated_today;

-- =============================================================================
-- 第四部分：查询计划分析工具
-- =============================================================================

-- 4.1 分析工具列表查询的执行计划
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT) 
SELECT id,name,tagline,logo_url,categories,features,pricing,rating,views,upvotes,date_added
FROM tools 
WHERE status = 'published' 
ORDER BY upvotes DESC, id DESC
LIMIT 60;

-- 4.2 分析分类筛选查询的执行计划
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT id,name,tagline,logo_url,categories,features,pricing,rating,views,upvotes,date_added
FROM tools 
WHERE status = 'published' 
  AND categories @> ARRAY['AI结构设计']
ORDER BY upvotes DESC, id DESC
LIMIT 20;

-- 4.3 分析全文搜索查询的执行计划（如果search_vector存在）
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'tools' AND column_name = 'search_vector'
    ) THEN
        EXECUTE 'EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
        SELECT id,name,tagline, ts_rank(search_vector, plainto_tsquery(''english'', ''AI'')) as rank
        FROM tools 
        WHERE status = ''published'' 
          AND search_vector @@ plainto_tsquery(''english'', ''AI'')
        ORDER BY rank DESC, upvotes DESC
        LIMIT 20';
    ELSE
        RAISE NOTICE '⚠️ search_vector列不存在，跳过全文搜索分析';
    END IF;
END $$;

-- =============================================================================
-- 第五部分：自动化监控函数
-- =============================================================================

-- 5.1 创建性能告警函数
CREATE OR REPLACE FUNCTION performance_health_check()
RETURNS TABLE (
  check_category text,
  check_name text,
  status text,
  details text,
  recommendation text
) AS $$
BEGIN
  -- 检查慢查询
  RETURN QUERY
  SELECT 
    '🐌 查询性能'::text,
    'Slow Queries'::text,
    CASE WHEN count(*) > 5 THEN '🔴 警告' ELSE '🟢 正常' END,
    '发现 ' || count(*) || ' 个慢查询 (>500ms)',
    '优化相关查询或添加索引'
  FROM pg_stat_statements 
  WHERE mean_time > 500 AND calls > 10;
  
  -- 检查未使用的索引
  RETURN QUERY
  SELECT 
    '📊 索引使用'::text,
    'Unused Indexes'::text,
    CASE WHEN count(*) > 2 THEN '🟡 注意' ELSE '🟢 正常' END,
    '发现 ' || count(*) || ' 个未使用的索引',
    '考虑删除未使用的大索引'
  FROM pg_stat_user_indexes 
  WHERE idx_scan = 0 
    AND schemaname = 'public'
    AND pg_relation_size(indexrelid) > 1024*1024;
  
  -- 检查表膨胀
  RETURN QUERY
  SELECT 
    '🗃️ 表维护'::text,
    'Table Bloat'::text,
    CASE WHEN count(*) > 0 THEN '🟡 注意' ELSE '🟢 正常' END,
    '发现 ' || count(*) || ' 个表需要VACUUM',
    '运行VACUUM或等待自动VACUUM'
  FROM pg_stat_user_tables 
  WHERE schemaname = 'public'
    AND n_dead_tup::float / GREATEST(n_live_tup + n_dead_tup, 1) > 0.1;
  
  -- 检查连接数
  RETURN QUERY
  SELECT 
    '🔌 连接状态'::text,
    'Active Connections'::text,
    CASE WHEN count(*) > 50 THEN '🔴 警告' ELSE '🟢 正常' END,
    '当前活跃连接: ' || count(*),
    CASE WHEN count(*) > 50 THEN '检查连接池配置' ELSE '连接数正常' END
  FROM pg_stat_activity 
  WHERE state = 'active';
  
  -- 检查缓存命中率
  RETURN QUERY
  SELECT 
    '💾 缓存效率'::text,
    'Buffer Cache Hit Rate'::text,
    CASE WHEN hit_ratio < 95 THEN '🟡 注意' ELSE '🟢 正常' END,
    '缓存命中率: ' || round(hit_ratio, 2) || '%',
    CASE WHEN hit_ratio < 95 THEN '考虑增加shared_buffers' ELSE '缓存效率良好' END
  FROM (
    SELECT 
      round(100.0 * sum(blks_hit) / GREATEST(sum(blks_hit + blks_read), 1), 2) as hit_ratio
    FROM pg_stat_database
  ) cache_stats;
END;
$$ LANGUAGE plpgsql;

-- 5.2 创建索引建议函数
CREATE OR REPLACE FUNCTION suggest_missing_indexes()
RETURNS TABLE (
  table_name text,
  suggested_index text,
  reason text,
  priority text
) AS $$
BEGIN
  -- 基于慢查询分析建议索引
  -- 这里提供一些常见的索引建议
  
  -- 检查是否缺少复合索引
  RETURN QUERY
  SELECT 
    'tools'::text,
    'CREATE INDEX CONCURRENTLY idx_tools_status_pricing_upvotes ON tools (status, pricing, upvotes DESC)'::text,
    '支持按定价筛选的工具列表查询'::text,
    '中等'::text
  WHERE NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE tablename = 'tools' 
    AND indexname LIKE '%status%pricing%'
  );
  
  -- 检查全文搜索索引
  RETURN QUERY
  SELECT 
    'tools'::text,
    'ALTER TABLE tools ADD COLUMN search_vector tsvector; CREATE INDEX idx_tools_fts ON tools USING GIN(search_vector)'::text,
    '支持高效的全文搜索'::text,
    '高'::text
  WHERE NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'tools' AND column_name = 'search_vector'
  );
  
  -- 检查数组字段索引
  RETURN QUERY
  SELECT 
    'tools'::text,
    'CREATE INDEX CONCURRENTLY idx_tools_categories_features ON tools USING GIN((categories || features))'::text,
    '支持组合分类和功能搜索'::text,
    '中等'::text
  WHERE NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE tablename = 'tools' 
    AND indexname LIKE '%categories%features%'
  );
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- 第六部分：维护脚本
-- =============================================================================

-- 6.1 数据库清理和优化
CREATE OR REPLACE FUNCTION database_maintenance()
RETURNS text AS $$
DECLARE
  result text := '';
  rec record;
BEGIN
  result := '=== 数据库维护报告 ===\n';
  
  -- 更新表统计信息
  FOR rec IN 
    SELECT schemaname, tablename 
    FROM pg_tables 
    WHERE schemaname = 'public'
  LOOP
    EXECUTE 'ANALYZE ' || quote_ident(rec.schemaname) || '.' || quote_ident(rec.tablename);
  END LOOP;
  
  result := result || '✅ 已更新所有表的统计信息\n';
  
  -- 检查是否需要VACUUM
  FOR rec IN 
    SELECT tablename,
           n_dead_tup,
           n_live_tup + n_dead_tup as total_tup,
           round(100.0 * n_dead_tup / GREATEST(n_live_tup + n_dead_tup, 1), 2) as dead_ratio
    FROM pg_stat_user_tables 
    WHERE schemaname = 'public'
      AND n_dead_tup::float / GREATEST(n_live_tup + n_dead_tup, 1) > 0.1
  LOOP
    result := result || '⚠️ 表 ' || rec.tablename || ' 需要VACUUM (死行占比: ' || rec.dead_ratio || '%)\n';
  END LOOP;
  
  -- 生成优化建议
  result := result || '\n=== 优化建议 ===\n';
  
  -- 检查长时间运行的查询
  FOR rec IN 
    SELECT pid, extract(epoch from (now() - query_start)) as runtime,
           left(query, 50) as query_preview
    FROM pg_stat_activity 
    WHERE state = 'active' 
      AND query_start < now() - interval '30 seconds'
      AND query NOT LIKE '%pg_stat_activity%'
  LOOP
    result := result || '🐌 长时间运行的查询 (PID: ' || rec.pid || ', 运行时间: ' || round(rec.runtime) || 's): ' || rec.query_preview || '...\n';
  END LOOP;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- 第七部分：快速诊断查询
-- =============================================================================

-- 一键运行所有健康检查
DO $$ 
BEGIN
  RAISE NOTICE '=============================================================================';
  RAISE NOTICE '🏥 Civil AI Hub 数据库健康检查报告';
  RAISE NOTICE '=============================================================================';
  RAISE NOTICE '';
END $$;

-- 显示当前性能状态
SELECT '📊 当前性能统计' as section;
SELECT * FROM performance_health_check();

-- 显示索引建议
SELECT '💡 索引优化建议' as section;
SELECT * FROM suggest_missing_indexes();

-- 显示表统计
SELECT '📈 表统计信息' as section;
SELECT 
  tablename,
  n_live_tup as live_rows,
  n_dead_tup as dead_rows,
  pg_size_pretty(pg_total_relation_size('public.'||tablename)) as total_size,
  last_vacuum,
  last_autovacuum
FROM pg_stat_user_tables 
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size('public.'||tablename) DESC;

-- =============================================================================
-- 定期运行建议
-- =============================================================================

/*
🕐 建议的监控计划：

1. 每小时运行：
   SELECT * FROM performance_health_check();

2. 每天运行：
   SELECT * FROM database_maintenance();

3. 每周运行：
   SELECT * FROM suggest_missing_indexes();
   
4. 根据需要手动运行：
   - 查看慢查询：前面的性能监控查询
   - 分析执行计划：EXPLAIN查询
   - 检查锁等待：锁监控查询

5. 告警阈值：
   - 平均查询时间 > 200ms
   - 缓存命中率 < 95%
   - 死行比例 > 10%
   - 活跃连接数 > 50

6. 维护操作：
   - 当死行比例 > 20% 时运行 VACUUM
   - 定期运行 ANALYZE 更新统计信息
   - 监控并删除未使用的大索引
*/