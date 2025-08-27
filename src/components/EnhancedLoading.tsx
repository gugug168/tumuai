import React from 'react';
import { Loader2, Wifi, WifiOff, RefreshCw, AlertTriangle } from 'lucide-react';

export type LoadingState = 'loading' | 'error' | 'offline' | 'retrying' | 'success' | 'empty';

interface EnhancedLoadingProps {
  state: LoadingState;
  message?: string;
  error?: string;
  retryCount?: number;
  onRetry?: () => void;
  onRefresh?: () => void;
  size?: 'sm' | 'md' | 'lg';
  showProgress?: boolean;
  progress?: number; // 0-100
  children?: React.ReactNode;
}

const EnhancedLoading: React.FC<EnhancedLoadingProps> = ({
  state,
  message,
  error,
  retryCount = 0,
  onRetry,
  onRefresh,
  size = 'md',
  showProgress = false,
  progress = 0,
  children
}) => {
  const sizeClasses = {
    sm: 'p-4',
    md: 'p-8',
    lg: 'p-12'
  };

  const iconSizes = {
    sm: 'w-4 h-4',
    md: 'w-8 h-8',
    lg: 'w-12 h-12'
  };

  const textSizes = {
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-lg'
  };

  const getStateConfig = () => {
    switch (state) {
      case 'loading':
        return {
          icon: <Loader2 className={`${iconSizes[size]} text-blue-500 animate-spin`} />,
          title: '加载中...',
          titleColor: 'text-blue-700',
          bgColor: 'bg-blue-50',
          borderColor: 'border-blue-200'
        };
      
      case 'error':
        return {
          icon: <AlertTriangle className={`${iconSizes[size]} text-red-500`} />,
          title: '加载失败',
          titleColor: 'text-red-700',
          bgColor: 'bg-red-50',
          borderColor: 'border-red-200'
        };
      
      case 'offline':
        return {
          icon: <WifiOff className={`${iconSizes[size]} text-orange-500`} />,
          title: '网络离线',
          titleColor: 'text-orange-700',
          bgColor: 'bg-orange-50',
          borderColor: 'border-orange-200'
        };
      
      case 'retrying':
        return {
          icon: <RefreshCw className={`${iconSizes[size]} text-blue-500 animate-spin`} />,
          title: `正在重试 ${retryCount > 0 ? `(第${retryCount}次)` : ''}`,
          titleColor: 'text-blue-700',
          bgColor: 'bg-blue-50',
          borderColor: 'border-blue-200'
        };
      
      case 'empty':
        return {
          icon: <div className={`${iconSizes[size]} text-gray-300 flex items-center justify-center`}>
            <svg fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
            </svg>
          </div>,
          title: '暂无数据',
          titleColor: 'text-gray-700',
          bgColor: 'bg-gray-50',
          borderColor: 'border-gray-200'
        };
      
      default:
        return {
          icon: null,
          title: '',
          titleColor: 'text-gray-700',
          bgColor: 'bg-gray-50',
          borderColor: 'border-gray-200'
        };
    }
  };

  const config = getStateConfig();

  if (state === 'success' && children) {
    return <>{children}</>;
  }

  return (
    <div 
      className={`
        ${sizeClasses[size]} 
        ${config.bgColor} 
        ${config.borderColor}
        border rounded-lg text-center
      `}
      role="status" 
      aria-live="polite"
      aria-label={`${config.title}${message ? `: ${message}` : ''}`}
    >
      {/* 状态图标 */}
      <div className="flex justify-center mb-4">
        {config.icon}
      </div>

      {/* 主标题 */}
      <div className={`font-medium ${config.titleColor} ${textSizes[size]} mb-2`}>
        {config.title}
      </div>

      {/* 详细消息 */}
      {message && (
        <div className={`text-gray-600 ${textSizes.sm} mb-4`}>
          {message}
        </div>
      )}

      {/* 错误信息 */}
      {error && state === 'error' && (
        <div className="text-red-600 bg-red-100 border border-red-200 rounded-md p-3 text-sm mb-4">
          {error}
        </div>
      )}

      {/* 进度条 */}
      {showProgress && state === 'loading' && (
        <div className="mb-4">
          <div className="bg-gray-200 rounded-full h-2 overflow-hidden">
            <div 
              className="bg-blue-500 h-full transition-all duration-300 ease-out"
              style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
              role="progressbar"
              aria-valuenow={progress}
              aria-valuemin={0}
              aria-valuemax={100}
            />
          </div>
          <div className="text-xs text-gray-500 mt-1">
            {Math.round(progress)}% 完成
          </div>
        </div>
      )}

      {/* 重试次数指示 */}
      {retryCount > 0 && (state === 'error' || state === 'retrying') && (
        <div className="text-xs text-gray-500 mb-3">
          已重试 {retryCount} 次
        </div>
      )}

      {/* 操作按钮 */}
      <div className="flex justify-center space-x-3">
        {/* 重试按钮 */}
        {onRetry && (state === 'error' || state === 'offline') && (
          <button
            onClick={onRetry}
            className="inline-flex items-center px-4 py-2 text-sm font-medium text-blue-700 bg-blue-100 border border-blue-200 rounded-md hover:bg-blue-200 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            disabled={state === 'retrying'}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${state === 'retrying' ? 'animate-spin' : ''}`} />
            重试
          </button>
        )}

        {/* 刷新按钮 */}
        {onRefresh && state === 'offline' && (
          <button
            onClick={onRefresh}
            className="inline-flex items-center px-4 py-2 text-sm font-medium text-green-700 bg-green-100 border border-green-200 rounded-md hover:bg-green-200 transition-colors focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
          >
            <Wifi className="w-4 h-4 mr-2" />
            检查网络
          </button>
        )}
      </div>

      {/* 额外内容 */}
      {children && (
        <div className="mt-4">
          {children}
        </div>
      )}
    </div>
  );
};

// 简化版本的快速加载组件
export const QuickLoader: React.FC<{
  text?: string;
  size?: 'sm' | 'md' | 'lg';
}> = ({ text = '加载中...', size = 'md' }) => {
  return (
    <EnhancedLoading 
      state="loading" 
      message={text} 
      size={size}
    />
  );
};

// 错误状态组件
export const ErrorState: React.FC<{
  error: string;
  onRetry?: () => void;
  retryCount?: number;
}> = ({ error, onRetry, retryCount }) => {
  return (
    <EnhancedLoading 
      state="error" 
      error={error} 
      onRetry={onRetry}
      retryCount={retryCount}
    />
  );
};

// 空状态组件
export const EmptyState: React.FC<{
  message?: string;
  children?: React.ReactNode;
}> = ({ message = '暂无数据', children }) => {
  return (
    <EnhancedLoading 
      state="empty" 
      message={message}
    >
      {children}
    </EnhancedLoading>
  );
};

EnhancedLoading.displayName = 'EnhancedLoading';

export default EnhancedLoading;