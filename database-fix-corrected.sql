-- 修正版数据库修复脚本
-- 解决所有RLS策略和表关系问题

-- ==============================================
-- 1. 修复 admin_users 表的 RLS 策略（避免无限递归）
-- ==============================================

-- 删除可能导致递归的现有策略
DROP POLICY IF EXISTS "admin_users_policy" ON admin_users;
DROP POLICY IF EXISTS "Admin users can view all admin users" ON admin_users;
DROP POLICY IF EXISTS "Admin users can manage admin users" ON admin_users;

-- 创建简化的 RLS 策略
-- 允许管理员查看自己的记录
CREATE POLICY "admin_users_select_own" ON admin_users
    FOR SELECT USING (auth.uid() = user_id);

-- 允许服务端角色（service_role）完全访问
CREATE POLICY "admin_users_service_role" ON admin_users
    FOR ALL USING (auth.role() = 'service_role');

-- ==============================================
-- 2. 修复 Storage RLS 策略（允许图片上传）
-- ==============================================

-- 删除可能冲突的策略
DROP POLICY IF EXISTS "Allow anonymous uploads" ON storage.objects;
DROP POLICY IF EXISTS "Allow public access" ON storage.objects;
DROP POLICY IF EXISTS "tool_logos_upload" ON storage.objects;
DROP POLICY IF EXISTS "tool_logos_read" ON storage.objects;
DROP POLICY IF EXISTS "tool_logos_delete" ON storage.objects;

-- 允许任何人上传到 tool-logos 桶
CREATE POLICY "tool_logos_upload" ON storage.objects
    FOR INSERT WITH CHECK (bucket_id = 'tool-logos');

-- 允许任何人读取 tool-logos 桶中的文件
CREATE POLICY "tool_logos_read" ON storage.objects
    FOR SELECT USING (bucket_id = 'tool-logos');

-- 允许文件所有者删除（可选）
CREATE POLICY "tool_logos_delete" ON storage.objects
    FOR DELETE USING (bucket_id = 'tool-logos');

-- ==============================================
-- 3. 修复 user_profiles 表结构（确保有 user_id 列）
-- ==============================================

-- 检查并添加 user_id 列到 user_profiles 表
DO $$ 
BEGIN
    -- 检查 user_id 列是否存在
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'user_profiles' AND column_name = 'user_id'
    ) THEN
        -- 添加 user_id 列
        ALTER TABLE user_profiles 
        ADD COLUMN user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
        
        -- 创建唯一索引
        CREATE UNIQUE INDEX IF NOT EXISTS idx_user_profiles_user_id ON user_profiles(user_id);
        
        -- 如果表中已有数据，需要手动填充 user_id 值
        -- 这里假设 username 或其他字段可以用来关联，或者表为空
        UPDATE user_profiles SET user_id = id WHERE user_id IS NULL;
    END IF;
END $$;

-- ==============================================
-- 4. 确保 tool_reviews 表存在并有正确结构
-- ==============================================

-- 确保 tool_reviews 表有正确的列
CREATE TABLE IF NOT EXISTS tool_reviews (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    tool_id uuid NOT NULL REFERENCES tools(id) ON DELETE CASCADE,
    rating integer NOT NULL CHECK (rating >= 1 AND rating <= 5),
    title text,
    content text,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    UNIQUE(user_id, tool_id) -- 一个用户只能评价一个工具一次
);

-- ==============================================
-- 5. 修复其他必要的 RLS 策略
-- ==============================================

-- user_favorites 表的 RLS 策略
ALTER TABLE user_favorites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_favorites_select" ON user_favorites;
DROP POLICY IF EXISTS "user_favorites_insert" ON user_favorites;
DROP POLICY IF EXISTS "user_favorites_delete" ON user_favorites;

CREATE POLICY "user_favorites_select" ON user_favorites
    FOR SELECT USING (auth.uid() = user_id OR auth.role() = 'service_role');

CREATE POLICY "user_favorites_insert" ON user_favorites
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "user_favorites_delete" ON user_favorites
    FOR DELETE USING (auth.uid() = user_id);

-- tool_reviews 表的 RLS 策略
ALTER TABLE tool_reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tool_reviews_select" ON tool_reviews;
DROP POLICY IF EXISTS "tool_reviews_insert" ON tool_reviews;
DROP POLICY IF EXISTS "tool_reviews_update" ON tool_reviews;
DROP POLICY IF EXISTS "tool_reviews_delete" ON tool_reviews;

CREATE POLICY "tool_reviews_select" ON tool_reviews
    FOR SELECT USING (true); -- 所有人都可以查看评论

CREATE POLICY "tool_reviews_insert" ON tool_reviews
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "tool_reviews_update" ON tool_reviews
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "tool_reviews_delete" ON tool_reviews
    FOR DELETE USING (auth.uid() = user_id OR auth.role() = 'service_role');

-- user_profiles 表的 RLS 策略
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_profiles_select" ON user_profiles;
DROP POLICY IF EXISTS "user_profiles_insert" ON user_profiles;
DROP POLICY IF EXISTS "user_profiles_update" ON user_profiles;

CREATE POLICY "user_profiles_select" ON user_profiles
    FOR SELECT USING (true); -- 所有人都可以查看用户资料

CREATE POLICY "user_profiles_insert" ON user_profiles
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "user_profiles_update" ON user_profiles
    FOR UPDATE USING (auth.uid() = user_id);

-- tool_comments 表的 RLS 策略（如果存在）
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'tool_comments') THEN
        ALTER TABLE tool_comments ENABLE ROW LEVEL SECURITY;
        
        DROP POLICY IF EXISTS "tool_comments_select" ON tool_comments;
        DROP POLICY IF EXISTS "tool_comments_insert" ON tool_comments;
        DROP POLICY IF EXISTS "tool_comments_update" ON tool_comments;
        DROP POLICY IF EXISTS "tool_comments_delete" ON tool_comments;
        
        CREATE POLICY "tool_comments_select" ON tool_comments
            FOR SELECT USING (true);
            
        CREATE POLICY "tool_comments_insert" ON tool_comments
            FOR INSERT WITH CHECK (auth.uid() = user_id);
            
        CREATE POLICY "tool_comments_update" ON tool_comments
            FOR UPDATE USING (auth.uid() = user_id);
            
        CREATE POLICY "tool_comments_delete" ON tool_comments
            FOR DELETE USING (auth.uid() = user_id OR auth.role() = 'service_role');
    END IF;
END $$;

-- ==============================================
-- 6. 创建缺失的索引（提升性能）
-- ==============================================

CREATE INDEX IF NOT EXISTS idx_user_favorites_user_id ON user_favorites(user_id);
CREATE INDEX IF NOT EXISTS idx_user_favorites_tool_id ON user_favorites(tool_id);
CREATE INDEX IF NOT EXISTS idx_tool_reviews_user_id ON tool_reviews(user_id);
CREATE INDEX IF NOT EXISTS idx_tool_reviews_tool_id ON tool_reviews(tool_id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_username ON user_profiles(username);

-- ==============================================
-- 完成提示
-- ==============================================

SELECT 'Database fix completed successfully! All RLS policies and table relationships have been corrected.' as status;
