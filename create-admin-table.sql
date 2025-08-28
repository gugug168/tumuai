-- 创建 admin_users 表
CREATE TABLE IF NOT EXISTS admin_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL UNIQUE,
    role TEXT NOT NULL DEFAULT 'admin' CHECK (role IN ('admin', 'super_admin')),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    last_login TIMESTAMPTZ,
    created_by UUID REFERENCES auth.users(id),
    permissions JSONB DEFAULT '{"tools": ["read", "write"], "users": ["read"]}'::jsonb
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_admin_users_user_id ON admin_users(user_id);
CREATE INDEX IF NOT EXISTS idx_admin_users_email ON admin_users(email);
CREATE INDEX IF NOT EXISTS idx_admin_users_role ON admin_users(role);

-- 启用RLS
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;

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
EXCEPTION
    WHEN others THEN
        RETURN false;
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
EXCEPTION
    WHEN others THEN
        RETURN false;
END;
$$;