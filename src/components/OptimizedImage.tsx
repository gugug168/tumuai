import React, { useState, useRef, useEffect } from 'react';

interface OptimizedImageProps {
  src: string;
  alt: string;
  className?: string;
  placeholder?: string;
  sizes?: string;
  priority?: boolean; // 优先加载
  lazyLoad?: boolean; // 懒加载
  onLoad?: () => void;
  onError?: () => void;
}

const OptimizedImage: React.FC<OptimizedImageProps> = ({
  src,
  alt,
  className = '',
  placeholder,
  sizes = '(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw',
  priority = false,
  lazyLoad = true,
  onLoad,
  onError
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
        rootMargin: '50px', // 提前50px开始加载
        threshold: 0.1
      }
    );

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => observer.disconnect();
  }, [lazyLoad, priority, isInView]);

  // 生成响应式图片URL
  const generateResponsiveUrl = (originalUrl: string, width: number) => {
    // 如果是Pexels图片，使用其内置的尺寸参数
    if (originalUrl.includes('pexels.com')) {
      return originalUrl.replace(/w=\d+/, `w=${width}`);
    }
    
    // 对于其他图片，可以集成imagekit.io或类似服务
    return originalUrl;
  };

  // 生成srcset
  const generateSrcSet = (originalUrl: string) => {
    const widths = [320, 640, 1024, 1280, 1920];
    return widths
      .map(width => `${generateResponsiveUrl(originalUrl, width)} ${width}w`)
      .join(', ');
  };

  const handleLoad = () => {
    setIsLoaded(true);
    onLoad?.();
  };

  const handleError = () => {
    setHasError(true);
    onError?.();
  };

  // 生成占位符
  const placeholderUrl = placeholder || 
    `data:image/svg+xml;base64,${btoa(
      `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300" viewBox="0 0 400 300">
        <rect width="400" height="300" fill="#f3f4f6"/>
        <text x="200" y="150" text-anchor="middle" font-family="Arial" font-size="14" fill="#9ca3af">
          加载中...
        </text>
      </svg>`
    )}`;

  return (
    <div 
      ref={containerRef}
      className={`relative overflow-hidden ${className}`}
      style={{ backgroundColor: '#f3f4f6' }}
    >
      {/* 占位符 */}
      {!isLoaded && !hasError && (
        <img
          src={placeholderUrl}
          alt=""
          className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300 ${
            isInView ? 'opacity-100' : 'opacity-100'
          }`}
          aria-hidden="true"
        />
      )}

      {/* 错误状态 */}
      {hasError && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100 text-gray-400">
          <div className="text-center">
            <div className="w-12 h-12 mx-auto mb-2 opacity-50">
              <svg fill="currentColor" viewBox="0 0 24 24">
                <path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/>
              </svg>
            </div>
            <p className="text-sm">图片加载失败</p>
          </div>
        </div>
      )}

      {/* 实际图片 */}
      {isInView && !hasError && (
        <img
          ref={imgRef}
          src={src}
          srcSet={generateSrcSet(src)}
          sizes={sizes}
          alt={alt}
          loading={priority ? 'eager' : 'lazy'}
          decoding="async"
          className={`w-full h-full object-cover transition-opacity duration-500 ${
            isLoaded ? 'opacity-100' : 'opacity-0'
          }`}
          onLoad={handleLoad}
          onError={handleError}
          // 预连接域名以优化加载速度
          {...(priority && {
            fetchPriority: 'high' as const
          })}
        />
      )}

      {/* 加载动画 */}
      {!isLoaded && !hasError && isInView && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
      )}
    </div>
  );
};

export default OptimizedImage;