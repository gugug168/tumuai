/*
  # 创建管理员系统

  1. 新增表
    - `admin_users` - 管理员用户表
    - `admin_logs` - 管理员操作日志表
    - `tool_submissions` - 工具提交审核表

  2. 安全策略
    - 管理员权限控制
    - 操作日志记录
    - 数据访问限制

  3. 功能
    - 管理员认证
    - 工具审核管理
    - 用户数据管理
    - 系统统计
*/

-- 管理员用户表
CREATE TABLE IF NOT EXISTS admin_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'admin' CHECK (role IN ('super_admin', 'admin', 'moderator')),
  permissions jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 管理员操作日志表
CREATE TABLE IF NOT EXISTS admin_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid REFERENCES admin_users(id) ON DELETE CASCADE,
  action text NOT NULL,
  target_type text NOT NULL,
  target_id uuid,
  details jsonb DEFAULT '{}',
  ip_address inet,
  user_agent text,
  created_at timestamptz DEFAULT now()
);

-- 工具提交审核表
CREATE TABLE IF NOT EXISTS tool_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submitter_email text,
  tool_name text NOT NULL,
  tagline text NOT NULL,
  description text,
  website_url text NOT NULL,
  logo_url text,
  categories text[] DEFAULT '{}',
  features text[] DEFAULT '{}',
  pricing text NOT NULL CHECK (pricing IN ('Free', 'Freemium', 'Paid', 'Trial')),
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  admin_notes text,
  reviewed_by uuid REFERENCES admin_users(id),
  reviewed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 启用行级安全
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE tool_submissions ENABLE ROW LEVEL SECURITY;

-- 管理员用户策略
CREATE POLICY "Super admins can manage admin users"
  ON admin_users
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users au
      WHERE au.user_id = auth.uid() AND au.role = 'super_admin'
    )
  );

-- 管理员日志策略
CREATE POLICY "Admins can view logs"
  ON admin_logs
  FOR SELECT
  TO authenticated
  USING (
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
    EXISTS (
      SELECT 1 FROM admin_users au
      WHERE au.user_id = auth.uid() AND au.id = admin_id
    )
  );

-- 工具提交策略
CREATE POLICY "Anyone can submit tools"
  ON tool_submissions
  FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Admins can manage submissions"
  ON tool_submissions
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users au
      WHERE au.user_id = auth.uid()
    )
  );

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_admin_users_user_id ON admin_users(user_id);
CREATE INDEX IF NOT EXISTS idx_admin_users_role ON admin_users(role);
CREATE INDEX IF NOT EXISTS idx_admin_logs_admin_id ON admin_logs(admin_id);
CREATE INDEX IF NOT EXISTS idx_admin_logs_created_at ON admin_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tool_submissions_status ON tool_submissions(status);
CREATE INDEX IF NOT EXISTS idx_tool_submissions_created_at ON tool_submissions(created_at DESC);

-- 更新时间戳触发器
CREATE TRIGGER update_admin_users_updated_at
  BEFORE UPDATE ON admin_users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tool_submissions_updated_at
  BEFORE UPDATE ON tool_submissions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 插入默认超级管理员（需要手动设置实际的用户ID）
-- INSERT INTO admin_users (user_id, role) VALUES ('your-user-id-here', 'super_admin');