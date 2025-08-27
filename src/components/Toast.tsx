import React, { useState, useEffect, useCallback, createContext, useContext } from 'react';
import { X, CheckCircle, AlertCircle, AlertTriangle, Info } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';
export type ToastPosition = 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left' | 'top-center' | 'bottom-center';

export interface ToastMessage {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  duration?: number;
  persistent?: boolean;
  action?: {
    label: string;
    onClick: () => void;
  };
}

interface ToastContextValue {
  showToast: (toast: Omit<ToastMessage, 'id'>) => string;
  hideToast: (id: string) => void;
  hideAllToasts: () => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};

interface ToastProviderProps {
  children: React.ReactNode;
  position?: ToastPosition;
  maxToasts?: number;
}

export const ToastProvider: React.FC<ToastProviderProps> = ({
  children,
  position = 'top-right',
  maxToasts = 5
}) => {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const showToast = useCallback((toast: Omit<ToastMessage, 'id'>) => {
    const id = Math.random().toString(36).substring(2) + Date.now().toString(36);
    const newToast: ToastMessage = {
      id,
      duration: 5000,
      persistent: false,
      ...toast
    };

    setToasts(prev => {
      const updated = [newToast, ...prev];
      return updated.slice(0, maxToasts);
    });

    // 自动隐藏（非持久化的toast）
    if (!newToast.persistent && newToast.duration && newToast.duration > 0) {
      setTimeout(() => {
        hideToast(id);
      }, newToast.duration);
    }

    return id;
  }, [maxToasts]);

  const hideToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  }, []);

  const hideAllToasts = useCallback(() => {
    setToasts([]);
  }, []);

  const getPositionClasses = () => {
    switch (position) {
      case 'top-right':
        return 'top-4 right-4';
      case 'top-left':
        return 'top-4 left-4';
      case 'bottom-right':
        return 'bottom-4 right-4';
      case 'bottom-left':
        return 'bottom-4 left-4';
      case 'top-center':
        return 'top-4 left-1/2 transform -translate-x-1/2';
      case 'bottom-center':
        return 'bottom-4 left-1/2 transform -translate-x-1/2';
      default:
        return 'top-4 right-4';
    }
  };

  return (
    <ToastContext.Provider value={{ showToast, hideToast, hideAllToasts }}>
      {children}
      
      {/* Toast容器 */}
      <div 
        className={`fixed ${getPositionClasses()} z-50 space-y-3`}
        role="alert"
        aria-live="polite"
      >
        {toasts.map(toast => (
          <ToastItem
            key={toast.id}
            toast={toast}
            onClose={() => hideToast(toast.id)}
          />
        ))}
      </div>
    </ToastContext.Provider>
  );
};

interface ToastItemProps {
  toast: ToastMessage;
  onClose: () => void;
}

