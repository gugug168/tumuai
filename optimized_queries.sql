-- =====================================================
-- Civil AI Hub 优化查询示例
-- 替代现有低效查询的高性能版本
-- =====================================================

-- 1. 工具列表查询优化
-- 原查询：基础分页查询
-- 优化：使用覆盖索引和窗口函数
CREATE OR REPLACE FUNCTION get_tools_optimized(
    p_limit INTEGER DEFAULT 60,
    p_offset INTEGER DEFAULT 0,
    p_sort_by TEXT DEFAULT 'upvotes',
    p_sort_order TEXT DEFAULT 'desc'
) RETURNS TABLE(
    id UUID,
    name VARCHAR,
    tagline VARCHAR,
    logo_url VARCHAR,
    categories UUID[],
    features TEXT[],
    pricing TEXT,
    rating DECIMAL,
    views BIGINT,
    upvotes INTEGER,
    date_added TIMESTAMPTZ,
    total_count BIGINT
) AS $$
BEGIN
    RETURN QUERY
    WITH ranked_tools AS (
        SELECT 
            t.id, t.name, t.tagline, t.logo_url, t.categories, t.features,
            t.pricing::TEXT, t.rating, t.views, t.upvotes, t.date_added,
            COUNT(*) OVER() as total_count,
            ROW_NUMBER() OVER (
                ORDER BY 
                    CASE WHEN p_sort_by = 'upvotes' AND p_sort_order = 'desc' THEN t.upvotes END DESC,
                    CASE WHEN p_sort_by = 'upvotes' AND p_sort_order = 'asc' THEN t.upvotes END ASC,
                    CASE WHEN p_sort_by = 'date_added' AND p_sort_order = 'desc' THEN t.date_added END DESC,
                    CASE WHEN p_sort_by = 'date_added' AND p_sort_order = 'asc' THEN t.date_added END ASC,
                    CASE WHEN p_sort_by = 'views' AND p_sort_order = 'desc' THEN t.views END DESC,
                    CASE WHEN p_sort_by = 'views' AND p_sort_order = 'asc' THEN t.views END ASC,
                    CASE WHEN p_sort_by = 'rating' AND p_sort_order = 'desc' THEN t.rating END DESC,
                    CASE WHEN p_sort_by = 'rating' AND p_sort_order = 'asc' THEN t.rating END ASC,
                    t.name
            ) as rn
        FROM tools t
        WHERE t.status = 'published'
    )
    SELECT rt.* FROM ranked_tools rt
    WHERE rn > p_offset AND rn <= (p_offset + p_limit);
END;
$$ LANGUAGE plpgsql;

-- 2. 智能搜索查询优化
-- 原查询：简单ILIKE模糊匹配
-- 优化：全文搜索 + 智能权重排序
CREATE OR REPLACE FUNCTION search_tools_optimized(
    p_query TEXT,
    p_categories UUID[] DEFAULT NULL,
    p_features TEXT[] DEFAULT NULL,
    p_pricing TEXT DEFAULT NULL,
    p_min_rating DECIMAL DEFAULT NULL,
    p_limit INTEGER DEFAULT 20,
    p_offset INTEGER DEFAULT 0
) RETURNS TABLE(
    id UUID,
    name VARCHAR,
    tagline VARCHAR,
    description TEXT,
    logo_url VARCHAR,
    categories UUID[],
    features TEXT[],
    pricing TEXT,
    rating DECIMAL,
    views BIGINT,
    upvotes INTEGER,
    date_added TIMESTAMPTZ,
    search_rank REAL,
    total_count BIGINT
) AS $$
DECLARE
    search_vector tsvector;
    search_query tsquery;
