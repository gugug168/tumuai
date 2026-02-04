import React, { useState, useRef, useEffect } from 'react';

type BrokenImgMap = Record<string, number>; // url -> expiresAt (ms)

const BROKEN_IMG_STORAGE_KEY = 'tumuai_broken_img_v1';
const BROKEN_IMG_MAX_ENTRIES = 200;

// 错误类型及其 TTL（缓存时间）
const ERROR_TTL_MS = {
  '404': 7 * 24 * 60 * 60 * 1000,      // 7天 - 资源不存在，长期缓存
  '403': 30 * 60 * 1000,                // 30分钟 - 临时禁止，允许稍后重试
  'network': 60 * 60 * 1000,            // 1小时 - 网络错误，中等缓存
  'timeout': 10 * 60 * 1000,            // 10分钟 - 超时，短缓存
  'first_party': 10 * 60 * 1000,        // 10分钟 - 自己的资源，可能正在上传
  'default': 3 * 24 * 60 * 60 * 1000    // 3天 - 默认
} as const;

type ErrorType = keyof typeof ERROR_TTL_MS;

// 错误信息缓存结构
interface BrokenImgEntry {
  expiresAt: number;
  errorType?: ErrorType;
}

type BrokenImgMap = Record<string, BrokenImgEntry>;

let brokenImgMapCache: BrokenImgMap | null = null;

function loadBrokenImgMap(): BrokenImgMap {
  if (brokenImgMapCache) return brokenImgMapCache;

  if (typeof window === 'undefined') {
    brokenImgMapCache = {};
    return brokenImgMapCache;
  }

  try {
    const raw = localStorage.getItem(BROKEN_IMG_STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as BrokenImgMap) : {};
    const map: BrokenImgMap = parsed && typeof parsed === 'object' ? parsed : {};

    // 清理过期条目
    const now = Date.now();
    for (const [url, entry] of Object.entries(map)) {
      if (!entry || typeof entry.expiresAt !== 'number' || entry.expiresAt <= now) {
        delete map[url];
      }
    }

    brokenImgMapCache = map;
    return map;
  } catch {
    brokenImgMapCache = {};
    return brokenImgMapCache;
  }
}

function saveBrokenImgMap(map: BrokenImgMap) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(BROKEN_IMG_STORAGE_KEY, JSON.stringify(map));
  } catch {
    // Ignore storage errors (quota, private mode, etc.)
  }
}

function isHttpUrl(url: string): boolean {
  return /^https?:\/\//i.test(url);
}

/**
 * 检查是否是 Supabase Storage 的 URL
 */
function isSupabaseUrl(url: string): boolean {
  return url.includes('supabase.co');
}

/**
 * 为 Supabase 图片生成带格式参数的 URL
 */
function formatImageUrl(url: string, format?: string, width?: number): string {
  const urlObj = new URL(url);
  if (format) {
    urlObj.searchParams.set('format', format);
  }
  if (width) {
    urlObj.searchParams.set('width', width.toString());
  }
  return urlObj.toString();
}

/**
 * 生成 srcset 属性值
 */
function generateSrcSet(baseUrl: string, widths: number[], format?: string): string {
  return widths.map(w => `${formatImageUrl(baseUrl, format, w)} ${w}w`).join(', ');
}

/**
 * 根据错误类型和 URL 获取 TTL
 */
function getBrokenImgTtlMs(url: string, errorType: ErrorType = 'default'): number {
  // 对于自己的 Supabase Storage 资源，使用较短的 TTL，以便在上传后快速恢复
  if (url.includes('/storage/v1/object/public/tool-screenshots/') ||
      url.includes('/storage/v1/object/public/tool-logos/')) {
    return ERROR_TTL_MS.first_party;
  }

  // 根据错误类型返回对应的 TTL
  return ERROR_TTL_MS[errorType] || ERROR_TTL_MS.default;
}

/**
 * 从错误事件中识别错误类型
 */
