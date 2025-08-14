/*
  # 修复管理员RLS策略中的无限递归问题

  1. 问题描述
    - admin_users表的RLS策略存在自引用，导致无限递归错误
    - 这会导致管理员后台无法正确加载统计数据和列表

  2. 解决方案
    - 重构RLS策略，避免自引用
    - 使用auth.uid()直接检查用户权限
*/

-- 删除有问题的策略
DROP POLICY IF EXISTS "Super admins can manage admin users" ON admin_users;

-- 创建新的管理员用户策略，避免自引用
CREATE POLICY "Admins can manage admin users"
  ON admin_users
  FOR ALL
  TO authenticated
  USING (
    -- 检查当前用户是否为超级管理员
    EXISTS (
      SELECT 1 FROM admin_users au 
      WHERE au.user_id = auth.uid() AND au.role = 'super_admin'
    )
  )
  WITH CHECK (
    -- 检查当前用户是否为超级管理员
    EXISTS (
      SELECT 1 FROM admin_users au 
      WHERE au.user_id = auth.uid() AND au.role = 'super_admin'
    )
  );

-- 修复工具提交表的策略
DROP POLICY IF EXISTS "Admins can manage submissions" ON tool_submissions;

CREATE POLICY "Admins can manage submissions"
  ON tool_submissions
  FOR ALL
  TO authenticated
  USING (
    -- 检查当前用户是否为管理员
    EXISTS (
      SELECT 1 FROM admin_users au 
      WHERE au.user_id = auth.uid()
    )
  )
  WITH CHECK (
    -- 检查当前用户是否为管理员
    EXISTS (
      SELECT 1 FROM admin_users au 
      WHERE au.user_id = auth.uid()
    )
  );

-- 修复管理员日志表的策略
DROP POLICY IF EXISTS "Admins can view logs" ON admin_logs;
DROP POLICY IF EXISTS "Admins can insert logs" ON admin_logs;

CREATE POLICY "Admins can view logs"
  ON admin_logs
  FOR SELECT
  TO authenticated
  USING (
    -- 检查当前用户是否为管理员
    EXISTS (
      SELECT 1 FROM admin_users au 
      WHERE au.user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can insert logs"
  ON admin_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (
    -- 检查当前用户是否为管理员且admin_id匹配
    EXISTS (
      SELECT 1 FROM admin_users au 
      WHERE au.user_id = auth.uid() AND au.id = admin_id
    )
  );