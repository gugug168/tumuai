/**
 * Logo 提取 API
 * 专门用于从网站提取高质量图标
 *
 * 支持操作:
 * - extract_single: 提取单个网站图标
 * - extract_batch: 批量提取图标
 * - validate_logo: 验证图标 URL
 */

import { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

// 初始化 Supabase 客户端 (使用 service role 绕过 RLS)
const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

/**
 * CORS 配置
 */
function setCORSHeaders(res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

/**
 * 带超时的 fetch
 */
async function fetchWithTimeout(url: string, options: RequestInit = {}, timeoutMs: number = 10000): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

/**
 * 图标候选接口
 */
interface LogoCandidate {
  url: string;
  type: string;
  quality: number;
}

/**
 * 解析 HTML 提取图标候选
 */
function extractLogoCandidates(html: string, baseUrl: string): LogoCandidate[] {
  const candidates: LogoCandidate[] = [];
  const base = new URL(baseUrl);

  // 匹配 link 标签
  const linkRegex = /<link\s+([^>]*?)>/gi;
  let match;

  while ((match = linkRegex.exec(html)) !== null) {
    const linkAttrs = match[1];
    const relMatch = linkAttrs.match(/rel=["']([^"']+)["']/i);
    const hrefMatch = linkAttrs.match(/href=["']([^"']+)["']/i);
    const sizesMatch = linkAttrs.match(/sizes=["']([^"']+)["']/i);
    const typeMatch = linkAttrs.match(/type=["']([^"']+)["']/i);

    if (!relMatch || !hrefMatch) continue;

    const rel = relMatch[1].toLowerCase();
    let href = hrefMatch[1];

    // 转换为绝对 URL
    if (!href.startsWith('http') && !href.startsWith('//')) {
      try {
        href = new URL(href, base.origin).href;
      } catch {
        continue;
      }
    } else if (href.startsWith('//')) {
      href = base.protocol + href;
    }

    // 只处理图标相关的 link
    const iconRels = ['icon', 'shortcut icon', 'apple-touch-icon', 'mask-icon', 'fluid-icon'];
    if (!iconRels.some(r => rel.includes(r))) continue;

    // 计算质量分数
    let quality = 50;
    let logoType = 'icon';

    if (rel.includes('apple-touch-icon')) {
      quality = 95;
      logoType = 'apple-touch-icon';
    } else if (typeMatch && typeMatch[1].includes('svg')) {
      quality = 100;
      logoType = 'svg';
    } else if (href.endsWith('.svg')) {
      quality = 100;
      logoType = 'svg';
    } else if (sizesMatch) {
      const size = parseInt(sizesMatch[1].split('x')[0]);
      quality = 60 + Math.min(size / 10, 30);
      logoType = 'sized-icon';
    } else if (href.endsWith('.png')) {
      quality = 75;
    }

    candidates.push({
      url: href,
      type: logoType,
      quality
    });
  }

  // 匹配 og:image
  const ogImageMatch = html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i);
  if (ogImageMatch) {
    let ogImage = ogImageMatch[1];
    if (!ogImage.startsWith('http') && !ogImage.startsWith('//')) {
      try {
        ogImage = new URL(ogImage, base.origin).href;
      } catch {
        // skip
      }
    } else if (ogImage.startsWith('//')) {
      ogImage = base.protocol + ogImage;
    }
    candidates.push({
      url: ogImage,
      type: 'og-image',
      quality: 70
    });
  }

  // 按质量排序
  return candidates.sort((a, b) => b.quality - a.quality);
}

/**
 * 从网站提取图标 URL
 */
async function extractLogoFromWebsite(websiteUrl: string): Promise<string | null> {
  console.log('🔍 提取网站图标:', websiteUrl);

  try {
    const url = new URL(websiteUrl.startsWith('http') ? websiteUrl : `https://${websiteUrl}`);
    const origin = url.origin;

    // 抓取 HTML
    const response = await fetchWithTimeout(origin, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html'
      }
    }, 10000);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const html = await response.text();

    // 提取图标候选
    const candidates = extractLogoCandidates(html, origin);

    if (candidates.length === 0) {
      // 使用备用服务
      return `https://cdn2.iconhorse.com/icons/${url.hostname}.png`;
    }

    // 按优先级验证并返回
    for (const candidate of candidates) {
      try {
        // 使用 no-cors 模式验证
        await fetchWithTimeout(candidate.url, { method: 'HEAD', mode: 'no-cors' }, 5000);
        console.log(`✅ 找到图标: ${candidate.type} - ${candidate.url}`);
        return candidate.url;
      } catch {
        continue;
      }
    }

    // 所有候选失败，使用备用
    return `https://cdn2.iconhorse.com/icons/${url.hostname}.png`;

  } catch (error) {
    console.error('❌ 提取图标失败:', error);
    return null;
  }
}

