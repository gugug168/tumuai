import React from 'react';
import { AlertTriangle, RefreshCw, X, Wifi, Lock, Server, HelpCircle } from 'lucide-react';
import { ERROR_CODES, type AppError } from '../lib/api';

// Phase 3优化: 人性化错误信息映射，包含操作建议
function humanizeErrorMessage(error: AppError): {
  title: string;
  message: string;
  actions?: { label: string; description: string }[];
  icon?: 'wifi' | 'lock' | 'server' | 'alert';
} {
  // 先按错误码映射
  switch (error.code) {
    case ERROR_CODES.NETWORK_ERROR:
      return {
        title: '网络连接问题',
        message: '无法连接到服务器，可能是网络不稳定或服务器繁忙',
        icon: 'wifi',
        actions: [
          { label: '检查网络', description: '确保您已连接到互联网' },
          { label: '刷新页面', description: '点击下方重试按钮' },
          { label: '稍后重试', description: '等待几分钟后再次尝试' }
        ]
      };
    case ERROR_CODES.TIMEOUT_ERROR:
      return {
        title: '请求超时',
        message: '服务器响应时间过长，可能是网络拥堵或服务器负载高',
        icon: 'wifi',
        actions: [
          { label: '稍等片刻', description: '等待30秒后重试' },
          { label: '检查网络', description: '确保网络连接稳定' }
        ]
      };
    case ERROR_CODES.AUTH_ERROR:
      return {
        title: '登录已过期',
        message: '您的登录状态已失效，请重新登录',
        icon: 'lock',
        actions: [
          { label: '重新登录', description: '点击右上角登录按钮' }
        ]
      };
    case ERROR_CODES.FORBIDDEN:
      return {
        title: '权限不足',
        message: '您没有执行此操作的权限，可能需要管理员授权',
        icon: 'lock',
        actions: [
          { label: '联系管理员', description: '申请相应权限' }
        ]
      };
    case ERROR_CODES.SERVER_ERROR:
      return {
        title: '服务器开小差了',
        message: '服务器暂时出现问题，我们已收到通知并正在修复',
        icon: 'server',
        actions: [
          { label: '稍后重试', description: '通常几分钟内恢复' },
          { label: '联系我们', description: '如问题持续，请联系客服' }
        ]
      };
    case ERROR_CODES.NOT_FOUND:
      return {
        title: '内容不存在',
        message: '您访问的内容可能已被移除、更名或地址有误',
        icon: 'alert',
        actions: [
          { label: '返回首页', description: '浏览其他内容' },
          { label: '检查地址', description: '确认链接是否正确' }
        ]
      };
    case ERROR_CODES.VALIDATION_ERROR:
      return {
        title: '数据验证失败',
        message: error.message || '您输入的内容不符合要求，请检查后重试',
        icon: 'alert',
        actions: [
          { label: '检查输入', description: '确保所有必填项已正确填写' }
        ]
      };
  }

  // 兜底：按关键词匹配 error.message
  const msg = error.message || '';
  if (msg.includes('Failed to fetch') || msg.includes('fetch')) {
    return {
      title: '网络连接失败',
      message: '无法连接到服务器，请检查您的网络设置',
      icon: 'wifi',
      actions: [
        { label: '刷新页面', description: '点击下方重试按钮' },
        { label: '检查网络', description: '确保网络连接正常' }
      ]
    };
  }
  if (msg.includes('timeout') || msg.includes('Timeout')) {
    return {
      title: '请求超时',
      message: '服务器响应时间过长，请稍后再试',
      icon: 'wifi'
    };
  }

  return {
    title: '出现了一点问题',
    message: msg || '操作未能完成，请稍后再试',
    icon: 'alert',
    actions: [
      { label: '刷新重试', description: '点击下方重试按钮' }
    ]
  };
}

interface ErrorDisplayProps {
  error: AppError | null;
  onRetry?: () => void;
  onDismiss?: () => void;
  canRetry?: boolean;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  /** 显示详细的操作建议 */
  showActions?: boolean;
}

const ErrorDisplay: React.FC<ErrorDisplayProps> = ({
  error,
  onRetry,
  onDismiss,
  canRetry = false,
  className = '',
  size = 'md',
  showActions = true
}) => {
  if (!error) return null;

  const humanized = humanizeErrorMessage(error);

  const getErrorIcon = () => {
    const iconMap = {
      wifi: <Wifi className="h-5 w-5 text-orange-500" />,
      lock: <Lock className="h-5 w-5 text-red-500" />,
      server: <Server className="h-5 w-5 text-red-500" />,
      alert: <AlertTriangle className="h-5 w-5 text-yellow-500" />
    };
    return iconMap[humanized.icon || 'alert'];
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
    <div
      role="alert"
      aria-live="polite"
      className={`border rounded-lg ${getErrorColor()} ${sizeClasses[size]} ${className}`}
    >
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

          {/* 操作建议 */}
          {showActions && humanized.actions && humanized.actions.length > 0 && (
            <div className="mt-3 p-3 bg-white/50 rounded-lg border border-current/10">
              <p className="text-xs font-medium opacity-75 mb-2 flex items-center">
                <HelpCircle className="w-3 h-3 mr-1" />
                您可以尝试：
              </p>
              <ul className="space-y-1">
                {humanized.actions.map((action, index) => (
                  <li key={index} className="text-xs flex items-start">
                    <span className="font-medium mr-1.5">{index + 1}.</span>
                    <span>
                      <span className="font-medium">{action.label}</span>
                      <span className="opacity-70 ml-1">- {action.description}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
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
        <div className="ml-4 flex-shrink-0 flex flex-col space-y-2">
          {canRetry && onRetry && (
            <button
              onClick={onRetry}
              className="inline-flex items-center justify-center px-3 py-1.5 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
            >
              <RefreshCw className="h-3 w-3 mr-1.5" />
              重试
            </button>
          )}
          {onDismiss && (
            <button
              onClick={onDismiss}
              className="inline-flex items-center justify-center p-1.5 border border-transparent rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 transition-colors"
              aria-label="关闭"
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
