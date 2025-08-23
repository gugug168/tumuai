# 环境变量设置指南

## 快速设置

### 1. 本地开发环境

创建 `.env.local` 文件（此文件不会被提交到 Git）：

```bash
# 复制以下内容到 .env.local 文件中，并替换相应的值

# Supabase 配置
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here

# Netlify Functions 专用（本地测试时需要）
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here

# 端到端测试配置（可选）
E2E_ADMIN_USER=admin@civilaihub.com
E2E_ADMIN_PASS=your-admin-password
E2E_SUPABASE_URL=https://your-project.supabase.co
E2E_SUPABASE_ANON_KEY=your-anon-key-here
E2E_SUPABASE_TOKEN=your-test-access-token
```

### 2. 获取 Supabase 凭据

1. 打开 [Supabase Dashboard](https://app.supabase.com/)
2. 选择您的项目
3. 左侧菜单 > Settings > API
4. 复制以下值：
   - **URL**: 用于 `VITE_SUPABASE_URL`
   - **anon/public key**: 用于 `VITE_SUPABASE_ANON_KEY`
   - **service_role key**: 用于 `SUPABASE_SERVICE_ROLE_KEY`

### 3. Netlify 生产环境配置

1. 登录 [Netlify Dashboard](https://app.netlify.com/)
2. 选择您的项目
3. Site settings > Environment variables
4. 添加以下变量：
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`

### 4. 验证配置

运行以下命令验证环境变量是否正确配置：

```bash
# 启动开发服务器
npm run dev

# 访问诊断页面
# http://localhost:5173/diagnostic
```

## 环境变量说明

| 变量名 | 用途 | 前端可见 | 必需 |
|--------|------|----------|------|
| `VITE_SUPABASE_URL` | Supabase 项目 URL | ✅ | ✅ |
| `VITE_SUPABASE_ANON_KEY` | 匿名访问密钥 | ✅ | ✅ |
| `SUPABASE_SERVICE_ROLE_KEY` | 服务端完全访问密钥 | ❌ | ✅ |
| `E2E_*` | 端到端测试配置 | ❌ | 🔶 |

## 安全注意事项

🔒 **重要安全规则**：

1. **永远不要** 将 `SUPABASE_SERVICE_ROLE_KEY` 暴露到前端代码中
2. **永远不要** 将任何包含 `SERVICE_ROLE` 的密钥提交到 Git
3. 定期轮换 API 密钥
4. 在生产环境中使用不同的密钥
5. 启用 Supabase RLS (Row Level Security) 策略

## 故障排除

### 常见问题

1. **"Missing VITE_SUPABASE_URL environment variable"**
   - 确保 `.env.local` 文件存在且包含正确的 URL

2. **"Connection failed"**
   - 检查 Supabase URL 是否正确
   - 验证 API 密钥是否有效

3. **"Forbidden" 错误**
   - 检查 RLS 策略设置
   - 确认使用了正确的 service role key

4. **Netlify Functions 无法访问数据库**
   - 确保在 Netlify 中设置了 `SUPABASE_SERVICE_ROLE_KEY`
   - 检查函数是否使用了正确的环境变量

### 测试环境变量

```bash
# 检查前端环境变量
echo $VITE_SUPABASE_URL
echo $VITE_SUPABASE_ANON_KEY

# 测试数据库连接（在 Node.js 环境中）
node check_database.js
```
