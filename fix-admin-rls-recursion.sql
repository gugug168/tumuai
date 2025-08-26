-- 修复admin_users表RLS无限递归问题
-- 问题：admin_users表的RLS策略引用自身造成无限递归
-- 解决方案：完全禁用admin_users表的RLS，依靠Netlify Functions进行权限验证

-- 1. 删除所有admin_users表的RLS策略（防止无限递归）
DROP POLICY IF EXISTS "admin_users_read_own" ON admin_users;
DROP POLICY IF EXISTS "admin_users_super_admin_read_all" ON admin_users;  
DROP POLICY IF EXISTS "admin_users_super_admin_write" ON admin_users;
DROP POLICY IF EXISTS "admin_users_select_own" ON admin_users;
DROP POLICY IF EXISTS "admin_users_service_role" ON admin_users;
DROP POLICY IF EXISTS "admin_users_policy" ON admin_users;
DROP POLICY IF EXISTS "Admin users can view all admin users" ON admin_users;
DROP POLICY IF EXISTS "Admin users can manage admin users" ON admin_users;

-- 2. 完全禁用admin_users表的行级安全
ALTER TABLE admin_users DISABLE ROW LEVEL SECURITY;

-- 3. 修复工具表的RLS策略，简化管理员权限检查
-- 移除复杂的admin_users查询，改为依赖service_role权限
DROP POLICY IF EXISTS "tools_admin_read_all" ON tools;
DROP POLICY IF EXISTS "tools_admin_write" ON tools;

-- 简化的管理员策略：只允许service_role（Netlify Functions）操作
CREATE POLICY "tools_admin_access" ON tools
    FOR ALL TO service_role
    USING (true)
    WITH CHECK (true);

-- 4. 验证修复结果
SELECT 
    'RLS修复完成' as status,
    c.relname as table_name,
    c.relrowsecurity as rls_enabled
FROM pg_catalog.pg_class c
WHERE c.relname IN ('admin_users', 'tools')
    AND c.relkind = 'r'  -- 只查询普通表
ORDER BY c.relname;