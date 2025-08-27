-- 管理员用户表迁移脚本
-- 在Supabase SQL Editor中执行

-- 创建管理员用户表
CREATE TABLE IF NOT EXISTS admin_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL DEFAULT 'admin' CHECK (role IN ('admin', 'super_admin')),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  last_login TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id),
  permissions JSONB DEFAULT '{"tools": ["read", "write"], "users": ["read"]}'
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_admin_users_user_id ON admin_users(user_id);
CREATE INDEX IF NOT EXISTS idx_admin_users_email ON admin_users(email);
CREATE INDEX IF NOT EXISTS idx_admin_users_role ON admin_users(role);

-- 设置RLS（行级安全）
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;

-- 创建RLS策略
CREATE POLICY "管理员可以查看所有管理员" 
ON admin_users FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM admin_users au 
    WHERE au.user_id = auth.uid() AND au.is_active = true
  )
);

CREATE POLICY "超级管理员可以管理所有管理员" 
ON admin_users FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM admin_users au 
    WHERE au.user_id = auth.uid() 
    AND au.role = 'super_admin' 
    AND au.is_active = true
  )
);

-- 创建管理员验证函数
CREATE OR REPLACE FUNCTION is_admin(user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM admin_users 
    WHERE admin_users.user_id = $1 
    AND is_active = true
  );
END;
$$;

-- 创建超级管理员验证函数
CREATE OR REPLACE FUNCTION is_super_admin(user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM admin_users 
    WHERE admin_users.user_id = $1 
    AND role = 'super_admin'
    AND is_active = true
  );
END;
$$;

-- 插入初始超级管理员（请修改邮箱地址）
-- 注意：需要先在Supabase Auth中创建这个用户账号
INSERT INTO admin_users (user_id, email, role, is_active, created_at)
SELECT 
  id,
  email,
  'super_admin',
  true,
  now()
FROM auth.users 
WHERE email = 'your-super-admin@example.com' -- 替换为实际的超级管理员邮箱
ON CONFLICT (email) DO NOTHING;

-- 为工具表添加管理员权限检查
ALTER TABLE tools ENABLE ROW LEVEL SECURITY;

-- 允许所有人读取已发布的工具
CREATE POLICY "所有人可以查看已发布工具" 
ON tools FOR SELECT 
USING (status = 'published');

-- 只有管理员可以查看所有工具
CREATE POLICY "管理员可以查看所有工具" 
ON tools FOR SELECT 
USING (is_admin());

-- 只有管理员可以修改工具
CREATE POLICY "管理员可以管理工具" 
ON tools FOR ALL 
USING (is_admin());