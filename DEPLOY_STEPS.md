# TumuAI 部署操作指南

## 🚨 当前情况

代码已全部优化并推送到 GitHub (22 次提交)，但 Vercel 没有自动部署新版本的前端代码。

## 📋 请按以下步骤操作

### 步骤 1：选择部署方式

#### 方式 A：使用 Vercel CLI（最简单，推荐）

1. **打开新的命令提示符或 PowerShell**

2. **运行部署脚本**：
   ```powershell
   # PowerShell
   cd E:\tumuai\scripts
   .\deploy.ps1
   ```

   或者
   ```cmd
   # CMD
   cd E:\tumuai\scripts
   deploy.bat
   ```

3. **按提示完成登录**（会自动打开浏览器）

4. **等待部署完成**（约 1-2 分钟）

#### 方式 B：配置 GitHub Actions（一次性配置，后续自动）

1. **获取 Vercel Token**
   - 访问 https://vercel.com/account/tokens
   - 点击 "Create Token"
   - 勾选 "Full Account" 权限
   - 创建并复制 Token

2. **配置 GitHub Secrets**
   - 访问 https://github.com/gugug168/tumuai/settings/secrets/actions
   - 点击 "New repository secret"
   - 依次添加：

   | Secret Name | Value |
   |--------------|-------|
   | `VERCEL_TOKEN` | 你刚才复制的 Token |
   | `VERCEL_ORG_ID` | `team_6XLfrsqlmELfvJ8OZtnlvMup` |
   | `VERCEL_PROJECT_ID` | `prj_4vyL9kVlVhEwXqDOFznKvzosJqWU` |

3. **触发部署**
   - 任意修改一个文件并推送，或运行：
   ```bash
   git commit --allow-empty -m "trigger deploy"
   git push origin master
   ```

#### 方式 C：Vercel Dashboard 手动部署

1. 访问 https://vercel.com/dashboard
2. 找到 **tumuai** 项目
3. 点击 **Deployments** 标签
4. 点击 **New Deployment** 按钮
5. 选择 **master** 分支
6. 点击 **Deploy** 按钮
7. 等待部署完成（约 2-3 分钟）

### 步骤 2：验证部署

部署完成后，访问 https://www.tumuai.net/ 并检查：

- [ ] 控制台没有红色 404 错误
- [ ] 没有 meta 标签警告
- [ ] 点击 "工具中心" 链接可以跳转
- [ ] 点击 "关于我们" 链接可以跳转

## 📞 完成后请告诉我

部署完成后，请回复 **"部署完成"**，我会立即验证所有功能并进行下一轮优化！

## ❓ 常见问题

**Q: Vercel CLI 登录后提示 "No existing credentials"？**
A: 确保运行了 `vercel login` 并在浏览器中完成了授权

**Q: GitHub Actions 失败？**
A: 检查 secrets 是否正确配置，特别是 VERCEL_TOKEN 是否有效

**Q: 部署后还是旧版本？**
A: 尝试清除浏览器缓存 (Ctrl+Shift+Delete) 或使用无痕模式访问
