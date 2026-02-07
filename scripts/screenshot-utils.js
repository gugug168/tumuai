/**
 * Screenshot generation helpers (Playwright).
 *
 * Produces multiple distinct "regions" by scrolling the page and capturing the viewport.
 * This replaces the old thum.io approach which returned the same image for every region.
 */

const crypto = require('crypto');

function normalizeWebsiteUrl(raw) {
  const url = String(raw || '').trim();
  if (!url) return '';
  if (/^https?:\/\//i.test(url)) return url;
  return `https://${url}`;
}

function sha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

async function getScrollMetrics(page) {
  return await page.evaluate(() => {
    const doc = document.documentElement;
    const body = document.body;
    const scrollHeight = Math.max(
      doc?.scrollHeight || 0,
      body?.scrollHeight || 0,
      doc?.offsetHeight || 0,
      body?.offsetHeight || 0
    );
    const clientHeight = doc?.clientHeight || window.innerHeight || 0;
    return { scrollHeight, clientHeight };
  });
}

async function scrollToY(page, y) {
  await page.evaluate((yy) => window.scrollTo(0, yy), y);
}

async function captureViewportPng(page, y) {
  await scrollToY(page, y);
  await page.waitForTimeout(600);
  return await page.screenshot({ type: 'png' });
}

/**
 * Capture 4 region screenshots.
 * Returns raw PNG buffers in region order.
 */
async function captureRegionPngs(page, websiteUrl) {
  const url = normalizeWebsiteUrl(websiteUrl);
  if (!url) return null;

  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 });
  await page.waitForTimeout(1200);

  const viewport = page.viewportSize() || { width: 1200, height: 800 };
  const { scrollHeight, clientHeight } = await getScrollMetrics(page);
  const maxScroll = Math.max(0, scrollHeight - Math.min(clientHeight || viewport.height, viewport.height));

  const yHero = 0;
  const yFeatures = Math.round(maxScroll * 0.35);
  const yPricing = Math.round(maxScroll * 0.7);

  const hero = await captureViewportPng(page, yHero);
  const features = await captureViewportPng(page, yFeatures);
  const pricing = await captureViewportPng(page, yPricing);

  // Fullpage: capture the entire document when possible.
  await scrollToY(page, 0);
  await page.waitForTimeout(400);
  const fullpage = await page.screenshot({ type: 'png', fullPage: true });

  // If the page is too short and everything is identical, try alternative scroll fractions.
  const hashes = [hero, features, pricing].map(sha256);
  const unique = new Set(hashes).size;
  if (unique === 1 && maxScroll > 0) {
    const alt1 = await captureViewportPng(page, Math.round(maxScroll * 0.2));
    const alt2 = await captureViewportPng(page, Math.round(maxScroll * 0.5));
    const alt3 = await captureViewportPng(page, Math.round(maxScroll * 0.85));
    return { hero: alt1, features: alt2, pricing: alt3, fullpage };
  }

  return { hero, features, pricing, fullpage };
}

module.exports = {
  normalizeWebsiteUrl,
  sha256,
  captureRegionPngs,
};

