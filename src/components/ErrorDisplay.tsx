import React from 'react';
import { AlertTriangle, RefreshCw, X, Wifi, Lock, Server } from 'lucide-react';
import { ERROR_CODES, type AppError } from '../lib/api';

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
            {error.code === ERROR_CODES.NETWORK_ERROR && '网络连接问题'}
            {error.code === ERROR_CODES.TIMEOUT_ERROR && '请求超时'}
            {error.code === ERROR_CODES.AUTH_ERROR && '身份验证失败'}
            {error.code === ERROR_CODES.FORBIDDEN && '权限不足'}
            {error.code === ERROR_CODES.SERVER_ERROR && '服务器错误'}
            {error.code === ERROR_CODES.VALIDATION_ERROR && '数据验证失败'}
            {error.code === ERROR_CODES.NOT_FOUND && '资源不存在'}
            {error.code === ERROR_CODES.UNKNOWN_ERROR && '发生错误'}
          </h3>
          <p className="mt-1 opacity-90">
            {error.message}
          </p>
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
