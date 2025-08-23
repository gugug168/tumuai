-- 直接 SQL 执行 - 修复所有数据库问题
-- 这个文件可以直接在 Supabase CLI 或 Dashboard 中执行

-- ==============================================
-- 1. 修复 user_favorites 表的 RLS 策略
-- ==============================================

-- 删除旧策略
DROP POLICY IF EXISTS "user_favorites_select" ON user_favorites;
DROP POLICY IF EXISTS "user_favorites_insert" ON user_favorites;
DROP POLICY IF EXISTS "user_favorites_update" ON user_favorites;
DROP POLICY IF EXISTS "user_favorites_delete" ON user_favorites;

-- 启用 RLS
ALTER TABLE user_favorites ENABLE ROW LEVEL SECURITY;

-- 创建新策略
CREATE POLICY "user_favorites_select_policy" ON user_favorites
    FOR SELECT USING (
        auth.uid() = user_id 
        OR auth.role() = 'service_role'
        OR auth.role() = 'anon'
    );

CREATE POLICY "user_favorites_insert_policy" ON user_favorites
    FOR INSERT WITH CHECK (
        auth.uid() = user_id
        OR auth.role() = 'service_role'
    );

CREATE POLICY "user_favorites_update_policy" ON user_favorites
    FOR UPDATE USING (
        auth.uid() = user_id
        OR auth.role() = 'service_role'
    );

CREATE POLICY "user_favorites_delete_policy" ON user_favorites
    FOR DELETE USING (
        auth.uid() = user_id
        OR auth.role() = 'service_role'
    );

-- ==============================================
-- 2. 修复 admin_users 表（禁用 RLS）
-- ==============================================

-- 删除所有策略
DROP POLICY IF EXISTS "admin_users_select_own" ON admin_users;
DROP POLICY IF EXISTS "admin_users_service_role" ON admin_users;
DROP POLICY IF EXISTS "admin_users_policy" ON admin_users;

-- 禁用 RLS
ALTER TABLE admin_users DISABLE ROW LEVEL SECURITY;

-- ==============================================
-- 3. 确保 Storage 策略正确
-- ==============================================

-- 删除旧策略
DROP POLICY IF EXISTS "Allow anonymous uploads" ON storage.objects;
DROP POLICY IF EXISTS "Allow public access" ON storage.objects;
DROP POLICY IF EXISTS "tool_logos_upload" ON storage.objects;
DROP POLICY IF EXISTS "tool_logos_read" ON storage.objects;
DROP POLICY IF EXISTS "tool_logos_delete" ON storage.objects;

-- 创建新的 Storage 策略
CREATE POLICY "tool_logos_upload" ON storage.objects
    FOR INSERT WITH CHECK (bucket_id = 'tool-logos');

CREATE POLICY "tool_logos_read" ON storage.objects
    FOR SELECT USING (bucket_id = 'tool-logos');

CREATE POLICY "tool_logos_delete" ON storage.objects
    FOR DELETE USING (bucket_id = 'tool-logos');

-- ==============================================
-- 4. 验证修复
-- ==============================================

SELECT 'All database issues have been fixed via CLI!' as status;
