# 🔐 管理员权限设置指南

## 📋 概述

新的权限控制系统使用数据库级别的验证，提供更安全的权限管理机制。

## 🚀 初始设置步骤

### 1. 执行数据库迁移

1. 登录 [Supabase Dashboard](https://supabase.com/dashboard)
2. 进入项目的 SQL Editor
3. 复制并执行 `database/admin_users_migration.sql` 中的所有SQL语句
4. 修改最后的INSERT语句，替换为实际的超级管理员邮箱

### 2. 创建管理员账号

**在Supabase Auth中创建管理员用户**：
1. 进入 Authentication → Users
2. 点击 "Add User"
3. 输入管理员邮箱和密码
4. 确认创建

### 3. 添加管理员权限

**方法1：SQL命令添加**
```sql
-- 添加普通管理员
INSERT INTO admin_users (user_id, email, role, is_active, permissions)
SELECT 
  id,
  email,
  'admin',
  true,
  '{"tools": ["read", "write"], "users": ["read"]}'
FROM auth.users 
WHERE email = 'admin@example.com'
ON CONFLICT (email) DO NOTHING;

-- 添加超级管理员
INSERT INTO admin_users (user_id, email, role, is_active, permissions)
SELECT 
  id,
  email,
  'super_admin',
  true,
  '{"tools": ["read", "write", "delete"], "users": ["read", "write", "delete"], "system": ["read", "write"]}'
FROM auth.users 
WHERE email = 'superadmin@example.com'
ON CONFLICT (email) DO NOTHING;
```

### 4. 验证设置

1. 用管理员账号登录应用
2. 访问管理后台页面
3. 确认权限验证正常工作

## 🛡️ 权限级别说明

### 普通管理员 (`admin`)
- 可以查看和管理工具
- 可以查看用户列表
- 无法管理其他管理员

### 超级管理员 (`super_admin`)
- 拥有所有普通管理员权限
- 可以添加/删除其他管理员
- 可以修改系统配置
- 可以查看系统统计信息

## 🔧 权限管理操作

### 添加新管理员
```sql
INSERT INTO admin_users (user_id, email, role, is_active)
SELECT id, email, 'admin', true
FROM auth.users 
WHERE email = 'newadmin@example.com';
```

### 禁用管理员
```sql
UPDATE admin_users 
SET is_active = false 
WHERE email = 'admin@example.com';
```

### 升级为超级管理员
```sql
UPDATE admin_users 
SET role = 'super_admin',
    permissions = '{"tools": ["read", "write", "delete"], "users": ["read", "write", "delete"], "system": ["read", "write"]}'
WHERE email = 'admin@example.com';
```

### 查看所有管理员
```sql
SELECT 
  au.email,
  au.role,
  au.is_active,
  au.last_login,
  au.created_at
FROM admin_users au
ORDER BY au.created_at DESC;
```

## ⚠️ 重要安全注意事项

1. **数据库访问控制**: 确保只有授权人员能访问Supabase控制台
2. **定期审查**: 定期检查管理员列表，移除不需要的权限
3. **日志监控**: 监控管理员操作日志，发现异常行为
4. **密码策略**: 要求管理员使用强密码，定期更换

## 🔍 故障排除

### 问题1：管理员无法登录
- 检查用户是否在 `auth.users` 表中存在
- 验证 `admin_users` 表中是否有对应记录
- 确认 `is_active` 字段为 `true`

### 问题2：权限验证失败
- 检查Netlify Functions环境变量配置
- 验证 `SUPABASE_SERVICE_ROLE_KEY` 是否正确
- 查看浏览器控制台和Netlify Functions日志

### 问题3：数据库连接错误
- 验证 `VITE_SUPABASE_URL` 环境变量
- 检查RLS策略是否正确配置
- 确认函数权限设置