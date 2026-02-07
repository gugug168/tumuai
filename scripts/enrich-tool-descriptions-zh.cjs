/* eslint-disable no-console */
/**
 * Batch-enrich tool `description` with a Chinese long-form introduction.
 *
 * Why:
 * - Many tools have empty/too-short descriptions, hurting detail-page conversion.
 * - This script generates deterministic (non-LLM) Chinese copy based on existing fields.
 *
 * Usage:
 * - Dry run (default): `node scripts/enrich-tool-descriptions-zh.cjs`
 * - Apply updates:      `APPLY=1 node scripts/enrich-tool-descriptions-zh.cjs`
 * - Only fill empty:    `ONLY_EMPTY=1 APPLY=1 node scripts/enrich-tool-descriptions-zh.cjs`
 * - Limit tools:        `LIMIT=20 APPLY=1 node scripts/enrich-tool-descriptions-zh.cjs`
 * - Specific IDs:       `TOOL_IDS=id1,id2 APPLY=1 node scripts/enrich-tool-descriptions-zh.cjs`
 */

const dotenv = require('dotenv');
const { createClient } = require('@supabase/supabase-js');

dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const APPLY = process.env.APPLY === '1' || process.env.APPLY === 'true';
const ONLY_EMPTY = process.env.ONLY_EMPTY === '1' || process.env.ONLY_EMPTY === 'true';
const LIMIT = Number.isFinite(Number(process.env.LIMIT)) ? Number(process.env.LIMIT) : Infinity;
const MIN_LEN = Number.isFinite(Number(process.env.MIN_LEN)) ? Number(process.env.MIN_LEN) : 180;
const TOOL_IDS = typeof process.env.TOOL_IDS === 'string' && process.env.TOOL_IDS.trim().length > 0
  ? process.env.TOOL_IDS.split(',').map((s) => s.trim()).filter(Boolean)
  : null;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Missing env: VITE_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

function pricingLabel(pricing) {
  if (pricing === 'Free') return '免费';
  if (pricing === 'Freemium') return '免费增值';
  if (pricing === 'Trial') return '可试用';
  if (pricing === 'Paid') return '付费';
  return '未标注';
}

function firstCategory(categories) {
  return Array.isArray(categories) && categories.length > 0 ? String(categories[0] || '').trim() : '';
}

function normalizeList(list, limit) {
  if (!Array.isArray(list)) return [];
  const cleaned = list
    .map((v) => String(v || '').trim())
    .filter(Boolean);
  return Array.from(new Set(cleaned)).slice(0, limit);
}

function guessAudience(category) {
  const c = category || '';
  if (/BIM|建模/i.test(c)) return 'BIM 设计与建模人员';
  if (/结构|设计/i.test(c)) return '结构工程师与设计人员';
  if (/施工|进度|现场/i.test(c)) return '施工与现场管理人员';
  if (/造价|预算|清单/i.test(c)) return '造价/成本管理人员';
  if (/项目|协作|管理/i.test(c)) return '项目管理与协作团队';
  return '土木工程相关从业者';
}

function buildUseCases(category) {
  const c = category || '';
  if (/BIM|建模/i.test(c)) return ['建模效率提升', '构件信息整理', '协同与交付'];
  if (/结构|设计/i.test(c)) return ['方案比选与推演', '参数快速调整', '规范与校核辅助'];
  if (/施工|进度|现场/i.test(c)) return ['计划与进度跟踪', '现场沟通记录', '质量/安全检查辅助'];
  if (/造价|预算|清单/i.test(c)) return ['工程量与清单整理', '成本测算与对比', '报价/投标材料准备'];
  if (/项目|协作|管理/i.test(c)) return ['任务分解与跟踪', '跨角色协作', '项目资料沉淀'];
  return ['效率提升', '资料整理', '协作与交付'];
}

function toSentenceList(items) {
  const list = normalizeList(items, 6);
  if (list.length === 0) return '';
  if (list.length === 1) return list[0];
  if (list.length === 2) return `${list[0]}、${list[1]}`;
  return `${list.slice(0, -1).join('、')}和${list[list.length - 1]}`;
}

function generateZhDescription(tool) {
  const name = String(tool.name || '').trim() || '该工具';
  const tagline = String(tool.tagline || '')
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[。\.!?！？]+$/g, '')
    .replace(/。{2,}/g, '。');
  const category = firstCategory(tool.categories) || '工程效率';
  const audience = guessAudience(category);
  const pricing = pricingLabel(tool.pricing);

  const features = normalizeList(tool.features, 6);
  const useCases = buildUseCases(category);

  const p1 = tagline
    ? `${name} 是一款面向 ${audience} 的「${category}」工具，主打：${tagline}。它通常用于在真实项目流程中减少重复操作，把时间还给方案与决策。`
    : `${name} 是一款面向 ${audience} 的「${category}」工具，目标是在日常工作中提升效率与协作质量。`;

  const featureSentence = features.length > 0
    ? `在功能侧，常见亮点包括：${toSentenceList(features)}。`
    : `如果你希望从“搜集信息—整理输出—协同交付”这条链路上提速，这类工具通常会带来明显收益。`;

  const p2 = `适用场景：${useCases.join(' / ')}。${featureSentence}`;

  const p3 = `定价模式：${pricing}（以官网为准）。建议从一个小任务开始试用：先看「产品截图」了解界面，再用 1 个具体需求验证是否匹配你的工作流；确认有效后再逐步替换原有工具链。`;

  return [p1, p2, p3].join('\n\n').trim();
}

function shouldUpdateDescription(existing) {
  const text = typeof existing === 'string' ? existing.trim() : '';
  if (!text) return true;
  if (ONLY_EMPTY) return false;
  return text.length < MIN_LEN;
}

async function main() {
  console.log(`[desc-zh] mode=${APPLY ? 'APPLY' : 'DRY_RUN'} onlyEmpty=${ONLY_EMPTY} minLen=${MIN_LEN} limit=${LIMIT}`);

  let query = supabase
    .from('tools')
    .select('id,name,tagline,description,categories,features,pricing,website_url,status')
    .eq('status', 'published')
    .order('upvotes', { ascending: false })
    .limit(2000);

  if (TOOL_IDS && TOOL_IDS.length > 0) {
    query = query.in('id', TOOL_IDS);
  }

  const { data, error } = await query;
  if (error) throw error;

  const tools = Array.isArray(data) ? data : [];
  const candidates = tools.filter((t) => shouldUpdateDescription(t.description));
  const target = candidates.slice(0, Number.isFinite(LIMIT) ? LIMIT : candidates.length);

  console.log(`[desc-zh] published=${tools.length} candidates=${candidates.length} target=${target.length}`);
  if (target.length === 0) return;

  let updated = 0;
  for (const tool of target) {
    const next = generateZhDescription(tool);
    const prev = typeof tool.description === 'string' ? tool.description.trim() : '';

    console.log(`\n[tool] ${tool.name} (${tool.id})`);
    console.log(`- prevLen=${prev.length} nextLen=${next.length}`);
    console.log(`- preview=${next.slice(0, 80).replace(/\s+/g, ' ')}...`);

    if (!APPLY) continue;

    const { error: updateError } = await supabase
      .from('tools')
      .update({ description: next, updated_at: new Date().toISOString() })
      .eq('id', tool.id);

    if (updateError) {
      console.error(`[desc-zh] update failed: ${updateError.message}`);
      continue;
    }

    updated += 1;
  }

  console.log(`\n[desc-zh] done updated=${updated}/${target.length}`);
}

main().catch((err) => {
  console.error('[desc-zh] fatal:', err);
  process.exit(1);
});
