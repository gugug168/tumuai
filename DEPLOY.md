# Vercel 部署问题解决方案

## 问题诊断

Vercel GitHub 自动部署已停止工作，需要手动部署。

## 解决方案

### 方案1：使用 Vercel CLI（推荐）

1. **安装 Vercel CLI**
   ```bash
   npm install -g vercel
   ```

2. **登录 Vercel**
   ```bash
   vercel login
   ```
   这会打开浏览器进行授权

3. **部署到生产环境**
   ```bash
   cd /e/tumuai
   vercel --prod
   ```

### 方案2：使用 GitHub Actions

1. 打开 https://github.com/gugug168/tumuai/settings/secrets/actions

2. 添加以下 secrets：

   | Name | Value |
   |------|-------|
   | `VERCEL_TOKEN` | 从 https://vercel.com/account/tokens 获取 |
   | `VERCEL_ORG_ID` | `team_6XLfrsqlmELfvJ8OZtnlvMup` |
   | `VERCEL_PROJECT_ID` | `prj_4vyL9kVlVhEwXqDOFznKvzosJqWU` |

3. 推送代码会自动触发部署

### 方案3：在 Vercel Dashboard 手动部署

1. 登录 https://vercel.com/dashboard
2. 找到 tumuai 项目
3. 点击 "Deployments" → "New Deployment"
4. 选择 master 分支
5. 点击 "Deploy"

## 验证部署

部署完成后，访问 https://www.tumuai.net/ 并检查：

1. 控制台没有 404 错误
2. JS 文件是新的哈希值
3. `/tools` 和 `/about` 页面可以访问

## 项目信息

- **组织ID**: team_6XLfrsqlmELfvJ8OZtnlvMup
- **项目ID**: prj_4vyL9kVlVhEwXqDOFznKvzosJqWU
- **项目名称**: tumuai
