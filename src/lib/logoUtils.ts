/**
 * Logo自动获取工具
 * 为用户提供多种logo获取方式，减少手动上传的必要性
 */

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
 * 从网站URL获取favicon
 */
export async function getFaviconUrl(websiteUrl: string): Promise<string | null> {
  try {
    const url = new URL(websiteUrl);
    const domain = url.origin;
    
    // 尝试常见的favicon路径
    const faviconUrls = [
      `${domain}/favicon.ico`,
      `${domain}/favicon.png`, 
      `${domain}/apple-touch-icon.png`,
      `${domain}/android-chrome-192x192.png`,
      `${domain}/logo.png`,
      `${domain}/logo.svg`
    ];

    // 检查哪个favicon存在且可访问
    for (const faviconUrl of faviconUrls) {
      try {
        const response = await fetchWithTimeout(faviconUrl, { 
          method: 'HEAD', 
          mode: 'no-cors'
        }, 5000);
        
        // no-cors模式下，如果没有错误说明资源存在
        return faviconUrl;
      } catch {
        continue;
      }
    }

    // 使用第三方服务获取favicon
    return `https://www.google.com/s2/favicons?domain=${url.hostname}&sz=64`;
    
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
  
  const svgContent = `
    <svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100">
      <rect width="100" height="100" fill="${color}" rx="12"/>
      <text x="50" y="50" font-family="Arial, sans-serif" font-size="32" font-weight="bold" 
            text-anchor="middle" dominant-baseline="central" fill="white">
        ${initials}
      </text>
    </svg>
  `;
  
  return `data:image/svg+xml;base64,${btoa(svgContent)}`;
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
 * 自动获取工具Logo - 综合方案
 */
export async function autoGenerateLogo(toolName: string, websiteUrl: string, categories: string[] = []): Promise<string> {
  console.log('🎨 开始自动获取Logo:', { toolName, websiteUrl, categories });
  
  try {
    // 1. 首先尝试获取网站favicon
    const favicon = await getFaviconUrl(websiteUrl);
    if (favicon) {
      console.log('✅ 成功获取网站favicon:', favicon);
      return favicon;
    }
    
    console.log('⚠️ 无法获取favicon，使用生成logo');
  } catch (error) {
    console.warn('获取favicon异常:', error);
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