# TumuAI 部署指南

## 🚨 当前问题

Vercel GitHub 自动部署已失效。需要手动部署或配置 GitHub Actions Secrets。

## 🔧 解决方案

### 方案A：配置 GitHub Actions（推荐，自动化）

1. **获取 Vercel Token**
   - 访问 https://vercel.com/account/tokens
   - 创建新 Token
   - 复制 Token

2. **配置 GitHub Secrets**
   - 访问 https://github.com/gugug168/tumuai/settings/secrets/actions
   - 点击 "New repository secret"
   - 添加以下 3 个 secrets：

   | Name | Value |
   |------|-------|
   | `VERCEL_TOKEN` | 你创建的 Vercel Token |
   | `VERCEL_ORG_ID` | `team_6XLfrsqlmELfvJ8OZtnlvMup` |
   | `VERCEL_PROJECT_ID` | `prj_4vyL9kVlVhEwXqDOFznKvzosJqWU` |

3. **验证**
   - 推送代码会自动触发部署
   - 访问 https://github.com/gugug168/tumuai/actions 查看运行状态

### 方案B：使用 Vercel CLI（手动）

#### Windows PowerShell：
```powershell
cd E:\tumuai\scripts
.\deploy.ps1
```

#### Windows CMD：
```cmd
cd E:\tumuai\scripts
deploy.bat
```

#### 手动命令：
```bash
npm install -g @vercel/cli
vercel login
cd E:\tumuai
vercel --prod
```

### 方案C：Vercel Dashboard

1. 访问 https://vercel.com/dashboard
2. 找到 tumuai 项目
3. Deployments → New Deployment
4. 选择 master 分支
5. 点击 Deploy

## ✅ 部署后验证

访问 https://www.tumuai.net/ 检查：

- [ ] 控制台无 404 错误
- [ ] 无 meta 标签警告
- [ ] /tools 页面可用
- [ ] /about 页面可用

## 📊 项目信息

- **组织 ID**: team_6XLfrsqlmELfvJ8OZtnlvMup
- **项目 ID**: prj_4vyL9kVlVhEwXqDOFznKvzosJqWU
- **项目名称**: tumuai
- **构建命令**: npm run build
- **输出目录**: dist
