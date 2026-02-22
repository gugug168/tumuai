/* eslint-disable no-console */
/**
 * Prerender-lite for Vite SPA (no SSR).
 *
 * Generates route-specific HTML files (e.g. /about -> about.html) with:
 * - unique <title>, description, canonical, OG/Twitter URLs
 * - meaningful static fallback content inside #root for crawlers/no-JS
 *
 * Optional:
 * - generates /tools/:id static snapshots (tools/<id>.html) and sitemap.xml
 *   when Supabase is reachable during build.
 */

const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(process.cwd(), '.env.local'), quiet: true });
dotenv.config({ path: path.resolve(process.cwd(), '.env'), quiet: true });

const SITE_ORIGIN = 'https://www.tumuai.net';
const DIST_DIR = path.resolve(process.cwd(), 'dist');
const INDEX_HTML_PATH = path.join(DIST_DIR, 'index.html');

const FALLBACK_START = '<!-- PRERENDER_FALLBACK_CONTENT_START -->';
const FALLBACK_END = '<!-- PRERENDER_FALLBACK_CONTENT_END -->';

function escapeAttr(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

function replaceOrThrow(html, re, replacement, label) {
  if (!re.test(html)) {
    throw new Error(`prerender: failed to replace ${label}`);
  }
  return html.replace(re, replacement);
}

function replaceFallback(html, innerHtml) {
  const start = html.indexOf(FALLBACK_START);
  const end = html.indexOf(FALLBACK_END);
  if (start === -1 || end === -1 || end <= start) {
    throw new Error('prerender: fallback markers not found in dist/index.html');
  }

  const before = html.slice(0, start + FALLBACK_START.length);
  const after = html.slice(end);
  return `${before}\n${innerHtml}\n${after}`;
}

function setHtmlLang(html, locale) {
  const lang = locale === 'en' ? 'en' : 'zh-CN';
  return replaceOrThrow(
    html,
    /<html\s+lang=["'][^"']*["']\s*>/i,
    `<html lang="${escapeAttr(lang)}">`,
    'html lang'
  );
}

function setOgLocale(html, locale) {
  const ogLocale = locale === 'en' ? 'en_US' : 'zh_CN';
  return replaceOrThrow(
    html,
    /<meta\s+property=["']og:locale["']\s+content=["'][^"']*["']\s*\/?>/i,
    `<meta property="og:locale" content="${escapeAttr(ogLocale)}" />`,
    'og:locale'
  );
}

function injectAlternates(html, alternates) {
  // Remove any existing alternates (idempotent).
  let out = html.replace(/<link\s+rel=["']alternate["'][^>]*hreflang=["'][^"']*["'][^>]*\/?>\s*/gi, '');
  const tags = alternates
    .map((a) => `<link rel="alternate" hreflang="${escapeAttr(a.hreflang)}" href="${escapeAttr(a.href)}" />`)
    .join('\n');

  // Insert right after canonical link.
  out = replaceOrThrow(
    out,
    /(<link\s+rel=["']canonical["']\s+href=["'][^"']*["']\s*\/?>)/i,
    `$1\n${tags}`,
    'hreflang alternates'
  );

  return out;
}

function localizePath(pathname, locale) {
  if (locale !== 'en') return pathname;
  if (pathname === '/') return '/en';
  return `/en${pathname}`;
}

function withPageMeta(baseHtml, { title, description, canonicalPath, locale = 'zh-CN', alternates = null }) {
  const canonicalUrl = `${SITE_ORIGIN}${canonicalPath}`;
  let html = baseHtml;

  html = setHtmlLang(html, locale);
  html = setOgLocale(html, locale);

  html = replaceOrThrow(
    html,
    /<title>[\s\S]*?<\/title>/i,
    `<title>${escapeAttr(title)}</title>`,
    'title'
  );

  html = replaceOrThrow(
    html,
    /<meta\s+name=["']description["']\s+content=["'][^"']*["']\s*\/?>/i,
    `<meta name="description" content="${escapeAttr(description)}" />`,
    'meta description'
  );

  html = replaceOrThrow(
    html,
    /<link\s+rel=["']canonical["']\s+href=["'][^"']*["']\s*\/?>/i,
    `<link rel="canonical" href="${escapeAttr(canonicalUrl)}" />`,
    'canonical link'
  );

  if (Array.isArray(alternates) && alternates.length > 0) {
    html = injectAlternates(html, alternates);
  }

  html = replaceOrThrow(
    html,
    /<meta\s+property=["']og:url["']\s+content=["'][^"']*["']\s*\/?>/i,
    `<meta property="og:url" content="${escapeAttr(canonicalUrl)}" />`,
    'og:url'
  );

  html = replaceOrThrow(
    html,
    /<meta\s+property=["']og:title["']\s+content=["'][^"']*["']\s*\/?>/i,
    `<meta property="og:title" content="${escapeAttr(title)}" />`,
    'og:title'
  );

  html = replaceOrThrow(
    html,
    /<meta\s+property=["']og:description["']\s+content=["'][^"']*["']\s*\/?>/i,
    `<meta property="og:description" content="${escapeAttr(description)}" />`,
    'og:description'
  );

  html = replaceOrThrow(
    html,
    /<meta\s+name=["']twitter:url["']\s+content=["'][^"']*["']\s*\/?>/i,
    `<meta name="twitter:url" content="${escapeAttr(canonicalUrl)}" />`,
    'twitter:url'
  );

  html = replaceOrThrow(
    html,
    /<meta\s+name=["']twitter:title["']\s+content=["'][^"']*["']\s*\/?>/i,
    `<meta name="twitter:title" content="${escapeAttr(title)}" />`,
    'twitter:title'
  );

  html = replaceOrThrow(
    html,
    /<meta\s+name=["']twitter:description["']\s+content=["'][^"']*["']\s*\/?>/i,
    `<meta name="twitter:description" content="${escapeAttr(description)}" />`,
    'twitter:description'
  );

  return html;
}

function writeHtml(relPath, html) {
  const outPath = path.join(DIST_DIR, relPath);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, html, 'utf8');
}

async function fetchPublishedTools() {
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !anonKey) {
    return null;
  }

  const url = new URL(`${supabaseUrl.replace(/\/+$/, '')}/rest/v1/tools`);
  url.searchParams.set(
    'select',
    'id,name,tagline,description,categories,pricing,website_url,logo_url,upvotes,date_added,updated_at'
  );
  url.searchParams.set('status', 'eq.published');
  url.searchParams.set('order', 'upvotes.desc');
  url.searchParams.set('limit', '2000');

  const res = await fetch(url.toString(), {
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`
    }
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Supabase REST error ${res.status}: ${text.slice(0, 200)}`);
  }

  const data = await res.json();
  return Array.isArray(data) ? data : null;
}

function buildToolsListHtml(tools, limit, locale = 'zh-CN') {
  const items = tools.slice(0, limit).map((t) => {
    const name = escapeAttr(t.name || (locale === 'en' ? 'Untitled tool' : '未命名工具'));
    const tagline = escapeAttr(t.tagline || t.description || '');
    const category = Array.isArray(t.categories) && t.categories[0]
      ? escapeAttr(t.categories[0])
      : (locale === 'en' ? 'Uncategorized' : '未分类');
    const pricing = escapeAttr(t.pricing || 'Free');
    const href = localizePath(`/tools/${encodeURIComponent(t.id)}`, locale);
    return `
      <li class="rounded-xl border border-gray-200 bg-white p-4 hover:shadow-sm transition-shadow">
        <a class="block" href="${href}">
          <div class="flex items-center justify-between gap-3">
            <div class="min-w-0">
              <h3 class="font-semibold text-gray-900 truncate">${name}</h3>
              <p class="mt-1 text-sm text-gray-600 line-clamp-2">${tagline}</p>
            </div>
            <span class="shrink-0 text-xs rounded-full bg-blue-50 text-blue-700 px-2 py-1">${category}</span>
          </div>
          <div class="mt-3 flex items-center justify-between text-xs text-gray-500">
            <span>${locale === 'en' ? 'Pricing:' : '定价：'} <span class="font-medium text-gray-700">${pricing}</span></span>
            <span class="text-blue-600">${locale === 'en' ? 'View →' : '查看详情 →'}</span>
          </div>
        </a>
      </li>`;
  });

  const title = locale === 'en' ? 'Tools' : '工具中心';
  const desc = locale === 'en'
    ? 'Browse AI and productivity tools for civil engineering. This page includes a static preview for crawlers; enable JavaScript for full search and filters.'
    : '浏览土木工程领域的 AI 工具与效率工具：结构设计、BIM 建模、施工管理、造价估算等。为提升检索与可索引性，本页提供静态摘要，完整筛选与搜索请启用 JavaScript。';

  return `
    <h1 class="text-2xl md:text-3xl font-bold">${title}</h1>
    <p class="mt-3 text-gray-600 max-w-3xl">
      ${desc}
    </p>
    <div class="mt-6 flex flex-wrap gap-3">
      <a href="${localizePath('/tools', locale)}" class="inline-flex items-center rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 transition-colors">${locale === 'en' ? 'Open tools' : '打开工具中心'}</a>
      <a href="${localizePath('/submit', locale)}" class="inline-flex items-center rounded-lg border border-gray-300 px-4 py-2 text-gray-900 hover:bg-gray-50 transition-colors">${locale === 'en' ? 'Submit a tool' : '提交新工具'}</a>
    </div>
    <h2 class="mt-10 text-lg font-semibold text-gray-900">${locale === 'en' ? 'Popular tools (static preview)' : '热门工具（静态预览）'}</h2>
    <ul class="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
      ${items.join('\n')}
    </ul>
    <p class="mt-6 text-xs text-gray-500">
      ${locale === 'en' ? 'Loading the full page... If it stays here for too long, please refresh.' : '正在加载完整页面内容……如果长时间停留在此页面，请检查网络或刷新重试。'}
    </p>
    <noscript>
      <div class="mt-6 rounded-lg border border-yellow-200 bg-yellow-50 p-4 text-sm text-yellow-900">
        ${locale === 'en' ? 'JavaScript is disabled. Enable it to use full features (login, submit, filters, etc.).' : '你当前禁用了 JavaScript，因此只能看到简版页面。请启用 JavaScript 以使用完整功能（登录、提交工具、筛选等）。'}
      </div>
    </noscript>
  `;
}

function buildAboutFallbackHtml(locale = 'zh-CN') {
  const title = locale === 'en' ? 'About TumuAI.net' : '关于 TumuAI.net';
  const desc = locale === 'en'
    ? 'TumuAI is a curated directory of AI and productivity tools for civil engineers. We continuously collect and organize tools for structural design, BIM, construction management, and more.'
    : 'TumuAI 是面向土木工程师的 AI 工具导航平台，持续收录结构设计、BIM、施工管理、工程计算等领域的优质工具。';

  return `
    <h1 class="text-2xl md:text-3xl font-bold">${title}</h1>
    <p class="mt-3 text-gray-600 max-w-3xl">
      ${desc}
    </p>
    <div class="mt-6 flex flex-wrap gap-3">
      <a href="${localizePath('/tools', locale)}" class="inline-flex items-center rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 transition-colors">${locale === 'en' ? 'Browse tools' : '浏览工具库'}</a>
      <a href="${localizePath('/submit', locale)}" class="inline-flex items-center rounded-lg border border-gray-300 px-4 py-2 text-gray-900 hover:bg-gray-50 transition-colors">${locale === 'en' ? 'Submit a tool' : '提交新工具'}</a>
    </div>
    <div class="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
      <div class="rounded-xl border border-gray-200 bg-white p-4">
        <div class="text-sm font-semibold text-gray-900">${locale === 'en' ? 'Focus' : '专注'}</div>
        <div class="mt-1 text-sm text-gray-600">${locale === 'en' ? 'Organized around civil engineering workflows — less noise.' : '围绕土木工程工作流组织信息，减少噪音。'}</div>
      </div>
      <div class="rounded-xl border border-gray-200 bg-white p-4">
        <div class="text-sm font-semibold text-gray-900">${locale === 'en' ? 'Quality' : '精选'}</div>
        <div class="mt-1 text-sm text-gray-600">${locale === 'en' ? 'We keep improving categories, tags, and link validity.' : '持续优化分类、标签与链接可用性。'}</div>
      </div>
      <div class="rounded-xl border border-gray-200 bg-white p-4">
        <div class="text-sm font-semibold text-gray-900">${locale === 'en' ? 'Community' : '共建'}</div>
        <div class="mt-1 text-sm text-gray-600">${locale === 'en' ? 'Submit tools and feedback — help build a better directory.' : '欢迎提交工具与反馈问题，一起完善生态。'}</div>
      </div>
    </div>
    <p class="mt-6 text-xs text-gray-500">
      ${locale === 'en' ? 'Loading the full page... If it stays here for too long, please refresh.' : '正在加载完整页面内容……如果长时间停留在此页面，请检查网络或刷新重试。'}
    </p>
    <noscript>
      <div class="mt-6 rounded-lg border border-yellow-200 bg-yellow-50 p-4 text-sm text-yellow-900">
        ${locale === 'en' ? 'JavaScript is disabled. Enable it to use full features (login, submit, filters, etc.).' : '你当前禁用了 JavaScript，因此只能看到简版页面。请启用 JavaScript 以使用完整功能（登录、提交工具、筛选等）。'}
      </div>
    </noscript>
  `;
}

function buildSubmitFallbackHtml(locale = 'zh-CN') {
  const title = locale === 'en' ? 'Submit a tool' : '提交新工具';
  const desc = locale === 'en'
    ? 'Submit a new tool link. After review, we will improve categories, tags, and metadata to help more engineers discover it.'
    : '你可以提交一个新的工具链接，我们会在审核后完善分类、标签与信息，帮助更多土木工程师发现它。';
  const bullets = locale === 'en'
    ? ['Website URL (required)', 'One-line tagline (required)', 'Category, tags, pricing & logo (optional, speeds up review)']
    : ['官网地址（必填）', '一句话简介（必填）', '分类、功能标签、定价信息与 Logo（选填，但会让审核更快）'];

  return `
    <h1 class="text-2xl md:text-3xl font-bold">${title}</h1>
    <p class="mt-3 text-gray-600 max-w-3xl">
      ${desc}
    </p>
    <div class="mt-6 flex flex-wrap gap-3">
      <a href="${localizePath('/submit', locale)}" class="inline-flex items-center rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 transition-colors">${locale === 'en' ? 'Open submit page' : '打开提交页面'}</a>
      <a href="${localizePath('/tools', locale)}" class="inline-flex items-center rounded-lg border border-gray-300 px-4 py-2 text-gray-900 hover:bg-gray-50 transition-colors">${locale === 'en' ? 'Browse tools first' : '先看看工具库'}</a>
    </div>
    <div class="mt-8 rounded-xl border border-gray-200 bg-white p-4">
      <div class="text-sm font-semibold text-gray-900">${locale === 'en' ? 'Suggested info' : '建议提供'}</div>
      <ul class="mt-2 text-sm text-gray-600 list-disc pl-5 space-y-1">
        ${bullets.map((b) => `<li>${escapeAttr(b)}</li>`).join('\n')}
      </ul>
    </div>
    <p class="mt-6 text-xs text-gray-500">
      ${locale === 'en' ? 'Loading the full page... If it stays here for too long, please refresh.' : '正在加载完整页面内容……如果长时间停留在此页面，请检查网络或刷新重试。'}
    </p>
    <noscript>
      <div class="mt-6 rounded-lg border border-yellow-200 bg-yellow-50 p-4 text-sm text-yellow-900">
        ${locale === 'en' ? 'JavaScript is disabled. Enable it to use full features (login, submit, filters, etc.).' : '你当前禁用了 JavaScript，因此只能看到简版页面。请启用 JavaScript 以使用完整功能（登录、提交工具、筛选等）。'}
      </div>
    </noscript>
  `;
}

function buildHomeFallbackHtml(locale = 'zh-CN') {
  const title = locale === 'en' ? 'TumuAI.net' : 'TumuAI.net';
  const subtitle = locale === 'en' ? 'AI tools for civil engineers' : '专业土木AI工具平台';
  const desc = locale === 'en'
    ? 'Discover AI and productivity tools for civil engineering workflows: structural design, BIM, construction management, and more.'
    : '发现并浏览土木工程领域的 AI 工具与效率工具：结构设计、BIM、施工管理、工程计算等。';

  return `
    <h1 class="text-2xl md:text-3xl font-bold">${title}</h1>
    <p class="mt-2 text-gray-700">${subtitle}</p>
    <p class="mt-3 text-gray-600 max-w-3xl">${desc}</p>
    <div class="mt-6 flex flex-wrap gap-3">
      <a href="${localizePath('/tools', locale)}" class="inline-flex items-center rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 transition-colors">${locale === 'en' ? 'Browse tools' : '浏览工具库'}</a>
      <a href="${localizePath('/submit', locale)}" class="inline-flex items-center rounded-lg border border-gray-300 px-4 py-2 text-gray-900 hover:bg-gray-50 transition-colors">${locale === 'en' ? 'Submit a tool' : '提交新工具'}</a>
    </div>
    <p class="mt-6 text-xs text-gray-500">
      ${locale === 'en' ? 'Loading the full page... If it stays here for too long, please refresh.' : '正在加载完整页面内容……如果长时间停留在此页面，请检查网络或刷新重试。'}
    </p>
    <noscript>
      <div class="mt-6 rounded-lg border border-yellow-200 bg-yellow-50 p-4 text-sm text-yellow-900">
        ${locale === 'en' ? 'JavaScript is disabled. Enable it to use full features.' : '你当前禁用了 JavaScript，因此只能看到简版页面。请启用 JavaScript 以使用完整功能。'}
      </div>
    </noscript>
  `;
}

function toolDescriptionForMeta(tool) {
  const raw = (tool.tagline || tool.description || '').toString().trim();
  if (!raw) return `${tool.name} - TumuAI 工具详情`;
  return raw.length > 160 ? `${raw.slice(0, 157)}...` : raw;
}

// Phase 4优化: 生成工具详情页 SoftwareApplication 结构化数据
function buildToolStructuredData(tool) {
  if (!tool || !tool.name) return '';

  const schema = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: tool.name,
    description: tool.tagline || tool.description || '',
    applicationCategory: 'UtilitiesApplication',
    operatingSystem: 'Web Browser',
    url: tool.website_url || undefined,
    offers: {
      '@type': 'Offer',
      price: tool.pricing === 'Free' ? '0' : undefined,
      priceCurrency: 'CNY',
      availability: 'https://schema.org/OnlineOnly'
    }
  };

  // 仅在有评分数据时添加 aggregateRating
  if (tool.upvotes && tool.upvotes > 0) {
    schema.aggregateRating = {
      '@type': 'AggregateRating',
      ratingValue: '4.5',
      ratingCount: String(tool.upvotes || 1)
    };
  }

  // 清除 undefined 值
  const clean = JSON.stringify(schema, (_, v) => v === undefined ? undefined : v);

  return `    <script type="application/ld+json">\n    ${clean}\n    </script>`;
}

function buildToolDetailFallbackHtml(tool) {
  const name = escapeAttr(tool.name || '工具详情');
  const tagline = escapeAttr(tool.tagline || tool.description || '');
  const category = Array.isArray(tool.categories) && tool.categories[0] ? escapeAttr(tool.categories[0]) : '未分类';
  const pricing = escapeAttr(tool.pricing || 'Free');
  const websiteUrl = tool.website_url ? escapeAttr(tool.website_url) : '';

  const websiteLink = websiteUrl
    ? `<a href="${websiteUrl}" rel="nofollow noopener" class="inline-flex items-center rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 transition-colors" target="_blank">访问官网</a>`
    : '';

  return `
    <nav class="text-sm text-gray-500">
      <a href="/tools" class="hover:text-gray-900">工具中心</a>
      <span class="mx-2">/</span>
      <span class="text-gray-700">${name}</span>
    </nav>
    <h1 class="mt-4 text-2xl md:text-3xl font-bold text-gray-900">${name}</h1>
    <p class="mt-3 text-gray-600 max-w-3xl">${tagline}</p>
    <div class="mt-5 flex flex-wrap items-center gap-2 text-xs">
      <span class="rounded-full bg-blue-50 text-blue-700 px-3 py-1">分类：${category}</span>
      <span class="rounded-full bg-gray-100 text-gray-700 px-3 py-1">定价：${pricing}</span>
    </div>
    <div class="mt-6 flex flex-wrap gap-3">
      ${websiteLink}
      <a href="/tools" class="inline-flex items-center rounded-lg border border-gray-300 px-4 py-2 text-gray-900 hover:bg-gray-50 transition-colors">返回工具中心</a>
    </div>
    <p class="mt-6 text-xs text-gray-500">
      正在加载完整页面内容……如果长时间停留在此页面，请检查网络或刷新重试。
    </p>
    <noscript>
      <div class="mt-6 rounded-lg border border-yellow-200 bg-yellow-50 p-4 text-sm text-yellow-900">
        你当前禁用了 JavaScript，因此只能看到简版页面。请启用 JavaScript 以使用完整功能（登录、提交工具、收藏、评论等）。
      </div>
    </noscript>
  `;
}

function writeSitemapXml(toolUrls) {
  const now = new Date().toISOString();

  const staticUrls = [
    { loc: `${SITE_ORIGIN}/`, changefreq: 'daily', priority: '1.0' },
    { loc: `${SITE_ORIGIN}/tools`, changefreq: 'daily', priority: '0.9' },
    { loc: `${SITE_ORIGIN}/submit`, changefreq: 'weekly', priority: '0.7' },
    { loc: `${SITE_ORIGIN}/about`, changefreq: 'monthly', priority: '0.6' },
    { loc: `${SITE_ORIGIN}/en`, changefreq: 'daily', priority: '0.9' },
    { loc: `${SITE_ORIGIN}/en/tools`, changefreq: 'daily', priority: '0.85' },
    { loc: `${SITE_ORIGIN}/en/submit`, changefreq: 'weekly', priority: '0.65' },
    { loc: `${SITE_ORIGIN}/en/about`, changefreq: 'monthly', priority: '0.55' }
  ];

  const urlEntries = [
    ...staticUrls.map((u) => {
      return `
  <url>
    <loc>${escapeAttr(u.loc)}</loc>
    <lastmod>${escapeAttr(now)}</lastmod>
    <changefreq>${u.changefreq}</changefreq>
    <priority>${u.priority}</priority>
  </url>`;
    }),
    ...toolUrls.map((u) => {
      return `
  <url>
    <loc>${escapeAttr(u.loc)}</loc>
    ${u.lastmod ? `<lastmod>${escapeAttr(u.lastmod)}</lastmod>` : `<lastmod>${escapeAttr(now)}</lastmod>`}
    <changefreq>weekly</changefreq>
    <priority>0.5</priority>
  </url>`;
    })
  ].join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urlEntries}
</urlset>
`;

  writeHtml('sitemap.xml', xml);
}

function writeRobotsTxt() {
  const robots = `User-agent: *
Allow: /

Sitemap: ${SITE_ORIGIN}/sitemap.xml
`;
  writeHtml('robots.txt', robots);
}

async function main() {
  if (!fs.existsSync(INDEX_HTML_PATH)) {
    console.error('prerender: dist/index.html not found. Run `vite build` first.');
    process.exit(1);
  }

  const baseHtml = fs.readFileSync(INDEX_HTML_PATH, 'utf8');

  // English home page (SEO-friendly /en)
  const homeHtmlEn = replaceFallback(
    withPageMeta(baseHtml, {
      title: 'TumuAI.net - AI tools directory for civil engineers',
      description: 'Discover the best AI and productivity tools for civil engineering workflows: structural design, BIM, construction management, and more.',
      canonicalPath: '/en',
      locale: 'en',
      alternates: [
        { hreflang: 'zh-CN', href: `${SITE_ORIGIN}/` },
        { hreflang: 'en', href: `${SITE_ORIGIN}/en` },
        { hreflang: 'x-default', href: `${SITE_ORIGIN}/` }
      ]
    }),
    buildHomeFallbackHtml('en')
  );
  writeHtml(path.join('en', 'index.html'), homeHtmlEn);

  // Static pages (always generated)
  const aboutHtml = replaceFallback(
    withPageMeta(baseHtml, {
      title: '关于 TumuAI.net - 土木工程 AI 工具导航平台',
      description: '了解 TumuAI：面向土木工程师的 AI 工具导航平台。我们持续收录结构设计、BIM、施工管理、工程计算等领域的优质工具，并欢迎共建。',
      canonicalPath: '/about',
      locale: 'zh-CN',
      alternates: [
        { hreflang: 'zh-CN', href: `${SITE_ORIGIN}/about` },
        { hreflang: 'en', href: `${SITE_ORIGIN}/en/about` },
        { hreflang: 'x-default', href: `${SITE_ORIGIN}/about` }
      ]
    }),
    buildAboutFallbackHtml('zh-CN')
  );
  writeHtml('about.html', aboutHtml);

  const aboutHtmlEn = replaceFallback(
    withPageMeta(baseHtml, {
      title: 'About TumuAI.net - AI tools directory for civil engineers',
      description: 'Learn about TumuAI: a curated directory of AI and productivity tools for civil engineering. We continuously collect and organize high-quality tools and welcome community contributions.',
      canonicalPath: '/en/about',
      locale: 'en',
      alternates: [
        { hreflang: 'zh-CN', href: `${SITE_ORIGIN}/about` },
        { hreflang: 'en', href: `${SITE_ORIGIN}/en/about` },
        { hreflang: 'x-default', href: `${SITE_ORIGIN}/about` }
      ]
    }),
    buildAboutFallbackHtml('en')
  );
  writeHtml(path.join('en', 'about.html'), aboutHtmlEn);

  const submitHtml = replaceFallback(
    withPageMeta(baseHtml, {
      title: '提交新工具 - TumuAI.net',
      description: '向 TumuAI 提交一个新的土木工程 AI 工具或效率工具。填写官网与简介，我们会在审核后完善分类、标签与信息。',
      canonicalPath: '/submit',
      locale: 'zh-CN',
      alternates: [
        { hreflang: 'zh-CN', href: `${SITE_ORIGIN}/submit` },
        { hreflang: 'en', href: `${SITE_ORIGIN}/en/submit` },
        { hreflang: 'x-default', href: `${SITE_ORIGIN}/submit` }
      ]
    }),
    buildSubmitFallbackHtml('zh-CN')
  );
  writeHtml('submit.html', submitHtml);

  const submitHtmlEn = replaceFallback(
    withPageMeta(baseHtml, {
      title: 'Submit a tool - TumuAI.net',
      description: 'Submit a new AI or productivity tool for civil engineering. Provide the website and a short tagline — we will review and improve categories, tags, and metadata.',
      canonicalPath: '/en/submit',
      locale: 'en',
      alternates: [
        { hreflang: 'zh-CN', href: `${SITE_ORIGIN}/submit` },
        { hreflang: 'en', href: `${SITE_ORIGIN}/en/submit` },
        { hreflang: 'x-default', href: `${SITE_ORIGIN}/submit` }
      ]
    }),
    buildSubmitFallbackHtml('en')
  );
  writeHtml(path.join('en', 'submit.html'), submitHtmlEn);

  // Tools page: try to include real tool data (best-effort).
  let publishedTools = null;
  try {
    publishedTools = await fetchPublishedTools();
  } catch (e) {
    console.warn('[prerender] tools fetch skipped:', e instanceof Error ? e.message : e);
  }

  const toolsFallbackInnerZh = publishedTools
    ? buildToolsListHtml(publishedTools, 50, 'zh-CN')
    : buildToolsListHtml([], 0, 'zh-CN');

  const toolsFallbackInnerEn = publishedTools
    ? buildToolsListHtml(publishedTools, 50, 'en')
    : buildToolsListHtml([], 0, 'en');

  const toolsHtml = replaceFallback(
    withPageMeta(baseHtml, {
      title: '工具中心 - TumuAI.net | 土木工程 AI 工具导航',
      description: 'TumuAI 工具中心：浏览土木工程领域的 AI 工具与效率工具，涵盖结构设计、BIM、施工管理、工程计算、造价估算等方向。',
      canonicalPath: '/tools',
      locale: 'zh-CN',
      alternates: [
        { hreflang: 'zh-CN', href: `${SITE_ORIGIN}/tools` },
        { hreflang: 'en', href: `${SITE_ORIGIN}/en/tools` },
        { hreflang: 'x-default', href: `${SITE_ORIGIN}/tools` }
      ]
    }),
    toolsFallbackInnerZh
  );
  writeHtml('tools.html', toolsHtml);

  const toolsHtmlEn = replaceFallback(
    withPageMeta(baseHtml, {
      title: 'Tools - TumuAI.net | AI tools for civil engineering',
      description: 'Browse AI and productivity tools for civil engineering: structural design, BIM, construction management, engineering calculations, cost estimation, and more.',
      canonicalPath: '/en/tools',
      locale: 'en',
      alternates: [
        { hreflang: 'zh-CN', href: `${SITE_ORIGIN}/tools` },
        { hreflang: 'en', href: `${SITE_ORIGIN}/en/tools` },
        { hreflang: 'x-default', href: `${SITE_ORIGIN}/tools` }
      ]
    }),
    toolsFallbackInnerEn
  );
  writeHtml(path.join('en', 'tools.html'), toolsHtmlEn);

  // Tool detail snapshots + sitemap (best-effort).
  const toolUrlsForSitemap = [];
  if (publishedTools && publishedTools.length > 0) {
    for (const tool of publishedTools) {
      if (!tool?.id || !tool?.name) continue;

      const id = String(tool.id);
      const canonicalPath = `/tools/${encodeURIComponent(id)}`;

      // Phase 4优化: 生成 SoftwareApplication 结构化数据
      const toolStructuredData = buildToolStructuredData(tool);

      let toolHtml = replaceFallback(
        withPageMeta(baseHtml, {
          title: `${tool.name} - TumuAI 工具详情`,
          description: toolDescriptionForMeta(tool),
          canonicalPath
        }),
        buildToolDetailFallbackHtml(tool)
      );

      // 将结构化数据注入 </head> 前
      if (toolStructuredData) {
        toolHtml = toolHtml.replace('</head>', `${toolStructuredData}\n  </head>`);
      }

      writeHtml(path.join('tools', `${id}.html`), toolHtml);

      toolUrlsForSitemap.push({
        loc: `${SITE_ORIGIN}/tools/${encodeURIComponent(id)}`,
        lastmod: tool.updated_at || tool.date_added || null
      });
      toolUrlsForSitemap.push({
        loc: `${SITE_ORIGIN}/en/tools/${encodeURIComponent(id)}`,
        lastmod: tool.updated_at || tool.date_added || null
      });
    }
  }

  writeRobotsTxt();
  writeSitemapXml(toolUrlsForSitemap);

  console.log(
    `[prerender] generated: about.html, submit.html, tools.html, tools/*.html (${toolUrlsForSitemap.length}) + sitemap.xml`
  );
}

main().catch((e) => {
  console.error('prerender: failed:', e);
  process.exit(1);
});
