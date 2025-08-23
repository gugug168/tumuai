-- 修复 user_favorites 表的 RLS 策略
-- 解决 406 错误和插入权限问题

-- ==============================================
-- 1. 删除可能有问题的现有策略
-- ==============================================

DROP POLICY IF EXISTS "user_favorites_select" ON user_favorites;
DROP POLICY IF EXISTS "user_favorites_insert" ON user_favorites;
DROP POLICY IF EXISTS "user_favorites_update" ON user_favorites;
DROP POLICY IF EXISTS "user_favorites_delete" ON user_favorites;

-- ==============================================
-- 2. 确保表启用了 RLS
-- ==============================================

ALTER TABLE user_favorites ENABLE ROW LEVEL SECURITY;

-- ==============================================
-- 3. 创建新的 RLS 策略
-- ==============================================

-- 查询策略：用户可以查看所有收藏（用于统计）或查看自己的收藏
CREATE POLICY "user_favorites_select_policy" ON user_favorites
    FOR SELECT USING (
        -- 允许查看自己的收藏
        auth.uid() = user_id 
        OR 
        -- 允许服务端角色访问
        auth.role() = 'service_role'
        OR
        -- 允许匿名用户查看（用于公开统计）
        auth.role() = 'anon'
    );

-- 插入策略：用户只能为自己添加收藏
CREATE POLICY "user_favorites_insert_policy" ON user_favorites
    FOR INSERT WITH CHECK (
        -- 用户只能为自己添加收藏
        auth.uid() = user_id
        OR
        -- 允许服务端角色插入
        auth.role() = 'service_role'
    );

-- 更新策略：用户只能更新自己的收藏
CREATE POLICY "user_favorites_update_policy" ON user_favorites
    FOR UPDATE USING (
        auth.uid() = user_id
        OR
        auth.role() = 'service_role'
    );

-- 删除策略：用户只能删除自己的收藏
CREATE POLICY "user_favorites_delete_policy" ON user_favorites
    FOR DELETE USING (
        auth.uid() = user_id
        OR
        auth.role() = 'service_role'
    );

-- ==============================================
-- 4. 确保表结构正确
-- ==============================================

-- 检查表是否有必要的列和约束
DO $$
BEGIN
    -- 确保有唯一约束防止重复收藏
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'user_favorites_unique_user_tool'
    ) THEN
        ALTER TABLE user_favorites 
        ADD CONSTRAINT user_favorites_unique_user_tool 
        UNIQUE (user_id, tool_id);
    END IF;
END $$;

-- ==============================================
-- 5. 创建索引提升性能
-- ==============================================

CREATE INDEX IF NOT EXISTS idx_user_favorites_user_id ON user_favorites(user_id);
CREATE INDEX IF NOT EXISTS idx_user_favorites_tool_id ON user_favorites(tool_id);
CREATE INDEX IF NOT EXISTS idx_user_favorites_created_at ON user_favorites(created_at);

-- ==============================================
-- 6. 验证策略创建
-- ==============================================

SELECT 'User favorites RLS policies created successfully!' as status;

-- 显示当前策略
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE tablename = 'user_favorites'
ORDER BY policyname;
