# 数据库索引创建 - 快速指南

## 方法 1: Supabase Dashboard (推荐 - 最简单)

1. **打开 SQL Editor**
   - 登录 https://supabase.com/dashboard
   - 选择项目: `bixljqdwkjuzftlpmgtb`
   - 点击左侧菜单 **SQL Editor**

2. **复制并执行 SQL**
   - 打开文件: `database/execute_indexes.sql`
   - 复制全部内容
   - 粘贴到 SQL Editor
   - 点击 **Run** 按钮

3. **等待完成**
   - 通常 5-10 秒完成
   - 看到 "Success" 即表示成功

## 方法 2: Supabase CLI

```bash
# 安装 Supabase CLI
npm install -g supabase

# 登录
supabase login

# 链接项目
supabase link --project-ref bixljqdwkjuzftlpmgtb

# 执行 SQL 文件
supabase db execute --file database/execute_indexes.sql
```

## 将创建的内容

### 10 个性能索引
| 索引 | 用途 | 预期提升 |
|-----|------|---------|
| `tools_status_upvotes_idx` | 热度排序 | 50%+ |
| `tools_status_featured_idx` | 精选工具 | 40%+ |
| `tools_status_date_idx` | 最新收录 | 50%+ |
| `tools_status_rating_idx` | 评分排序 | 30%+ |
| `tools_status_views_idx` | 浏览量排序 | 30%+ |
| `user_favorites_user_tool_idx` | 收藏检查 | 80%+ |
| `user_favorites_user_idx` | 用户收藏 | 60%+ |
| `tools_categories_gin_idx` | 分类筛选 | 70%+ |
| `tools_features_gin_idx` | 功能筛选 | 70%+ |
| `tools_status_pricing_idx` | 定价筛选 | 30%+ |

### 2 个 RPC 函数
- `increment_views(tool_id, amount)` - 单个工具浏览量更新
- `increment_views_batch(tool_ids[], amount)` - 批量浏览量更新

## 验证

执行后在 SQL Editor 中运行以下查询验证:

```sql
SELECT indexname, pg_size_pretty(pg_relation_size(indexrelid)) AS size
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
  AND tablename IN ('tools', 'user_favorites')
ORDER BY indexname;
```

## 故障排除

**问题**: 权限不足
**解决**: 确保以项目所有者身份登录 Dashboard

**问题**: 索引已存在
**说明**: SQL 使用 `IF NOT EXISTS`，重复执行是安全的

**问题**: 执行超时
**说明**: 大数据量可能需要更长时间，请耐心等待
