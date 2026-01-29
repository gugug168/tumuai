import React, { useState, useRef, useEffect } from 'react';

interface OptimizedImageProps {
  src: string;
  alt: string;
  className?: string;
  sizes?: string;
  priority?: boolean;
  lazyLoad?: boolean;
  objectFit?: 'cover' | 'contain' | 'fill' | 'none' | 'scale-down';
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
  background = false,
  fallback,
  width,
  height
}) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [isInView, setIsInView] = useState(!lazyLoad || priority);
  const imgRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

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
      {isInView && (
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
            maxWidth: '100%',
            maxHeight: '100%',
            width: 'auto',
            height: 'auto',
            // 当容器有固定尺寸时，图片也应该填充容器
            ...(widthCss && { maxWidth: widthCss }),
            ...(heightCss && { maxHeight: heightCss })
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
