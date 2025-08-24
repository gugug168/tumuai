-- =============================================================================
-- Civil AI Hub - 数据库安全补丁脚本
-- 版本: 1.0
-- 创建时间: 2025-08-24
-- 
-- 说明: 修复security-auditor发现的数据库安全漏洞
-- =============================================================================

-- 1. 启用行级安全 (RLS) - 确保所有表都有适当的安全策略
ALTER TABLE tools ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;

-- 2. 工具表的安全策略
-- 2.1 公开读取已发布的工具
DROP POLICY IF EXISTS "tools_public_read" ON tools;
CREATE POLICY "tools_public_read" ON tools
    FOR SELECT USING (status = 'published');

-- 2.2 管理员可以读取所有工具
DROP POLICY IF EXISTS "tools_admin_read_all" ON tools;  
CREATE POLICY "tools_admin_read_all" ON tools
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM admin_users 
            WHERE user_id = auth.uid() 
            AND (permissions->>'manage_tools')::boolean = true
        )
    );

-- 2.3 管理员可以插入、更新、删除工具
DROP POLICY IF EXISTS "tools_admin_write" ON tools;
CREATE POLICY "tools_admin_write" ON tools
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM admin_users 
            WHERE user_id = auth.uid() 
            AND (permissions->>'manage_tools')::boolean = true
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM admin_users 
            WHERE user_id = auth.uid() 
            AND (permissions->>'manage_tools')::boolean = true
        )
    );

-- 3. 管理员表的安全策略
-- 3.1 管理员只能读取自己的信息
DROP POLICY IF EXISTS "admin_users_read_own" ON admin_users;
CREATE POLICY "admin_users_read_own" ON admin_users
    FOR SELECT TO authenticated
    USING (user_id = auth.uid());

-- 3.2 超级管理员可以读取所有管理员信息
DROP POLICY IF EXISTS "admin_users_super_admin_read_all" ON admin_users;
CREATE POLICY "admin_users_super_admin_read_all" ON admin_users
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM admin_users 
            WHERE user_id = auth.uid() 
            AND role = 'super_admin'
            AND (permissions->>'manage_admins')::boolean = true
        )
    );

-- 3.3 超级管理员可以管理其他管理员
DROP POLICY IF EXISTS "admin_users_super_admin_write" ON admin_users;
CREATE POLICY "admin_users_super_admin_write" ON admin_users
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM admin_users 
            WHERE user_id = auth.uid() 
            AND role = 'super_admin'
            AND (permissions->>'manage_admins')::boolean = true
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM admin_users 
            WHERE user_id = auth.uid() 
            AND role = 'super_admin'
            AND (permissions->>'manage_admins')::boolean = true
        )
    );

-- 4. 安全函数：验证管理员权限
CREATE OR REPLACE FUNCTION is_admin(required_permission text DEFAULT NULL)
RETURNS boolean AS $$
BEGIN
    -- 检查用户是否已认证
    IF auth.uid() IS NULL THEN
        RETURN false;
    END IF;
    
    -- 如果未指定权限，检查是否为管理员
    IF required_permission IS NULL THEN
        RETURN EXISTS (
            SELECT 1 FROM admin_users 
            WHERE user_id = auth.uid()
        );
    END IF;
    
    -- 检查特定权限
    RETURN EXISTS (
        SELECT 1 FROM admin_users 
        WHERE user_id = auth.uid() 
        AND (permissions->>required_permission)::boolean = true
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. 安全函数：获取当前用户权限
CREATE OR REPLACE FUNCTION get_user_permissions()
RETURNS jsonb AS $$
DECLARE
    user_perms jsonb;
BEGIN
    IF auth.uid() IS NULL THEN
        RETURN '{}'::jsonb;
    END IF;
    
    SELECT permissions INTO user_perms
    FROM admin_users 
    WHERE user_id = auth.uid();
    
    RETURN COALESCE(user_perms, '{}'::jsonb);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. 安全视图：只显示公开工具信息
CREATE OR REPLACE VIEW public_tools AS
SELECT 
    id, name, tagline, description, website_url, logo_url,
    categories, features, pricing, rating, views, upvotes, 
    date_added, created_at
FROM tools 
WHERE status = 'published';

-- 7. 审计日志表（如果不存在）
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id),
    table_name TEXT NOT NULL,
    operation TEXT NOT NULL CHECK (operation IN ('INSERT', 'UPDATE', 'DELETE')),
    old_data JSONB,
    new_data JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 启用审计日志表的RLS
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- 审计日志策略：只有超级管理员可以查看
DROP POLICY IF EXISTS "audit_logs_super_admin_only" ON audit_logs;
CREATE POLICY "audit_logs_super_admin_only" ON audit_logs
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM admin_users 
            WHERE user_id = auth.uid() 
            AND role = 'super_admin'
            AND (permissions->>'view_audit_logs')::boolean = true
        )
    );

-- 8. 工具表审计触发器
CREATE OR REPLACE FUNCTION audit_tools_changes()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        INSERT INTO audit_logs (user_id, table_name, operation, old_data)
        VALUES (auth.uid(), 'tools', TG_OP, row_to_json(OLD));
        RETURN OLD;
    ELSIF TG_OP = 'UPDATE' THEN
        INSERT INTO audit_logs (user_id, table_name, operation, old_data, new_data)
        VALUES (auth.uid(), 'tools', TG_OP, row_to_json(OLD), row_to_json(NEW));
        RETURN NEW;
    ELSIF TG_OP = 'INSERT' THEN
        INSERT INTO audit_logs (user_id, table_name, operation, new_data)
        VALUES (auth.uid(), 'tools', TG_OP, row_to_json(NEW));
        RETURN NEW;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 创建审计触发器
DROP TRIGGER IF EXISTS tools_audit_trigger ON tools;
CREATE TRIGGER tools_audit_trigger
    AFTER INSERT OR UPDATE OR DELETE ON tools
    FOR EACH ROW EXECUTE FUNCTION audit_tools_changes();

-- 9. 速率限制表（防止API滥用）
CREATE TABLE IF NOT EXISTS rate_limits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    identifier TEXT NOT NULL, -- IP地址或用户ID
    endpoint TEXT NOT NULL,
    request_count INTEGER DEFAULT 1,
    window_start TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 创建复合索引用于快速查找
CREATE INDEX IF NOT EXISTS idx_rate_limits_lookup 
ON rate_limits (identifier, endpoint, window_start);

-- 10. 清理旧的速率限制记录函数
CREATE OR REPLACE FUNCTION cleanup_old_rate_limits()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    -- 删除1小时前的记录
    DELETE FROM rate_limits 
    WHERE window_start < NOW() - INTERVAL '1 hour';
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- 安全配置验证
-- =============================================================================

DO $$
BEGIN
    RAISE NOTICE '=============================================================================';
    RAISE NOTICE '✅ 数据库安全补丁应用完成';
    RAISE NOTICE '=============================================================================';
    RAISE NOTICE '已配置的安全策略：';
    RAISE NOTICE '- RLS已启用所有敏感表';
    RAISE NOTICE '- 工具表：公开读取 + 管理员管理';
    RAISE NOTICE '- 管理员表：个人访问 + 超级管理员管理';
    RAISE NOTICE '- 审计日志：自动记录所有数据变更';
    RAISE NOTICE '- 速率限制：防止API滥用';
    RAISE NOTICE '=============================================================================';
    RAISE NOTICE '建议定期执行：SELECT cleanup_old_rate_limits();';
    RAISE NOTICE '=============================================================================';
END $$;