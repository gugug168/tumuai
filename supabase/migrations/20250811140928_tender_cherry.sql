/*
  # 创建用户系统和社区功能

  1. 新表
    - `user_profiles` - 用户资料表
    - `tool_favorites` - 工具收藏表
    - `tool_reviews` - 工具评价表
    - `tool_comments` - 工具评论表

  2. 安全
    - 启用所有表的RLS
    - 添加用户访问策略
*/

-- 用户资料表
CREATE TABLE IF NOT EXISTS user_profiles (
  id uuid REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  username text UNIQUE,
  full_name text,
  avatar_url text,
  bio text,
  company text,
  position text,
  website text,
  location text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 工具收藏表
CREATE TABLE IF NOT EXISTS tool_favorites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  tool_id uuid REFERENCES tools(id) ON DELETE CASCADE NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, tool_id)
);

-- 工具评价表
CREATE TABLE IF NOT EXISTS tool_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  tool_id uuid REFERENCES tools(id) ON DELETE CASCADE NOT NULL,
  rating integer NOT NULL CHECK (rating >= 1 AND rating <= 5),
  title text,
  content text,
  helpful_count integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, tool_id)
);

-- 工具评论表
CREATE TABLE IF NOT EXISTS tool_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  tool_id uuid REFERENCES tools(id) ON DELETE CASCADE NOT NULL,
  parent_id uuid REFERENCES tool_comments(id) ON DELETE CASCADE,
  content text NOT NULL,
  likes_count integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 评论点赞表
CREATE TABLE IF NOT EXISTS comment_likes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  comment_id uuid REFERENCES tool_comments(id) ON DELETE CASCADE NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, comment_id)
);

-- 启用RLS
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE tool_favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE tool_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE tool_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE comment_likes ENABLE ROW LEVEL SECURITY;

-- 用户资料策略
CREATE POLICY "Public profiles are viewable by everyone"
  ON user_profiles FOR SELECT
  USING (true);

CREATE POLICY "Users can insert their own profile"
  ON user_profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON user_profiles FOR UPDATE
  USING (auth.uid() = id);

-- 收藏策略
CREATE POLICY "Users can view their own favorites"
  ON tool_favorites FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own favorites"
  ON tool_favorites FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own favorites"
  ON tool_favorites FOR DELETE
  USING (auth.uid() = user_id);

-- 评价策略
CREATE POLICY "Reviews are viewable by everyone"
  ON tool_reviews FOR SELECT
  USING (true);

CREATE POLICY "Users can insert their own reviews"
  ON tool_reviews FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own reviews"
  ON tool_reviews FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own reviews"
  ON tool_reviews FOR DELETE
  USING (auth.uid() = user_id);

-- 评论策略
CREATE POLICY "Comments are viewable by everyone"
  ON tool_comments FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can insert comments"
  ON tool_comments FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own comments"
  ON tool_comments FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own comments"
  ON tool_comments FOR DELETE
  USING (auth.uid() = user_id);

-- 点赞策略
CREATE POLICY "Likes are viewable by everyone"
  ON comment_likes FOR SELECT
  USING (true);

CREATE POLICY "Users can manage their own likes"
  ON comment_likes FOR ALL
  USING (auth.uid() = user_id);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_user_profiles_username ON user_profiles(username);
CREATE INDEX IF NOT EXISTS idx_tool_favorites_user_id ON tool_favorites(user_id);
CREATE INDEX IF NOT EXISTS idx_tool_favorites_tool_id ON tool_favorites(tool_id);
CREATE INDEX IF NOT EXISTS idx_tool_reviews_tool_id ON tool_reviews(tool_id);
CREATE INDEX IF NOT EXISTS idx_tool_reviews_user_id ON tool_reviews(user_id);
CREATE INDEX IF NOT EXISTS idx_tool_comments_tool_id ON tool_comments(tool_id);
CREATE INDEX IF NOT EXISTS idx_tool_comments_parent_id ON tool_comments(parent_id);

-- 创建更新时间戳函数
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- 添加更新时间戳触发器
CREATE TRIGGER update_user_profiles_updated_at
  BEFORE UPDATE ON user_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tool_reviews_updated_at
  BEFORE UPDATE ON tool_reviews
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tool_comments_updated_at
  BEFORE UPDATE ON tool_comments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();