function getErrorTypeFromEvent(event: React.SyntheticEvent<HTMLImageElement, Event>): ErrorType {
  const img = event.currentTarget;
  const naturalWidth = img.naturalWidth;
  const naturalHeight = img.naturalHeight;

  // 检查是否加载了错误图片（某些 CDN 返回小尺寸的错误占位图）
  if (naturalWidth === 0 || naturalHeight === 0) {
    return '404'; // 最可能是资源不存在
  }

  // 检查 networkState（仅部分浏览器支持，HTMLMediaElement 才有）
  // 对于 HTMLImageElement，我们主要通过其他方式判断
  // 如果需要更精确的网络状态检测，可以考虑使用 fetch 预检查

  // 默认假设为 404
  return '404';
}

function isKnownBrokenUrl(url: string): boolean {
  if (!isHttpUrl(url)) return false;
  const map = loadBrokenImgMap();
  const entry = map[url];
  if (!entry) return false;

  if (entry.expiresAt <= Date.now()) {
    delete map[url];
    saveBrokenImgMap(map);
    return false;
  }

  return true;
}

function markBrokenUrl(url: string, errorType: ErrorType = '404') {
  if (!isHttpUrl(url)) return;
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return;

  const map = loadBrokenImgMap();
  map[url] = {
    expiresAt: Date.now() + getBrokenImgTtlMs(url, errorType),
    errorType
  };

  // 保持 map 有界，避免 localStorage 无限增长
  const keys = Object.keys(map);
  if (keys.length > BROKEN_IMG_MAX_ENTRIES) {
    // 删除最旧的条目
    keys
      .sort((a, b) => (map[a]?.expiresAt || 0) - (map[b]?.expiresAt || 0))
      .slice(0, keys.length - BROKEN_IMG_MAX_ENTRIES)
      .forEach((k) => {
        delete map[k];
      });
  }

  saveBrokenImgMap(map);
}

interface OptimizedImageProps {
  src: string;
  alt: string;
  className?: string;
  sizes?: string;
  priority?: boolean;
  lazyLoad?: boolean;
  objectFit?: 'cover' | 'contain' | 'fill' | 'none' | 'scale-down';
  objectPosition?: string;
  background?: boolean;
  fallback?: React.ReactNode; // 自定义兜底内容
  width?: string | number; // 强制容器宽度
  height?: string | number; // 强制容器高度
  enableWebp?: boolean; // 是否启用 WebP 优化（默认 true）
  srcsetWidths?: number[]; // srcset 响应式宽度列表
}

