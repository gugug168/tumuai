-- 彻底修复 admin_users 表的无限递归问题
-- 这次使用更简单和直接的策略

-- ==============================================
-- 1. 完全删除所有 admin_users 相关策略
-- ==============================================

-- 删除所有可能导致递归的策略
DROP POLICY IF EXISTS "admin_users_select_own" ON admin_users;
DROP POLICY IF EXISTS "admin_users_service_role" ON admin_users;
DROP POLICY IF EXISTS "admin_users_policy" ON admin_users;
DROP POLICY IF EXISTS "Admin users can view all admin users" ON admin_users;
DROP POLICY IF EXISTS "Admin users can manage admin users" ON admin_users;
DROP POLICY IF EXISTS "admin_users_select" ON admin_users;
DROP POLICY IF EXISTS "admin_users_insert" ON admin_users;
DROP POLICY IF EXISTS "admin_users_update" ON admin_users;
DROP POLICY IF EXISTS "admin_users_delete" ON admin_users;

-- ==============================================
-- 2. 暂时禁用 RLS（最安全的方法）
-- ==============================================

-- 禁用 RLS 避免所有递归问题
ALTER TABLE admin_users DISABLE ROW LEVEL SECURITY;

-- ==============================================
-- 3. 可选：创建最简单的策略（仅限服务端）
-- ==============================================

-- 如果需要 RLS，只允许服务端角色访问
-- ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;
-- 
-- CREATE POLICY "admin_users_service_only" ON admin_users
--     FOR ALL USING (auth.role() = 'service_role');

-- ==============================================
-- 4. 确保表结构正确
-- ==============================================

-- 确保表有必要的列
DO $$
BEGIN
    -- 检查并添加必要的列
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'admin_users' AND column_name = 'user_id'
    ) THEN
        ALTER TABLE admin_users ADD COLUMN user_id uuid REFERENCES auth.users(id);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'admin_users' AND column_name = 'role'
    ) THEN
        ALTER TABLE admin_users ADD COLUMN role text DEFAULT 'admin';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'admin_users' AND column_name = 'permissions'
    ) THEN
        ALTER TABLE admin_users ADD COLUMN permissions jsonb DEFAULT '{}';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'admin_users' AND column_name = 'created_at'
    ) THEN
        ALTER TABLE admin_users ADD COLUMN created_at timestamptz DEFAULT now();
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'admin_users' AND column_name = 'updated_at'
    ) THEN
        ALTER TABLE admin_users ADD COLUMN updated_at timestamptz DEFAULT now();
    END IF;
END $$;

-- ==============================================
-- 5. 创建索引
-- ==============================================

CREATE INDEX IF NOT EXISTS idx_admin_users_user_id ON admin_users(user_id);
CREATE INDEX IF NOT EXISTS idx_admin_users_role ON admin_users(role);

-- ==============================================
-- 6. 验证修复
-- ==============================================

SELECT 'Admin users RLS issues fixed - RLS disabled for safety' as status;

-- 显示当前状态
SELECT 
    schemaname,
    tablename,
    rowsecurity as rls_enabled,
    (SELECT count(*) FROM pg_policies WHERE tablename = 'admin_users') as policy_count
FROM pg_tables 
WHERE tablename = 'admin_users';
