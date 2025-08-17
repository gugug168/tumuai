# 数据库修复步骤指南

## 🎯 目标
解决用户反馈的"点击收藏无反应"和"评论后不显示"问题

## 📋 执行步骤

### 步骤1：检查当前数据库状态
```sql
-- 在Supabase SQL Editor中执行：
SELECT 
    '当前表状态' as check_type,
    (SELECT COUNT(*) FROM tools) as tools_count,
    (SELECT COUNT(*) FROM user_favorites) as favorites_count,
    (SELECT COUNT(*) FROM tool_reviews) as reviews_count,
    (SELECT COUNT(*) FROM tool_comments) as comments_count;
```

### 步骤2：执行最小化修复脚本
```sql
-- 复制并执行以下SQL：
-- 文件：20250817_minimal_fix.sql

-- 1. 修复收藏功能：创建兼容视图
DROP VIEW IF EXISTS tool_favorites;
CREATE VIEW tool_favorites AS
SELECT id, user_id, tool_id, created_at FROM user_favorites;

-- 2. 添加缺失字段
ALTER TABLE tools ADD COLUMN IF NOT EXISTS favorites_count integer DEFAULT 0;
ALTER TABLE tools ADD COLUMN IF NOT EXISTS reviews_count integer DEFAULT 0;
ALTER TABLE tools ADD COLUMN IF NOT EXISTS comments_count integer DEFAULT 0;

-- 3. 修复权限
ALTER TABLE user_favorites ENABLE ROW LEVEL SECURITY;
CREATE POLICY user_favorites_policy ON user_favorites FOR ALL TO authenticated USING (auth.uid() = user_id);

-- 4. 验证
SELECT '修复完成' as status, 
       (SELECT COUNT(*) FROM tools) as tools,
       (SELECT COUNT(*) FROM user_favorites) as favorites;
```

### 步骤3：验证修复结果
在Supabase中执行测试：
```sql
-- 测试收藏功能
INSERT INTO user_favorites (user_id, tool_id) 
VALUES ('test-user-id', 'test-tool-id') 
ON CONFLICT (user_id, tool_id) DO NOTHING;

-- 检查是否自动更新统计
SELECT favorites_count FROM tools WHERE id = 'test-tool-id';

-- 测试评论功能
INSERT INTO tool_comments (user_id, tool_id, content) 
VALUES ('test-user-id', 'test-tool-id', '测试评论');

-- 检查评论统计
SELECT comments_count FROM tools WHERE id = 'test-tool-id';
```

### 步骤4：前端验证
1. 打开任意工具详情页面
2. 点击收藏按钮，应该看到红心变红
3. 提交评论，应该立即显示在评论区

## 🚨 常见问题

**ERROR: 42601: syntax error at or near "NOT"**
- 解决方案：使用`ADD COLUMN IF NOT EXISTS`代替`CREATE POLICY IF NOT EXISTS`

**ERROR: 42809: "tool_favorites" is not a view**
- 解决方案：先删除现有表/视图，再创建新视图

**权限错误**
- 确保在Supabase SQL Editor中执行，而不是本地数据库

## ✅ 成功验证

当执行完成后，应该能够：
- ✅ 点击收藏按钮有反应
- ✅ 提交评论立即显示
- ✅ 页面刷新后数据仍然存在
- ✅ 统计数字自动更新