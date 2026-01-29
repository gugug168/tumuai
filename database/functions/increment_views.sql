-- ============================================
-- Supabase RPC 函数: 原子性增加浏览量
-- ============================================
-- 功能: 原子性地增加工具浏览量，避免竞态条件
-- 优势: 比 UPDATE + SELECT 更高效，单次往返完成
-- ============================================

-- 创建或替换 RPC 函数
CREATE OR REPLACE FUNCTION increment_views(tool_id UUID, amount INTEGER DEFAULT 1)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  new_views INTEGER;
BEGIN
  -- 原子性增加浏览量
  UPDATE tools
  SET views = COALESCE(views, 0) + amount,
      updated_at = NOW()
  WHERE id = tool_id
  RETURNING views INTO new_views;

  -- 返回结果
  IF FOUND THEN
    RETURN jsonb_build_object(
      'success', true,
      'tool_id', tool_id,
      'new_views', new_views,
      'increment', amount
    );
  ELSE
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Tool not found'
    );
  END IF;
END;
$$;

-- ============================================
-- 批量增加浏览量 (优化版)
-- ============================================
-- 功能: 一次性增加多个工具的浏览量
-- 优势: 减少数据库往返次数
-- ============================================

CREATE OR REPLACE FUNCTION increment_views_batch(tool_ids UUID[], amount INTEGER DEFAULT 1)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  updated_count INTEGER;
BEGIN
  -- 批量更新
  UPDATE tools
  SET views = COALESCE(views, 0) + amount,
      updated_at = NOW()
  WHERE id = ANY(tool_ids)
  RETURNING COUNT(*) INTO updated_count;

  -- 返回结果
  RETURN jsonb_build_object(
    'success', true,
    'updated_count', updated_count,
    'requested_count', array_length(tool_ids, 1),
    'increment', amount
  );
END;
$$;

-- ============================================
-- 延迟更新视图 (用于临时存储)
-- ============================================
-- 如果需要实现延迟更新，可以创建临时表
-- ============================================

/*
-- 创建临时浏览量表 (可选)
CREATE TABLE IF NOT EXISTS pending_view_updates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tool_id UUID NOT NULL REFERENCES tools(id) ON DELETE CASCADE,
  views_count INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed BOOLEAN NOT NULL DEFAULT FALSE
);

-- 索引
CREATE INDEX IF NOT EXISTS pending_view_updates_tool_id_idx
  ON pending_view_updates(tool_id);

CREATE INDEX IF NOT EXISTS pending_view_updates_processed_idx
  ON pending_view_updates(processed, created_at);

-- 批量处理待更新的浏览量
CREATE OR REPLACE FUNCTION process_pending_view_updates(batch_size INTEGER DEFAULT 100)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  processed_count INTEGER;
BEGIN
  -- 使用 CTE 批量更新
  WITH updates AS (
    SELECT tool_id, SUM(views_count) as total_views
    FROM pending_view_updates
    WHERE processed = FALSE
    GROUP BY tool_id
    LIMIT batch_size
    FOR UPDATE SKIP LOCKED
  ),
  updated_tools AS (
    UPDATE tools t
    SET views = COALESCE(t.views, 0) + u.total_views,
        updated_at = NOW()
    FROM updates u
    WHERE t.id = u.tool_id
    RETURNING t.id
  )
  SELECT COUNT(*) INTO processed_count FROM updated_tools;

  -- 标记为已处理
  DELETE FROM pending_view_updates
  WHERE processed = FALSE
    AND tool_id IN (SELECT tool_id FROM updates);

  RETURN jsonb_build_object(
    'success', true,
    'processed_count', processed_count
  );
END;
$$;
*/
