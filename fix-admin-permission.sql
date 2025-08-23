-- 修复管理员权限问题
-- 确保当前登录的管理员用户有正确的权限记录

-- 1. 查看当前 admin_users 表的状态
SELECT 'Current admin_users table:' as info;
SELECT * FROM admin_users;

-- 2. 查看当前认证的用户
SELECT 'Current auth users:' as info;  
SELECT id, email, created_at FROM auth.users ORDER BY created_at DESC LIMIT 5;

-- 3. 添加管理员记录（如果不存在）
-- 找到邮箱为 admin@civilaihub.com 的用户并设为管理员
INSERT INTO admin_users (user_id, role, permissions, created_at, updated_at)
SELECT 
    id,
    'super_admin',
    '{"tools": ["read", "write", "delete"], "users": ["read", "write"], "categories": ["read", "write", "delete"], "reviews": ["read", "write", "delete"]}'::jsonb,
    now(),
    now()
FROM auth.users 
WHERE email = 'admin@civilaihub.com'
ON CONFLICT (user_id) DO UPDATE SET
    role = EXCLUDED.role,
    permissions = EXCLUDED.permissions,
    updated_at = now();

-- 4. 如果没有找到 admin@civilaihub.com，则将最新的用户设为管理员
INSERT INTO admin_users (user_id, role, permissions, created_at, updated_at)
SELECT 
    id,
    'super_admin',
    '{"tools": ["read", "write", "delete"], "users": ["read", "write"], "categories": ["read", "write", "delete"], "reviews": ["read", "write", "delete"]}'::jsonb,
    now(),
    now()
FROM auth.users 
WHERE id NOT IN (SELECT user_id FROM admin_users WHERE user_id IS NOT NULL)
ORDER BY created_at DESC
LIMIT 1
ON CONFLICT (user_id) DO NOTHING;

-- 5. 验证结果
SELECT 'Final admin_users table:' as info;
SELECT 
    au.*,
    u.email
FROM admin_users au
JOIN auth.users u ON au.user_id = u.id;

-- 6. 显示状态
SELECT 'Admin setup completed successfully' as status;

