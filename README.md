# Civil AI Hub

Civil AI Hub是一个专注于Civil领域的人工智能工具平台，旨在帮助工程师、设计师和专业人士发现和分享最佳的人工智能解决方案。

## 🚀 部署说明

### 环境变量配置
在部署前，请确保在部署平台（如Netlify）中配置以下环境变量：

| 变量名称 | 描述 |
|---------|------|
| `VITE_SUPABASE_URL` | Supabase项目的URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase的匿名密钥 |

### Netlify部署配置
1. 登录到 [Netlify Dashboard](https://app.netlify.com/)
2. 选择项目后点击左侧菜单底部"Site settings"
3. 在"Environment variables"选项中添加上述环境变量
4. 保存后Netlify会自动触发重新部署

### Supabase环境变量值获取路径：
1. 登录到 [Supabase Dashboard](https://app.supabase.com/)
2. 选择项目后点击左侧菜单底部"Project Settings"
3. 在"API"选项卡中获取项目URL和匿名密钥

## 📦 项目构建

项目使用Vite构建，支持快速开发和优化的生产构建。您可以使用以下命令：

```bash
# 开发模式
npm run dev

# 构建生产版本
npm run build

# 预览生产版本
npm run preview
```

## 🧪 代码质量

项目包含以下代码质量工具：

```bash
# 类型检查
npm run type-check

# 代码检查
npm run lint

# 代码格式化
npm run format
```

## 🌐 环境变量配置

项目使用VITE构建，需要配置以下环境变量：

### 1. 创建环境变量文件
在项目根目录创建以下文件：

```bash
# 开发环境配置文件
touch .env.local

# 生产环境在Netlify中配置环境变量
```

### 2. 本地开发环境变量
在 `.env.local` 文件中配置：

```bash
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

### 3. 生产环境配置（Netlify）
在 Netlify Dashboard 中配置以下环境变量：

| 变量名称 | 描述 | 必需 |
|---------|------|------|
| `VITE_SUPABASE_URL` | Supabase项目的URL | ✅ |
| `VITE_SUPABASE_ANON_KEY` | Supabase的匿名密钥 | ✅ |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase服务角色密钥（用于Netlify Functions） | ✅ |
| `E2E_ADMIN_USER` | 测试管理员邮箱 | 🔶 |
| `E2E_ADMIN_PASS` | 测试管理员密码 | 🔶 |
| `E2E_SUPABASE_URL` | 测试环境Supabase URL | 🔶 |
| `E2E_SUPABASE_ANON_KEY` | 测试环境匿名密钥 | 🔶 |

### 4. 获取Supabase环境变量值
1. 登录到 [Supabase Dashboard](https://app.supabase.com/)
2. 选择项目后点击左侧菜单底部"Project Settings"
3. 在"API"选项卡中获取：
   - **URL**: 项目URL（VITE_SUPABASE_URL）
   - **anon public**: 匿名公钥（VITE_SUPABASE_ANON_KEY）
   - **service_role**: 服务角色密钥（SUPABASE_SERVICE_ROLE_KEY，⚠️保密）

### 5. 环境变量安全说明
⚠️ **重要安全提示**：
- `VITE_SUPABASE_ANON_KEY`: 可以暴露在前端，但应配置RLS策略
- `SUPABASE_SERVICE_ROLE_KEY`: 绝对不能暴露到前端，仅用于服务端
- 生产环境密钥与开发环境应该分离
- 定期轮换API密钥

## 🌐 技术栈

- **前端**：React + TypeScript + Vite
- **样式**：Tailwind CSS
- **图标**：Lucide React
- **路由**：React Router
- **状态管理**：React Context
- **后端**：Supabase（数据库、认证）
- **数据库**：PostgreSQL（通过Supabase）

## 📁 目录结构

```bash
src/
├── components/       # 可重用的UI组件
├── contexts/          # React Context提供者
├── lib/               # 核心库和工具函数
├── pages/             # 页面组件
├── App.tsx             # 主应用程序组件
└── main.tsx           # 入口点
```

## 📄 免责声明

本项目使用免费版Supabase和Netlify实现所有功能：

- **Supabase免费版提供**：
  - 500MB数据库空间
  - 50,000个用户
  - 1GB存储空间

- **Netlify免费版提供**：
  - 100GB带宽/月
  - 300分钟构建时间/月
  - 单个函数最多10秒执行时间

## 📝 许可证

本项目使用MIT许可证。详情请参阅[MIT License](LICENSE)文件。