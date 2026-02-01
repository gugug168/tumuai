import React, { useState, useRef, useEffect } from 'react';

type BrokenImgMap = Record<string, number>; // url -> expiresAt (ms)

const BROKEN_IMG_STORAGE_KEY = 'tumuai_broken_img_v1';
const BROKEN_IMG_TTL_DEFAULT_MS = 3 * 24 * 60 * 60 * 1000; // 3 days
const BROKEN_IMG_TTL_FIRST_PARTY_MS = 10 * 60 * 1000; // 10 minutes
const BROKEN_IMG_MAX_ENTRIES = 200;

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

    // Prune expired entries on load.
    const now = Date.now();
    for (const [url, expiresAt] of Object.entries(map)) {
      if (typeof expiresAt !== 'number' || expiresAt <= now) {
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

function getBrokenImgTtlMs(url: string): number {
  // For our own Supabase Storage assets, a missing object can become available shortly
  // after an async backfill. Use a shorter TTL so the UI can recover quickly.
  if (url.includes('/storage/v1/object/public/tool-screenshots/')) return BROKEN_IMG_TTL_FIRST_PARTY_MS;
  if (url.includes('/storage/v1/object/public/tool-logos/')) return BROKEN_IMG_TTL_FIRST_PARTY_MS;
  return BROKEN_IMG_TTL_DEFAULT_MS;
}

function isKnownBrokenUrl(url: string): boolean {
  if (!isHttpUrl(url)) return false;
  const map = loadBrokenImgMap();
  const expiresAt = map[url];
  if (typeof expiresAt !== 'number') return false;

  if (expiresAt <= Date.now()) {
    delete map[url];
    saveBrokenImgMap(map);
    return false;
  }

  return true;
}

function markBrokenUrl(url: string) {
  if (!isHttpUrl(url)) return;
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return;

  const map = loadBrokenImgMap();
  map[url] = Date.now() + getBrokenImgTtlMs(url);

  // Keep the map bounded to avoid unbounded localStorage growth.
  const keys = Object.keys(map);
  if (keys.length > BROKEN_IMG_MAX_ENTRIES) {
    // Remove the oldest (smallest expiresAt) entries.
    keys
      .sort((a, b) => (map[a] || 0) - (map[b] || 0))
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
  height
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

  const handleError = () => {
    setHasError(true);
    markBrokenUrl(src);
  };

  // 将 width/height 转换为 CSS 值
  const widthCss = typeof width === 'number' ? `${width}px` : width;
  const heightCss = typeof height === 'number' ? `${height}px` : height;

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
      {isInView && !hasError && (
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

      {/* 加载动画 - 只在加载中显示 */}
      {isInView && !isLoaded && !hasError && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
      )}

      {/* 错误状态 / 兜底内容 */}
      {hasError && (
        <div className="absolute inset-0 flex items-center justify-center">
          {fallback || (
            <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <rect x="3" y="3" width="18" height="18" rx="2" strokeWidth="2"/>
              <circle cx="8.5" cy="8.5" r="1.5" fill="currentColor"/>
              <path d="M21 15l-5-5L5 21" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          )}
        </div>
      )}
    </div>
  );
};

export default OptimizedImage;
