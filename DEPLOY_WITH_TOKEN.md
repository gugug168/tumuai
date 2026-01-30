# 使用 Token 部署到 Vercel

## 方法：使用个人访问令牌部署

### 1. 获取 Vercel Token

1. 访问 https://vercel.com/account/tokens
2. 点击 "Create Token"
3. 输入 Token 名称：`tumuai-deploy`
4. 选择 Scope：`Full Account`
5. 点击 "Create"
6. **复制生成的 Token**（只显示一次！）

### 2. 设置环境变量并部署

#### Windows PowerShell:
```powershell
$env:VERCEL_TOKEN = "你的Token"
cd E:\tumuai
npx vercel --prod --token=$env:VERCEL_TOKEN
```

#### Windows CMD:
```cmd
set VERCEL_TOKEN=你的Token
cd E:\tumuai
npx vercel --prod --token=%VERCEL_TOKEN%
```

#### 或者直接在命令中：
```bash
cd E:\tumuai
npx vercel --prod --token=你的Token
```

### 3. 验证部署

访问 https://www.tumuai.net/ 检查是否更新成功

---

**注意**：Token 是敏感信息，请妥善保管！
