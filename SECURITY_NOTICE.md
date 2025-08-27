# 🔐 安全警告 - API密钥泄露处理

## ⚠️ 立即行动要求

由于之前的代码审查发现了API密钥泄露问题，**必须立即执行以下安全措施**：

### 1. 轮换Supabase API密钥

**立即在Supabase控制台执行**：
1. 访问 [Supabase Dashboard](https://supabase.com/dashboard)
2. 进入项目设置 → API
3. 重新生成以下密钥：
   - `anon` 公钥
   - `service_role` 密钥（如使用）

### 2. 更新环境变量

**本地开发环境**：
```bash
# 创建 .env.local 文件（不要使用 .env）
cp .env.example .env.local

# 编辑 .env.local 文件，填入新的API密钥
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_new_anon_key
VITE_ADMIN_EMAILS=your-admin-emails
VITE_SUPER_ADMIN_EMAIL=your-super-admin-email
```

**生产环境（Netlify）**：
1. 访问 Netlify Dashboard
2. 进入项目设置 → Environment variables
3. 更新所有相关的环境变量

### 3. 管理员配置

由于移除了硬编码管理员配置，需要设置环境变量：
```bash
VITE_ADMIN_EMAILS=admin1@example.com,admin2@example.com
VITE_SUPER_ADMIN_EMAIL=superadmin@example.com
```

### 4. 验证安全修复

- [x] 移除硬编码密码 `admin123`
- [x] 删除泄露的 `.env` 文件  
- [x] 创建 `.env.example` 模板
- [x] 改进 `.gitignore` 配置
- [x] 修复登录页面凭证引用
- [ ] **待执行：轮换Supabase API密钥**
- [ ] **待执行：更新生产环境变量**

## 🛡️ 安全改进措施

已实施的安全增强：
1. **移除所有硬编码凭证**
2. **环境变量模板化**  
3. **输入验证增强**
4. **邮箱格式验证**

## 📞 后续行动

请立即执行上述API密钥轮换步骤，确保系统安全。

**此文件可在安全措施完成后删除。**