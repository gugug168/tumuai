import { useEffect, useCallback } from 'react';

/**
 * Meta 标签配置接口
 */
interface MetaTagConfig {
  title?: string;
  description?: string;
  keywords?: string;
  ogTitle?: string;
  ogDescription?: string;
  ogImage?: string;
  ogType?: string;
  twitterCard?: string;
  twitterTitle?: string;
  twitterDescription?: string;
  twitterImage?: string;
  canonical?: string;
  noIndex?: boolean;
}

/**
 * 默认配置
 */
const DEFAULT_CONFIG: MetaTagConfig = {
  title: 'TumuAI - 土木AI之家 | 专业的土木工程AI工具导航平台',
  description: '为土木工程师提供最全面的AI工具和效率工具导航，涵盖结构设计、BIM建模、施工管理、造价估算等专业领域。',
  keywords: '土木工程,AI工具,结构设计,BIM建模,施工管理,工程造价,AI辅助设计,土木软件,工程软件导航',
  ogType: 'website',
  twitterCard: 'summary_large_image'
};

/**
 * useMetaTags Hook - 动态管理页面 Meta 标签
 *
 * 用于在单页应用中动态更新页面的 Meta 标签，
 * 提升 SEO 和社交媒体分享效果。
 *
 * @example
 * ```tsx
 * function ToolDetailPage({ tool }) {
 *   useMetaTags({
 *     title: `${tool.name} - TumuAI`,
 *     description: tool.tagline,
 *     ogImage: tool.logo_url
 *   });
 *   return <div>...</div>;
 * }
 * ```
 */
export function useMetaTags(config: MetaTagConfig = {}) {
  const mergedConfig = { ...DEFAULT_CONFIG, ...config };

  /**
   * 更新页面标题
   */
  const updateTitle = useCallback((title: string) => {
    document.title = title;
  }, []);

  /**
   * 更新或创建 Meta 标签
   */
  const updateMetaTag = useCallback((name: string, content: string, property = false) => {
    const selector = property
      ? `meta[property="${name}"]`
      : `meta[name="${name}"]`;

    let element = document.querySelector(selector) as HTMLMetaElement;

    if (!element) {
      element = document.createElement('meta');
      if (property) {
        (element as any).setAttribute('property', name);
      } else {
        element.setAttribute('name', name);
      }
      document.head.appendChild(element);
    }

    element.setAttribute('content', content);
  }, []);

  /**
   * 更新 canonical 链接
   */
  const updateCanonical = useCallback((url: string) => {
    let link = document.querySelector('link[rel="canonical"]') as HTMLLinkElement;

    if (!link) {
      link = document.createElement('link');
      link.setAttribute('rel', 'canonical');
      document.head.appendChild(link);
    }

    link.setAttribute('href', url);
  }, []);

  /**
   * 设置 robots 标签
   */
  const setRobots = useCallback((noIndex: boolean) => {
    const content = noIndex ? 'noindex, nofollow' : 'index, follow';
    updateMetaTag('robots', content);
    updateMetaTag('googlebot', content);
  }, [updateMetaTag]);

  /**
   * 批量更新所有 Meta 标签
   */
  const updateAll = useCallback((config: MetaTagConfig) => {
    // 标题
    if (config.title) {
      updateTitle(config.title);
    }

    // 基础 Meta 标签
    if (config.description) {
      updateMetaTag('description', config.description);
    }
    if (config.keywords) {
      updateMetaTag('keywords', config.keywords);
    }

    // Open Graph 标签
    if (config.ogTitle || config.title) {
      updateMetaTag('og:title', config.ogTitle || config.title!, true);
    }
    if (config.ogDescription || config.description) {
      updateMetaTag('og:description', config.ogDescription || config.description!, true);
    }
    if (config.ogImage) {
      updateMetaTag('og:image', config.ogImage, true);
    }
    if (config.ogType) {
      updateMetaTag('og:type', config.ogType, true);
    }

    // Twitter Card 标签
    if (config.twitterCard) {
      updateMetaTag('twitter:card', config.twitterCard);
    }
    if (config.twitterTitle || config.title) {
      updateMetaTag('twitter:title', config.twitterTitle || config.title!);
    }
    if (config.twitterDescription || config.description) {
      updateMetaTag('twitter:description', config.twitterDescription || config.description!);
    }
    if (config.twitterImage || config.ogImage) {
      updateMetaTag('twitter:image', config.twitterImage || config.ogImage!);
    }

    // Canonical 链接
    if (config.canonical) {
      updateCanonical(config.canonical);
    }

    // Robots 标签
    if (config.noIndex !== undefined) {
      setRobots(config.noIndex);
    }
  }, [updateTitle, updateMetaTag, updateCanonical, setRobots]);

  // 初始化时更新所有标签
  useEffect(() => {
    updateAll(mergedConfig);
  }, [mergedConfig, updateAll]);

  // 组件卸载时恢复默认标签
  useEffect(() => {
    return () => {
      // 可选：恢复默认 Meta 标签
      // updateAll(DEFAULT_CONFIG);
    };
  }, [updateAll]);

  return {
    updateTitle,
    updateMetaTag,
    updateCanonical,
    setRobots,
    updateAll
  };
}

/**
 * 工具详情页专用的 Meta 标签 Hook
 */
export function useToolMetaTags(tool: {
  name: string;
  tagline?: string;
  description?: string;
  logo_url?: string;
  categories?: string[];
  pricing?: string;
}) {
  const categoriesText = tool.categories?.join(', ') || '';

  return useMetaTags({
    title: `${tool.name} - TumuAI`,
    description: tool.tagline || tool.description || `查看${tool.name}的详细信息`,
    keywords: `${tool.name},${categoriesText},AI工具,土木工程`.replace(/,{2,}/g, ','),
    ogTitle: tool.name,
    ogDescription: tool.tagline || tool.description,
    ogImage: tool.logo_url,
    twitterTitle: tool.name,
    twitterDescription: tool.tagline || tool.description,
    twitterImage: tool.logo_url
  });
}

/**
 * 文章/内容页专用的 Meta 标签 Hook
 */
export function useArticleMetaTags(article: {
  title: string;
  description?: string;
  image?: string;
  publishDate?: string;
  author?: string;
}) {
  return useMetaTags({
    title: `${article.title} - TumuAI`,
    description: article.description,
    ogTitle: article.title,
    ogDescription: article.description,
    ogImage: article.image,
    ogType: 'article',
    twitterCard: 'summary_large_image'
  });
}

export default useMetaTags;
