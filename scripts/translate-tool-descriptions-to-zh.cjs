/* eslint-disable no-console */
/**
 * Translate published tool `description` to Chinese (zh-CN) to avoid mixed Chinese/English.
 *
 * Default behavior:
 * - Only updates descriptions that contain significant English.
 *
 * Usage (PowerShell):
 * - Dry run:                 `node scripts/translate-tool-descriptions-to-zh.cjs`
 * - Apply updates:           `$env:APPLY='1'; node scripts/translate-tool-descriptions-to-zh.cjs`
 * - Limit:                   `$env:LIMIT='20'; $env:APPLY='1'; node scripts/translate-tool-descriptions-to-zh.cjs`
 * - Only tools with English: `$env:ONLY_IF_ENGLISH='1'; ...` (default)
 * - Specific IDs:            `$env:TOOL_IDS='id1,id2'; ...`
 * - Provider:                `$env:PROVIDER='google'` (default) or `libre`
 */

const dotenv = require('dotenv');
const { createClient } = require('@supabase/supabase-js');

dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const APPLY = process.env.APPLY === '1' || process.env.APPLY === 'true';
const LIMIT = Number.isFinite(Number(process.env.LIMIT)) ? Number(process.env.LIMIT) : Infinity;
const ONLY_IF_ENGLISH = process.env.ONLY_IF_ENGLISH === '0' ? false : true;
const PROVIDER = (process.env.PROVIDER || 'google').toLowerCase();
const TOOL_IDS = typeof process.env.TOOL_IDS === 'string' && process.env.TOOL_IDS.trim().length > 0
  ? process.env.TOOL_IDS.split(',').map((s) => s.trim()).filter(Boolean)
  : null;

const SLEEP_BETWEEN = Number.isFinite(Number(process.env.SLEEP_BETWEEN)) ? Number(process.env.SLEEP_BETWEEN) : 180;
const REMOVE_ENGLISH = process.env.REMOVE_ENGLISH === '0' ? false : true;
const MAX_FRAGMENT = Number.isFinite(Number(process.env.MAX_FRAGMENT)) ? Number(process.env.MAX_FRAGMENT) : 420;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Missing env: VITE_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function cleanText(s) {
  return String(s || '').replace(/\u00A0/g, ' ').replace(/\s+/g, ' ').trim();
}

function hasChinese(text) {
  return /[\u4e00-\u9fff]/.test(text);
}

function englishLetterCount(text) {
  const m = String(text || '').match(/[A-Za-z]/g);
  return m ? m.length : 0;
}

function significantEnglish(text) {
  const t = String(text || '');
  if (!t.trim()) return false;
  const letters = englishLetterCount(t);
  if (letters < 12) return false;
  const ratio = letters / Math.max(1, t.length);
  return ratio > 0.06 || /[A-Za-z]{6,}\s+[A-Za-z]{6,}/.test(t);
}

function postProcessZh(text, toolName) {
  let out = String(text || '').replace(/\r\n/g, '\n');
  // Normalize spacing/punctuation
  out = out.replace(/[ ]{2,}/g, ' ').trim();

  // Replace common acronyms with Chinese (to reduce leftover English).
  out = out
    .replace(/\bAI\b/g, '人工智能')
    .replace(/\bBIM\b/g, '建筑信息模型')
    .replace(/\bCAD\b/g, '计算机辅助设计')
    .replace(/\b3D\b/g, '三维')
    .replace(/\b2D\b/g, '二维')
    .replace(/\bAPI\b/g, '接口')
    .replace(/\bSaaS\b/gi, '软件服务');

  // Remove lingering "Access Denied" etc.
  out = out.replace(/Access Denied/gi, '访问受限');

  // Avoid translating the tool name if we protected it.
  if (toolName) {
    out = out.replaceAll('__TOOL_NAME__', toolName);
  }

  // Final cleanup: remove long pure-English lines (rare after translation)
  out = out
    .split('\n')
    .map((line) => {
      const l = line.trim();
      if (!l) return '';
      const letters = englishLetterCount(l);
      const ratio = letters / Math.max(1, l.length);
      if (ratio > 0.35 && !hasChinese(l)) return '';
      return l;
    })
    .filter(Boolean)
    .join('\n');

  // Ensure paragraph breaks
  out = out.replace(/\n{3,}/g, '\n\n').trim();

  if (REMOVE_ENGLISH) {
    // Strip remaining English words (keep numbers/punctuation).
    out = out
      .replace(/[A-Za-z]{3,}/g, '')
      .replace(/[ ]{2,}/g, ' ')
      .replace(/：\s*。/g, '。')
      .replace(/\(\s*\)/g, '')
      .trim();
  }

  return out;
}

