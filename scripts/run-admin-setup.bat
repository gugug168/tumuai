@echo off
echo =====================================
echo 🏗️  Civil AI Hub 管理员账户初始化
echo =====================================
echo.

REM 检查Node.js是否安装
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Node.js 未安装或未添加到PATH
    echo 请安装 Node.js 后重试
    pause
    exit /b 1
)

REM 检查是否在项目根目录
if not exist "package.json" (
    echo ❌ 请在项目根目录运行此脚本
    pause
    exit /b 1
)

REM 检查环境变量文件
if not exist ".env.local" (
    echo ❌ .env.local 文件不存在
    echo 请确保环境变量已正确配置
    pause
    exit /b 1
)

echo ✅ 环境检查通过
echo.

REM 安装必要的依赖（如果需要）
echo 📦 检查依赖包...
npm list @supabase/supabase-js >nul 2>&1
if %errorlevel% neq 0 (
    echo 📦 安装 Supabase 客户端...
    npm install @supabase/supabase-js
)

npm list dotenv >nul 2>&1
if %errorlevel% neq 0 (
    echo 📦 安装 dotenv...
    npm install dotenv
)

echo.
echo 🚀 开始执行管理员初始化...
echo.

REM 运行初始化脚本
node scripts/admin-setup.js

if %errorlevel% equ 0 (
    echo.
    echo 🎉 管理员账户初始化完成!
    echo 您现在可以使用以下凭据登录管理后台:
    echo 📧 邮箱: admin@civilaihub.com
    echo 🔐 密码: admin123
    echo.
    echo 管理后台地址: http://localhost:8888/admin
) else (
    echo.
    echo ❌ 初始化失败，请检查错误信息
)

echo.
pause