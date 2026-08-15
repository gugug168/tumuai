-- 站长身份标记：user_profiles 加 is_webmaster 列
-- 配合详情页评论区的「站长/Official」徽章。
-- 前置条件：先在 Supabase Dashboard → Authentication 手动创建真实用户
-- webmaster@tumuai.net（勾选 auto confirm email），然后把下方 <webmaster-uid>
-- 替换为该用户的 auth.users.id 后在 SQL Editor 执行本文件。

ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS is_webmaster boolean NOT NULL DEFAULT false;

-- 把占位 uid 替换成实际值后取消注释执行：
-- UPDATE user_profiles
-- SET is_webmaster = true,
--     full_name = 'TumuAI 站长'
-- WHERE id = '<webmaster-uid>';
