/*
  # 创建工具分类管理系统
  
  1. 新建表
    - `categories` - 分类管理表
    - `tool_submissions` - 工具提交表（新增）
    
  2. 更新现有表
    - 为工具表添加更好的分类支持
    - 添加分类排序和层级结构
*/

-- 创建分类管理表
CREATE TABLE IF NOT EXISTS categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  slug text NOT NULL UNIQUE,
  description text,
  color text DEFAULT '#3B82F6',
  icon text DEFAULT 'tool',
  parent_id uuid REFERENCES categories(id) ON DELETE CASCADE,
  sort_order integer DEFAULT 0,
  is_active boolean DEFAULT true,
  tools_count integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 创建工具提交表（如果不存在）
CREATE TABLE IF NOT EXISTS tool_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submitter_email text,
  tool_name text NOT NULL,
  tagline text NOT NULL,
  description text,
  website_url text NOT NULL,
  logo_url text,
  categories text[] DEFAULT '{}',
  features text[] DEFAULT '{}',
  pricing text NOT NULL CHECK (pricing IN ('Free', 'Freemium', 'Paid', 'Trial')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  admin_notes text,
  reviewed_by uuid REFERENCES auth.users(id),
  reviewed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 添加分类索引
CREATE INDEX IF NOT EXISTS idx_categories_parent_id ON categories(parent_id);
CREATE INDEX IF NOT EXISTS idx_categories_slug ON categories(slug);
CREATE INDEX IF NOT EXISTS idx_categories_sort_order ON categories(sort_order);
CREATE INDEX IF NOT EXISTS idx_categories_is_active ON categories(is_active);

-- 添加工具提交表索引
CREATE INDEX IF NOT EXISTS idx_tool_submissions_status ON tool_submissions(status);
CREATE INDEX IF NOT EXISTS idx_tool_submissions_created_at ON tool_submissions(created_at DESC);

-- 启用RLS
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE tool_submissions ENABLE ROW LEVEL SECURITY;

-- 分类表策略：管理员可以管理，所有人可以查看
CREATE POLICY "Categories are viewable by everyone"
  ON categories FOR SELECT
  TO public
  USING (is_active = true);

CREATE POLICY "Admins can manage categories"
  ON categories FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users 
      WHERE admin_users.user_id = auth.uid()
    )
  );

-- 工具提交表策略：管理员可以管理，提交者可以查看自己的
CREATE POLICY "Tool submissions are viewable by admins"
  ON tool_submissions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users 
      WHERE admin_users.user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can update tool submissions"
  ON tool_submissions FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users 
      WHERE admin_users.user_id = auth.uid()
    )
  );

-- 插入默认分类
INSERT INTO categories (name, slug, description, color, icon, sort_order) VALUES
('设计软件', 'design-software', 'CAD、BIM、3D建模等设计相关软件', '#3B82F6', 'pen-tool', 1),
('结构计算', 'structural-analysis', '结构分析、计算与验算工具', '#EF4444', 'calculator', 2),
('施工管理', 'construction-management', '施工项目管理、进度管理、质量管理', '#10B981', 'hard-hat', 3),
('测量工具', 'surveying-tools', '工程测量、地形测量、施工放样工具', '#F59E0B', 'map-pin', 4),
('造价软件', 'cost-estimation', '工程造价、预算、结算相关软件', '#8B5CF6', 'dollar-sign', 5),
('检测试验', 'testing-inspection', '材料检测、工程质量检测工具', '#06B6D4', 'microscope', 6),
('文档管理', 'document-management', '工程文档、图纸管理、资料管理', '#84CC16', 'file-text', 7),
('协同办公', 'collaboration-tools', '团队协作、项目管理、沟通工具', '#F97316', 'users', 8)
ON CONFLICT (slug) DO NOTHING;

-- 创建更新时间触发器
CREATE TRIGGER update_categories_updated_at
  BEFORE UPDATE ON categories
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tool_submissions_updated_at
  BEFORE UPDATE ON tool_submissions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();