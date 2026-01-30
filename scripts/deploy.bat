@echo off
REM TumuAI Vercel 部署脚本
REM 请在 PowerShell 或命令提示符中运行此脚本

echo =========================================
echo   TumuAI Vercel 部署脚本
echo =========================================
echo.

REM 检查 Node.js
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo ❌ 未找到 Node.js
    echo 请先安装 Node.js: https://nodejs.org/
    exit /b 1
)

echo ✅ 找到 Node.js
node --version
echo.

REM 检查 Vercel CLI
where vercel >nul 2>nul
if %errorlevel% neq 0 (
    echo ⚠️  未安装 Vercel CLI
    echo 正在安装...
    call npm install -g vercel
)

echo ✅ Vercel CLI 已安装
echo.

REM 检查登录状态
vercel whoami >nul 2>nul
if %errorlevel% neq 0 (
    echo ⚠️  未登录 Vercel
    echo 正在打开登录页面...
    call vercel login
    if %errorlevel% neq 0 (
        echo ❌ 登录失败
        exit /b 1
    )
)

echo ✅ 已登录 Vercel
echo.

REM 构建项目
echo 🔨 构建项目...
call npm run build
if %errorlevel% neq 0 (
    echo ❌ 构建失败
    exit /b 1
)

echo ✅ 构建成功
echo.

REM 部署到 Vercel
echo 🚀 部署到 Vercel 生产环境...
call vercel --prod

if %errorlevel% neq 0 (
    echo ❌ 部署失败
    exit /b 1
)

echo.
echo ✅ 部署完成！
echo 请访问 https://www.tumuai.net/ 查看更新
echo.
pause
