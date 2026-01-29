# 数据库索引自动执行脚本

自动化创建数据库性能索引，无需手动操作 Supabase Dashboard。

## 快速开始

### 方法 1: 使用项目现有配置（推荐）

项目已配置好数据库连接，直接运行：

```bash
# 首次运行需要安装 pg 包
npm install --save-dev pg

# 执行索引创建
npm run db:indexes
```

### 方法 2: 使用环境变量

如果方法1失败，可以手动设置环境变量：

```bash
# Windows (PowerShell)
$env:SUPABASE_URL="https://bixljqdwkjuzftlpmgtb.supabase.co"
$env:SUPABASE_SERVICE_ROLE_KEY="your_service_role_key"
node database/scripts/execute-indexes.js

# Windows (CMD)
set SUPABASE_URL=https://bixljqdwkjuzftlpmgtb.supabase.co
set SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
node database/scripts/execute-indexes.js

# Linux/Mac
SUPABASE_URL=https://bixljqdwkjuzftlpmgtb.supabase.co \
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key \
node database/scripts/execute-indexes.js
```

### 方法 3: 使用完整数据库连接字符串

```bash
# 使用 DATABASE_URL
export DATABASE_URL="postgres://postgres:PASSWORD@db.PROJECT_REF.supabase.co:5432/postgres"
node database/scripts/execute-indexes.js
```

## 执行内容

脚本会自动创建以下内容：

### 性能索引（10个）

| 索引名称 | 用途 | 预期提升 |
|---------|------|----------|
| `tools_status_upvotes_idx` | 热度排序查询 | 50%+ |
| `tools_status_featured_idx` | 精选工具查询 | 40%+ |
| `tools_status_date_idx` | 最新收录排序 | 50%+ |
| `tools_status_rating_idx` | 评分排序 | 30%+ |
| `tools_status_views_idx` | 浏览量排序 | 30%+ |
| `user_favorites_user_tool_idx` | 收藏状态检查 | 80%+ |
| `user_favorites_user_idx` | 用户收藏列表 | 60%+ |
| `tools_categories_gin_idx` | 分类筛选 | 70%+ |
| `tools_features_gin_idx` | 功能筛选 | 70%+ |
| `tools_status_pricing_idx` | 定价筛选 | 30%+ |

### RPC 函数（2个）

| 函数名称 | 用途 |
|---------|------|
| `increment_views` | 单个工具浏览量原子更新 |
| `increment_views_batch` | 批量工具浏览量更新 |

## 执行输出示例

```
============================================================
Civil AI Hub - 数据库索引自动执行脚本
============================================================

✅ 数据库连接已获取
ℹ️  连接地址: postgres://postgres:****@db.xxx.supabase.co:5432/postgres

ℹ️  正在连接数据库...
✅ 数据库连接成功!

ℹ️  检查表结构...
ℹ️  找到表: tools, user_favorites

开始创建索引...

  [1/10] 创建 tools_status_upvotes_idx... ✅ 完成 (145ms)
  [2/10] 创建 tools_status_featured_idx... ✅ 完成 (89ms)
  ...

创建 RPC 函数...

  [1/2] 创建 increment_views... ✅ 完成 (67ms)
  [2/2] 创建 increment_views_batch... ✅ 完成 (82ms)

更新表统计信息...
✅ 统计信息更新完成

验证创建的索引...

索引列表:
─────────────────────────────────────────────────────────────
  • tools_status_upvotes_idx
    大小: 32 kB | 扫描: 0
  • tools_categories_gin_idx
    大小: 48 kB | 扫描: 0
  ...

RPC 函数列表:
─────────────────────────────────────────────────────────────
  • increment_views(tool_id uuid, amount integer)
  • increment_views_batch(tool_ids uuid[], amount integer)
  ...

============================================================
✅ 执行完成! 10/10 个索引创建成功
============================================================
```

## 故障排除

### 错误: "Cannot find module 'pg'"

```bash
npm install --save-dev pg
```

### 错误: "connection refused" 或 "ECONNREFUSED"

检查网络连接，确认 Supabase 项目可访问。

### 错误: "permission denied" 或 "role does not exist"

确保使用 `SUPABASE_SERVICE_ROLE_KEY` 而不是 `ANON_KEY`。

### 错误: "relation does not exist"

确认数据库中存在 `tools` 和 `user_favorites` 表。

## 验证索引

执行后可以在 Supabase Dashboard 验证：

1. 登录 [Supabase Dashboard](https://supabase.com/dashboard)
2. 选择项目 → Database → Indices
3. 查看创建的索引列表

## 删除索引

如需删除所有索引：

```sql
DROP INDEX IF EXISTS tools_status_upvotes_idx;
DROP INDEX IF EXISTS tools_status_featured_idx;
DROP INDEX IF EXISTS tools_status_date_idx;
DROP INDEX IF EXISTS tools_status_rating_idx;
DROP INDEX IF EXISTS tools_status_views_idx;
DROP INDEX IF EXISTS user_favorites_user_tool_idx;
DROP INDEX IF EXISTS user_favorites_user_idx;
DROP INDEX IF EXISTS tools_categories_gin_idx;
DROP INDEX IF EXISTS tools_features_gin_idx;
DROP INDEX IF EXISTS tools_status_pricing_idx;
```

## 安全提示

- 此脚本会创建数据库索引，建议在低峰期执行
- SERVICE_ROLE_KEY 具有最高权限，请妥善保管
- 脚本使用 `IF NOT EXISTS`，重复执行是安全的
