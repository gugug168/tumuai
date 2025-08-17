-- 完整修复验证脚本
-- 执行所有修复并验证结果

-- 1. 执行分类系统修复
\i 20250817_fix_categories_and_admin.sql

-- 2. 验证分类表
SELECT '=== 分类系统验证 ===' as section;
SELECT 
    '分类数量: ' || COUNT(*) as result,
    '包含分类: ' || string_agg(name, ', ') as categories
FROM categories;

-- 3. 验证工具审核功能
SELECT '=== 工具审核功能验证 ===' as section;
SELECT 
    '待审核工具: ' || COUNT(*) as pending_tools
FROM tool_submissions WHERE status = 'pending';

-- 4. 验证外键关联
SELECT '=== 外键关联验证 ===' as section;
SELECT 
    '工具分类关联: ' || COUNT(*) as tools_with_category
FROM tools WHERE category_id IS NOT NULL;

-- 5. 验证权限策略
SELECT '=== 权限策略验证 ===' as section;
SELECT 
    schemaname,
    tablename,
    policyname,
    cmd,
    qual
FROM pg_policies 
WHERE tablename IN ('categories', 'tools', 'tool_submissions', 'user_favorites', 'tool_reviews', 'tool_comments')
ORDER BY tablename, policyname;

-- 6. 验证函数存在
SELECT '=== 函数验证 ===' as section;
SELECT 
    'approve_tool_submission函数: ' || CASE WHEN EXISTS (
        SELECT 1 FROM pg_proc WHERE proname = 'approve_tool_submission'
    ) THEN '存在' ELSE '缺失' END as status;

SELECT 
    'manage_category函数: ' || CASE WHEN EXISTS (
        SELECT 1 FROM pg_proc WHERE proname = 'manage_category'
    ) THEN '存在' ELSE '缺失' END as status;

-- 7. 验证触发器
SELECT '=== 触发器验证 ===' as section;
SELECT 
    trigger_name,
    event_object_table,
    action_timing,
    action_statement
FROM information_schema.triggers 
WHERE event_object_table IN ('user_favorites', 'tool_reviews', 'tool_comments')
ORDER BY event_object_table, trigger_name;

-- 8. 测试审核流程
SELECT '=== 测试审核流程 ===' as section;

-- 创建一个测试提交
INSERT INTO tool_submissions (
    submitter_email, tool_name, tagline, description, website_url, 
    categories, features, pricing, category_id, status
) VALUES (
    'test@example.com', 
    '测试工具', 
    '这是一个测试工具', 
    '详细描述', 
    'https://example.com',
    ARRAY['测试'], 
    ARRAY['功能1', '功能2'], 
    'Free',
    (SELECT id FROM categories WHERE name = '效率工具' LIMIT 1),
    'pending'
) RETURNING id as test_submission_id;

-- 9. 最终状态检查
SELECT '=== 最终状态检查 ===' as section;
SELECT 
    '总工具数: ' || (SELECT COUNT(*) FROM tools),
    '总分类数: ' || (SELECT COUNT(*) FROM categories),
    '待审核数: ' || (SELECT COUNT(*) FROM tool_submissions WHERE status = 'pending'),
    '已分类工具: ' || (SELECT COUNT(*) FROM tools WHERE category_id IS NOT NULL);