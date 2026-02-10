import React from 'react';
import { AlertTriangle, RefreshCw, X, Wifi, Lock, Server } from 'lucide-react';
import { ERROR_CODES, type AppError } from '../lib/api';

// Phase 3优化: 人性化错误信息映射
function humanizeErrorMessage(error: AppError): { title: string; message: string; action?: string } {
  // 先按错误码映射
  switch (error.code) {
    case ERROR_CODES.NETWORK_ERROR:
      return {
        title: '网络连接问题',
        message: '无法连接到服务器，请检查您的网络设置',
        action: '您可以：检查网络连接 → 刷新页面重试'
      };
    case ERROR_CODES.TIMEOUT_ERROR:
      return {
        title: '请求超时',
        message: '服务器响应时间过长，请稍后再试',
        action: '您可以：稍等片刻后重试 → 检查网络是否稳定'
      };
    case ERROR_CODES.AUTH_ERROR:
      return {
        title: '身份验证失败',
        message: '您的登录状态可能已过期，请重新登录',
        action: '请重新登录后再试'
      };
    case ERROR_CODES.FORBIDDEN:
      return {
        title: '权限不足',
        message: '您没有执行此操作的权限',
      };
    case ERROR_CODES.SERVER_ERROR:
      return {
        title: '服务器暂时出现问题',
        message: '我们正在修复中，请稍后再试',
        action: '通常会在几分钟内恢复'
      };
    case ERROR_CODES.NOT_FOUND:
      return {
        title: '资源不存在',
        message: '请求的内容可能已被移除或地址有误',
      };
    case ERROR_CODES.VALIDATION_ERROR:
      return {
        title: '数据验证失败',
        message: error.message || '请检查输入内容是否正确',
      };
  }

  // 兜底：按关键词匹配 error.message
  const msg = error.message || '';
  if (msg.includes('Failed to fetch') || msg.includes('fetch')) {
    return {
      title: '网络连接失败',
      message: '无法连接到服务器，请检查您的网络设置',
      action: '您可以：刷新页面重试 → 检查网络连接'
    };
  }
  if (msg.includes('timeout') || msg.includes('Timeout')) {
    return {
      title: '请求超时',
      message: '服务器响应时间过长，请稍后再试',
    };
  }

  return {
    title: '发生错误',
    message: msg || '操作未能完成，请稍后再试',
    action: '如问题持续，请联系支持'
  };
}

interface ErrorDisplayProps {
  error: AppError | null;
  onRetry?: () => void;
  onDismiss?: () => void;
  canRetry?: boolean;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

const ErrorDisplay: React.FC<ErrorDisplayProps> = ({
  error,
  onRetry,
  onDismiss,
  canRetry = false,
  className = '',
  size = 'md'
}) => {
  if (!error) return null;

  const humanized = humanizeErrorMessage(error);

  const getErrorIcon = () => {
    switch (error.code) {
      case ERROR_CODES.NETWORK_ERROR:
      case ERROR_CODES.TIMEOUT_ERROR:
        return <Wifi className="h-5 w-5 text-orange-500" />;
      case ERROR_CODES.AUTH_ERROR:
      case ERROR_CODES.FORBIDDEN:
        return <Lock className="h-5 w-5 text-red-500" />;
      case ERROR_CODES.SERVER_ERROR:
        return <Server className="h-5 w-5 text-red-500" />;
      default:
        return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
    }
  };

  const getErrorColor = () => {
    switch (error.code) {
      case ERROR_CODES.NETWORK_ERROR:
      case ERROR_CODES.TIMEOUT_ERROR:
        return 'border-orange-200 bg-orange-50 text-orange-800';
      case ERROR_CODES.AUTH_ERROR:
      case ERROR_CODES.FORBIDDEN:
        return 'border-red-200 bg-red-50 text-red-800';
      case ERROR_CODES.SERVER_ERROR:
        return 'border-red-200 bg-red-50 text-red-800';
      default:
        return 'border-yellow-200 bg-yellow-50 text-yellow-800';
    }
  };

  const sizeClasses = {
    sm: 'p-3 text-sm',
    md: 'p-4',
    lg: 'p-6 text-lg'
  };

  return (
    <div className={`border rounded-lg ${getErrorColor()} ${sizeClasses[size]} ${className}`}>
      <div className="flex items-start">
        <div className="flex-shrink-0">
          {getErrorIcon()}
        </div>
        <div className="ml-3 flex-1">
          <h3 className="font-medium">
            {humanized.title}
          </h3>
          <p className="mt-1 opacity-90">
            {humanized.message}
          </p>
          {humanized.action && (
            <p className="mt-1 text-xs opacity-75">
              {humanized.action}
            </p>
          )}
          {process.env.NODE_ENV === 'development' && error.details && (
            <details className="mt-2 text-xs opacity-70">
              <summary className="cursor-pointer">技术细节</summary>
              <pre className="mt-1 whitespace-pre-wrap">
                {JSON.stringify(error.details, null, 2)}
              </pre>
            </details>
          )}
        </div>
        <div className="ml-4 flex-shrink-0 flex space-x-2">
          {canRetry && onRetry && (
            <button
              onClick={onRetry}
              className="inline-flex items-center px-3 py-1 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              <RefreshCw className="h-3 w-3 mr-1" />
              重试
            </button>
          )}
          {onDismiss && (
            <button
              onClick={onDismiss}
              className="inline-flex items-center p-1 border border-transparent rounded-md text-gray-400 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ErrorDisplay;