BEGIN
    -- 准备搜索向量和查询
    search_query := plainto_tsquery('simple', p_query);
    
    RETURN QUERY
    WITH search_results AS (
        SELECT 
            t.id, t.name, t.tagline, t.description, t.logo_url, t.categories, t.features,
            t.pricing::TEXT, t.rating, t.views, t.upvotes, t.date_added,
            -- 计算搜索相关性得分
            ts_rank_cd(
                to_tsvector('simple', t.name || ' ' || t.tagline || ' ' || coalesce(t.description, '')),
                search_query,
                32  -- 归一化
            ) * 
            -- 权重加成
            (CASE 
                WHEN t.name ILIKE '%' || p_query || '%' THEN 2.0  -- 名称匹配权重最高
                WHEN t.tagline ILIKE '%' || p_query || '%' THEN 1.5  -- 标语匹配权重中等
                ELSE 1.0 
            END) *
            -- 质量加成
            (1 + (t.upvotes::REAL / 100) + (t.rating::REAL / 5)) as search_rank
        FROM tools t
        WHERE t.status = 'published'
          AND (
              p_query IS NULL OR p_query = '' OR
              to_tsvector('simple', t.name || ' ' || t.tagline || ' ' || coalesce(t.description, '')) @@ search_query
          )
          AND (p_categories IS NULL OR t.categories && p_categories)
          AND (p_features IS NULL OR t.features && p_features)  
          AND (p_pricing IS NULL OR t.pricing::TEXT = p_pricing)
          AND (p_min_rating IS NULL OR t.rating >= p_min_rating)
    ),
    ranked_results AS (
        SELECT 
            *,
            COUNT(*) OVER() as total_count,
            ROW_NUMBER() OVER (ORDER BY search_rank DESC, upvotes DESC) as rn
        FROM search_results
        WHERE search_rank > 0.01  -- 过滤低相关性结果
    )
    SELECT rr.* FROM ranked_results rr
    WHERE rn > p_offset AND rn <= (p_offset + p_limit);
END;
$$ LANGUAGE plpgsql;

