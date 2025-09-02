-- AI智能填入功能：API性能监控表
-- 创建时间：2025-09-01
-- 目的：监控重复检测API和AI填入功能的性能指标

-- 创建API性能监控表
CREATE TABLE IF NOT EXISTS api_performance_logs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  endpoint text NOT NULL,                          -- API端点名称
  processing_time_ms integer NOT NULL,             -- 处理时间（毫秒）
  cache_hit boolean DEFAULT false,                 -- 是否命中缓存
  result_exists boolean DEFAULT false,             -- 检测结果是否存在重复
  has_error boolean DEFAULT false,                 -- 是否有错误
  error_message text,                              -- 错误信息
  user_agent text,                                 -- 用户代理
  ip_address inet,                                 -- 客户端IP
  request_size_bytes integer,                      -- 请求大小
  response_size_bytes integer,                     -- 响应大小
  metadata jsonb,                                  -- 额外的元数据
  created_at timestamp with time zone DEFAULT now()
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_api_logs_endpoint 
ON api_performance_logs(endpoint);

CREATE INDEX IF NOT EXISTS idx_api_logs_created_at 
ON api_performance_logs(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_api_logs_endpoint_created_at 
ON api_performance_logs(endpoint, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_api_logs_processing_time 
ON api_performance_logs(processing_time_ms);

CREATE INDEX IF NOT EXISTS idx_api_logs_cache_hit 
ON api_performance_logs(cache_hit);

CREATE INDEX IF NOT EXISTS idx_api_logs_has_error 
ON api_performance_logs(has_error) WHERE has_error = true;

-- 创建性能统计视图
CREATE OR REPLACE VIEW api_performance_stats AS
SELECT 
  endpoint,
  DATE(created_at) as date,
  COUNT(*) as total_calls,
  COUNT(*) FILTER (WHERE cache_hit = true) as cache_hits,
  COUNT(*) FILTER (WHERE has_error = true) as error_count,
  COUNT(*) FILTER (WHERE result_exists = true) as duplicates_found,
  ROUND(AVG(processing_time_ms)::numeric, 2) as avg_processing_time_ms,
  ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY processing_time_ms)::numeric, 2) as median_processing_time_ms,
  ROUND(PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY processing_time_ms)::numeric, 2) as p95_processing_time_ms,
  MIN(processing_time_ms) as min_processing_time_ms,
  MAX(processing_time_ms) as max_processing_time_ms,
  ROUND(AVG(request_size_bytes)::numeric, 2) as avg_request_size_bytes,
  ROUND(AVG(response_size_bytes)::numeric, 2) as avg_response_size_bytes
FROM api_performance_logs 
GROUP BY endpoint, DATE(created_at)
ORDER BY date DESC, endpoint;

-- 创建实时性能监控视图（最近1小时）
CREATE OR REPLACE VIEW api_performance_realtime AS
SELECT 
  endpoint,
  COUNT(*) as calls_last_hour,
  COUNT(*) FILTER (WHERE cache_hit = true) as cache_hits_last_hour,
  COUNT(*) FILTER (WHERE has_error = true) as errors_last_hour,
  ROUND(AVG(processing_time_ms)::numeric, 2) as avg_processing_time_ms,
  ROUND(PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY processing_time_ms)::numeric, 2) as p95_processing_time_ms
FROM api_performance_logs 
WHERE created_at >= (now() - interval '1 hour')
GROUP BY endpoint;

-- 创建自动清理旧日志的函数（保留30天数据）
CREATE OR REPLACE FUNCTION cleanup_old_api_performance_logs()
RETURNS integer AS $$
DECLARE
  deleted_count integer;
BEGIN
  DELETE FROM api_performance_logs 
  WHERE created_at < (now() - interval '30 days');
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- 创建分析慢查询的函数
CREATE OR REPLACE FUNCTION get_slow_api_calls(
  threshold_ms integer DEFAULT 1000,
  hours_back integer DEFAULT 24
)
RETURNS TABLE (
  endpoint text,
  processing_time_ms integer,
  cache_hit boolean,
  has_error boolean,
  error_message text,
  created_at timestamp with time zone
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    apl.endpoint,
    apl.processing_time_ms,
    apl.cache_hit,
    apl.has_error,
    apl.error_message,
    apl.created_at
  FROM api_performance_logs apl
  WHERE apl.processing_time_ms > threshold_ms
    AND apl.created_at >= (now() - (hours_back || ' hours')::interval)
  ORDER BY apl.processing_time_ms DESC, apl.created_at DESC;
END;
$$ LANGUAGE plpgsql;

-- 启用RLS（行级安全）
ALTER TABLE api_performance_logs ENABLE ROW LEVEL SECURITY;

-- 创建RLS策略：只有管理员可以访问性能日志
CREATE POLICY "admin_can_access_performance_logs" ON api_performance_logs
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM admin_users 
      WHERE user_id = auth.uid()
    )
  );

-- 创建RLS策略：系统服务可以插入日志
CREATE POLICY "service_can_insert_logs" ON api_performance_logs
  FOR INSERT WITH CHECK (true);

-- 添加表和函数注释
COMMENT ON TABLE api_performance_logs IS 'AI智能填入：API性能监控日志表';
COMMENT ON COLUMN api_performance_logs.endpoint IS 'API端点名称';
COMMENT ON COLUMN api_performance_logs.processing_time_ms IS '处理时间（毫秒）';
COMMENT ON COLUMN api_performance_logs.cache_hit IS '是否命中缓存';
COMMENT ON COLUMN api_performance_logs.result_exists IS '检测结果是否存在重复';
COMMENT ON COLUMN api_performance_logs.metadata IS '额外的元数据，JSON格式';

COMMENT ON VIEW api_performance_stats IS 'AI智能填入：API性能统计视图（按日期分组）';
COMMENT ON VIEW api_performance_realtime IS 'AI智能填入：实时API性能监控视图（最近1小时）';

COMMENT ON FUNCTION cleanup_old_api_performance_logs() IS 'AI智能填入：清理30天以上的性能日志';
COMMENT ON FUNCTION get_slow_api_calls(integer, integer) IS 'AI智能填入：获取慢查询记录';