function looksLikeUrl(text) {
  const t = String(text || '').trim();
  return /^https?:\/\//i.test(t) || t.includes('www.') || /[A-Za-z0-9.-]+\.[A-Za-z]{2,}/.test(t);
}

function extractEnglishFragments(text) {
  const t = String(text || '');
  const fragments = [];
  // Long-ish ASCII runs likely to be English marketing copy.
  const re = /([A-Za-z][A-Za-z0-9&@'’"“”\-\u2013\u2014,.:;!?()\/%+ ]{15,})/g;
  let m;
  while ((m = re.exec(t))) {
    const raw = m[1];
    const frag = raw.replace(/\s+/g, ' ').trim();
    if (!frag) continue;
    if (frag.length < 18) continue;
    if (looksLikeUrl(frag)) continue;
    // skip very short acronym-ish fragments
    const words = frag.split(' ').filter(Boolean);
    if (words.length < 2 && frag.length < 26) continue;
    fragments.push(frag);
  }
  return Array.from(new Set(fragments));
}

function splitEnglishFragment(fragment, maxLen) {
  const s = fragment.trim();
  if (s.length <= maxLen) return [s];
  const parts = [];
  let buf = '';
  const tokens = s.split(/(?<=[.!?;:])\s+|,\s+|\s+/g).filter(Boolean);
  for (const tok of tokens) {
    const next = buf ? `${buf} ${tok}` : tok;
    if (next.length <= maxLen) {
      buf = next;
    } else {
      if (buf) parts.push(buf);
      buf = tok.length <= maxLen ? tok : tok.slice(0, maxLen);
    }
  }
  if (buf) parts.push(buf);
  return parts;
}

async function translateGoogle(text) {
  const url = new URL('https://translate.googleapis.com/translate_a/single');
  url.searchParams.set('client', 'gtx');
  // Force English to ensure mixed Chinese sentences still translate embedded English fragments.
  url.searchParams.set('sl', 'en');
  url.searchParams.set('tl', 'zh-CN');
  url.searchParams.set('dt', 't');
  url.searchParams.set('q', text);

  const res = await fetch(url.toString(), {
    headers: { 'User-Agent': 'Mozilla/5.0' },
  });
  if (!res.ok) throw new Error(`google translate http ${res.status}`);
  const data = await res.json();
  // data[0] is array of translated segments: [[translated, original, ...], ...]
  const segs = Array.isArray(data) && Array.isArray(data[0]) ? data[0] : [];
  const out = segs.map((s) => (Array.isArray(s) ? String(s[0] || '') : '')).join('');
  return out;
}

async function translateLibre(text) {
  // Public LibreTranslate instances may rate-limit; this is best-effort.
  const endpoint = process.env.LIBRE_ENDPOINT || 'https://libretranslate.de/translate';
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      q: text,
      source: 'auto',
      target: 'zh',
      format: 'text',
    }),
  });
  if (!res.ok) throw new Error(`libre translate http ${res.status}`);
  const data = await res.json();
  return String(data.translatedText || '');
}

async function translateToZh(text) {
  if (PROVIDER === 'libre') return await translateLibre(text);
  return await translateGoogle(text);
}

