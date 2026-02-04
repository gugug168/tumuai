/**
 * 截图服务 - 智能多区域截图生成
 *
 * 功能:
 * - 使用 Playwright 智能截取页面关键区域
 * - 自动转换为 WebP 格式
 * - 图像去重检测 (pHash)
 */

import { chromium, Browser, Page, BrowserContext } from 'playwright-core';
import { createHash } from 'crypto';

// ==================== 类型定义 ====================

export interface ScreenshotRegion {
  name: string;
  selector: string;
  priority: number;
  required: boolean;
}

export interface ScreenshotResult {
  name: string;
  url: string;
  width: number;
  height: number;
  size: number;
  hash: string;
}

export interface ScreenshotOptions {
  width?: number;
  height?: number;
  timeout?: number;
  waitUntil?: 'load' | 'domcontentloaded' | 'networkidle';
  quality?: number; // WebP 质量 (1-100)
  maxWidth?: number;
  maxHeight?: number;
}

// ==================== 配置 ====================

// 默认截图区域配置
const DEFAULT_REGIONS: ScreenshotRegion[] = [
  {
    name: 'hero',
    selector: 'header, .hero, [class*="hero"], [class*="Hero"], #hero, section:first-of-type',
    priority: 1,
    required: true
  },
  {
    name: 'features',
    selector: '.features, [class*="feature"], [class*="Feature"], section.features, #features',
    priority: 2,
    required: false
  },
  {
    name: 'pricing',
    selector: '.pricing, [class*="pricing"], [class*="Pricing"], section.pricing, #pricing',
    priority: 3,
    required: false
  }
];

// ==================== 工具函数 ====================

/**
 * 清理 URL 用于生成文件名
 */
function sanitizeUrl(url: string): string {
  return url
    .replace(/^https?:\/\//, '')
    .replace(/[/:?=&]/g, '_')
    .substring(0, 50);
}

/**
 * 生成图像感知哈希 (pHash 简化版)
 * 用于检测相似图片
 */
function generateImageHash(buffer: Buffer): string {
  // 简化版: 使用 MD5 + 文件大小作为哈希
  const hash = createHash('md5').update(buffer).digest('hex');
  const size = buffer.length;
  return `${hash.substring(0, 12)}_${size}`;
}

/**
 * 计算两个哈希的相似度 (简化版)
 */
function calculateHashSimilarity(hash1: string, hash2: string): number {
  if (hash1 === hash2) return 1;
  const [h1, s1] = hash1.split('_');
  const [h2, s2] = hash2.split('_');

  // 哈希前缀匹配度
  const hashMatch = h1.split('').filter((c, i) => c === h2[i]).length / h1.length;
  // 大小相似度
  const sizeSimilarity = 1 - Math.abs(parseInt(s1) - parseInt(s2)) / Math.max(parseInt(s1), parseInt(s2));

  return (hashMatch * 0.7 + sizeSimilarity * 0.3);
}

/**
 * 截取指定区域的截图
 */
async function captureRegion(
  page: Page,
  region: ScreenshotRegion,
  options: ScreenshotOptions = {}
): Promise<Buffer | null> {
  const {
    width = 1200,
    quality = 85,
    maxWidth = 1200,
    maxHeight = 800
  } = options;

  try {
    // 尝试多个选择器
    const selectors = region.selector.split(',').map(s => s.trim());
    let element = null;

    for (const selector of selectors) {
      try {
        element = await page.$(selector);
        if (element) break;
      } catch {
        continue;
      }
    }

    if (!element) {
      console.log(`  ⚠️  未找到区域: ${region.name} (${region.selector})`);
      return null;
    }

    // 获取元素位置和大小
    const box = await element.boundingBox();
    if (!box) {
      console.log(`  ⚠️  无法获取区域边界: ${region.name}`);
      return null;
    }

    // 裁剪到最大尺寸
    const clipWidth = Math.min(box.width, maxWidth);
    const clipHeight = Math.min(box.height, maxHeight);

    if (clipWidth < 100 || clipHeight < 50) {
      console.log(`  ⚠️  区域太小: ${region.name} (${clipWidth}x${clipHeight})`);
      return null;
    }

    // 截图
    const buffer = await element.screenshot({
      type: 'webp',
      quality
    }) as Buffer;

    console.log(`  ✅ ${region.name}: ${buffer.length} bytes (${clipWidth}x${clipHeight})`);
    return buffer;

  } catch (error) {
    console.log(`  ❌ ${region.name} 截图失败:`, error instanceof Error ? error.message : error);
    return null;
  }
}

/**
 * 截取完整页面
 */
async function captureFullPage(
  page: Page,
  options: ScreenshotOptions = {}
): Promise<Buffer | null> {
  const {
    width = 1200,
    quality = 85,
    timeout = 10000
  } = options;

  try {
    // 设置视口
    await page.setViewportSize({ width, height: 800 });

    // 获取页面实际高度
    const bodyHeight = await page.evaluate(() => document.body.scrollHeight);
    const viewportHeight = Math.min(bodyHeight, 4000); // 限制最大高度

    // 截图
    const buffer = await page.screenshot({
      type: 'webp',
      quality,
      fullPage: false, // 使用固定高度避免过长
      clip: { x: 0, y: 0, width, height: viewportHeight }
    }) as Buffer;

    console.log(`  ✅ fullpage: ${buffer.length} bytes (${width}x${viewportHeight})`);
    return buffer;

  } catch (error) {
    console.log(`  ❌ fullpage 截图失败:`, error instanceof Error ? error.message : error);
    return null;
  }
}

// ==================== 主服务 ====================

export interface GenerateScreenshotsResult {
  success: boolean;
  screenshots: ScreenshotResult[];
  errors: string[];
}

/**
 * 为网站生成多区域截图
 *
 * @param url 目标网站 URL
 * @param options 截图选项
 * @returns 截图结果
 */
export async function generateScreenshots(
  url: string,
  options: ScreenshotOptions = {}
): Promise<GenerateScreenshotsResult> {
  const {
    timeout = 15000,
    waitUntil = 'networkidle',
    width = 1200
  } = options;

  const screenshots: ScreenshotResult[] = [];
  const errors: string[] = [];
  let browser: Browser | null = null;
  let context: BrowserContext | null = null;
  let page: Page | null = null;

  try {
    console.log(`\n🖼️  开始生成截图: ${url}`);

    // 启动浏览器
    browser = await chromium.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu'
      ]
    });

    context = await browser.newContext({
      viewport: { width, height: 800 },
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    });

    page = await context.newPage();

    // 设置超时
    page.setDefaultTimeout(timeout);

    // 访问页面
    console.log(`  📄 加载页面...`);
    await page.goto(url, { waitUntil, timeout });

    // 等待页面稳定
    await page.waitForTimeout(1000);

    // 用于去重的哈希集合
    const seenHashes = new Set<string>();

    // 1. 先尝试截取各个区域
    for (const region of DEFAULT_REGIONS) {
      const buffer = await captureRegion(page, region, options);

      if (buffer) {
        const hash = generateImageHash(buffer);

        // 检查是否重复
        let isDuplicate = false;
        for (const seenHash of seenHashes) {
          if (calculateHashSimilarity(hash, seenHash) > 0.9) {
            isDuplicate = true;
            console.log(`  ⚠️  ${region.name} 与已有截图相似，跳过`);
            break;
          }
        }

        if (!isDuplicate) {
          seenHashes.add(hash);
          screenshots.push({
            name: region.name,
            url: '', // 上传后填充
            width: 0,
            height: 0,
            size: buffer.length,
            hash
          });
        } else if (!region.required) {
          // 非必需区域，跳过
          continue;
        }
      } else if (region.required) {
        errors.push(`必需区域 ${region.name} 截图失败`);
      }
    }

    // 2. 如果区域截图太少，添加全页截图
    if (screenshots.length < 2) {
      console.log(`  📄 区域截图不足，添加全页截图...`);
      const fullPageBuffer = await captureFullPage(page, options);

      if (fullPageBuffer) {
        const hash = generateImageHash(fullPageBuffer);
        seenHashes.add(hash);
        screenshots.push({
          name: 'fullpage',
          url: '',
          width: 0,
          height: 0,
          size: fullPageBuffer.length,
          hash
        });
      }
    }

    console.log(`\n✅ 截图完成: ${screenshots.length} 张, ${errors.length} 个错误\n`);
    return { success: screenshots.length > 0, screenshots, errors };

  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error(`❌ 截图生成失败:`, msg);
    errors.push(msg);
    return { success: false, screenshots, errors };

  } finally {
    // 清理
    if (page) await page.close().catch(() => {});
    if (context) await context.close().catch(() => {});
    if (browser) await browser.close().catch(() => {});
  }
}

