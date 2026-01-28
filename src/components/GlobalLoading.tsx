import React from 'react';
import { Loader2 } from 'lucide-react';

interface GlobalLoadingProps {
  /**
   * 是否显示加载状态
   */
  isLoading: boolean;
  /**
   * 加载提示文字
   */
  message?: string;
  /**
   * 加载器大小
   */
  size?: 'sm' | 'md' | 'lg';
  /**
   * 是否显示背景遮罩
   */
  withBackdrop?: boolean;
  /**
   * 子元素（加载时不显示）
   */
  children: React.ReactNode;
}

/**
 * 全局加载组件
 * 用于页面级别的加载状态显示
 */
const GlobalLoading: React.FC<GlobalLoadingProps> = ({
  isLoading,
  message = '加载中...',
  size = 'md',
  withBackdrop = true,
  children
}) => {
  const sizeClasses = {
    sm: 'w-5 h-5',
    md: 'w-8 h-8',
    lg: 'w-12 h-12'
  };

  const textSizeClasses = {
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-lg'
  };

  if (!isLoading) {
    return <>{children}</>;
  }

  return (
    <>
      {withBackdrop && (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40" aria-hidden="true" />
      )}
      <div
        className={`fixed inset-0 flex items-center justify-center z-50 ${withBackdrop ? '' : 'absolute'} `}
        role="status"
        aria-live="polite"
        aria-label={message}
      >
        <div className="bg-white rounded-2xl shadow-xl p-8 flex flex-col items-center space-y-4 max-w-xs mx-auto">
          <Loader2 className={`${sizeClasses[size]} text-blue-600 animate-spin`} />
          <p className={`${textSizeClasses[size]} text-gray-700 font-medium`}>
            {message}
          </p>
        </div>
      </div>
    </>
  );
};

export default GlobalLoading;
