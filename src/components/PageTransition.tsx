import React, { useEffect, useState, useRef } from 'react';

interface PageTransitionProps {
  children: React.ReactNode;
  /**
   * 动画类型
   */
  type?: 'fade' | 'slide-up' | 'slide-down' | 'slide-left' | 'slide-right' | 'scale' | 'none';
  /**
   * 动画持续时间（毫秒）
   */
  duration?: number;
  /**
   * 延迟开始时间（毫秒）
   */
  delay?: number;
  /**
   * 是否在挂载时触发动画
   */
  animateOnMount?: boolean;
  /**
   * 自定义className
   */
  className?: string;
}

/**
 * 页面转场动画组件
 * 为页面切换提供流畅的过渡效果
 */
const PageTransition: React.FC<PageTransitionProps> = ({
  children,
  type = 'fade',
  duration = 300,
  delay = 0,
  animateOnMount = true,
  className = ''
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [shouldRender, setShouldRender] = useState(animateOnMount);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!animateOnMount) {
      setIsVisible(true);
      return;
    }

    const timer = setTimeout(() => {
      setIsVisible(true);
    }, delay);

    return () => clearTimeout(timer);
  }, [delay, animateOnMount]);

  const getAnimationClasses = () => {
    const baseClasses = 'transition-all ease-out';
    const durationClass = `duration-[${duration}ms]`;

    if (!isVisible) {
      switch (type) {
        case 'fade':
          return `${baseClasses} ${durationClass} opacity-0`;
        case 'slide-up':
          return `${baseClasses} ${durationClass} opacity-0 translate-y-8`;
        case 'slide-down':
          return `${baseClasses} ${durationClass} opacity-0 -translate-y-8`;
        case 'slide-left':
          return `${baseClasses} ${durationClass} opacity-0 translate-x-8`;
        case 'slide-right':
          return `${baseClasses} ${durationClass} opacity-0 -translate-x-8`;
        case 'scale':
          return `${baseClasses} ${durationClass} opacity-0 scale-95`;
        case 'none':
          return '';
        default:
          return `${baseClasses} ${durationClass} opacity-0`;
      }
    }

    return `${baseClasses} ${durationClass} opacity-100 translate-x-0 translate-y-0 scale-100`;
  };

  return (
    <div
      ref={containerRef}
      className={`${getAnimationClasses()} ${className}`.trim()}
      style={{
        transitionDuration: `${duration}ms`,
        transitionDelay: `${delay}ms`
      }}
    >
      {children}
    </div>
  );
};

export default PageTransition;