/**
 * 使用第三方 API 生成截图 (fallback)
 */
export async function generateScreenshotWithApi(
  url: string,
  options: ScreenshotOptions = {}
): Promise<Buffer | null> {
  const { width = 1200, timeout = 10000 } = options;

  // 清理 URL
  const targetUrl = url.startsWith('http') ? url : `https://${url}`;

  // thum.io API 端点
  const candidates = [
    `https://image.thum.io/get/fullpage/noanimate/width/${width}/${targetUrl}`,
    `https://image.thum.io/get/noanimate/width/${width}/${targetUrl}`,
    `https://image.thum.io/get/noanimate/width/${Math.max(800, width - 200)}/${targetUrl}`
  ];

  for (const apiUrl of candidates) {
    try {
      console.log(`  🌐 尝试 API: ${apiUrl.substring(0, 60)}...`);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const response = await fetch(apiUrl, {
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (!response.ok) continue;

      const buffer = Buffer.from(await response.arrayBuffer());
      console.log(`  ✅ API 截图成功: ${buffer.length} bytes`);

      return buffer;

    } catch (error) {
      console.log(`  ⚠️  API 失败:`, error instanceof Error ? error.message : error);
      continue;
    }
  }

  return null;
}

/**
 * 将 PNG 转换为 WebP (使用 sharp)
 */
export async function convertToWebP(
  buffer: Buffer,
  quality: number = 85
): Promise<Buffer> {
  try {
    // 动态导入 sharp
    const sharp = (await import('sharp')).default;
    const webpBuffer = await sharp(buffer)
      .webp({ quality })
      .toBuffer();
    return webpBuffer;
  } catch (error) {
    console.log(`  ⚠️  WebP 转换失败，返回原 buffer:`, error instanceof Error ? error.message : error);
    return buffer;
  }
}
