-- 修正后的第三个迁移验证查询
-- 检查API性能监控表和视图是否正确创建

-- 1. 检查api_performance表是否存在
SELECT 
  table_name,
  table_type,
  table_schema
FROM information_schema.tables 
WHERE table_name = 'api_performance' 
  AND table_schema = 'public';

-- 2. 检查api_performance表的列结构
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name = 'api_performance' 
  AND table_schema = 'public'
ORDER BY ordinal_position;

-- 3. 检查性能统计视图是否创建（修正后的查询）
SELECT 
  table_name,
  table_type
FROM information_schema.views 
WHERE table_name LIKE '%performance%' 
  AND table_schema = 'public';

-- 4. 检查是否有相关的函数创建
SELECT 
  routine_name,
  routine_type
FROM information_schema.routines 
WHERE routine_name LIKE '%performance%' 
  AND routine_schema = 'public';

-- 5. 验证RLS策略是否启用
SELECT 
  tablename,
  rowsecurity
FROM pg_tables 
WHERE tablename = 'api_performance' 
  AND schemaname = 'public';