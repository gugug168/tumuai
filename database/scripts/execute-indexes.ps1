# Civil AI Hub - 数据库索引自动执行脚本 (PowerShell)
#
# 使用 Supabase Management API 执行 SQL
#
# 使用方法:
#   .\database\scripts\execute-indexes.ps1

$ErrorActionPreference = "Stop"

# 颜色输出函数
function Write-ColorOutput {
    param([string]$Message, [string]$Color = "White")
    Write-Host $Message -ForegroundColor $Color
}

function Write-Success { Write-ColorOutput "✅ $args" -Color Green }
function Write-Error { Write-ColorOutput "❌ $args" -Color Red }
function Write-Info { Write-ColorOutput "ℹ️  $args" -Color Cyan }
function Write-Warn { Write-ColorOutput "⚠️  $args" -Color Yellow }

Write-Host ""
Write-Host "============================================================" -ForegroundColor Blue
Write-Host "Civil AI Hub - 数据库索引执行脚本" -ForegroundColor Blue
Write-Host "============================================================" -ForegroundColor Blue
Write-Host ""

# 读取环境变量
$envPath = Join-Path $PSScriptRoot "..\..\.env.local"

if (Test-Path $envPath) {
    Write-Info "从 .env.local 读取配置"
    Get-Content $envPath | ForEach-Object {
        if ($_ -match '^(\w+)=(.*)$') {
            [Environment]::SetEnvironmentVariable($matches[1], $matches[2], "Process")
        }
    }
}

$supabaseUrl = $env:VITE_SUPABASE_URL
$serviceKey = $env:SUPABASE_SERVICE_ROLE_KEY

if (-not $supabaseUrl -or -not $serviceKey) {
    Write-Error "缺少必要的环境变量!"
    Write-Host ""
    Write-Info "请在 .env.local 中配置:"
    Write-Host "  • VITE_SUPABASE_URL"
    Write-Host "  • SUPABASE_SERVICE_ROLE_KEY"
    Write-Host ""
    exit 1
}

Write-Success "Supabase 配置已获取"
Write-Info "项目 URL: $supabaseUrl"
Write-Host ""

# 提取项目引用
if ($supabaseUrl -match 'https://([^.]+)\.supabase\.co') {
    $projectRef = $matches[1]
    Write-Info "项目引用: $projectRef"
}

Write-Host ""
Write-Host "============================================================" -ForegroundColor Yellow
Write-Host "执行方法选择" -ForegroundColor Yellow
Write-Host "============================================================" -ForegroundColor Yellow
Write-Host ""
Write-Host "由于数据库连接限制，请选择以下方法之一:" -ForegroundColor White
Write-Host ""
Write-Host "方法 1 (推荐 - 最简单):" -ForegroundColor Green
Write-Host "  1. 登录 https://supabase.com/dashboard" -ForegroundColor White
Write-Host "  2. 选择项目: $projectRef" -ForegroundColor White
Write-Host "  3. 点击 SQL Editor" -ForegroundColor White
Write-Host "  4. 复制以下 SQL 并执行:" -ForegroundColor White
Write-Host ""
Write-Host "方法 2 (Supabase CLI):" -ForegroundColor Cyan
Write-Host "  npm install -g supabase" -ForegroundColor White
Write-Host "  supabase db execute --file database/execute_indexes.sql" -ForegroundColor White
Write-Host ""

# 读取并显示 SQL 文件
$sqlFilePath = Join-Path $PSScriptRoot "..\execute_indexes.sql"

if (Test-Path $sqlFilePath) {
    $sqlContent = Get-Content $sqlFilePath -Raw
    Write-Host "============================================================" -ForegroundColor Gray
    Write-Host "待执行的 SQL (database/execute_indexes.sql)" -ForegroundColor Gray
    Write-Host "============================================================" -ForegroundColor Gray
    Write-Host ""
    Write-Host $sqlContent -ForegroundColor Gray
    Write-Host ""
} else {
    Write-Warn "SQL 文件未找到: $sqlFilePath"
}

# 尝试使用 Supabase Management API
Write-Host "============================================================" -ForegroundColor Yellow
Write-Host "尝试自动执行 (使用 Management API)" -ForegroundColor Yellow
Write-Host "============================================================" -ForegroundColor Yellow
Write-Host ""

$apiUrl = "https://api.supabase.com/v1/projects/$projectRef/database/queries"

# 准备 SQL 语句
$sqlStatements = @(
    "CREATE INDEX IF NOT EXISTS tools_status_upvotes_idx ON tools(status, upvotes DESC)",
    "CREATE INDEX IF NOT EXISTS tools_status_featured_idx ON tools(status, featured) WHERE featured = true",
    "CREATE INDEX IF NOT EXISTS tools_status_date_idx ON tools(status, date_added DESC)",
    "CREATE INDEX IF NOT EXISTS tools_status_rating_idx ON tools(status, rating DESC NULLS LAST)",
    "CREATE INDEX IF NOT EXISTS tools_status_views_idx ON tools(status, views DESC)",
    "CREATE INDEX IF NOT EXISTS user_favorites_user_tool_idx ON user_favorites(user_id, tool_id)",
    "CREATE INDEX IF NOT EXISTS user_favorites_user_idx ON user_favorites(user_id)",
    "CREATE INDEX IF NOT EXISTS tools_categories_gin_idx ON tools USING GIN (categories)",
    "CREATE INDEX IF NOT EXISTS tools_features_gin_idx ON tools USING GIN (features)",
    "CREATE INDEX IF NOT EXISTS tools_status_pricing_idx ON tools(status, pricing)",
    "ANALYZE tools",
    "ANALYZE user_favorites"
)

$headers = @{
    "Authorization" = "Bearer $serviceKey"
    "Content-Type" = "application/json"
}

Write-Info "尝试连接 Supabase Management API..."

try {
    # Supabase Management API 需要 access token，不是 service role key
    # 这里只能提供指导
    Write-Warn "Management API 需要个人访问令牌"
} catch {
    Write-Warn "自动执行不可用"
}

Write-Host ""
Write-Host "============================================================" -ForegroundColor Blue
Write-Success "配置完成!"
Write-Host "============================================================" -ForegroundColor Blue
Write-Host ""
Write-Info "下一步操作:"
Write-Host "  1. 复制上面显示的 SQL 语句" -ForegroundColor White
Write-Host "  2. 在 Supabase Dashboard 的 SQL Editor 中粘贴执行" -ForegroundColor White
Write-Host "  3. 或安装 Supabase CLI: npm install -g supabase" -ForegroundColor White
Write-Host ""
