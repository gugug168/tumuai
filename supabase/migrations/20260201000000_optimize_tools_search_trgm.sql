-- Tools search optimization (tumuai.net)
-- Date: 2026-02-01
-- Goal: speed up ILIKE-based search on /api/tools-filtered?search=...
--
-- We use pg_trgm GIN indexes because:
-- - Works well for Chinese / mixed-language strings
-- - Accelerates `ILIKE '%keyword%'` patterns
-- - Keeps current API semantics (no need to change client/server query syntax)

-- Enable trigram extension (safe if already enabled)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Partial trigram indexes scoped to published tools (our read queries always filter status='published')
CREATE INDEX IF NOT EXISTS idx_tools_published_name_trgm
ON public.tools USING gin (name gin_trgm_ops)
WHERE status = 'published';

CREATE INDEX IF NOT EXISTS idx_tools_published_tagline_trgm
ON public.tools USING gin (tagline gin_trgm_ops)
WHERE status = 'published';

CREATE INDEX IF NOT EXISTS idx_tools_published_description_trgm
ON public.tools USING gin (description gin_trgm_ops)
WHERE status = 'published';

-- Refresh stats for the planner
ANALYZE public.tools;

