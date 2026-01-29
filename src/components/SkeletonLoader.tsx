import React from 'react';

/**
 * SkeletonLoader 组件 - 通用骨架屏
 *
 * 用于在内容加载时显示占位符，提升用户体验
 */

export interface SkeletonProps {
  /**
   * 骨架屏类型
   */
  variant?: 'text' | 'circular' | 'rectangular' | 'rounded';

  /**
   * 宽度
   */
  width?: string | number;

  /**
   * 高度
   */
  height?: string | number;

  /**
   * 是否显示动画
   */
  animation?: 'pulse' | 'wave' | 'none';

  /**
   * 自定义类名
   */
  className?: string;

  /**
   * 自定义样式
   */
  style?: React.CSSProperties;

  /**
   * 文本骨架屏时显示的行数
   */
  lines?: number;
}

/**
 * 骨架屏动画样式
 */
const animationStyles = {
  pulse: 'animate-pulse',
  wave: 'animate-shimmer',
  none: ''
};

/**
 * 形状样式映射
 */
const shapeStyles = {
  text: 'rounded',
  circular: 'rounded-full',
  rectangular: 'rounded-none',
  rounded: 'rounded-lg'
};

/**
 * 单个骨架屏元素
 */
export const Skeleton = React.memo<SkeletonProps>(({
  variant = 'text',
  width,
  height,
  animation = 'pulse',
  className = '',
  style
}) => {
  const shapeClass = shapeStyles[variant];
  const animationClass = animationStyles[animation];

  const combinedStyle: React.CSSProperties = {
    ...style,
    ...(width && { width: typeof width === 'number' ? `${width}px` : width }),
    ...(height && { height: typeof height === 'number' ? `${height}px` : height })
  };

  return (
    <div
      className={`bg-gray-200 ${shapeClass} ${animationClass} ${className}`}
      style={combinedStyle}
      aria-hidden="true"
      role="presentation"
    />
  );
});

Skeleton.displayName = 'Skeleton';

/**
 * 文本骨架屏 - 多行
 */
interface SkeletonTextProps {
  /**
   * 行数
   */
  lines?: number;

  /**
   * 每行宽度比例 (可选)
   */
  widths?: Array<string | number>;

  /**
   * 行高
   */
  lineHeight?: string | number;

  /**
   * 行间距
   */
  spacing?: string;

  /**
   * 最后一行宽度比例 (0-1)
   */
  lastLineWidth?: number;

  /**
   * 自定义类名
   */
  className?: string;
}

export const SkeletonText = React.memo<SkeletonTextProps>(({
  lines = 3,
  widths,
  lineHeight = 16,
  spacing = '8px',
  lastLineWidth = 0.7,
  className = ''
}) => {
  return (
    <div className={`space-y-[${spacing}] ${className}`} aria-hidden="true">
      {Array.from({ length: lines }).map((_, index) => {
        const isLast = index === lines - 1;
        const width = widths?.[index] ?? (isLast ? `${lastLineWidth * 100}%` : '100%');

        return (
          <Skeleton
            key={index}
            variant="text"
            height={lineHeight}
            width={width}
          />
        );
      })}
    </div>
  );
});

SkeletonText.displayName = 'SkeletonText';

/**
 * 头像骨架屏
 */
interface SkeletonAvatarProps {
  /**
   * 尺寸
   */
  size?: string | number;

  /**
   * 形状
   */
  variant?: 'circle' | 'square' | 'rounded';

  /**
   * 自定义类名
   */
  className?: string;
}

export const SkeletonAvatar = React.memo<SkeletonAvatarProps>(({
  size = 40,
  variant = 'circle',
  className = ''
}) => {
  const variantMap = {
    circle: 'circular' as const,
    square: 'rectangular' as const,
    rounded: 'rounded' as const
  };

  return (
    <Skeleton
      variant={variantMap[variant]}
      width={size}
      height={size}
      className={className}
    />
  );
});

SkeletonAvatar.displayName = 'SkeletonAvatar';

/**
 * 卡片骨架屏
 */
interface SkeletonCardProps {
  /**
   * 是否显示头像
   */
  showAvatar?: boolean;

  /**
   * 是否显示标题
   */
  showTitle?: boolean;

  /**
   * 文本行数
   */
  textLines?: number;

  /**
   * 是否显示底部操作栏
   */
  showActions?: boolean;

  /**
   * 自定义类名
   */
  className?: string;
}

export const SkeletonCard = React.memo<SkeletonCardProps>(({
  showAvatar = true,
  showTitle = true,
  textLines = 3,
  showActions = true,
  className = ''
}) => {
  return (
    <div className={`bg-white rounded-lg p-4 ${className}`} aria-hidden="true">
      {/* 头部区域 */}
      <div className="flex items-start space-x-4 mb-4">
        {showAvatar && (
          <SkeletonAvatar size={48} variant="rounded" />
        )}

        <div className="flex-1 space-y-2">
          {showTitle && (
            <Skeleton width="60%" height={20} />
          )}
          <Skeleton width="40%" height={14} />
        </div>
      </div>

      {/* 内容区域 */}
      <div className="space-y-2">
        <SkeletonText lines={textLines} lastLineWidth={0.8} />
      </div>

      {/* 底部操作栏 */}
      {showActions && (
        <div className="flex justify-between items-center mt-4 pt-4 border-t border-gray-200">
          <Skeleton width={80} height={32} variant="rounded" />
          <Skeleton width={60} height={32} variant="rounded" />
        </div>
      )}
    </div>
  );
});

SkeletonCard.displayName = 'SkeletonCard';

/**
 * 表格骨架屏
 */
interface SkeletonTableProps {
  /**
   * 行数
   */
  rows?: number;

  /**
   * 列数
   */
  columns?: number;

  /**
   * 是否显示表头
   */
  showHeader?: boolean;

  /**
   * 自定义类名
   */
  className?: string;
}

export const SkeletonTable = React.memo<SkeletonTableProps>(({
  rows = 5,
  columns = 4,
  showHeader = true,
  className = ''
}) => {
  return (
    <div className={`w-full ${className}`} aria-hidden="true">
      {/* 表头 */}
      {showHeader && (
        <div className="flex space-x-4 mb-4 pb-2 border-b border-gray-200">
          {Array.from({ length: columns }).map((_, index) => (
            <Skeleton
              key={`header-${index}`}
              width={`${100 / columns}%`}
              height={20}
            />
          ))}
        </div>
      )}

      {/* 表格行 */}
      <div className="space-y-3">
        {Array.from({ length: rows }).map((_, rowIndex) => (
          <div key={`row-${rowIndex}`} className="flex space-x-4">
            {Array.from({ length: columns }).map((_, colIndex) => (
              <Skeleton
                key={`cell-${rowIndex}-${colIndex}`}
                width={`${100 / columns}%`}
                height={16}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
});

SkeletonTable.displayName = 'SkeletonTable';

/**
 * 加载状态容器
 */
interface SkeletonWrapperProps {
  /**
   * 是否正在加载
   */
  loading: boolean;

  /**
   * 子元素
   */
  children: React.ReactNode;

  /**
   * 骨架屏组件
   */
  skeleton: React.ReactNode;

  /**
   * 自定义类名
   */
  className?: string;
}

export const SkeletonWrapper = React.memo<SkeletonWrapperProps>(({
  loading,
  children,
  skeleton,
  className = ''
}) => {
  if (loading) {
    return <div className={className}>{skeleton}</div>;
  }

  return <>{children}</>;
});

SkeletonWrapper.displayName = 'SkeletonWrapper';

export default Skeleton;
