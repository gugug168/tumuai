# 管理员账户初始化指南

本指南将帮助您完成 Civil AI Hub 管理员账户的初始化设置。

## 🎯 初始化目标

设置管理员账户：
- **邮箱**: admin@civilaihub.com  
- **密码**: admin123
- **角色**: super_admin
- **权限**: 全部管理权限

## 🔧 前置条件检查

在开始之前，请确保：

1. ✅ Supabase 项目已创建并配置
2. ✅ 环境变量已正确设置
3. ✅ Node.js 已安装
4. ✅ 项目依赖已安装

### 环境变量验证

检查 `.env.local` 文件包含：

```env
VITE_SUPABASE_URL=https://bixljqdwkjuzftlpmgtb.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

## 📋 初始化方法

### 方法一：使用 Netlify Functions (推荐)

如果您已经运行了 `netlify dev` 服务，可以使用现有的 setup-admin 函数：

```bash
# 访问设置端点（需要安全令牌）
curl "http://localhost:8888/.netlify/functions/setup-admin?token=your_setup_token"
```

### 方法二：直接在 Supabase SQL Editor 运行

1. 打开 [Supabase Dashboard](https://supabase.com/dashboard)
2. 进入您的项目
3. 点击左侧菜单 "SQL Editor"
4. 复制并运行 `scripts/direct-admin-setup.sql` 中的内容

**注意**: 此方法只会创建数据库结构，还需要手动创建用户账户。

### 方法三：使用 JavaScript 脚本 (最完整)

运行准备好的初始化脚本：

#### Windows:
```cmd
scripts\run-admin-setup.bat
```

#### Linux/macOS:
```bash
node scripts/admin-setup.js
```

## 🔍 验证步骤

### 1. 检查用户账户

在 Supabase Dashboard > Authentication > Users 中确认：
- ✅ admin@civilaihub.com 用户存在
- ✅ 邮箱已验证
- ✅ 用户状态为 active

### 2. 检查管理员记录

在 Supabase Dashboard > Database > admin_users 表中确认：
- ✅ 有对应的管理员记录
- ✅ role = 'super_admin'  
- ✅ is_active = true
- ✅ permissions 包含完整权限

### 3. 测试登录

1. 启动开发服务器：`npm run dev`
2. 访问：`http://localhost:5173/admin`
3. 使用凭据登录：
   - 邮箱：admin@civilaihub.com
   - 密码：admin123

## 🚨 常见问题排解

### 问题1：用户创建失败

**现象**: "Failed to create admin user" 错误

**解决方案**:
1. 检查 SUPABASE_SERVICE_ROLE_KEY 是否正确
2. 确保 Supabase 项目配置允许用户注册
3. 检查网络连接和 API 访问

### 问题2：管理员记录创建失败

**现象**: "Failed to create admin record" 错误

**解决方案**:
1. 确保 admin_users 表已创建
2. 运行 `scripts/direct-admin-setup.sql` 创建表结构
3. 检查外键约束和权限设置

### 问题3：RLS 权限问题

**现象**: "Row Level Security" 相关错误

**解决方案**:
1. 检查 is_admin() 和 is_super_admin() 函数是否存在
2. 确认 RLS 策略正确配置
3. 使用 Service Role Key 绕过 RLS 限制

### 问题4：登录后提示权限不足

**现象**: 登录成功但无法访问管理功能

**解决方案**:
1. 确认 admin_users 表中有对应记录
2. 检查 is_active 字段为 true
3. 验证 role 字段为 'super_admin'

## 🔄 重新初始化

如果需要重新初始化管理员账户：

1. **清理现有记录**:
```sql
DELETE FROM admin_users WHERE email = 'admin@civilaihub.com';
```

2. **删除 Auth 用户** (在 Supabase Dashboard):
   - Authentication > Users
   - 找到并删除 admin@civilaihub.com

3. **重新运行初始化脚本**

## 📊 数据库结构参考

### admin_users 表结构

```sql
CREATE TABLE admin_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL UNIQUE,
    role TEXT NOT NULL DEFAULT 'admin' CHECK (role IN ('admin', 'super_admin')),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    last_login TIMESTAMPTZ,
    created_by UUID REFERENCES auth.users(id),
    permissions JSONB DEFAULT '{...}'::jsonb
);
```

### 权限结构参考

```json
{
  "tools": ["read", "write", "delete"],
  "users": ["read", "write"],
  "categories": ["read", "write", "delete"],
  "submissions": ["read", "write", "delete"],
  "analytics": ["read"],
  "settings": ["read", "write"]
}
```

## 🎯 下一步

初始化完成后，您可以：

1. **访问管理后台**: http://localhost:5173/admin
2. **管理工具**: 审核、编辑、删除工具
3. **用户管理**: 查看用户活动和统计
4. **系统设置**: 配置分类、权限等

## 📞 技术支持

如果遇到问题：

1. 查看控制台错误日志
2. 检查 Supabase 项目日志
3. 参考本项目的其他文档
4. 检查 GitHub Issues

---

**安全提醒**: 请在生产环境中修改默认密码并加强安全设置。