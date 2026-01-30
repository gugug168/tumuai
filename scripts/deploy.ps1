# TumuAI Vercel 一键部署脚本

Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "  TumuAI Vercel 一键部署" -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host ""

# 检查 Node.js
Write-Host "1. 检查 Node.js..." -ForegroundColor Yellow
$nodeVersion = node --version 2>$null
if (-not $nodeVersion) {
    Write-Host "❌ 未找到 Node.js，请先安装" -ForegroundColor Red
    exit 1
}
Write-Host "✅ Node.js: $nodeVersion" -ForegroundColor Green

# 检查 npm
Write-Host "2. 检查 npm..." -ForegroundColor Yellow
$npmVersion = npm --version 2>$null
Write-Host "✅ npm: $npmVersion" -ForegroundColor Green

# 构建项目
Write-Host ""
Write-Host "3. 构建项目..." -ForegroundColor Yellow
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ 构建失败" -ForegroundColor Red
    exit 1
}
Write-Host "✅ 构建成功" -ForegroundColor Green

# 检查 Vercel CLI
Write-Host ""
Write-Host "4. 检查 Vercel CLI..." -ForegroundColor Yellow
$vercelInstalled = npm list -g @vercel/cli 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Host "⚠️  Vercel CLI 未安装，正在安装..." -ForegroundColor Yellow
    npm install -g @vercel/cli
}

# 检查登录状态
Write-Host ""
Write-Host "5. 检查 Vercel 登录状态..." -ForegroundColor Yellow
vercel whoami 2>$null | Out-Null
if ($LASTEXITCODE -ne 0) {
    Write-Host "⚠️  未登录 Vercel，正在打开登录页面..." -ForegroundColor Yellow
    Write-Host ""
    Write-Host "=========================================" -ForegroundColor Cyan
    Write-Host "请按照浏览器提示完成登录" -ForegroundColor Cyan
    Write-Host "=========================================" -ForegroundColor Cyan
    vercel login
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ 登录失败" -ForegroundColor Red
        exit 1
    }
}
Write-Host "✅ 已登录 Vercel" -ForegroundColor Green

# 部署到 Vercel
Write-Host ""
Write-Host "6. 部署到 Vercel 生产环境..." -ForegroundColor Yellow
Write-Host ""
vercel --prod

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "=========================================" -ForegroundColor Green
    Write-Host "✅ 部署成功！" -ForegroundColor Green
    Write-Host "=========================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "请访问以下地址验证：" -ForegroundColor Cyan
    Write-Host "  https://www.tumuai.net/" -ForegroundColor White
    Write-Host ""
} else {
    Write-Host ""
    Write-Host "❌ 部署失败，请检查错误信息" -ForegroundColor Red
    exit 1
}

Write-Host "按任意键退出..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
