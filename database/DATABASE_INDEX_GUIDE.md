# 数据库索引优化指南

## 执行方法

### 方法 1: Supabase Dashboard (推荐 - 最简单)

1. 登录 [Supabase Dashboard](https://supabase.com/dashboard)
2. 选择你的项目
3. 点击左侧菜单的 **SQL Editor**
4. 复制下面 SQL 语句到编辑器中：
   ```sql
   -- 一次性执行所有索引创建
   CREATE INDEX IF NOT EXISTS tools_status_upvotes_idx ON tools(status, upvotes DESC);
   CREATE INDEX IF NOT EXISTS tools_status_featured_idx ON tools(status, featured) WHERE featured = true;
   CREATE INDEX IF NOT EXISTS tools_status_date_idx ON tools(status, date_added DESC);
   CREATE INDEX IF NOT EXISTS tools_status_rating_idx ON tools(status, rating DESC NULLS LAST);
   CREATE INDEX IF NOT EXISTS tools_status_views_idx ON tools(status, views DESC);
   CREATE INDEX IF NOT EXISTS user_favorites_user_tool_idx ON user_favorites(user_id, tool_id);
   CREATE INDEX IF NOT EXISTS user_favorites_user_idx ON user_favorites(user_id);
   CREATE INDEX IF NOT EXISTS tools_categories_gin_idx ON tools USING GIN (categories);
   CREATE INDEX IF NOT EXISTS tools_features_gin_idx ON tools USING GIN (features);
   CREATE INDEX IF NOT EXISTS tools_status_pricing_idx ON tools(status, pricing);
   ```
5. 点击 **Run** 按钮执行
6. 等待执行完成（通常几秒钟）

### 方法 2: Supabase CLI (适合自动化)

```bash
# 安装 Supabase CLI (如果还没有)
npm install -g supabase

# 登录
supabase login

# 链接到项目
supabase link --project-ref YOUR_PROJECT_REF

# 执行 SQL 文件
supabase db execute --file database/optimizations/add-performance-indexes.sql
```

### 方法 3: psql 命令行 (高级用户)

```bash
psql -h db.YOUR_PROJECT_REF.supabase.co -U postgres -d postgres < database/optimizations/add-performance-indexes.sql
```

### 方法 4: 通过 API (编程方式)

可以使用 Supabase REST API 来执行 SQL：

```typescript
const executeSQL = async (sql: string) => {
  const response = await fetch(
    `https://YOUR_PROJECT_REF.supabase.co/rest/v1/rpc/execute_sql`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': 'YOUR_SERVICE_ROLE_KEY'
      },
      body: JSON.stringify({ query: sql })
    }
  );
  return response.json();
};
```

---

## 索引说明

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

---

## 验证索引是否创建成功

在 Supabase Dashboard 的 SQL Editor 中执行：

```sql
-- 查看已创建的索引
SELECT
  schemaname,
  tablename,
  indexname,
  pg_size_pretty(pg_relation_size(indexname::text)) AS index_size
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename IN ('tools', 'user_favorites')
ORDER BY indexname;
```

---

## 查看索引效果

执行以下查询来验证索引是否被使用：

```sql
-- 查看索引使用统计
SELECT
  schemaname,
  tablename,
  indexname,
  idx_scan AS index_scans,
  idx_tup_read AS tuples_read,
  idx_tup_fetch AS tuples_fetched
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
  AND tablename IN ('tools', 'user_favorites')
ORDER BY idx_scan DESC;
```

---

## 注意事项

1. **创建索引需要时间**：对于大表，创建索引可能需要几分钟
2. **写入锁**：创建索引期间可能会有写入锁，建议在低峰期执行
3. **索引占用空间**：索引会占用额外的存储空间
4. **性能影响**：虽然索引提升查询速度，但会稍微降低写入速度

---

## 如需删除索引

如果某个索引效果不理想，可以删除：

```sql
DROP INDEX IF EXISTS tools_status_upvotes_idx;
DROP INDEX IF EXISTS tools_status_featured_idx;
-- ... 其他索引
```
