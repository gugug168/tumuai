-- 最终修复：分类系统和工具审核功能
-- 修复slug约束错误并创建8个土木行业分类

-- 1. 如果categories表已存在，先删除重建
DROP TABLE IF EXISTS categories CASCADE;

-- 2. 创建categories表（无slug约束）
CREATE TABLE categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL UNIQUE,
    description TEXT,
    color VARCHAR(7) DEFAULT '#3B82F6',
    icon VARCHAR(50) DEFAULT 'Folder',
    parent_id UUID REFERENCES categories(id) ON DELETE CASCADE,
    sort_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. 插入8个土木行业分类
INSERT INTO categories (name, description, color, icon, sort_order) VALUES
('结构设计', '建筑结构设计与分析工具', '#EF4444', 'Building2', 1),
('建筑设计', '建筑设计与建模软件', '#F97316', 'Home', 2),
('施工管理', '项目管理和施工协调工具', '#10B981', 'Construction', 3),
('造价预算', '工程造价与预算计算工具', '#8B5CF6', 'Calculator', 4),
('BIM建模', '建筑信息模型与协作平台', '#06B6D4', 'Box', 5),
('岩土工程', '地质分析与基础设计工具', '#84CC16', 'Mountain', 6),
('市政工程', '道路、桥梁、管网设计工具', '#F59E0B', 'Road', 7),
('效率工具', '通用办公与效率提升工具', '#64748B', 'Zap', 8);

-- 4. 更新tool_submissions表，添加分类关联
ALTER TABLE tool_submissions 
ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES categories(id),
ADD COLUMN IF NOT EXISTS admin_notes TEXT,
ADD COLUMN IF NOT EXISTS reviewed_by UUID,
ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMP WITH TIME ZONE;

-- 5. 更新tools表，确保category_id正确关联
ALTER TABLE tools 
ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES categories(id);

-- 6. 创建approve_tool_submission函数
CREATE OR REPLACE FUNCTION approve_tool_submission(
  submission_id UUID,
  admin_notes TEXT DEFAULT NULL
) RETURNS TABLE (
  tool_id UUID,
  tool_name VARCHAR
) AS $$
BEGIN
  -- 更新提交状态
  UPDATE tool_submissions 
  SET status = 'approved', 
      reviewed_at = NOW(),
      admin_notes = COALESCE(admin_notes, admin_notes)
  WHERE id = submission_id;

  -- 创建正式工具记录
  RETURN QUERY
  INSERT INTO tools (
    name, tagline, description, website_url, logo_url,
    categories, features, pricing, category_id,
    status, upvotes, views, favorites_count, reviews_count, comments_count
  )
  SELECT 
    tool_name, tagline, description, website_url, logo_url,
    categories, features, pricing, category_id,
    'published', 0, 0, 0, 0, 0
  FROM tool_submissions 
  WHERE id = submission_id
  RETURNING id, tool_name;
END;
$$ LANGUAGE plpgsql;

-- 7. 创建manage_category函数
CREATE OR REPLACE FUNCTION manage_category(
  action_type VARCHAR,
  category_data JSONB
) RETURNS JSONB AS $$
DECLARE
  result JSONB;
BEGIN
  CASE action_type
    WHEN 'create' THEN
      INSERT INTO categories (name, description, color, icon, sort_order)
      VALUES (
        category_data->>'name',
        category_data->>'description',
        COALESCE(category_data->>'color', '#3B82F6'),
        COALESCE(category_data->>'icon', 'Folder'),
        COALESCE((category_data->>'sort_order')::INTEGER, 0)
      )
      RETURNING row_to_json(categories.*) INTO result;
      
    WHEN 'update' THEN
      UPDATE categories 
      SET 
        name = category_data->>'name',
        description = category_data->>'description',
        color = COALESCE(category_data->>'color', color),
        icon = COALESCE(category_data->>'icon', icon),
        sort_order = COALESCE((category_data->>'sort_order')::INTEGER, sort_order),
        is_active = COALESCE((category_data->>'is_active')::BOOLEAN, is_active),
        updated_at = NOW()
      WHERE id = (category_data->>'id')::UUID
      RETURNING row_to_json(categories.*) INTO result;
      
    WHEN 'delete' THEN
      DELETE FROM categories 
      WHERE id = (category_data->>'id')::UUID
      RETURNING jsonb_build_object('deleted', true, 'id', id) INTO result;
      
    WHEN 'list' THEN
      SELECT jsonb_agg(row_to_json(categories.*)) INTO result
      FROM categories ORDER BY sort_order, name;
  END CASE;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- 8. 创建工具表外键约束（如果还没有）
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'tools_category_id_fkey' AND table_name = 'tools'
  ) THEN
    ALTER TABLE tools 
    ADD CONSTRAINT tools_category_id_fkey 
    FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL;
  END IF;
END $$;

-- 9. 创建完整权限策略
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS categories_select_all ON categories;
CREATE POLICY categories_select_all ON categories FOR SELECT USING (true);

DROP POLICY IF EXISTS categories_admin_all ON categories;
CREATE POLICY categories_admin_all ON categories FOR ALL USING (
  EXISTS (
    SELECT 1 FROM admin_users 
    WHERE user_id = auth.uid()
  )
);

-- 10. 验证修复结果
SELECT '=== 分类系统验证 ===' as section;
SELECT 
    '分类数量: ' || COUNT(*) as result,
    '包含分类: ' || string_agg(name, ', ') as categories
FROM categories;

SELECT '=== 修复完成 ===' as status;