-- 3. 分类工具查询优化
-- 使用关联表查询（推荐数据结构）
CREATE OR REPLACE FUNCTION get_tools_by_category_optimized(
    p_category_ids UUID[],
    p_include_primary_only BOOLEAN DEFAULT false,
    p_limit INTEGER DEFAULT 20,
    p_offset INTEGER DEFAULT 0
) RETURNS TABLE(
    id UUID,
    name VARCHAR,
    tagline VARCHAR,
    logo_url VARCHAR,
    category_names TEXT[],
    is_primary BOOLEAN,
    upvotes INTEGER,
    views BIGINT,
    rating DECIMAL,
    date_added TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        t.id, t.name, t.tagline, t.logo_url,
        array_agg(DISTINCT c.name) as category_names,
        bool_or(tc.is_primary) as is_primary,
        t.upvotes, t.views, t.rating, t.date_added
    FROM tools t
    INNER JOIN tool_categories tc ON t.id = tc.tool_id
    INNER JOIN categories c ON tc.category_id = c.id
    WHERE t.status = 'published'
      AND tc.category_id = ANY(p_category_ids)
      AND (NOT p_include_primary_only OR tc.is_primary = true)
    GROUP BY t.id, t.name, t.tagline, t.logo_url, t.upvotes, t.views, t.rating, t.date_added
    ORDER BY t.upvotes DESC, t.views DESC
    LIMIT p_limit OFFSET p_offset;
END;
$$ LANGUAGE plpgsql;

-- 4. 工具详情查询优化（包含相关推荐）
CREATE OR REPLACE FUNCTION get_tool_detail_with_recommendations(
    p_tool_id UUID
) RETURNS JSON AS $$
DECLARE
    tool_data JSON;
    recommendations JSON;
BEGIN
    -- 获取工具详情
    SELECT to_json(t) INTO tool_data
    FROM (
        SELECT 
            id, name, tagline, description, website_url, logo_url,
            categories, features, pricing, featured, rating, review_count,
            upvotes, views, date_added, created_at, updated_at
        FROM tools 
        WHERE id = p_tool_id AND status = 'published'
    ) t;
    
    -- 获取相关推荐（基于分类和功能相似性）
    SELECT json_agg(rec) INTO recommendations
    FROM (
        SELECT 
            t2.id, t2.name, t2.tagline, t2.logo_url, t2.rating, t2.upvotes,
            -- 计算相似度得分
            (
                -- 分类相似性
                (SELECT COUNT(*) FROM unnest(t1.categories) c1 
                 WHERE c1 = ANY(t2.categories)) * 2 +
                -- 功能相似性  
                (SELECT COUNT(*) FROM unnest(t1.features) f1 
                 WHERE f1 = ANY(t2.features)) +
                -- 定价相似性
                (CASE WHEN t1.pricing = t2.pricing THEN 1 ELSE 0 END)
            ) as similarity_score
        FROM tools t1, tools t2
        WHERE t1.id = p_tool_id 
          AND t2.id != p_tool_id
          AND t2.status = 'published'
          AND (
              t1.categories && t2.categories OR 
              t1.features && t2.features OR
              t1.pricing = t2.pricing
          )
        ORDER BY similarity_score DESC, t2.upvotes DESC
        LIMIT 6
    ) rec;
    
    -- 返回组合结果
    RETURN json_build_object(
        'tool', tool_data,
        'recommendations', recommendations
    );
END;
$$ LANGUAGE plpgsql;

-- 5. 统计查询优化（使用物化视图）
-- 创建统计物化视图
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_tool_statistics AS
SELECT 
    DATE(created_at) as stat_date,
    COUNT(*) as total_tools,
    COUNT(*) FILTER (WHERE status = 'published') as published_tools,
    COUNT(*) FILTER (WHERE featured = true) as featured_tools,
    AVG(rating) FILTER (WHERE rating > 0) as avg_rating,
    SUM(upvotes) as total_upvotes,
    SUM(views) as total_views,
    MAX(created_at) as last_updated
FROM tools
WHERE created_at >= CURRENT_DATE - INTERVAL '90 days'
GROUP BY DATE(created_at)
ORDER BY stat_date DESC;

-- 创建物化视图索引
CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_tool_statistics_date 
ON mv_tool_statistics(stat_date);

-- 刷新物化视图的函数
CREATE OR REPLACE FUNCTION refresh_tool_statistics()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_tool_statistics;
END;
$$ LANGUAGE plpgsql;

-- 6. 批量操作优化
-- 批量更新浏览量（避免大量单独UPDATE）
CREATE OR REPLACE FUNCTION increment_tools_views_batch(
    tool_ids UUID[],
    increments INTEGER[] DEFAULT NULL
) RETURNS void AS $$
DECLARE
    i INTEGER;
    default_increment INTEGER := 1;
BEGIN
    -- 使用unnest进行批量更新
    UPDATE tools 
    SET views = views + COALESCE(batch_data.increment, default_increment),
        updated_at = NOW()
    FROM (
        SELECT 
            unnest(tool_ids) as tool_id,
            unnest(COALESCE(increments, array_fill(default_increment, array_length(tool_ids, 1)))) as increment
    ) batch_data
    WHERE tools.id = batch_data.tool_id;
END;
$$ LANGUAGE plpgsql;

-- 7. 缓存友好的分页查询
-- 使用游标分页替代OFFSET分页（大偏移量时性能更好）
CREATE OR REPLACE FUNCTION get_tools_cursor_pagination(
    p_cursor_upvotes INTEGER DEFAULT NULL,
    p_cursor_id UUID DEFAULT NULL,
    p_limit INTEGER DEFAULT 20,
    p_direction TEXT DEFAULT 'next'  -- 'next' or 'prev'
) RETURNS TABLE(
    id UUID,
    name VARCHAR,
    tagline VARCHAR,
    logo_url VARCHAR,
    upvotes INTEGER,
    views BIGINT,
    has_next BOOLEAN,
    has_prev BOOLEAN
) AS $$
DECLARE
    total_count INTEGER;
    current_position INTEGER;
BEGIN
    -- 获取总数
    SELECT COUNT(*) INTO total_count FROM tools WHERE status = 'published';
    
    RETURN QUERY
    WITH paginated_tools AS (
        SELECT 
            t.id, t.name, t.tagline, t.logo_url, t.upvotes, t.views,
            ROW_NUMBER() OVER (ORDER BY t.upvotes DESC, t.id) as rn
        FROM tools t
        WHERE t.status = 'published'
          AND (
              p_cursor_upvotes IS NULL OR
              (p_direction = 'next' AND (t.upvotes < p_cursor_upvotes OR (t.upvotes = p_cursor_upvotes AND t.id > p_cursor_id))) OR
              (p_direction = 'prev' AND (t.upvotes > p_cursor_upvotes OR (t.upvotes = p_cursor_upvotes AND t.id < p_cursor_id)))
          )
        ORDER BY 
            CASE WHEN p_direction = 'next' THEN t.upvotes END DESC,
            CASE WHEN p_direction = 'next' THEN t.id END,
            CASE WHEN p_direction = 'prev' THEN t.upvotes END ASC,
            CASE WHEN p_direction = 'prev' THEN t.id END DESC
        LIMIT p_limit + 1  -- 多获取一条用于判断是否还有更多
    )
    SELECT 
        pt.id, pt.name, pt.tagline, pt.logo_url, pt.upvotes, pt.views,
        (SELECT COUNT(*) FROM paginated_tools) > p_limit as has_next,
        p_cursor_upvotes IS NOT NULL as has_prev
    FROM paginated_tools pt
    WHERE pt.rn <= p_limit;
END;
$$ LANGUAGE plpgsql;

-- 8. 实时推荐算法查询
-- 基于用户行为的协同过滤推荐
CREATE OR REPLACE FUNCTION get_personalized_recommendations(
    p_user_viewed_tools UUID[],
    p_limit INTEGER DEFAULT 10
) RETURNS TABLE(
    id UUID,
    name VARCHAR,
    tagline VARCHAR,
    logo_url VARCHAR,
    recommendation_score REAL,
    recommendation_reason TEXT
) AS $$
BEGIN
    RETURN QUERY
    WITH user_preferences AS (
        -- 分析用户偏好
        SELECT 
            unnest(categories) as preferred_category,
            COUNT(*) as category_weight
        FROM tools 
        WHERE id = ANY(p_user_viewed_tools)
        GROUP BY unnest(categories)
    ),
    candidate_tools AS (
        SELECT 
            t.id, t.name, t.tagline, t.logo_url, t.categories, t.features,
            t.upvotes, t.rating, t.views,
            -- 计算推荐得分
            (
                -- 分类匹配得分
                COALESCE((
                    SELECT SUM(up.category_weight) 
                    FROM user_preferences up 
                    WHERE up.preferred_category = ANY(t.categories)
                ), 0) * 0.4 +
                -- 质量得分
                (t.upvotes::REAL / 1000 + COALESCE(t.rating, 0) * 0.2) * 0.3 +
                -- 新颖性得分（避免推荐太老的工具）
                (EXTRACT(days FROM NOW() - t.date_added) / -365.0 + 1) * 0.3
            ) as recommendation_score
        FROM tools t
        WHERE t.status = 'published'
          AND t.id != ALL(p_user_viewed_tools)  -- 排除已查看的工具
          AND EXISTS (
              SELECT 1 FROM user_preferences up 
              WHERE up.preferred_category = ANY(t.categories)
          )
    )
    SELECT 
        ct.id, ct.name, ct.tagline, ct.logo_url, ct.recommendation_score,
        '基于您浏览过的' || (
            SELECT string_agg(DISTINCT c.name, '、') 
            FROM categories c, unnest(ct.categories) cat_id 
            WHERE c.id = cat_id
        ) || '类工具推荐' as recommendation_reason
    FROM candidate_tools ct
    WHERE ct.recommendation_score > 0
    ORDER BY ct.recommendation_score DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- 使用示例和性能测试
-- 测试优化后的查询性能
SELECT '=== 性能测试开始 ===' as test_info;

-- 测试工具列表查询
EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) 
SELECT * FROM get_tools_optimized(20, 0, 'upvotes', 'desc');

-- 测试搜索查询  
EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
SELECT * FROM search_tools_optimized('AI design', NULL, NULL, NULL, NULL, 10, 0);

-- 测试工具详情查询
EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
SELECT get_tool_detail_with_recommendations('00000000-0000-0000-0000-000000000001'::UUID);

SELECT '=== 性能测试完成 ===' as test_info;