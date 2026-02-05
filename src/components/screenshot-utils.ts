/**
 * 截图相关工具函数
 *
 * 从 ScreenshotGallery 组件中提取的纯函数
 */

import type { GalleryImage } from './ScreenshotGallery';

// 截图区域类型
export type ScreenshotRegion = 'hero' | 'features' | 'pricing' | 'fullpage';

// 区域标签映射
export const REGION_LABELS: Record<ScreenshotRegion, string> = {
  hero: '首页',
  features: '功能',
  pricing: '价格',
  fullpage: '全页'
};

// 区域图标映射
export const REGION_ICONS: Record<ScreenshotRegion, string> = {
  hero: '🏠',
  features: '⚡',
  pricing: '💰',
  fullpage: '📄'
};

// 区域排序顺序
export const REGION_ORDER: ScreenshotRegion[] = ['hero', 'features', 'pricing', 'fullpage'];

/**
 * 从截图 URL 解析区域类型
 */
export function parseScreenshotRegion(url: string): ScreenshotRegion | null {
  const match = url.match(/\/(hero|features|pricing|fullpage)\.webp$/i);
  if (match) {
    return match[1].toLowerCase() as ScreenshotRegion;
  }
  return null;
}

/**
 * 获取截图的区域标签
 */
export function getScreenshotLabel(url: string): string {
  const region = parseScreenshotRegion(url);
  return region ? REGION_LABELS[region] : '';
}

/**
 * 获取截图的区域图标
 */
export function getScreenshotIcon(url: string): string {
  const region = parseScreenshotRegion(url);
  return region ? REGION_ICONS[region] : '';
}

/**
 * 获取区域的排序值
 */
export function getRegionOrder(region: ScreenshotRegion | null): number {
  if (!region) return 999;
  return REGION_ORDER.indexOf(region);
}

/**
 * 将截图按区域分组
 */
export function groupScreenshotsByRegion(images: GalleryImage[]): Map<ScreenshotRegion | 'other', GalleryImage[]> {
  const groups = new Map<ScreenshotRegion | 'other', GalleryImage[]>();

  REGION_ORDER.forEach(region => {
    groups.set(region, []);
  });
  groups.set('other', []);

  images.forEach(image => {
    const region = parseScreenshotRegion(image.src);
    const key = region || 'other';
    const current = groups.get(key) || [];
    current.push(image);
    groups.set(key, current);
  });

  return groups;
}