/**
 * 验证图标 URL
 */
async function validateLogoUrl(logoUrl: string): Promise<boolean> {
  try {
    await fetchWithTimeout(logoUrl, { method: 'HEAD', mode: 'no-cors' }, 5000);
    return true;
  } catch {
    return false;
  }
}

/**
 * 更新工具的 logo_url
 */
async function updateToolLogo(toolId: string, logoUrl: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('tools')
      .update({ logo_url: logoUrl, updated_at: new Date().toISOString() })
      .eq('id', toolId);

    if (error) {
      console.error('❌ 更新工具图标失败:', error);
      return false;
    }

    console.log('✅ 工具图标已更新:', toolId);
    return true;
  } catch (error) {
    console.error('❌ 更新工具图标异常:', error);
    return false;
  }
}

/**
 * API 主处理函数
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // 处理 CORS 预检请求
  setCORSHeaders(res);
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // 仅允许 POST 请求
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { action, toolId, websiteUrl, toolIds } = req.body;

  try {
    switch (action) {
      case 'extract_single': {
        // 提取单个网站图标并更新到工具
        if (!toolId || !websiteUrl) {
          return res.status(400).json({ error: 'toolId and websiteUrl are required' });
        }

        const logoUrl = await extractLogoFromWebsite(websiteUrl);

        if (!logoUrl) {
          return res.status(500).json({ error: 'Failed to extract logo' });
        }

        // 更新工具的 logo_url
        const updated = await updateToolLogo(toolId, logoUrl);

        if (!updated) {
          return res.status(500).json({ error: 'Failed to update tool logo' });
        }

        return res.json({
          success: true,
          logoUrl,
          toolId
        });
      }

      case 'extract_from_url': {
        // 仅提取，不更新 (用于预览)
        if (!websiteUrl) {
          return res.status(400).json({ error: 'websiteUrl is required' });
        }

        const logoUrl = await extractLogoFromWebsite(websiteUrl);

        if (!logoUrl) {
          return res.status(500).json({ error: 'Failed to extract logo' });
        }

        return res.json({
          success: true,
          logoUrl
        });
      }

      case 'extract_batch': {
        // 批量提取图标
        if (!toolIds || !Array.isArray(toolIds) || toolIds.length === 0) {
          return res.status(400).json({ error: 'toolIds is required' });
        }

        // 限制批量数量
        const ids = toolIds.slice(0, 50);

        // 获取工具列表
        const { data: tools, error: fetchError } = await supabase
          .from('tools')
          .select('id, website_url')
          .in('id', ids);

        if (fetchError) {
          return res.status(500).json({ error: 'Failed to fetch tools' });
        }

        if (!tools || tools.length === 0) {
          return res.json({ success: true, updated: 0, results: [] });
        }

        const results: Array<{ toolId: string; websiteUrl: string; logoUrl?: string; error?: string }> = [];
        let updatedCount = 0;

        for (const tool of tools) {
          try {
            const logoUrl = await extractLogoFromWebsite(tool.website_url);

            if (logoUrl) {
              const updated = await updateToolLogo(tool.id, logoUrl);
              if (updated) updatedCount++;

              results.push({
                toolId: tool.id,
                websiteUrl: tool.website_url,
                logoUrl
              });
            } else {
              results.push({
                toolId: tool.id,
                websiteUrl: tool.website_url,
                error: 'Failed to extract logo'
              });
            }
          } catch (error) {
            results.push({
              toolId: tool.id,
              websiteUrl: tool.website_url,
              error: (error as Error).message
            });
          }
        }

        return res.json({
          success: true,
          updated: updatedCount,
          total: tools.length,
          results
        });
      }

      case 'validate_logo': {
        // 验证图标 URL
        if (!websiteUrl) {
          return res.status(400).json({ error: 'websiteUrl is required for validation' });
        }

        const isValid = await validateLogoUrl(websiteUrl);

        return res.json({
          success: true,
          valid: isValid,
          url: websiteUrl
        });
      }

      default:
        return res.status(400).json({ error: 'Invalid action' });
    }

  } catch (error) {
    console.error('Logo Extract API Error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: (error as Error).message
    });
  }
}