async function main() {
  console.log(`[translate-zh] mode=${APPLY ? 'APPLY' : 'DRY_RUN'} provider=${PROVIDER} onlyIfEnglish=${ONLY_IF_ENGLISH} removeEnglish=${REMOVE_ENGLISH} limit=${LIMIT}`);

  let query = supabase
    .from('tools')
    .select('id,name,description,status')
    .eq('status', 'published')
    .order('upvotes', { ascending: false })
    .limit(2000);

  if (TOOL_IDS && TOOL_IDS.length > 0) {
    query = query.in('id', TOOL_IDS);
  }

  const { data, error } = await query;
  if (error) throw error;

  const tools = Array.isArray(data) ? data : [];
  const candidates = tools.filter((t) => {
    const desc = typeof t.description === 'string' ? t.description : '';
    if (!desc.trim()) return false;
    return ONLY_IF_ENGLISH ? significantEnglish(desc) : true;
  });
  const target = candidates.slice(0, Number.isFinite(LIMIT) ? LIMIT : candidates.length);

  console.log(`[translate-zh] published=${tools.length} candidates=${candidates.length} target=${target.length}`);
  if (target.length === 0) return;

  let updated = 0;
  let skipped = 0;
  let failed = 0;
  const translationCache = new Map();

  for (const tool of target) {
    const prev = String(tool.description || '').trim();
    const name = cleanText(tool.name || '');

    console.log(`\n[tool] ${name} (${tool.id}) prevLen=${prev.length}`);

    // Protect tool name to avoid odd translation, but only for replacement after translation.
    let working = prev;
    if (name) working = working.replaceAll(name, '__TOOL_NAME__');

    const fragments = extractEnglishFragments(working);
    if (fragments.length === 0) {
      skipped += 1;
      console.log('- skip: no English fragments found');
      continue;
    }

    try {
      for (const frag of fragments) {
        if (translationCache.has(frag)) continue;
        const fragParts = splitEnglishFragment(frag, MAX_FRAGMENT);
        const translatedParts = [];
        for (const part of fragParts) {
          const tr = await translateToZh(part);
          translatedParts.push(tr);
          await sleep(SLEEP_BETWEEN);
        }
        translationCache.set(frag, translatedParts.join(' ').replace(/\s+/g, ' ').trim());
      }
    } catch (e) {
      failed += 1;
      console.warn(`[translate-zh] translate failed: ${e instanceof Error ? e.message : String(e)}`);
      continue;
    }

    for (const frag of fragments) {
      const tr = translationCache.get(frag);
      if (typeof tr === 'string' && tr.trim()) {
        working = working.split(frag).join(tr);
      }
    }

    const next = postProcessZh(working, name);

    const nextLetters = englishLetterCount(next);
    const nextRatio = nextLetters / Math.max(1, next.length);
    console.log(`- nextLen=${next.length} letters=${nextLetters} ratio=${nextRatio.toFixed(3)}`);
    console.log(`- preview=${cleanText(next).slice(0, 90)}...`);

    if (!hasChinese(next) || next.length < 120) {
      skipped += 1;
      console.warn('[translate-zh] skip: translated text too short or missing Chinese');
      continue;
    }

    // Ensure we don't leave big English blocks.
    if (significantEnglish(next)) console.warn('[translate-zh] warning: still contains significant English after post-process');

    if (!APPLY) continue;

    const { error: updateError } = await supabase
      .from('tools')
      .update({ description: next, updated_at: new Date().toISOString() })
      .eq('id', tool.id);

    if (updateError) {
      failed += 1;
      console.warn(`[translate-zh] update failed: ${updateError.message}`);
      continue;
    }

    updated += 1;
  }

  console.log(`\n[translate-zh] done updated=${updated} skipped=${skipped} failed=${failed}`);
}

main().catch((err) => {
  console.error('[translate-zh] fatal:', err);
  process.exit(1);
});
