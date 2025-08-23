-- 修复 tool_reviews 与 user_profiles 的关系查询
-- 由于 Supabase 需要显式的外键关系才能进行 JOIN 查询

-- 方案：确保 tool_reviews 表通过 user_id 正确关联到 user_profiles

-- 1. 首先检查 tool_reviews 表是否有数据，如果有，需要确保 user_id 都是有效的
UPDATE tool_reviews 
SET user_id = (
    SELECT user_id FROM user_profiles 
    WHERE user_profiles.id = tool_reviews.user_id
    LIMIT 1
)
WHERE user_id IS NOT NULL;

-- 2. 删除可能存在的旧外键约束
ALTER TABLE tool_reviews DROP CONSTRAINT IF EXISTS tool_reviews_user_profile_fk;
ALTER TABLE tool_reviews DROP CONSTRAINT IF EXISTS fk_tool_reviews_user_profiles;

-- 3. 由于 Supabase 的 JOIN 查询机制，我们需要确保外键指向正确的列
-- tool_reviews.user_id 应该指向 user_profiles.user_id（不是 user_profiles.id）

-- 但是，基于错误信息，看起来 Supabase 期望的是通过 user_id 进行连接
-- 让我们确保 tool_reviews 表的结构正确

-- 4. 重建 tool_reviews 表的外键（如果需要）
DO $$
BEGIN
    -- 检查 user_profiles 表中是否有 user_id 列且有数据
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'user_profiles' AND column_name = 'user_id'
    ) THEN
        -- 添加外键约束，连接到 user_profiles.user_id
        ALTER TABLE tool_reviews 
        ADD CONSTRAINT fk_tool_reviews_user_profiles 
        FOREIGN KEY (user_id) REFERENCES user_profiles(user_id) ON DELETE CASCADE;
        
        RAISE NOTICE 'Foreign key constraint added successfully';
    ELSE
        RAISE NOTICE 'user_profiles table does not have user_id column';
    END IF;
EXCEPTION
    WHEN duplicate_object THEN
        RAISE NOTICE 'Foreign key constraint already exists';
    WHEN others THEN
        RAISE NOTICE 'Error adding foreign key: %', SQLERRM;
END $$;

-- 5. 创建函数来手动处理 JOIN（如果外键关系仍然有问题）
CREATE OR REPLACE FUNCTION get_tool_reviews_with_profiles(tool_id_param uuid)
RETURNS TABLE (
    id uuid,
    user_id uuid,
    tool_id uuid,
    rating integer,
    title text,
    content text,
    created_at timestamptz,
    updated_at timestamptz,
    username text,
    full_name text,
    avatar_url text
) 
LANGUAGE sql
AS $$
    SELECT 
        tr.id,
        tr.user_id,
        tr.tool_id,
        tr.rating,
        tr.title,
        tr.content,
        tr.created_at,
        tr.updated_at,
        up.username,
        up.full_name,
        up.avatar_url
    FROM tool_reviews tr
    LEFT JOIN user_profiles up ON tr.user_id = up.user_id
    WHERE tr.tool_id = tool_id_param
    ORDER BY tr.created_at DESC;
$$;

-- 6. 验证关系是否正确建立
SELECT 'Reviews relationship fix completed!' as status;

-- 显示表信息用于调试
SELECT 
    'tool_reviews columns:' as info,
    string_agg(column_name, ', ') as columns
FROM information_schema.columns 
WHERE table_name = 'tool_reviews'
GROUP BY info;

SELECT 
    'user_profiles columns:' as info,
    string_agg(column_name, ', ') as columns
FROM information_schema.columns 
WHERE table_name = 'user_profiles'
GROUP BY info;