const ToastItem: React.FC<ToastItemProps> = ({ toast, onClose }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [isExiting, setIsExiting] = useState(false);

  // 进入动画
  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), 50);
    return () => clearTimeout(timer);
  }, []);

  // 处理关闭动画
  const handleClose = useCallback(() => {
    setIsExiting(true);
    setTimeout(onClose, 300); // 等待退出动画完成
  }, [onClose]);

  const getIcon = () => {
    const iconClass = 'w-5 h-5 flex-shrink-0';
    switch (toast.type) {
      case 'success':
        return <CheckCircle className={`${iconClass} text-green-500`} />;
      case 'error':
        return <AlertCircle className={`${iconClass} text-red-500`} />;
      case 'warning':
        return <AlertTriangle className={`${iconClass} text-yellow-500`} />;
      case 'info':
        return <Info className={`${iconClass} text-blue-500`} />;
    }
  };

  const getTypeClasses = () => {
    switch (toast.type) {
      case 'success':
        return 'bg-green-50 border-green-200';
      case 'error':
        return 'bg-red-50 border-red-200';
      case 'warning':
        return 'bg-yellow-50 border-yellow-200';
      case 'info':
        return 'bg-blue-50 border-blue-200';
    }
  };

  const getTitleColor = () => {
    switch (toast.type) {
      case 'success':
        return 'text-green-800';
      case 'error':
        return 'text-red-800';
      case 'warning':
        return 'text-yellow-800';
      case 'info':
        return 'text-blue-800';
    }
  };

  const getMessageColor = () => {
    switch (toast.type) {
      case 'success':
        return 'text-green-600';
      case 'error':
        return 'text-red-600';
      case 'warning':
        return 'text-yellow-600';
      case 'info':
        return 'text-blue-600';
    }
  };

  return (
    <div
      className={`
        ${getTypeClasses()}
        border rounded-lg shadow-lg p-4 min-w-72 max-w-md
        transform transition-all duration-300 ease-out
        ${isVisible && !isExiting 
          ? 'translate-x-0 opacity-100 scale-100' 
          : 'translate-x-full opacity-0 scale-95'
        }
      `}
      role="alert"
      aria-atomic="true"
    >
      <div className="flex items-start space-x-3">
        {/* 图标 */}
        <div className="flex-shrink-0 pt-0.5">
          {getIcon()}
        </div>

        {/* 内容 */}
        <div className="flex-1 min-w-0">
          <div className={`font-medium ${getTitleColor()} text-sm mb-1`}>
            {toast.title}
          </div>
          
          {toast.message && (
            <div className={`${getMessageColor()} text-sm leading-relaxed`}>
              {toast.message}
            </div>
          )}

          {/* 操作按钮 */}
          {toast.action && (
            <div className="mt-3">
              <button
                onClick={toast.action.onClick}
                className={`
                  text-sm font-medium px-3 py-1.5 rounded-md transition-colors
                  ${toast.type === 'success' 
                    ? 'text-green-700 bg-green-100 hover:bg-green-200' 
                    : toast.type === 'error'
                    ? 'text-red-700 bg-red-100 hover:bg-red-200'
                    : toast.type === 'warning'
                    ? 'text-yellow-700 bg-yellow-100 hover:bg-yellow-200'
                    : 'text-blue-700 bg-blue-100 hover:bg-blue-200'
                  }
                `}
              >
                {toast.action.label}
              </button>
            </div>
          )}
        </div>

        {/* 关闭按钮 */}
        <button
          onClick={handleClose}
          className="flex-shrink-0 text-gray-400 hover:text-gray-600 transition-colors p-1"
          aria-label="关闭通知"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* 进度条（仅非持久化toast显示） */}
      {!toast.persistent && toast.duration && (
        <div className="mt-3">
          <div className="bg-gray-200 rounded-full h-1 overflow-hidden">
            <div 
              className={`h-full transition-all ease-linear ${
                toast.type === 'success' ? 'bg-green-400' :
                toast.type === 'error' ? 'bg-red-400' :
                toast.type === 'warning' ? 'bg-yellow-400' :
                'bg-blue-400'
              }`}
              style={{
                width: '100%',
                animation: `shrink ${toast.duration}ms linear`
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
};

// 便捷的toast函数
export const createToastHelpers = (showToast: ToastContextValue['showToast']) => ({
  success: (title: string, message?: string, options?: Partial<ToastMessage>) => 
    showToast({ type: 'success', title, message, ...options }),
  
  error: (title: string, message?: string, options?: Partial<ToastMessage>) => 
    showToast({ type: 'error', title, message, ...options }),
  
  warning: (title: string, message?: string, options?: Partial<ToastMessage>) => 
    showToast({ type: 'warning', title, message, ...options }),
  
  info: (title: string, message?: string, options?: Partial<ToastMessage>) => 
    showToast({ type: 'info', title, message, ...options })
});

// CSS动画样式（需要添加到全局CSS中）
export const toastStyles = `
@keyframes shrink {
  from {
    width: 100%;
  }
  to {
    width: 0%;
  }
}
`;