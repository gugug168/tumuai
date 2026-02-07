/* eslint-disable no-console */
/**
 * Enrich tool `description` by crawling the tool's official website and extracting:
 * - title / meta description
 * - headings (h1-h3)
 * - bullet points (li)
 * - pricing-related snippets
 *
 * This script is deterministic (no external LLM required). For Chinese sites, the output
 * becomes noticeably more specific because it reuses the official wording.
 *
 * Usage (PowerShell):
 * - Dry run:             `node scripts/enrich-tool-descriptions-from-site.cjs`
 * - Apply updates:       `$env:APPLY='1'; node scripts/enrich-tool-descriptions-from-site.cjs`
 * - Limit:               `$env:LIMIT='20'; $env:APPLY='1'; node scripts/enrich-tool-descriptions-from-site.cjs`
 * - Max pages per site:  `$env:MAX_PAGES='3'; ...`
 * - Only placeholder:    `$env:ONLY_PLACEHOLDER='1'; ...`
 * - Specific IDs:        `$env:TOOL_IDS='id1,id2'; ...`
 * - Timeouts (ms):       `$env:NAV_TIMEOUT='20000'; $env:WAIT_AFTER_NAV='600'; ...`
 */

const dotenv = require('dotenv');
const { createClient } = require('@supabase/supabase-js');
const { chromium } = require('playwright');

dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const APPLY = process.env.APPLY === '1' || process.env.APPLY === 'true';
const ONLY_PLACEHOLDER = process.env.ONLY_PLACEHOLDER === '1' || process.env.ONLY_PLACEHOLDER === 'true';
const LIMIT = Number.isFinite(Number(process.env.LIMIT)) ? Number(process.env.LIMIT) : Infinity;
const MAX_PAGES = Number.isFinite(Number(process.env.MAX_PAGES)) ? Math.max(1, Number(process.env.MAX_PAGES)) : 3;
const NAV_TIMEOUT = Number.isFinite(Number(process.env.NAV_TIMEOUT)) ? Number(process.env.NAV_TIMEOUT) : 20_000;
const WAIT_AFTER_NAV = Number.isFinite(Number(process.env.WAIT_AFTER_NAV)) ? Number(process.env.WAIT_AFTER_NAV) : 600;
const MIN_NEXT_LEN = Number.isFinite(Number(process.env.MIN_NEXT_LEN)) ? Number(process.env.MIN_NEXT_LEN) : 220;
const SLEEP_BETWEEN_SITES = Number.isFinite(Number(process.env.SLEEP_BETWEEN_SITES)) ? Number(process.env.SLEEP_BETWEEN_SITES) : 600;
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

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function uniq(items) {
  return Array.from(new Set(items));
}