const OptimizedImage: React.FC<OptimizedImageProps> = ({
  src,
  alt,
  className = '',
  sizes = '(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw',
  priority = false,
  lazyLoad = true,
  objectFit = 'contain', // 默认使用 contain 避免图片变形
  objectPosition = '50% 50%',
  background = false,
  fallback,
  width,
  height,
  enableWebp = true,
  srcsetWidths = [320, 640, 960, 1280, 1920]
}) => {
  const initialBroken = typeof window !== 'undefined' ? isKnownBrokenUrl(src) : false;
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(initialBroken);
  const [isInView, setIsInView] = useState(!lazyLoad || priority);
  const imgRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // If the src changes, reset local loading state (but respect the broken-url cache).
  useEffect(() => {
    setIsLoaded(false);
    setHasError(typeof window !== 'undefined' ? isKnownBrokenUrl(src) : false);
  }, [src]);

  // Intersection Observer for lazy loading
  useEffect(() => {
    if (!lazyLoad || priority || isInView) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsInView(true);
            observer.disconnect();
          }
        });
      },
      {
        rootMargin: '50px',
        threshold: 0.1
      }
    );

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => observer.disconnect();
  }, [lazyLoad, priority, isInView]);

  const handleLoad = () => {
    setIsLoaded(true);
  };

  const handleError = (event: React.SyntheticEvent<HTMLImageElement, Event>) => {
    const errorType = getErrorTypeFromEvent(event);
    setHasError(true);
    markBrokenUrl(src, errorType);
  };

  // 将 width/height 转换为 CSS 值
  const widthCss = typeof width === 'number' ? `${width}px` : width;
  const heightCss = typeof height === 'number' ? `${height}px` : height;

  // 检查是否可以使用 WebP 优化
  const canUseWebP = enableWebp && isHttpUrl(src) && isSupabaseUrl(src);

  // 图片元素
  const imageElement = (
    <>
      {canUseWebP ? (
        // 使用 picture 元素支持 WebP 格式
        <picture>
          <source
            srcSet={generateSrcSet(src, srcsetWidths, 'webp')}
            type="image/webp"
            sizes={sizes}
          />
          <img
            ref={imgRef}
            src={src}
            alt={alt}
            loading={priority ? 'eager' : 'lazy'}
            decoding="async"
            className={`transition-opacity duration-300 ${
              isLoaded && !hasError ? 'opacity-100' : 'opacity-0'
            }`}
            style={{
              objectFit,
              objectPosition,
              // Ensure object-fit/object-position work as expected (cropping & "slices") by sizing the
              // image to the container box. The replaced element is then fitted within that box.
              width: '100%',
              height: '100%',
              // When container has fixed dimensions, we already set them on the wrapper; keep image aligned.
              ...(widthCss && { width: widthCss }),
              ...(heightCss && { height: heightCss })
            }}
            onLoad={handleLoad}
            onError={handleError}
            {...(priority && {
              fetchPriority: 'high' as const
            })}
          />
        </picture>
      ) : (
        // 普通 img 元素
        <img
          ref={imgRef}
          src={src}
          sizes={sizes}
          alt={alt}
          loading={priority ? 'eager' : 'lazy'}
          decoding="async"
          className={`transition-opacity duration-300 ${
            isLoaded && !hasError ? 'opacity-100' : 'opacity-0'
          }`}
          style={{
            objectFit,
            objectPosition,
            // Ensure object-fit/object-position work as expected (cropping & "slices") by sizing the
            // image to the container box. The replaced element is then fitted within that box.
            width: '100%',
            height: '100%',
            // When container has fixed dimensions, we already set them on the wrapper; keep image aligned.
            ...(widthCss && { width: widthCss }),
            ...(heightCss && { height: heightCss })
          }}
          onLoad={handleLoad}
          onError={handleError}
          {...(priority && {
            fetchPriority: 'high' as const
          })}
        />
      )}
    </>
  );

  return (
    <div
      ref={containerRef}
      className={`relative overflow-hidden ${className}`}
      style={{
        backgroundColor: background ? '#f3f4f6' : 'transparent',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        // 当指定 width/height 时，强制使用固定尺寸
        ...(widthCss && { width: widthCss }),
        ...(heightCss && { height: heightCss })
      }}
    >
      {/* 实际图片 */}
      {isInView && !hasError && imageElement}

      {/* 优化的加载动画 - 只在加载中显示 */}
      {isInView && !isLoaded && !hasError && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 animate-shimmer">
          {/* 骨架屏波纹效果 */}
          <div className="absolute inset-0 overflow-hidden opacity-50">
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-gray-300 to-transparent -translate-x-full animate-[shimmer_1.5s_infinite]" />
          </div>
          {/* 加载旋转器 */}
          <div className="relative w-10 h-10">
            <div className="absolute inset-0 border-3 border-gray-200 rounded-full"></div>
            <div className="absolute inset-0 border-3 border-transparent border-t-blue-500 rounded-full animate-spin"></div>
            <div className="absolute inset-2 border-3 border-transparent border-t-blue-400 rounded-full animate-spin" style={{ animationDirection: 'reverse', animationDuration: '0.8s' }}></div>
          </div>
          {/* 加载文字提示 */}
          <span className="mt-3 text-xs text-gray-400 font-medium skeleton-pulse">加载中...</span>
        </div>
      )}

      {/* 错误状态 / 兜底内容 */}
      {hasError && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-50">
          {fallback || (
            <>
              <svg className="w-12 h-12 text-gray-300 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <rect x="3" y="3" width="18" height="18" rx="2" strokeWidth="2"/>
                <circle cx="8.5" cy="8.5" r="1.5" fill="currentColor"/>
                <path d="M21 15l-5-5L5 21" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <span className="text-xs text-gray-400">图片加载失败</span>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default OptimizedImage;
