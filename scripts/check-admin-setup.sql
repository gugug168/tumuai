-- 管理员设置检查和创建脚本
-- 在Supabase SQL Editor中执行

-- 1. 检查 admin_users 表是否存在
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'admin_users'
    ) THEN
        RAISE NOTICE '⚠️  admin_users 表不存在，正在创建...';
        
        -- 创建 admin_users 表
        CREATE TABLE admin_users (
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
        CREATE INDEX idx_admin_users_user_id ON admin_users(user_id);
        CREATE INDEX idx_admin_users_email ON admin_users(email);
        CREATE INDEX idx_admin_users_role ON admin_users(role);
        
        RAISE NOTICE '✅ admin_users 表创建成功';
    ELSE
        RAISE NOTICE '✅ admin_users 表已存在';
    END IF;
END $$;

-- 2. 设置行级安全策略
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;

-- 删除可能存在的旧策略
DROP POLICY IF EXISTS "管理员可以查看所有管理员" ON admin_users;
DROP POLICY IF EXISTS "超级管理员可以管理所有管理员" ON admin_users;
DROP POLICY IF EXISTS "admin_select_policy" ON admin_users;
DROP POLICY IF EXISTS "admin_modify_policy" ON admin_users;

-- 创建新的RLS策略 - 管理员查看策略
CREATE POLICY "admin_select_policy" 
ON admin_users FOR SELECT 
USING (
    EXISTS (
        SELECT 1 FROM admin_users au 
        WHERE au.user_id = auth.uid() AND au.is_active = true
    )
);

-- 创建新的RLS策略 - 超级管理员管理策略  
CREATE POLICY "admin_modify_policy" 
ON admin_users FOR ALL 
USING (
    EXISTS (
        SELECT 1 FROM admin_users au 
        WHERE au.user_id = auth.uid() 
        AND au.role = 'super_admin' 
        AND au.is_active = true
    )
);

-- 3. 创建或更新管理员验证函数
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

-- 4. 创建或更新超级管理员验证函数
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

-- 5. 检查管理员用户是否存在
DO $$
DECLARE
    admin_user_id UUID;
    admin_email TEXT := 'admin@civilaihub.com';
    admin_exists BOOLEAN := false;
BEGIN
    -- 检查 auth.users 中是否有管理员用户
    SELECT id INTO admin_user_id
    FROM auth.users 
    WHERE email = admin_email;
    
    IF admin_user_id IS NOT NULL THEN
        RAISE NOTICE '✅ 管理员用户在 auth.users 中存在: %', admin_user_id;
        admin_exists := true;
        
        -- 检查 admin_users 表中是否有对应记录
        IF EXISTS (
            SELECT 1 FROM admin_users 
            WHERE user_id = admin_user_id
        ) THEN
            RAISE NOTICE '✅ 管理员记录在 admin_users 中存在';
            
            -- 更新管理员记录确保权限正确
            UPDATE admin_users 
            SET 
                role = 'super_admin',
                is_active = true,
                permissions = '{
                    "tools": ["read", "write", "delete"],
                    "users": ["read", "write"],
                    "categories": ["read", "write", "delete"],
                    "submissions": ["read", "write", "delete"],
                    "analytics": ["read"],
                    "settings": ["read", "write"]
                }'::jsonb
            WHERE user_id = admin_user_id;
            
            RAISE NOTICE '✅ 管理员权限已更新';
        ELSE
            RAISE NOTICE '⚠️  管理员记录在 admin_users 中不存在，正在创建...';
            
            -- 创建管理员记录
            INSERT INTO admin_users (user_id, email, role, is_active, permissions)
            VALUES (
                admin_user_id,
                admin_email,
                'super_admin',
                true,
                '{
                    "tools": ["read", "write", "delete"],
                    "users": ["read", "write"], 
                    "categories": ["read", "write", "delete"],
                    "submissions": ["read", "write", "delete"],
                    "analytics": ["read"],
                    "settings": ["read", "write"]
                }'::jsonb
            );
            
            RAISE NOTICE '✅ 管理员记录创建成功';
        END IF;
    ELSE
        RAISE NOTICE '⚠️  管理员用户在 auth.users 中不存在: %', admin_email;
        RAISE NOTICE '请先通过 Supabase Auth Admin API 或 scripts/admin-setup.js 创建用户';
    END IF;
END $$;

-- 6. 验证设置结果
SELECT 
    '=== 管理员设置验证 ===' as section,
    '检查结果如下:' as description;

-- 检查表结构
SELECT 
    'admin_users 表:' as check_type,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.tables 
            WHERE table_schema = 'public' AND table_name = 'admin_users'
        ) 
        THEN '✅ 存在' 
        ELSE '❌ 不存在' 
    END as status;

-- 检查函数
SELECT 
    'is_admin 函数:' as check_type,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM pg_proc 
            WHERE proname = 'is_admin'
        ) 
        THEN '✅ 存在' 
        ELSE '❌ 不存在' 
    END as status;

SELECT 
    'is_super_admin 函数:' as check_type,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM pg_proc 
            WHERE proname = 'is_super_admin'
        ) 
        THEN '✅ 存在' 
        ELSE '❌ 不存在' 
    END as status;

-- 检查管理员用户
SELECT 
    '管理员用户 (auth):' as check_type,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM auth.users 
            WHERE email = 'admin@civilaihub.com'
        ) 
        THEN '✅ 存在' 
        ELSE '❌ 不存在' 
    END as status;

-- 检查管理员记录
SELECT 
    '管理员记录 (admin_users):' as check_type,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM admin_users au
            JOIN auth.users u ON au.user_id = u.id
            WHERE u.email = 'admin@civilaihub.com'
            AND au.is_active = true
        ) 
        THEN '✅ 存在且活跃' 
        ELSE '❌ 不存在或未激活' 
    END as status;

-- 显示管理员详细信息
SELECT 
    '=== 管理员账户详情 ===' as section;

SELECT 
    u.id as user_id,
    u.email as email,
    u.email_confirmed_at IS NOT NULL as email_confirmed,
    au.role as admin_role,
    au.is_active as is_active,
    au.permissions as permissions,
    au.created_at as admin_created_at
FROM auth.users u
LEFT JOIN admin_users au ON u.id = au.user_id
WHERE u.email = 'admin@civilaihub.com';

-- 显示RLS策略
SELECT 
    '=== RLS 策略状态 ===' as section;

SELECT 
    schemaname,
    tablename,
    policyname,
    cmd as policy_type,
    CASE 
        WHEN qual IS NOT NULL THEN '有条件限制' 
        ELSE '无限制' 
    END as access_control
FROM pg_policies 
WHERE tablename = 'admin_users'
ORDER BY policyname;