/**
 * 本地翻译脚本 - 直接翻译所有工具到英文
 * 运行方式: node scripts/translate-all-tools.mjs
 */

import { createClient } from '@supabase/supabase-js';

// 从 .env.local 读取配置
const SUPABASE_URL = 'https://bixljqdwkjuzftlpmgtb.supabase.co';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJpeGxqcWR3a2p1emZ0bHBtZ3RiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NDkxNzg3NSwiZXhwIjoyMDcwNDkzODc1fQ.sBkAjHucMdBRC62-0JEGuuVP7gCWRt8P4AI4xzvLp2Q';

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false }
});

function cleanText(value) {
  return String(value || '').replace(/\u00A0/g, ' ').replace(/\s+/g, ' ').trim();
}

function splitIntoChunks(text, maxLen = 1200) {
  const t = text.trim();
  if (!t) return [];
  if (t.length <= maxLen) return [t];

  const parts = [];
  const paragraphs = t.split(/\n{2,}/g).map(p => p.trim()).filter(Boolean);

  for (const p of paragraphs) {
    if (p.length <= maxLen) {
      parts.push(p);
      continue;
    }
    // Split long paragraphs by sentences
    const sentences = p.split(/(?<=[.!?。！？])\s+/g).map(s => s.trim()).filter(Boolean);
    let buf = '';
    for (const s of sentences) {
      const next = buf ? `${buf} ${s}` : s;
      if (next.length <= maxLen) {
        buf = next;
      } else {
        if (buf) parts.push(buf);
        buf = s.length <= maxLen ? s : s.slice(0, maxLen);
      }
    }
    if (buf) parts.push(buf);
  }
  return parts.filter(Boolean);
}

async function translateGoogle(text, target = 'en') {
  const url = new URL('https://translate.googleapis.com/translate_a/single');
  url.searchParams.set('client', 'gtx');
  url.searchParams.set('sl', 'auto');
  url.searchParams.set('tl', target);
  url.searchParams.set('dt', 't');
  url.searchParams.set('q', text);

  const res = await fetch(url.toString(), {
    headers: { 'User-Agent': 'Mozilla/5.0' }
  });

  if (!res.ok) {
    throw new Error(`Google Translate HTTP ${res.status}`);
  }

  const data = await res.json();
  const segs = Array.isArray(data) && Array.isArray(data[0]) ? data[0] : [];
  return segs.map(s => (Array.isArray(s) ? String(s[0] || '') : '')).join('');
}

async function translateToEn(text) {
  const t = cleanText(text);
  if (!t) return '';

  const chunks = splitIntoChunks(t, 1200);
  const out = [];

  for (const chunk of chunks) {
    const translated = await translateGoogle(chunk, 'en');
    out.push(translated);
    // Rate limiting - wait a bit between requests
    await new Promise(r => setTimeout(r, 200));
  }

  return cleanText(out.join('\n\n'));
}

async function main() {
  console.log('Starting translation process...\n');

  // 1. Get all published tools
  const { data: tools, error: toolsError } = await supabase
    .from('tools')
    .select('id, name, tagline, description, updated_at')
    .eq('status', 'published')
    .order('updated_at', { ascending: false });

  if (toolsError) {
    console.error('Error fetching tools:', toolsError);
    process.exit(1);
  }

  console.log(`Found ${tools.length} published tools\n`);

  // 2. Get existing translations
  const { data: existing, error: existingError } = await supabase
    .from('tool_translations')
    .select('tool_id, lang, source_updated_at')
    .eq('lang', 'en');

  if (existingError) {
    console.error('Error fetching existing translations:', existingError);
    process.exit(1);
  }

  const existingMap = new Map();
  for (const row of (existing || [])) {
    existingMap.set(row.tool_id, row);
  }

  console.log(`Already translated: ${existingMap.size} tools\n`);

  // 3. Find tools that need translation
  const needsTranslation = tools.filter(tool => {
    const prev = existingMap.get(tool.id);
    if (!prev) return true;
    // Also re-translate if source was updated
    const src = tool.updated_at || null;
    const translatedSrc = prev.source_updated_at || null;
    if (!translatedSrc) return true;
    if (!src) return false;
    return translatedSrc !== src;
  });

  console.log(`Tools needing translation: ${needsTranslation.length}\n`);

  if (needsTranslation.length === 0) {
    console.log('All tools are already translated!');
    return;
  }

  // 4. Translate in batches
  let translated = 0;
  let failed = 0;

  for (let i = 0; i < needsTranslation.length; i++) {
    const tool = needsTranslation[i];
    console.log(`[${i + 1}/${needsTranslation.length}] Translating: ${tool.name}`);

    try {
      // Translate tagline and description
      const taglineEn = tool.tagline ? await translateToEn(tool.tagline) : null;
      console.log(`  Tagline: ${taglineEn?.substring(0, 50)}...`);

      const descriptionEn = tool.description ? await translateToEn(tool.description) : null;
      console.log(`  Description: ${descriptionEn?.substring(0, 80)}...`);

      // Save to database
      const { error: upsertError } = await supabase
        .from('tool_translations')
        .upsert({
          tool_id: tool.id,
          lang: 'en',
          tagline: taglineEn,
          description: descriptionEn,
          source_updated_at: tool.updated_at,
          updated_at: new Date().toISOString()
        }, { onConflict: 'tool_id,lang' });

      if (upsertError) {
        console.error(`  Error saving: ${upsertError.message}`);
        failed++;
      } else {
        translated++;
        console.log(`  ✓ Saved (${translated}/${needsTranslation.length})`);
      }

      // Rate limiting
      await new Promise(r => setTimeout(r, 300));

    } catch (err) {
      console.error(`  ✗ Failed: ${err.message}`);
      failed++;

      // Wait longer on error (rate limit)
      await new Promise(r => setTimeout(r, 2000));
    }
  }

  console.log('\n========================================');
  console.log(`Translation complete!`);
  console.log(`  Total tools: ${tools.length}`);
  console.log(`  Already translated: ${existingMap.size}`);
  console.log(`  Newly translated: ${translated}`);
  console.log(`  Failed: ${failed}`);
  console.log('========================================');
}

main().catch(console.error);
