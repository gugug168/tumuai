#!/bin/bash
# TumuAI Vercel 部署脚本
# 使用方法: ./scripts/deploy-vercel.sh

echo "========================================="
echo "  TumuAI Vercel 部署脚本"
echo "========================================="
echo ""

# 检查是否已安装 Vercel CLI
if ! command -v vercel &> /dev/null; then
    echo "❌ Vercel CLI 未安装"
    echo "请运行: npm install -g vercel"
    exit 1
fi

# 检查是否已登录
echo "🔍 检查 Vercel 登录状态..."
if ! vercel whoami &> /dev/null; then
    echo "⚠️  未登录 Vercel"
    echo "请运行: vercel login"
    echo ""
    echo "或者使用 GitHub Actions 自动部署："
    echo "1. 打开 https://github.com/gugug168/tumuai/settings/secrets/actions"
    echo "2. 添加以下 secrets："
    echo "   - VERCEL_TOKEN (从 https://vercel.com/account/tokens 获取)"
    echo "   - VERCEL_ORG_ID: team_6XLfrsqlmELfvJ8OZtnlvMup"
    echo "   - VERCEL_PROJECT_ID: prj_4vyL9kVlVhEwXqDOFznKvzosJqWU"
    echo ""
    exit 1
fi

echo "✅ 已登录 Vercel"
echo ""

# 构建项目
echo "🔨 构建项目..."
npm run build
if [ $? -ne 0 ]; then
    echo "❌ 构建失败"
    exit 1
fi
echo "✅ 构建成功"
echo ""

# 部署到 Vercel
echo "🚀 部署到 Vercel 生产环境..."
vercel --prod

echo ""
echo "✅ 部署完成！"
echo "请访问 https://www.tumuai.net/ 查看更新"
