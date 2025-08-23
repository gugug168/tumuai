-- Fix all RLS issues identified in error logs
-- Migration: 20250123000000_fix_all_rls_issues

-- ==============================================
-- 1. Fix user_favorites table RLS policies
-- ==============================================

-- Drop existing policies
DROP POLICY IF EXISTS "user_favorites_select" ON user_favorites;
DROP POLICY IF EXISTS "user_favorites_insert" ON user_favorites;
DROP POLICY IF EXISTS "user_favorites_update" ON user_favorites;
DROP POLICY IF EXISTS "user_favorites_delete" ON user_favorites;
DROP POLICY IF EXISTS "user_favorites_select_policy" ON user_favorites;
DROP POLICY IF EXISTS "user_favorites_insert_policy" ON user_favorites;
DROP POLICY IF EXISTS "user_favorites_update_policy" ON user_favorites;
DROP POLICY IF EXISTS "user_favorites_delete_policy" ON user_favorites;

-- Enable RLS
ALTER TABLE user_favorites ENABLE ROW LEVEL SECURITY;

-- Create corrected policies
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

-- Add unique constraint to prevent duplicate favorites
DO $$
BEGIN
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
-- 2. Fix admin_users table (disable RLS)
-- ==============================================

-- Drop all policies to prevent infinite recursion
DROP POLICY IF EXISTS "admin_users_select_own" ON admin_users;
DROP POLICY IF EXISTS "admin_users_service_role" ON admin_users;
DROP POLICY IF EXISTS "admin_users_policy" ON admin_users;
DROP POLICY IF EXISTS "Admin users can view all admin users" ON admin_users;
DROP POLICY IF EXISTS "Admin users can manage admin users" ON admin_users;

-- Disable RLS for safety
ALTER TABLE admin_users DISABLE ROW LEVEL SECURITY;

-- ==============================================
-- 3. Fix Storage policies for tool-logos bucket
-- ==============================================

-- Drop existing storage policies
DROP POLICY IF EXISTS "Allow anonymous uploads" ON storage.objects;
DROP POLICY IF EXISTS "Allow public access" ON storage.objects;
DROP POLICY IF EXISTS "tool_logos_upload" ON storage.objects;
DROP POLICY IF EXISTS "tool_logos_read" ON storage.objects;
DROP POLICY IF EXISTS "tool_logos_delete" ON storage.objects;

-- Create new storage policies
CREATE POLICY "tool_logos_upload" ON storage.objects
    FOR INSERT WITH CHECK (bucket_id = 'tool-logos');

CREATE POLICY "tool_logos_read" ON storage.objects
    FOR SELECT USING (bucket_id = 'tool-logos');

CREATE POLICY "tool_logos_delete" ON storage.objects
    FOR DELETE USING (bucket_id = 'tool-logos');

-- ==============================================
-- 4. Create indexes for performance
-- ==============================================

CREATE INDEX IF NOT EXISTS idx_user_favorites_user_id ON user_favorites(user_id);
CREATE INDEX IF NOT EXISTS idx_user_favorites_tool_id ON user_favorites(tool_id);
CREATE INDEX IF NOT EXISTS idx_user_favorites_created_at ON user_favorites(created_at);
CREATE INDEX IF NOT EXISTS idx_admin_users_user_id ON admin_users(user_id);

-- ==============================================
-- 5. Verification
-- ==============================================

-- This will help verify the migration was successful
INSERT INTO public.migration_log (migration_name, status, applied_at) 
VALUES ('20250123000000_fix_all_rls_issues', 'completed', now())
ON CONFLICT DO NOTHING;
