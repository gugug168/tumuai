/*
  # 创建默认管理员账号

  1. 创建管理员用户
    - 邮箱: admin@civilaihub.com
    - 密码: gu2278797
    - 角色: super_admin

  2. 安全设置
    - 启用所有管理权限
    - 设置为超级管理员
*/

-- 首先确保 auth.users 表中有管理员用户
-- 注意：在实际部署时，需要通过 Supabase 控制台或 API 创建用户
-- 这里我们假设用户已经通过注册流程创建

-- 创建管理员权限记录的函数
CREATE OR REPLACE FUNCTION create_admin_user()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  admin_user_id uuid;
BEGIN
  -- 查找管理员用户ID（通过邮箱）
  SELECT id INTO admin_user_id
  FROM auth.users
  WHERE email = 'admin@civilaihub.com'
  LIMIT 1;

  -- 如果找到用户，创建管理员记录
  IF admin_user_id IS NOT NULL THEN
    -- 检查是否已存在管理员记录
    IF NOT EXISTS (
      SELECT 1 FROM admin_users WHERE user_id = admin_user_id
    ) THEN
      -- 插入管理员记录
      INSERT INTO admin_users (
        user_id,
        role,
        permissions,
        created_at,
        updated_at
      ) VALUES (
        admin_user_id,
        'super_admin',
        jsonb_build_object(
          'manage_tools', true,
          'manage_users', true,
          'manage_submissions', true,
          'manage_admins', true,
          'view_analytics', true,
          'system_settings', true
        ),
        now(),
        now()
      );
    END IF;

    -- 同时创建用户资料（如果不存在）
    IF NOT EXISTS (
      SELECT 1 FROM user_profiles WHERE id = admin_user_id
    ) THEN
      INSERT INTO user_profiles (
        id,
        username,
        full_name,
        created_at,
        updated_at
      ) VALUES (
        admin_user_id,
        'admin',
        '系统管理员',
        now(),
        now()
      );
    END IF;
  END IF;
END;
$$;

-- 执行函数（如果管理员用户存在的话）
SELECT create_admin_user();

-- 清理函数
DROP FUNCTION IF EXISTS create_admin_user();