function cleanText(s) {
  return String(s || '')
    .replace(/\u00A0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function looksBlocked(text) {
  const t = cleanText(text).toLowerCase();
  if (!t) return false;
  return (
    t.includes('access denied') ||
    t.includes('attention required') ||
    t.includes('just a moment') ||
    t.includes('captcha') ||
    t.includes('forbidden') ||
    t.includes('service unavailable') ||
    t.includes('please enable javascript') ||
    t.includes('验证') ||
    t.includes('访问受限') ||
    t.includes('请开启') ||
    t.includes('人机验证')
  );
}

function safeUrl(raw) {
  const v = String(raw || '').trim();
  if (!v) return null;
  try {
    return new URL(/^https?:\/\//i.test(v) ? v : `https://${v}`);
  } catch {
    return null;
  }
}

function isPlaceholderDescription(text) {
  const t = typeof text === 'string' ? text : '';
  if (!t.trim()) return true;
  // Matches the previous template we backfilled.
  return (
    t.includes('适用场景：') &&
    t.includes('定价模式：') &&
    t.includes('建议从一个小任务开始试用') &&
    t.includes('产品截图')
  );
}

function shouldUpdate(tool) {
  const desc = typeof tool.description === 'string' ? tool.description.trim() : '';
  if (!desc) return true;
  if (ONLY_PLACEHOLDER) return isPlaceholderDescription(desc);
  if (looksBlocked(desc)) return true;
  return desc.length < 220 || isPlaceholderDescription(desc);
}

function pricingLabel(pricing) {
  if (pricing === 'Free') return '免费';
  if (pricing === 'Freemium') return '免费增值';
  if (pricing === 'Trial') return '可试用';
  if (pricing === 'Paid') return '付费';
  return '';
}

function firstCategory(categories) {
  return Array.isArray(categories) && categories.length > 0 ? cleanText(categories[0]) : '';
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

function toInlineList(items, limit) {
  const list = uniq(items.map(cleanText)).filter(Boolean).slice(0, limit);
  if (list.length === 0) return '';
  if (list.length === 1) return list[0];
  if (list.length === 2) return `${list[0]}、${list[1]}`;
  return `${list.slice(0, -1).join('、')}和${list[list.length - 1]}`;
}

function pickTop(items, max, minLen = 6, maxLen = 60) {
  const out = [];
  const seen = new Set();
  for (const it of items) {
    const t = cleanText(it);
    if (!t) continue;
    if (t.length < minLen || t.length > maxLen) continue;
    // filter boilerplate
    if (looksBlocked(t)) continue;
    if (/cookie|隐私|条款|登录|注册|newsletter|subscribe|版权|©/i.test(t)) continue;
    const key = t.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(t);
    if (out.length >= max) break;
  }
  return out;
}

function buildDescription({ tool, extracted }) {
  const name = cleanText(tool.name) || '该工具';
  const category = firstCategory(tool.categories) || '工程效率';
  const audience = guessAudience(category);
  const tag = cleanText(tool.tagline || '');
  const officialMetaRaw = cleanText(extracted.metaDescription || '');
  const officialTitleRaw = cleanText(extracted.title || '');
  const officialMeta = looksBlocked(officialMetaRaw) ? '' : officialMetaRaw;
  const officialTitle = looksBlocked(officialTitleRaw) ? '' : officialTitleRaw;
  const hasOfficial = Boolean(officialMeta || officialTitle);
  const officialPitch = officialMeta || (officialTitle && officialTitle !== name ? officialTitle : '') || '';
  const fallbackPitch = tag || '';

  const headings = pickTop(extracted.headings || [], 10);
  const bullets = pickTop(extracted.bullets || [], 10);
  const pricingSnippets = pickTop(extracted.pricingSnippets || [], 6, 4, 90);

  const capabilityPool = uniq([...bullets, ...headings]);
  const capabilities = pickTop(capabilityPool, 6);

  const p1 = hasOfficial && officialPitch
    ? `${name} 是一款面向 ${audience} 的「${category}」工具。根据官网信息，它主要提供：${officialPitch}。`
    : fallbackPitch
      ? `${name} 是一款面向 ${audience} 的「${category}」工具。根据本站收录信息，它主要用于：${fallbackPitch}。`
      : `${name} 是一款面向 ${audience} 的「${category}」工具，用于提升日常工作效率与协作质量。`;

  const p2 = capabilities.length > 0
    ? `你可以用它来：${toInlineList(capabilities, 6)}。`
    : `你可以从截图与官网介绍快速判断它是否适配你的工作流，再决定是否深入试用。`;

  const useCaseHints = pickTop(headings.filter((h) => /方案|设计|建模|算量|审图|进度|质量|安全|成本|造价|协作|交付|文档|报告|分析|扫描|监测/i.test(h)), 4, 4, 40);
  const p3 = useCaseHints.length > 0
    ? `适用场景参考：${toInlineList(useCaseHints, 4)}。`
    : `适用场景参考：围绕「${category}」的典型工作环节（从输入资料到输出交付）做效率提升。`;

  const pricing = pricingLabel(tool.pricing);
  const pricingExtra = pricingSnippets.length > 0 ? `官网可能涉及：${toInlineList(pricingSnippets, 3)}。` : '';
  const p4 = `定价与账号：${pricing || '以官网为准'}。${pricingExtra}`.trim();

  const p5 = `上手建议：先看本页「产品截图」建立直观预期，然后用一个真实任务做验证（例如一次算量/一次审图/一份报告输出），确认节省的时间与产出质量后再纳入工具链。`;

  const text = [p1, p2, p3, p4, p5].join('\n\n').trim();
  return text.length >= MIN_NEXT_LEN ? text : '';
}

async function extractFromPage(page) {
  return await page.evaluate(() => {
    const text = (node) => (node && node.textContent ? node.textContent : '').replace(/\s+/g, ' ').trim();
    const pickMeta = (sel) => {
      const el = document.querySelector(sel);
      return el ? (el.getAttribute('content') || '').trim() : '';
    };

    const title = document.title || '';
    const metaDescription =
      pickMeta('meta[name=\"description\"]') ||
      pickMeta('meta[property=\"og:description\"]') ||
      pickMeta('meta[name=\"twitter:description\"]') ||
      '';

    const headings = Array.from(document.querySelectorAll('h1,h2,h3'))
      .map(text)
      .filter(Boolean)
      .slice(0, 60);

    const bullets = Array.from(document.querySelectorAll('main li, article li, section li'))
      .map(text)
      .filter(Boolean)
      .slice(0, 120);

    const pricingSnippets = Array.from(document.querySelectorAll('main, article, body'))
      .flatMap((root) => {
        const raw = text(root);
        const lines = raw.split(/[\n\r]+/).map((l) => l.trim()).filter(Boolean);
        return lines.filter((l) => /pricing|price|plan|free|trial|月|年|￥|\$|定价|价格|套餐|版本|计费/i.test(l)).slice(0, 40);
      })
      .slice(0, 80);

    const anchors = Array.from(document.querySelectorAll('a[href]'))
      .map((a) => ({
        href: a.getAttribute('href') || '',
        text: text(a),
      }))
      .filter((a) => a.href && !a.href.startsWith('#'))
      .slice(0, 2000);

    return { title, metaDescription, headings, bullets, pricingSnippets, anchors };
  });
}

function scoreNavLink(text) {
  const t = cleanText(text).toLowerCase();
  if (!t) return 0;
  const patterns = [
    /pricing|price|plans|plan|billing/i,
    /features|feature|product|solutions|use cases|case studies/i,
    /docs|documentation|help|guide/i,
    /about|company|team/i,
    /定价|价格|套餐|版本|计费/,
    /功能|特性|产品|解决方案|案例|使用场景/,
    /文档|帮助|指南|教程/,
    /关于|团队|公司/,
  ];
  for (let i = 0; i < patterns.length; i += 1) {
    if (patterns[i].test(t)) return 100 - i * 5;
  }
  return 1;
}

function buildCandidateUrls(baseUrl, anchors) {
  const origin = baseUrl.origin;

  const internal = [];
  for (const a of anchors || []) {
    try {
      const u = new URL(a.href, baseUrl.toString());
      if (u.origin !== origin) continue;
      // skip obvious auth/logout/share links
      if (/\/(login|signin|signup|register|logout)\b/i.test(u.pathname)) continue;
      if (/\b(mailto:|tel:)/i.test(a.href)) continue;
      internal.push({ url: u.toString(), score: scoreNavLink(a.text), text: a.text });
    } catch {
      // ignore
    }
  }

  // Always include homepage.
  const seeds = [{ url: baseUrl.toString(), score: 1000, text: 'home' }];

  // Add some common paths.
  const commonPaths = ['/features', '/feature', '/pricing', '/plans', '/plan', '/product', '/products', '/about', '/docs', '/documentation'];
  for (const p of commonPaths) {
    try {
      const u = new URL(p, baseUrl.toString());
      if (u.origin === origin) seeds.push({ url: u.toString(), score: 80, text: p });
    } catch {
      // ignore
    }
  }

  const merged = [...seeds, ...internal]
    .sort((a, b) => b.score - a.score)
    .map((x) => x.url);

  // unique and keep within MAX_PAGES (+1 for homepage already included, but dedupe handles it)
  return uniq(merged).slice(0, MAX_PAGES);
}

async function tryDismissBanners(page) {
  // Best-effort cookie/banner dismissal to access content.
  const texts = [
    'Accept', 'I agree', 'Agree', 'OK',
    '同意', '接受', '好的', '知道了', '继续', '允许全部', '全部接受',
  ];

  for (const t of texts) {
    try {
      const btn = page.getByRole('button', { name: t }).first();
      if (await btn.count()) {
        await btn.click({ timeout: 800 }).catch(() => {});
      }
    } catch {
      // ignore
    }
  }
}

async function crawlToolSite(page, websiteUrl) {
  const baseUrl = safeUrl(websiteUrl);
  if (!baseUrl) return null;

  const extracted = {
    title: '',
    metaDescription: '',
    headings: [],
    bullets: [],
    pricingSnippets: [],
  };

  // First visit base URL
  await page.goto(baseUrl.toString(), { waitUntil: 'domcontentloaded', timeout: NAV_TIMEOUT });
  await tryDismissBanners(page);
  await page.waitForTimeout(WAIT_AFTER_NAV);
  const first = await extractFromPage(page);

  const candidates = buildCandidateUrls(new URL(page.url()), first.anchors);
  const visited = new Set();

  for (const url of candidates) {
    if (visited.has(url)) continue;
    visited.add(url);

    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: NAV_TIMEOUT });
      await tryDismissBanners(page);
      await page.waitForTimeout(WAIT_AFTER_NAV);
      const data = await extractFromPage(page);

      extracted.title = extracted.title || data.title || '';
      extracted.metaDescription = extracted.metaDescription || data.metaDescription || '';
      extracted.headings.push(...(data.headings || []));
      extracted.bullets.push(...(data.bullets || []));
      extracted.pricingSnippets.push(...(data.pricingSnippets || []));
    } catch (e) {
      console.warn(`[crawl] skip url: ${url} (${e instanceof Error ? e.message : String(e)})`);
    }
  }

  extracted.headings = uniq(extracted.headings.map(cleanText)).filter(Boolean);
  extracted.bullets = uniq(extracted.bullets.map(cleanText)).filter(Boolean);
  extracted.pricingSnippets = uniq(extracted.pricingSnippets.map(cleanText)).filter(Boolean);

  return extracted;
}

async function main() {
  console.log(`[site-desc] mode=${APPLY ? 'APPLY' : 'DRY_RUN'} onlyPlaceholder=${ONLY_PLACEHOLDER} maxPages=${MAX_PAGES} navTimeout=${NAV_TIMEOUT} limit=${LIMIT}`);

  let query = supabase
    .from('tools')
    .select('id,name,tagline,description,website_url,categories,features,pricing,status')
    .eq('status', 'published')
    .order('upvotes', { ascending: false })
    .limit(2000);

  if (TOOL_IDS && TOOL_IDS.length > 0) {
    query = query.in('id', TOOL_IDS);
  }

  const { data, error } = await query;
  if (error) throw error;

  const tools = Array.isArray(data) ? data : [];
  const candidates = tools.filter(shouldUpdate).filter((t) => safeUrl(t.website_url));
  const target = candidates.slice(0, Number.isFinite(LIMIT) ? LIMIT : candidates.length);

  console.log(`[site-desc] published=${tools.length} candidates=${candidates.length} target=${target.length}`);
  if (target.length === 0) return;

  const browser = await chromium.launch({
    headless: true,
  });
  const context = await browser.newContext({
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 800 },
    locale: 'zh-CN',
    ignoreHTTPSErrors: true,
  });
  const page = await context.newPage();

  let updated = 0;
  let attempted = 0;

  try {
    for (const tool of target) {
      attempted += 1;
      const base = safeUrl(tool.website_url);
      if (!base) continue;

      console.log(`\n[tool] ${tool.name} (${tool.id})`);
      console.log(`- site=${base.origin}`);

      let extracted = null;
      try {
        extracted = await crawlToolSite(page, tool.website_url);
      } catch (e) {
        console.warn(`[crawl] failed: ${e instanceof Error ? e.message : String(e)}`);
      }

      if (!extracted) {
        console.log('- result=skip (no extracted data)');
        await sleep(SLEEP_BETWEEN_SITES);
        continue;
      }

      const next = buildDescription({ tool, extracted });
      const prev = typeof tool.description === 'string' ? tool.description.trim() : '';
      console.log(`- prevLen=${prev.length} nextLen=${next.length}`);
      console.log(`- sample=${cleanText(next).slice(0, 100)}...`);

      if (!next) {
        console.log('- result=skip (too short)');
        await sleep(SLEEP_BETWEEN_SITES);
        continue;
      }

      if (!APPLY) {
        await sleep(SLEEP_BETWEEN_SITES);
        continue;
      }

      const { error: updateError } = await supabase
        .from('tools')
        .update({ description: next, updated_at: new Date().toISOString() })
        .eq('id', tool.id);

      if (updateError) {
        console.warn(`[site-desc] update failed: ${updateError.message}`);
      } else {
        updated += 1;
      }

      await sleep(SLEEP_BETWEEN_SITES);
    }
  } finally {
    await page.close().catch(() => {});
    await context.close().catch(() => {});
    await browser.close().catch(() => {});
  }

  console.log(`\n[site-desc] done attempted=${attempted} updated=${updated}`);
}

main().catch((err) => {
  console.error('[site-desc] fatal:', err);
  process.exit(1);
});
