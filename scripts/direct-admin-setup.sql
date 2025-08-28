-- =============================================================================
-- Civil AI Hub 管理员账户直接设置脚本
-- 在 Supabase SQL Editor 中直接运行
-- =============================================================================

-- 第一步：创建管理员用户账户
-- 注意：这需要使用 Supabase Dashboard 或 Auth Admin API

-- 第二步：创建 admin_users 表（如果不存在）
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

-- 第三步：启用行级安全
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;

-- 删除可能冲突的旧策略
DROP POLICY IF EXISTS "admin_select_policy" ON admin_users;
DROP POLICY IF EXISTS "admin_modify_policy" ON admin_users;
DROP POLICY IF EXISTS "管理员可以查看所有管理员" ON admin_users;
DROP POLICY IF EXISTS "超级管理员可以管理所有管理员" ON admin_users;

-- 创建 RLS 策略
CREATE POLICY "admin_select_policy" 
ON admin_users FOR SELECT 
USING (
    EXISTS (
        SELECT 1 FROM admin_users au 
        WHERE au.user_id = auth.uid() AND au.is_active = true
    )
);

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

-- 第四步：创建管理员验证函数
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

-- 第五步：插入管理员记录
-- 注意：需要先在 Supabase Auth 中创建 admin@civilaihub.com 用户
INSERT INTO admin_users (user_id, email, role, is_active, permissions, created_at)
SELECT 
    u.id,
    u.email,
    'super_admin',
    true,
    '{
        "tools": ["read", "write", "delete"],
        "users": ["read", "write"],
        "categories": ["read", "write", "delete"], 
        "submissions": ["read", "write", "delete"],
        "analytics": ["read"],
        "settings": ["read", "write"]
    }'::jsonb,
    now()
FROM auth.users u
WHERE u.email = 'admin@civilaihub.com'
ON CONFLICT (email) DO UPDATE SET
    role = 'super_admin',
    is_active = true,
    permissions = '{
        "tools": ["read", "write", "delete"],
        "users": ["read", "write"],
        "categories": ["read", "write", "delete"],
        "submissions": ["read", "write", "delete"],
        "analytics": ["read"],
        "settings": ["read", "write"]
    }'::jsonb;

-- 验证结果
SELECT 
    '=== 设置验证结果 ===' as section;

-- 检查表是否存在
SELECT 
    'admin_users 表' as component,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.tables 
            WHERE table_schema = 'public' AND table_name = 'admin_users'
        ) 
        THEN '✅ 存在' 
        ELSE '❌ 不存在' 
    END as status;

-- 检查函数是否存在
SELECT 
    'is_admin 函数' as component,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM pg_proc WHERE proname = 'is_admin'
        ) 
        THEN '✅ 存在' 
        ELSE '❌ 不存在' 
    END as status;

SELECT 
    'is_super_admin 函数' as component,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM pg_proc WHERE proname = 'is_super_admin'
        ) 
        THEN '✅ 存在' 
        ELSE '❌ 不存在' 
    END as status;

-- 检查管理员用户
SELECT 
    '管理员用户 (auth)' as component,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM auth.users WHERE email = 'admin@civilaihub.com'
        ) 
        THEN '✅ 存在' 
        ELSE '❌ 不存在 - 需要先创建' 
    END as status;

-- 检查管理员记录
SELECT 
    '管理员记录 (admin_users)' as component,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM admin_users au
            JOIN auth.users u ON au.user_id = u.id
            WHERE u.email = 'admin@civilaihub.com' AND au.is_active = true
        ) 
        THEN '✅ 存在且活跃' 
        ELSE '❌ 不存在或未激活' 
    END as status;

-- 显示管理员详情（如果存在）
SELECT 
    '=== 管理员账户详情 ===' as section;

SELECT 
    u.id as user_id,
    u.email,
    u.email_confirmed_at IS NOT NULL as email_confirmed,
    u.created_at as user_created,
    au.role as admin_role,
    au.is_active,
    au.permissions,
    au.created_at as admin_record_created
FROM auth.users u
JOIN admin_users au ON u.id = au.user_id
WHERE u.email = 'admin@civilaihub.com';

-- 显示当前RLS策略
SELECT 
    '=== RLS 策略列表 ===' as section;

SELECT 
    tablename,
    policyname,
    cmd as policy_command,
    SUBSTRING(qual FROM 1 FOR 50) || '...' as policy_condition
FROM pg_policies 
WHERE tablename = 'admin_users'
ORDER BY policyname;

-- 最终状态报告
SELECT 
    '=== 最终状态报告 ===' as section;

DO $$
DECLARE
    user_exists BOOLEAN;
    admin_record_exists BOOLEAN;
    tables_ready BOOLEAN;
    functions_ready BOOLEAN;
BEGIN
    -- 检查各项状态
    SELECT EXISTS(SELECT 1 FROM auth.users WHERE email = 'admin@civilaihub.com') INTO user_exists;
    SELECT EXISTS(
        SELECT 1 FROM admin_users au 
        JOIN auth.users u ON au.user_id = u.id 
        WHERE u.email = 'admin@civilaihub.com' AND au.is_active = true
    ) INTO admin_record_exists;
    SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'admin_users') INTO tables_ready;
    SELECT (
        EXISTS(SELECT 1 FROM pg_proc WHERE proname = 'is_admin') AND 
        EXISTS(SELECT 1 FROM pg_proc WHERE proname = 'is_super_admin')
    ) INTO functions_ready;
    
    -- 输出状态报告
    RAISE NOTICE '=====================================';
    RAISE NOTICE '🏗️  管理员设置状态报告';
    RAISE NOTICE '=====================================';
    RAISE NOTICE '📋 数据库表: %', CASE WHEN tables_ready THEN '✅ 就绪' ELSE '❌ 缺失' END;
    RAISE NOTICE '🔧 验证函数: %', CASE WHEN functions_ready THEN '✅ 就绪' ELSE '❌ 缺失' END;
    RAISE NOTICE '👤 Auth用户: %', CASE WHEN user_exists THEN '✅ 存在' ELSE '❌ 不存在' END;
    RAISE NOTICE '🔐 管理员记录: %', CASE WHEN admin_record_exists THEN '✅ 活跃' ELSE '❌ 缺失' END;
    RAISE NOTICE '=====================================';
    
    IF user_exists AND admin_record_exists AND tables_ready AND functions_ready THEN
        RAISE NOTICE '🎉 管理员设置完成！';
        RAISE NOTICE '📧 登录邮箱: admin@civilaihub.com';
        RAISE NOTICE '🔐 登录密码: admin123';
        RAISE NOTICE '🌐 管理后台: /admin';
    ELSE
        RAISE NOTICE '⚠️  设置未完成，请检查以上状态';
        IF NOT user_exists THEN
            RAISE NOTICE '❗ 需要先在 Supabase Auth 中创建用户: admin@civilaihub.com';
        END IF;
    END IF;
    RAISE NOTICE '=====================================';
END $$;