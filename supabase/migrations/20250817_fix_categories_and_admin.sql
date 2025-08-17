-- 修复分类管理和后台功能
-- 统一分类系统并完善审核功能

-- 1. 创建统一的分类表
CREATE TABLE IF NOT EXISTS categories (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL UNIQUE,
    description text,
    icon text,
    color text,
    sort_order integer DEFAULT 0,
    is_active boolean DEFAULT true,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- 2. 插入标准土木行业分类
INSERT INTO categories (name, description, icon, color, sort_order) VALUES
('AI结构设计', 'AI驱动的结构设计工具，包括智能计算、优化算法等', 'Building2', 'bg-blue-500', 1),
('智能施工管理', '施工项目管理、进度控制、资源优化等智能工具', 'HardHat', 'bg-orange-500', 2),
('BIM软件', '建筑信息模型、三维建模、协同设计工具', 'Layers', 'bg-green-500', 3),
('效率工具', '提升工程师工作效率的各类工具软件', 'Calculator', 'bg-purple-500', 4),
('岩土工程', '岩土分析、地质勘察、基础设计等专业工具', 'Mountain', 'bg-amber-500', 5),
('项目管理', '项目计划、成本控制、团队协作管理工具', 'ClipboardList', 'bg-indigo-500', 6),
('资料管理', '技术文档管理、资料归档、报告生成工具', 'FileText', 'bg-teal-500', 7),
('图纸处理', 'CAD图纸处理、图纸转换、批注工具', 'Ruler', 'bg-red-500', 8)
ON CONFLICT (name) DO UPDATE SET
    description = EXCLUDED.description,
    icon = EXCLUDED.icon,
    color = EXCLUDED.color,
    sort_order = EXCLUDED.sort_order;

-- 3. 修复tool_submissions表，确保有分类关联
ALTER TABLE tool_submissions 
ADD COLUMN IF NOT EXISTS category_id uuid REFERENCES categories(id),
ADD COLUMN IF NOT EXISTS status text DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
ADD COLUMN IF NOT EXISTS admin_notes text,
ADD COLUMN IF NOT EXISTS reviewed_by uuid REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS reviewed_at timestamptz;

-- 4. 修复tools表，确保有分类关联
ALTER TABLE tools 
ADD COLUMN IF NOT EXISTS category_id uuid REFERENCES categories(id),
ADD COLUMN IF NOT EXISTS status text DEFAULT 'published' CHECK (status IN ('published', 'draft', 'archived'));

-- 5. 更新现有工具的分类（将字符串分类转换为ID）
DO $$
DECLARE
    cat_record RECORD;
    tool_record RECORD;
BEGIN
    -- 为没有category_id的tools更新分类
    FOR cat_record IN SELECT * FROM categories LOOP
        UPDATE tools SET category_id = cat_record.id 
        WHERE category_id IS NULL AND categories @> ARRAY[cat_record.name];
    END LOOP;
    
    -- 为tool_submissions做同样的事情
    FOR cat_record IN SELECT * FROM categories LOOP
        UPDATE tool_submissions SET category_id = cat_record.id 
        WHERE category_id IS NULL AND categories @> ARRAY[cat_record.name];
    END LOOP;
END $$;

-- 6. 创建工具审核相关函数
CREATE OR REPLACE FUNCTION approve_tool_submission(submission_id uuid, admin_user_id uuid)
RETURNS TABLE (tool_id uuid, success boolean) AS $$
DECLARE
    new_tool_id uuid;
    submission_record RECORD;
BEGIN
    -- 获取提交记录
    SELECT * INTO submission_record FROM tool_submissions WHERE id = submission_id;
    
    IF NOT FOUND THEN
        RETURN QUERY SELECT NULL::uuid, false;
        RETURN;
    END IF;
    
    -- 创建新工具
    INSERT INTO tools (
        name, tagline, description, website_url, logo_url, 
        categories, features, pricing, category_id, status
    ) VALUES (
        submission_record.name, 
        submission_record.tagline, 
        submission_record.description, 
        submission_record.website_url, 
        submission_record.logo_url,
        submission_record.categories,
        submission_record.features,
        submission_record.pricing,
        submission_record.category_id,
        'published'
    ) RETURNING id INTO new_tool_id;
    
    -- 更新提交状态
    UPDATE tool_submissions SET 
        status = 'approved',
        reviewed_by = admin_user_id,
        reviewed_at = now()
    WHERE id = submission_id;
    
    RETURN QUERY SELECT new_tool_id, true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION reject_tool_submission(submission_id uuid, admin_user_id uuid, notes text)
RETURNS boolean AS $$
BEGIN
    UPDATE tool_submissions SET 
        status = 'rejected',
        admin_notes = notes,
        reviewed_by = admin_user_id,
        reviewed_at = now()
    WHERE id = submission_id;
    
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. 创建分类管理函数
CREATE OR REPLACE FUNCTION manage_category(
    action text,
    cat_id uuid DEFAULT NULL,
    cat_name text DEFAULT NULL,
    cat_description text DEFAULT NULL,
    cat_icon text DEFAULT NULL,
    cat_color text DEFAULT NULL,
    cat_sort_order integer DEFAULT 0,
    cat_is_active boolean DEFAULT true
)
RETURNS TABLE (result json) AS $$
BEGIN
    IF action = 'create' THEN
        INSERT INTO categories (name, description, icon, color, sort_order, is_active)
        VALUES (cat_name, cat_description, cat_icon, cat_color, cat_sort_order, cat_is_active)
        RETURNING json_build_object('id', id, 'name', name, 'action', 'created') INTO result;
        RETURN NEXT;
    
    ELSIF action = 'update' THEN
        UPDATE categories SET
            name = COALESCE(cat_name, name),
            description = COALESCE(cat_description, description),
            icon = COALESCE(cat_icon, icon),
            color = COALESCE(cat_color, color),
            sort_order = COALESCE(cat_sort_order, sort_order),
            is_active = COALESCE(cat_is_active, is_active),
            updated_at = now()
        WHERE id = cat_id
        RETURNING json_build_object('id', id, 'name', name, 'action', 'updated') INTO result;
        RETURN NEXT;
    
    ELSIF action = 'delete' THEN
        DELETE FROM categories WHERE id = cat_id;
        result := json_build_object('id', cat_id, 'action', 'deleted');
        RETURN NEXT;
    
    ELSIF action = 'list' THEN
        RETURN QUERY
        SELECT json_build_object(
            'id', id, 'name', name, 'description', description, 
            'icon', icon, 'color', color, 'sort_order', sort_order, 'is_active', is_active
        ) FROM categories ORDER BY sort_order, name;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. 创建工具管理函数
CREATE OR REPLACE FUNCTION admin_manage_tool(
    action text,
    tool_id uuid DEFAULT NULL,
    tool_data json DEFAULT '{}'::json
)
RETURNS TABLE (result json) AS $$
DECLARE
    tool_record RECORD;
BEGIN
    IF action = 'create' THEN
        INSERT INTO tools (
            name, tagline, description, website_url, logo_url, 
            categories, features, pricing, category_id, status
        ) SELECT 
            tool_data->>'name',
            tool_data->>'tagline',
            tool_data->>'description',
            tool_data->>'website_url',
            tool_data->>'logo_url',
            ARRAY[tool_data->>'categories'],
            ARRAY[tool_data->>'features'],
            tool_data->>'pricing',
            (tool_data->>'category_id')::uuid,
            COALESCE(tool_data->>'status', 'published')
        RETURNING json_build_object('id', id, 'name', name, 'action', 'created') INTO result;
        RETURN NEXT;
    
    ELSIF action = 'update' THEN
        UPDATE tools SET
            name = COALESCE(tool_data->>'name', name),
            tagline = COALESCE(tool_data->>'tagline', tagline),
            description = COALESCE(tool_data->>'description', description),
            website_url = COALESCE(tool_data->>'website_url', website_url),
            logo_url = COALESCE(tool_data->>'logo_url', logo_url),
            categories = COALESCE(ARRAY[tool_data->>'categories'], categories),
            features = COALESCE(ARRAY[tool_data->>'features'], features),
            pricing = COALESCE(tool_data->>'pricing', pricing),
            category_id = COALESCE((tool_data->>'category_id')::uuid, category_id),
            status = COALESCE(tool_data->>'status', status),
            updated_at = now()
        WHERE id = tool_id
        RETURNING json_build_object('id', id, 'name', name, 'action', 'updated') INTO result;
        RETURN NEXT;
    
    ELSIF action = 'delete' THEN
        DELETE FROM tools WHERE id = tool_id;
        result := json_build_object('id', tool_id, 'action', 'deleted');
        RETURN NEXT;
    
    ELSIF action = 'list' THEN
        RETURN QUERY
        SELECT json_build_object(
            'id', t.id, 'name', t.name, 'tagline', t.tagline,
            'description', t.description, 'website_url', t.website_url,
            'logo_url', t.logo_url, 'categories', t.categories,
            'features', t.features, 'pricing', t.pricing,
            'category_id', t.category_id, 'status', t.status,
            'category_name', c.name
        ) FROM tools t LEFT JOIN categories c ON t.category_id = c.id ORDER BY t.created_at DESC;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 9. 更新现有数据
-- 更新工具状态
UPDATE tools SET status = 'published' WHERE status IS NULL;
UPDATE tool_submissions SET status = 'pending' WHERE status IS NULL;

-- 10. 创建索引优化查询
CREATE INDEX IF NOT EXISTS idx_tools_category_id ON tools(category_id);
CREATE INDEX IF NOT EXISTS idx_tools_status ON tools(status);
CREATE INDEX IF NOT EXISTS idx_tool_submissions_status ON tool_submissions(status);
CREATE INDEX IF NOT EXISTS idx_tool_submissions_category_id ON tool_submissions(category_id);

-- 11. 最终验证
SELECT 
    '分类系统修复完成' as status,
    (SELECT COUNT(*) FROM categories) as categories_count,
    (SELECT COUNT(*) FROM tool_submissions WHERE status = 'pending') as pending_submissions,
    (SELECT COUNT(*) FROM tools WHERE category_id IS NOT NULL) as categorized_tools;