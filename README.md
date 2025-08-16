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
```bash
# 创建.env文件（用于生产环境）
cp .env.example .env

# 创建.env.local文件（用于开发环境）
cp .env.local.example .env.local
```

### 2. 配置环境变量
编辑创建的.env或.env.local文件，设置以下变量：

| 变量名称 | 描述 |
|---------|------|
| `VITE_SUPABASE_URL` | Supabase项目的URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase的匿名密钥 |

### 3. 获取Supabase环境变量值
1. 登录到 [Supabase Dashboard](https://app.supabase.com/)
2. 选择项目后点击左侧菜单底部"Project Settings"
3. 在"API"选项卡中获取项目URL和匿名密钥

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