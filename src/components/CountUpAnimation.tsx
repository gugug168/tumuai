import React, { useState, useEffect, useRef, useCallback } from 'react';

interface CountUpAnimationProps {
  /**
   * 目标数字
   */
  end: number;
  /**
   * 起始数字，默认为0
   */
  start?: number;
  /**
   * 动画持续时间（毫秒），默认2000ms
   */
  duration?: number;
  /**
   * 数字后缀
   */
  suffix?: string;
  /**
   * 数字前缀
   */
  prefix?: string;
  /**
   * 小数位数，默认为0
   */
  decimals?: number;
  /**
   * 是否使用逗号分隔千位
   */
  useComma?: boolean;
  /**
   * 是否延迟启动动画
   */
  delay?: number;
  /**
   * 自定义className
   */
  className?: string;
  /**
   * 当动画完成时的回调
   */
  onComplete?: () => void;
}

/**
 * 数字滚动动画组件
 * 用于统计数据的动态展示效果
 */
const CountUpAnimation = React.memo(({
  end,
  start = 0,
  duration = 2000,
  suffix = '',
  prefix = '',
  decimals = 0,
  useComma = true,
  delay = 0,
  className = '',
  onComplete
}: CountUpAnimationProps) => {
  const [count, setCount] = useState(start);
  const elementRef = useRef<HTMLSpanElement>(null);
  const animationRef = useRef<number | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const hasAnimatedRef = useRef(false);

  // 格式化数字
  const formatNumber = useCallback((num: number) => {
    const fixedNum = num.toFixed(decimals);
    if (useComma) {
      const parts = fixedNum.split('.');
      parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
      return parts.join('.');
    }
    return fixedNum;
  }, [decimals, useComma]);

  // 动画函数
  const animate = useCallback((currentTime: number) => {
    if (!startTimeRef.current) {
      startTimeRef.current = currentTime;
    }

    const elapsed = currentTime - startTimeRef.current;
    const progress = Math.min(elapsed / duration, 1);

    // 使用easeOutExpo缓动函数让动画更自然
    const easeOutExpo = (t: number) => {
      return t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
    };

    const easedProgress = easeOutExpo(progress);
    const currentCount = start + (end - start) * easedProgress;

    setCount(currentCount);

    if (progress < 1) {
      animationRef.current = requestAnimationFrame(animate);
    } else {
      // 动画完成
      setCount(end);
      hasAnimatedRef.current = true;
      if (onComplete) {
        onComplete();
      }
    }
  }, [start, end, duration, onComplete]);

  // 启动动画
  const startAnimation = useCallback(() => {
    if (hasAnimatedRef.current) return;

    hasAnimatedRef.current = true;
    setTimeout(() => {
      animationRef.current = requestAnimationFrame(animate);
    }, delay);
  }, [animate, delay]);

  // 使用Intersection Observer检测元素是否可见
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry.isIntersecting && !hasAnimatedRef.current) {
          startAnimation();
        }
      },
      { threshold: 0.1 } // 元素进入视口10%时触发
    );

    if (elementRef.current) {
      observer.observe(elementRef.current);
    }

    return () => {
      observer.disconnect();
    };
  }, [startAnimation]);

  // 清理动画
  useEffect(() => {
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);

  return (
    <span ref={elementRef} className={className}>
      {prefix}{formatNumber(count)}{suffix}
    </span>
  );
});

CountUpAnimation.displayName = 'CountUpAnimation';

export default CountUpAnimation;
