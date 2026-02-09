-- ============================================
-- Civil AI Hub - 第一阶段优化索引
-- ============================================
-- 创建时间: 2025-02-09
-- 说明: 这些索引基于全面代码审查后添加
-- ============================================

-- 1. 工具表 normalized_url 索引
-- 用于: 重复网站 URL 检查
-- 查询: SELECT * FROM tools WHERE normalized_url = $1 AND status IN ('published', 'pending')
CREATE INDEX IF NOT EXISTS tools_normalized_url_idx
  ON tools(normalized_url)
  WHERE status IN ('published', 'pending');

-- 2. 工具提交表状态和日期索引
-- 用于: 管理后台获取待审核工具
-- 查询: SELECT * FROM tool_submissions WHERE status = 'pending' ORDER BY created_at DESC
CREATE INDEX IF NOT EXISTS tool_submissions_status_idx
  ON tool_submissions(status, created_at DESC);

-- 3. 工具提交表网站 URL 索引
-- 用于: 检查重复提交
-- 查询: SELECT * FROM tool_submissions WHERE website_url = $1
CREATE INDEX IF NOT EXISTS tool_submissions_website_idx
  ON tool_submissions(website_url);

-- 4. 管理日志表管理员和日期索引
-- 用于: 查看管理员操作历史
-- 查询: SELECT * FROM admin_logs WHERE admin_id = $1 ORDER BY created_at DESC
CREATE INDEX IF NOT EXISTS admin_logs_admin_created_idx
  ON admin_logs(admin_id, created_at DESC);

-- 5. 用户收藏表创建时间索引
-- 用于: 获取最新收藏
-- 查询: SELECT * FROM user_favorites WHERE user_id = $1 ORDER BY created_at DESC
CREATE INDEX IF NOT EXISTS user_favorites_created_idx
  ON user_favorites(user_id, created_at DESC);

-- 验证索引创建
-- 运行以下查询验证:
-- SELECT schemaname, tablename, indexname
-- FROM pg_indexes
-- WHERE schemaname = 'public'
--   AND indexname IN (
--     'tools_normalized_url_idx',
--     'tool_submissions_status_idx',
--     'tool_submissions_website_idx',
--     'admin_logs_admin_created_idx',
--     'user_favorites_created_idx'
--   );
