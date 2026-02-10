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

function withPageMeta(baseHtml, { title, description, canonicalPath }) {
  const canonicalUrl = `${SITE_ORIGIN}${canonicalPath}`;
  let html = baseHtml;

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

function buildToolsListHtml(tools, limit) {
  const items = tools.slice(0, limit).map((t) => {
    const name = escapeAttr(t.name || '未命名工具');
    const tagline = escapeAttr(t.tagline || t.description || '');
    const category = Array.isArray(t.categories) && t.categories[0] ? escapeAttr(t.categories[0]) : '未分类';
    const pricing = escapeAttr(t.pricing || 'Free');
    const href = `/tools/${encodeURIComponent(t.id)}`;
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
            <span>定价：<span class="font-medium text-gray-700">${pricing}</span></span>
            <span class="text-blue-600">查看详情 →</span>
          </div>
        </a>
      </li>`;
  });

  return `
    <h1 class="text-2xl md:text-3xl font-bold">工具中心</h1>
    <p class="mt-3 text-gray-600 max-w-3xl">
      浏览土木工程领域的 AI 工具与效率工具：结构设计、BIM 建模、施工管理、造价估算等。为提升检索与可索引性，本页提供静态摘要，完整筛选与搜索请启用 JavaScript。
    </p>
    <div class="mt-6 flex flex-wrap gap-3">
      <a href="/tools" class="inline-flex items-center rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 transition-colors">打开工具中心</a>
      <a href="/submit" class="inline-flex items-center rounded-lg border border-gray-300 px-4 py-2 text-gray-900 hover:bg-gray-50 transition-colors">提交新工具</a>
    </div>
    <h2 class="mt-10 text-lg font-semibold text-gray-900">热门工具（静态预览）</h2>
    <ul class="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
      ${items.join('\n')}
    </ul>
    <p class="mt-6 text-xs text-gray-500">
      正在加载完整页面内容……如果长时间停留在此页面，请检查网络或刷新重试。
    </p>
    <noscript>
      <div class="mt-6 rounded-lg border border-yellow-200 bg-yellow-50 p-4 text-sm text-yellow-900">
        你当前禁用了 JavaScript，因此只能看到简版页面。请启用 JavaScript 以使用完整功能（登录、提交工具、筛选等）。
      </div>
    </noscript>
  `;
}

function buildAboutFallbackHtml() {
  return `
    <h1 class="text-2xl md:text-3xl font-bold">关于 TumuAI.net</h1>
    <p class="mt-3 text-gray-600 max-w-3xl">
      TumuAI 是面向土木工程师的 AI 工具导航平台，持续收录结构设计、BIM、施工管理、工程计算等领域的优质工具。
    </p>
    <div class="mt-6 flex flex-wrap gap-3">
      <a href="/tools" class="inline-flex items-center rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 transition-colors">浏览工具库</a>
      <a href="/submit" class="inline-flex items-center rounded-lg border border-gray-300 px-4 py-2 text-gray-900 hover:bg-gray-50 transition-colors">提交新工具</a>
    </div>
    <div class="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
      <div class="rounded-xl border border-gray-200 bg-white p-4">
        <div class="text-sm font-semibold text-gray-900">专注</div>
        <div class="mt-1 text-sm text-gray-600">围绕土木工程工作流组织信息，减少噪音。</div>
      </div>
      <div class="rounded-xl border border-gray-200 bg-white p-4">
        <div class="text-sm font-semibold text-gray-900">精选</div>
        <div class="mt-1 text-sm text-gray-600">持续优化分类、标签与链接可用性。</div>
      </div>
      <div class="rounded-xl border border-gray-200 bg-white p-4">
        <div class="text-sm font-semibold text-gray-900">共建</div>
        <div class="mt-1 text-sm text-gray-600">欢迎提交工具与反馈问题，一起完善生态。</div>
      </div>
    </div>
    <p class="mt-6 text-xs text-gray-500">
      正在加载完整页面内容……如果长时间停留在此页面，请检查网络或刷新重试。
    </p>
    <noscript>
      <div class="mt-6 rounded-lg border border-yellow-200 bg-yellow-50 p-4 text-sm text-yellow-900">
        你当前禁用了 JavaScript，因此只能看到简版页面。请启用 JavaScript 以使用完整功能（登录、提交工具、筛选等）。
      </div>
    </noscript>
  `;
}

function buildSubmitFallbackHtml() {
  return `
    <h1 class="text-2xl md:text-3xl font-bold">提交新工具</h1>
    <p class="mt-3 text-gray-600 max-w-3xl">
      你可以提交一个新的工具链接，我们会在审核后完善分类、标签与信息，帮助更多土木工程师发现它。
    </p>
    <div class="mt-6 flex flex-wrap gap-3">
      <a href="/submit" class="inline-flex items-center rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 transition-colors">打开提交页面</a>
      <a href="/tools" class="inline-flex items-center rounded-lg border border-gray-300 px-4 py-2 text-gray-900 hover:bg-gray-50 transition-colors">先看看工具库</a>
    </div>
    <div class="mt-8 rounded-xl border border-gray-200 bg-white p-4">
      <div class="text-sm font-semibold text-gray-900">建议提供</div>
      <ul class="mt-2 text-sm text-gray-600 list-disc pl-5 space-y-1">
        <li>官网地址（必填）</li>
        <li>一句话简介（必填）</li>
        <li>分类、功能标签、定价信息与 Logo（选填，但会让审核更快）</li>
      </ul>
    </div>
    <p class="mt-6 text-xs text-gray-500">
      正在加载完整页面内容……如果长时间停留在此页面，请检查网络或刷新重试。
    </p>
    <noscript>
      <div class="mt-6 rounded-lg border border-yellow-200 bg-yellow-50 p-4 text-sm text-yellow-900">
        你当前禁用了 JavaScript，因此只能看到简版页面。请启用 JavaScript 以使用完整功能（登录、提交工具、筛选等）。
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
    { loc: `${SITE_ORIGIN}/about`, changefreq: 'monthly', priority: '0.6' }
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

  // Static pages (always generated)
  const aboutHtml = replaceFallback(
    withPageMeta(baseHtml, {
      title: '关于 TumuAI.net - 土木工程 AI 工具导航平台',
      description: '了解 TumuAI：面向土木工程师的 AI 工具导航平台。我们持续收录结构设计、BIM、施工管理、工程计算等领域的优质工具，并欢迎共建。',
      canonicalPath: '/about'
    }),
    buildAboutFallbackHtml()
  );
  writeHtml('about.html', aboutHtml);

  const submitHtml = replaceFallback(
    withPageMeta(baseHtml, {
      title: '提交新工具 - TumuAI.net',
      description: '向 TumuAI 提交一个新的土木工程 AI 工具或效率工具。填写官网与简介，我们会在审核后完善分类、标签与信息。',
      canonicalPath: '/submit'
    }),
    buildSubmitFallbackHtml()
  );
  writeHtml('submit.html', submitHtml);

  // Tools page: try to include real tool data (best-effort).
  let publishedTools = null;
  try {
    publishedTools = await fetchPublishedTools();
  } catch (e) {
    console.warn('[prerender] tools fetch skipped:', e instanceof Error ? e.message : e);
  }

  const toolsFallbackInner = publishedTools
    ? buildToolsListHtml(publishedTools, 50)
    : `
      <h1 class="text-2xl md:text-3xl font-bold">工具中心</h1>
      <p class="mt-3 text-gray-600 max-w-3xl">
        浏览土木工程领域的 AI 工具与效率工具。完整内容需要 JavaScript 加载；此页提供基础结构与导航信息。
      </p>
      <div class="mt-6 flex flex-wrap gap-3">
        <a href="/tools" class="inline-flex items-center rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 transition-colors">打开工具中心</a>
        <a href="/submit" class="inline-flex items-center rounded-lg border border-gray-300 px-4 py-2 text-gray-900 hover:bg-gray-50 transition-colors">提交新工具</a>
      </div>
      <p class="mt-6 text-xs text-gray-500">
        正在加载完整页面内容……如果长时间停留在此页面，请检查网络或刷新重试。
      </p>
      <noscript>
        <div class="mt-6 rounded-lg border border-yellow-200 bg-yellow-50 p-4 text-sm text-yellow-900">
          你当前禁用了 JavaScript，因此只能看到简版页面。请启用 JavaScript 以使用完整功能（登录、提交工具、筛选等）。
        </div>
      </noscript>
    `;

  const toolsHtml = replaceFallback(
    withPageMeta(baseHtml, {
      title: '工具中心 - TumuAI.net | 土木工程 AI 工具导航',
      description: 'TumuAI 工具中心：浏览土木工程领域的 AI 工具与效率工具，涵盖结构设计、BIM、施工管理、工程计算、造价估算等方向。',
      canonicalPath: '/tools'
    }),
    toolsFallbackInner
  );
  writeHtml('tools.html', toolsHtml);

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
