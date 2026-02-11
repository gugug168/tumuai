/**
 * Logo自动获取工具
 * 为用户提供多种logo获取方式，减少手动上传的必要性
 */

/**
 * 图标优先级配置
 * 按质量和可用性排序
 */
interface LogoCandidate {
  url: string;
  type: string;
  size?: string;
  quality: number; // 0-100，越高越优先
  isSvg?: boolean;
}

/**
 * 带超时的fetch请求
 */
async function fetchWithTimeout(url: string, options: RequestInit = {}, timeoutMs: number = 5000): Promise<Response> {
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
 * 解析 HTML 提取所有图标候选
 * 按优先级排序返回
 */
function extractLogoCandidates(html: string, baseUrl: string): LogoCandidate[] {
  const candidates: LogoCandidate[] = [];
  const base = new URL(baseUrl);

  // 匹配所有 link 标签中的图标
  const linkRegex = /<link\s+([^>]*?)>/gi;
  let match;

  while ((match = linkRegex.exec(html)) !== null) {
    const linkAttrs = match[1];
    const relMatch = linkAttrs.match(/rel=["']([^"']+)["']/i);
    const hrefMatch = linkAttrs.match(/href=["']([^"']+)["']/i);
    const sizesMatch = linkAttrs.match(/sizes=["']([^"']+)["']/i);
    const typeMatch = linkAttrs.match(/type=["']([^"']+)["']/i);

    if (!relMatch || !hrefMatch) continue;

    const rel = relMatch[1];
    let href = hrefMatch[1];

    // 转换为绝对 URL
    if (!href.startsWith('http') && !href.startsWith('//')) {
      href = new URL(href, base.origin).href;
    } else if (href.startsWith('//')) {
      href = base.protocol + href;
    }

    // 检查是否是图标相关的 link
    const iconRels = ['icon', 'shortcut icon', 'apple-touch-icon', 'mask-icon', 'fluid-icon'];
    if (!iconRels.some(r => rel.toLowerCase().includes(r))) continue;

    // 计算质量分数
    let quality = 50;
    let logoType = 'icon';

    if (rel.toLowerCase().includes('apple-touch-icon')) {
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
      // 优先选择较大的图标 (192x192 或更高)
      quality = 60 + Math.min(size / 10, 30);
      logoType = 'sized-icon';
    }

    candidates.push({
      url: href,
      type: logoType,
      size: sizesMatch?.[1],
      quality,
      isSvg: href.endsWith('.svg') || typeMatch?.[1].includes('svg')
    });
  }

  // 匹配 og:image
  const ogImageMatch = html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i);
  if (ogImageMatch) {
    let ogImage = ogImageMatch[1];
    if (!ogImage.startsWith('http') && !ogImage.startsWith('//')) {
      ogImage = new URL(ogImage, base.origin).href;
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
 * 从网站 HTML 中提取高质量图标
 * 优先级: SVG > apple-touch-icon > 大尺寸 icon > og:image > favicon
 */
export async function extractLogoFromHtml(websiteUrl: string): Promise<string | null> {
  console.log('🔍 开始提取网站图标:', websiteUrl);

  try {
    const url = new URL(websiteUrl.startsWith('http') ? websiteUrl : `https://${websiteUrl}`);
    const origin = url.origin;

    // 1. 抓取网站 HTML
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10秒超时

    let html: string;
    try {
      const response = await fetch(origin, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'text/html,application/xhtml+xml'
        }
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      html = await response.text();
    } catch (fetchError) {
      clearTimeout(timeoutId);
      console.warn('⚠️ 无法抓取网站HTML，使用备用方案:', fetchError);
      // 直接返回备用服务
      return getFallbackLogo(origin);
    }

    // 2. 提取图标候选
    const candidates = extractLogoCandidates(html, origin);

    if (candidates.length === 0) {
      console.log('❌ 未找到图标候选');
      return getFallbackLogo(origin);
    }

    console.log(`✅ 找到 ${candidates.length} 个图标候选:`, candidates.map(c => ({ type: c.type, quality: c.quality })));

    // 3. 按优先级验证并返回第一个可用的
    for (const candidate of candidates) {
      if (await validateLogoUrl(candidate.url)) {
        console.log(`✅ 成功获取图标: ${candidate.type} (${candidate.url})`);
        return candidate.url;
      }
    }

    // 4. 如果所有候选都失败，使用备用服务
    console.log('⚠️ 所有图标候选都无法访问，使用备用服务');
    return getFallbackLogo(origin);

  } catch (error) {
    console.error('❌ 提取图标失败:', error);
    return null;
  }
}

/**
 * 获取备用图标 (第三方服务)
 */
function getFallbackLogo(websiteOrigin: string): string {
  const url = new URL(websiteOrigin);
  const domain = url.hostname;

  // 使用 IconHorse (高质量)
  return `https://cdn2.iconhorse.com/icons/${domain}.png`;
}

// 默认占位符logo列表 - 根据工具类型匹配
const DEFAULT_LOGOS = {
  'AI工具': '/placeholders/ai-tool.svg',
  '结构设计': '/placeholders/structure-design.svg', 
  'BIM建模': '/placeholders/bim-modeling.svg',
  '工程计算': '/placeholders/engineering-calc.svg',
  '项目管理': '/placeholders/project-mgmt.svg',
  '数据分析': '/placeholders/data-analysis.svg',
  '建筑设计': '/placeholders/architecture.svg',
  '施工管理': '/placeholders/construction.svg',
  'default': '/placeholders/default-tool.svg'
};

/**
 * 从网站URL获取favicon (增强版 - 支持 HTML 解析)
 */
export async function getFaviconUrl(websiteUrl: string): Promise<string | null> {
  try {
    // 首先尝试使用智能提取
    const smartLogo = await extractLogoFromHtml(websiteUrl);
    if (smartLogo) {
      return smartLogo;
    }

    // 兜底方案：尝试常见路径
    const url = new URL(websiteUrl);
    const domain = url.origin;

    const faviconUrls = [
      `${domain}/favicon.ico`,
      `${domain}/favicon.png`,
      `${domain}/apple-touch-icon.png`,
      `${domain}/android-chrome-192x192.png`,
      `${domain}/logo.png`,
      `${domain}/logo.svg`
    ];

    for (const faviconUrl of faviconUrls) {
      try {
        await fetchWithTimeout(faviconUrl, {
          method: 'HEAD',
          mode: 'no-cors'
        }, 5000);
        return faviconUrl;
      } catch {
        continue;
      }
    }

    // 最终兜底：Google favicon API
    return `https://www.google.com/s2/favicons?domain=${url.hostname}&sz=128`;

  } catch (error) {
    console.warn('获取favicon失败:', error);
    return null;
  }
}

/**
 * 根据工具分类获取默认logo
 */
export function getDefaultLogoByCategory(categories: string[]): string {
  if (!categories || categories.length === 0) {
    return DEFAULT_LOGOS.default;
  }

  // 优先匹配第一个分类
  const primaryCategory = categories[0];
  
  // 查找匹配的默认logo
  for (const [key, logoPath] of Object.entries(DEFAULT_LOGOS)) {
    if (primaryCategory.includes(key) || key.includes(primaryCategory)) {
      return logoPath;
    }
  }

  // 通用匹配规则
  if (primaryCategory.toLowerCase().includes('ai') || primaryCategory.toLowerCase().includes('智能')) {
    return DEFAULT_LOGOS['AI工具'];
  }
  
  if (primaryCategory.includes('结构') || primaryCategory.includes('建筑')) {
    return DEFAULT_LOGOS['结构设计'];
  }
  
  if (primaryCategory.includes('BIM') || primaryCategory.includes('建模')) {
    return DEFAULT_LOGOS['BIM建模'];
  }
  
  if (primaryCategory.includes('计算') || primaryCategory.includes('分析')) {
    return DEFAULT_LOGOS['工程计算'];
  }
  
  if (primaryCategory.includes('管理') || primaryCategory.includes('项目')) {
    return DEFAULT_LOGOS['项目管理'];
  }

  return DEFAULT_LOGOS.default;
}

/**
 * 生成基于首字母的SVG logo
 */
export function generateInitialLogo(toolName: string, categories: string[] = []): string {
  const initials = getInitials(toolName);
  const color = getColorByCategory(categories);

  // 直接使用 encodeURIComponent 编码，更可靠
  const svgContent = `
    <svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100">
      <rect width="100" height="100" fill="${color}" rx="16"/>
      <text x="50" y="55" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif"
            font-size="36" font-weight="bold" text-anchor="middle" fill="white">
        ${initials}
      </text>
    </svg>
  `;

  return `data:image/svg+xml,${encodeURIComponent(svgContent)}`;
}

/**
 * 获取工具名称首字母
 */
function getInitials(toolName: string): string {
  if (!toolName) return 'T';
  
  // 移除特殊字符，只保留字母和数字
  const cleanName = toolName.replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, ' ');
  const words = cleanName.trim().split(/\s+/);
  
  if (words.length === 1) {
    // 单词情况：取前两个字符
    return words[0].substring(0, 2).toUpperCase();
  } else {
    // 多词情况：取前两个词的首字母
    return words.slice(0, 2).map(word => word.charAt(0)).join('').toUpperCase();
  }
}

/**
 * 根据分类获取对应颜色
 */
function getColorByCategory(categories: string[]): string {
  const categoryColors: Record<string, string> = {
    'AI工具': '#6366f1',      // indigo
    '结构设计': '#059669',     // emerald  
    'BIM建模': '#0891b2',      // cyan
    '工程计算': '#dc2626',     // red
    '项目管理': '#9333ea',     // violet
    '数据分析': '#ea580c',     // orange
    '建筑设计': '#16a34a',     // green
    '施工管理': '#0f172a',     // slate
    'default': '#6b7280'      // gray
  };

  if (!categories || categories.length === 0) {
    return categoryColors.default;
  }

  const primaryCategory = categories[0];
  
  // 直接匹配
  if (categoryColors[primaryCategory]) {
    return categoryColors[primaryCategory];
  }
  
  // 模糊匹配
  for (const [key, color] of Object.entries(categoryColors)) {
    if (primaryCategory.includes(key) || key.includes(primaryCategory)) {
      return color;
    }
  }

  return categoryColors.default;
}

/**
 * 自动获取工具Logo - 综合方案 (增强版)
 */
export async function autoGenerateLogo(toolName: string, websiteUrl: string, categories: string[] = []): Promise<string> {
  console.log('🎨 开始自动获取Logo:', { toolName, websiteUrl, categories });

  try {
    // 1. 首先使用智能提取 (HTML 解析)
    console.log('🔍 尝试智能提取图标...');
    const smartLogo = await extractLogoFromHtml(websiteUrl);
    if (smartLogo) {
      console.log('✅ 智能提取成功:', smartLogo);
      return smartLogo;
    }

    console.log('⚠️ 智能提取失败，使用兜底方案');
  } catch (error) {
    console.warn('智能提取异常:', error);
  }

  // 2. 生成基于首字母的logo
  const generatedLogo = generateInitialLogo(toolName, categories);
  console.log('✅ 生成首字母Logo成功');

  return generatedLogo;
}

/**
 * 验证logo URL是否有效
 */
export async function validateLogoUrl(logoUrl: string): Promise<boolean> {
  try {
    const response = await fetchWithTimeout(logoUrl, {
      method: 'HEAD'
    }, 5000);
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * 判断 logo_url 是否是高质量的有效 URL
 * 过滤掉低质量的 favicon 服务和占位符
 */
export function isValidHighQualityLogoUrl(logoUrl?: string): boolean {
  if (!logoUrl) return false;

  // 过滤低质量的 favicon 服务
  const lowQualityPatterns = [
    'google.com/s2/favicons',
    'placeholder',
    'iconhorse'
  ];

  return !lowQualityPatterns.some(pattern => logoUrl.includes(pattern));
}

/**
 * 获取最佳显示的 logo URL
 * 优先使用高质量 URL，否则生成首字母 logo
 */
export function getBestDisplayLogoUrl(logoUrl: string | undefined, toolName: string, categories: string[] = []): string {
  if (isValidHighQualityLogoUrl(logoUrl)) {
    return logoUrl!;
  }
  return generateInitialLogo(toolName, categories);
}
