/* eslint-disable no-console */
/**
 * Normalize tool `categories` array to Chinese labels (avoid English-only category tags).
 *
 * Usage (PowerShell):
 * - Dry run:       `node scripts/normalize-tool-categories-zh.cjs`
 * - Apply updates: `$env:APPLY='1'; node scripts/normalize-tool-categories-zh.cjs`
 * - Limit:         `$env:LIMIT='50'; $env:APPLY='1'; node scripts/normalize-tool-categories-zh.cjs`
 */

const dotenv = require('dotenv');
const { createClient } = require('@supabase/supabase-js');

dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const APPLY = process.env.APPLY === '1' || process.env.APPLY === 'true';
const LIMIT = Number.isFinite(Number(process.env.LIMIT)) ? Number(process.env.LIMIT) : Infinity;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Missing env: VITE_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const CATEGORY_MAP = new Map([
  ['Computer Vision', '计算机视觉'],
  ['Object Detection', '目标检测'],
  ['Natural Language Processing', '自然语言处理'],
  ['Document AI', '文档智能'],
  ['Edge AI', '边缘智能'],
  ['Generative AI', '生成式人工智能'],
  ['Industrial Automation', '工业自动化'],
  ['AI for Engineering', '工程领域人工智能'],
  ['AI in Construction', '施工领域人工智能'],
  ['AI结构设计', '人工智能结构设计'],
]);

function normalizeCategories(categories) {
  if (!Array.isArray(categories)) return [];
  const out = [];
  for (const c of categories) {
    const s = String(c || '').trim();
    if (!s) continue;
    out.push(CATEGORY_MAP.get(s) || s);
  }
  return Array.from(new Set(out));
}

async function main() {
  console.log(`[cat-zh] mode=${APPLY ? 'APPLY' : 'DRY_RUN'} limit=${LIMIT}`);

  const { data, error } = await supabase
    .from('tools')
    .select('id,name,categories,status')
    .eq('status', 'published')
    .order('upvotes', { ascending: false })
    .limit(2000);

  if (error) throw error;

  const tools = Array.isArray(data) ? data : [];
  const target = tools.slice(0, Number.isFinite(LIMIT) ? LIMIT : tools.length);

  let updated = 0;
  for (const tool of target) {
    const prev = Array.isArray(tool.categories) ? tool.categories.map((x) => String(x)) : [];
    const next = normalizeCategories(prev);
    if (next.join('|') === prev.join('|')) continue;

    console.log(`[tool] ${tool.name} prev=${JSON.stringify(prev)} next=${JSON.stringify(next)}`);

    if (!APPLY) continue;

    const { error: updateError } = await supabase
      .from('tools')
      .update({ categories: next, updated_at: new Date().toISOString() })
      .eq('id', tool.id);

    if (updateError) {
      console.warn(`[cat-zh] update failed: ${tool.name} (${tool.id}) ${updateError.message}`);
      continue;
    }

    updated += 1;
  }

  console.log(`[cat-zh] done updated=${updated}/${target.length}`);
}

main().catch((err) => {
  console.error('[cat-zh] fatal:', err);
  process.exit(1);
});
