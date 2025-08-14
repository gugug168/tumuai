-- 初始化管理员用户
INSERT INTO admin_users (id, user_id, role, permissions, created_at, updated_at)
VALUES (
  gen_random_uuid(), -- 使用随机UUID生成唯一ID
  '44d96eb6-6cd0-49dc-9c36-ad909f0d3e46', -- 实际的用户ID
  'super_admin',
  '{}',
  NOW(),
  NOW()
)
ON CONFLICT (user_id) DO NOTHING;