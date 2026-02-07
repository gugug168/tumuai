/* eslint-disable no-console */
/**
 * Final normalization pass to ensure tool descriptions are Chinese-only.
 * - Removes English letters (A-Z) from `tools.description`
 * - Normalizes a few common English category tokens
 * - Avoids repeating English tool names inside description (page header already shows name)
 *
 * Usage (PowerShell):
 * - Dry run:       `node scripts/normalize-tool-descriptions-zh-only.cjs`
 * - Apply updates: `$env:APPLY='1'; node scripts/normalize-tool-descriptions-zh-only.cjs`
 * - Limit:         `$env:LIMIT='50'; $env:APPLY='1'; node scripts/normalize-tool-descriptions-zh-only.cjs`
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

function cleanSpaces(s) {
  return String(s || '')
    .replace(/\u00A0/g, ' ')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function normalizePunctuation(s) {
  return String(s || '')
    .replace(/。。+/g, '。')
    .replace(/，，+/g, '，')
    .replace(/：\s*。/g, '。')
    .replace(/^\s*[，。:：-]+\s*/g, '')
    .trim();
}

function normalizeCategoryTokens(s) {
  return String(s || '')
    .replace(/Computer Vision/g, '计算机视觉')
    .replace(/\bML\b/g, '机器学习')
    .replace(/\bAI\b/g, '人工智能')
    .replace(/\bBIM\b/g, '建筑信息模型')
    .replace(/\bCAD\b/g, '计算机辅助设计')
    .replace(/\b3D\b/g, '三维')
    .replace(/\b2D\b/g, '二维')
    .replace(/\bAPI\b/g, '接口');
}

function stripEnglishLetters(s) {
  // Remove any remaining English letters to satisfy "中文为主且不夹杂英文" requirement.
  return String(s || '')
    .replace(/[A-Za-z]+/g, '')
    .replace(/[ ]{2,}/g, ' ')
    .trim();
}

function ensureChineseStart(s) {
  const t = String(s || '').trim();
  if (!t) return t;
  if (t.startsWith('是一款')) return `该工具${t}`;
  if (!/^[\u4e00-\u9fff]/.test(t)) return `该工具${t}`;
  return t;
}

function normalizeDescription({ name, description }) {
  const toolName = String(name || '').trim();
  let out = String(description || '').replace(/\r\n/g, '\n');

  // Avoid repeating English tool name inside the description.
  if (toolName && /[A-Za-z]/.test(toolName)) {
    out = out.replaceAll(toolName, '该工具');
  }

  out = normalizeCategoryTokens(out);
  out = stripEnglishLetters(out);
  out = cleanSpaces(out);
  out = normalizePunctuation(out);
  out = ensureChineseStart(out);

  return out;
}

async function main() {
  console.log(`[zh-only] mode=${APPLY ? 'APPLY' : 'DRY_RUN'} limit=${LIMIT}`);

  const { data, error } = await supabase
    .from('tools')
    .select('id,name,description,status')
    .eq('status', 'published')
    .order('upvotes', { ascending: false })
    .limit(2000);

  if (error) throw error;

  const tools = Array.isArray(data) ? data : [];
  const target = tools.slice(0, Number.isFinite(LIMIT) ? LIMIT : tools.length);

  let updated = 0;
  for (const tool of target) {
    const prev = String(tool.description || '').trim();
    if (!prev) continue;

    const next = normalizeDescription({ name: tool.name, description: prev });
    if (!next || next === prev) continue;

    const letters = (next.match(/[A-Za-z]/g) || []).length;
    if (letters !== 0) {
      console.warn(`[zh-only] still has letters after normalize: ${tool.name} (${tool.id}) letters=${letters}`);
    }

    console.log(`[tool] ${tool.name} prevLen=${prev.length} nextLen=${next.length}`);

    if (!APPLY) continue;

    const { error: updateError } = await supabase
      .from('tools')
      .update({ description: next, updated_at: new Date().toISOString() })
      .eq('id', tool.id);

    if (updateError) {
      console.warn(`[zh-only] update failed: ${tool.name} (${tool.id}) ${updateError.message}`);
      continue;
    }

    updated += 1;
  }

  console.log(`[zh-only] done updated=${updated}/${target.length}`);
}

main().catch((err) => {
  console.error('[zh-only] fatal:', err);
  process.exit(1);
});

