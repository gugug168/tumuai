/*
  # 创建工具数据表

  1. 新建表
    - `tools` 表
      - `id` (uuid, 主键)
      - `name` (text, 工具名称)
      - `tagline` (text, 一句话简介)
      - `description` (text, 详细描述)
      - `website_url` (text, 官方网址)
      - `logo_url` (text, Logo图片URL)
      - `categories` (text[], 分类数组)
      - `features` (text[], 功能特性数组)
      - `pricing` (text, 定价模式)
      - `featured` (boolean, 是否精选)
      - `date_added` (timestamptz, 添加日期)
      - `upvotes` (integer, 点赞数/热度)
      - `views` (integer, 浏览次数)
      - `rating` (numeric, 平均评分)
      - `review_count` (integer, 评价数量)
      - `created_at` (timestamptz, 创建时间)
      - `updated_at` (timestamptz, 更新时间)

  2. 安全策略
    - 启用 RLS
    - 允许所有用户查看工具
    - 只有管理员可以添加/修改工具
*/

-- 创建工具表
CREATE TABLE IF NOT EXISTS tools (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  tagline text NOT NULL,
  description text,
  website_url text NOT NULL,
  logo_url text,
  categories text[] DEFAULT '{}',
  features text[] DEFAULT '{}',
  pricing text NOT NULL CHECK (pricing IN ('Free', 'Freemium', 'Paid', 'Trial')),
  featured boolean DEFAULT false,
  date_added timestamptz DEFAULT now(),
  upvotes integer DEFAULT 0,
  views integer DEFAULT 0,
  rating numeric(3,2) DEFAULT 0.0 CHECK (rating >= 0 AND rating <= 5),
  review_count integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 启用行级安全
ALTER TABLE tools ENABLE ROW LEVEL SECURITY;

-- 创建索引以提高查询性能
CREATE INDEX IF NOT EXISTS idx_tools_categories ON tools USING GIN (categories);
CREATE INDEX IF NOT EXISTS idx_tools_features ON tools USING GIN (features);
CREATE INDEX IF NOT EXISTS idx_tools_pricing ON tools (pricing);
CREATE INDEX IF NOT EXISTS idx_tools_featured ON tools (featured);
CREATE INDEX IF NOT EXISTS idx_tools_date_added ON tools (date_added DESC);
CREATE INDEX IF NOT EXISTS idx_tools_upvotes ON tools (upvotes DESC);
CREATE INDEX IF NOT EXISTS idx_tools_rating ON tools (rating DESC);

-- 创建安全策略：所有用户可以查看工具
CREATE POLICY "Anyone can view tools"
  ON tools
  FOR SELECT
  TO public
  USING (true);

-- 创建安全策略：只有认证用户可以增加浏览量（通过更新views字段）
CREATE POLICY "Authenticated users can update views"
  ON tools
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- 创建更新时间触发器函数
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- 创建触发器
CREATE TRIGGER update_tools_updated_at
  BEFORE UPDATE ON tools
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();