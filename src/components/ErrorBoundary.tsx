import React, { Component, ErrorInfo } from 'react';
import { AlertCircle, RefreshCw, Home } from 'lucide-react';

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error, errorInfo: null };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.group('🔴 React错误边界捕获到错误');
    console.error('错误详情:', error);
    console.error('组件堆栈:', errorInfo.componentStack);
    console.groupEnd();

    // 设置错误信息到state
    this.setState({
      error,
      errorInfo
    });

    // 生产环境中可以发送错误报告到监控服务
    if (process.env.NODE_ENV === 'production') {
      // TODO: 集成错误监控服务 (如Sentry)
      // reportErrorToService(error, errorInfo);
    }
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  handleGoHome = () => {
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      // 如果提供了自定义fallback UI
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
          <div className="max-w-lg w-full bg-white rounded-xl shadow-lg p-8 text-center">
            <div className="text-red-500 mb-6">
              <AlertCircle className="w-20 h-20 mx-auto" />
            </div>
            
            <h1 className="text-2xl font-bold text-gray-900 mb-3">
              页面遇到了问题
            </h1>
            
            <p className="text-gray-600 mb-8 leading-relaxed">
              抱歉，应用程序遇到了意外错误。我们已记录此问题，请尝试以下操作：
            </p>

            <div className="space-y-3 mb-6">
              <button
                onClick={this.handleRetry}
                className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-blue-700 transition-colors flex items-center justify-center"
              >
                <RefreshCw className="w-5 h-5 mr-2" />
                重试
              </button>
              
              <button
                onClick={() => window.location.reload()}
                className="w-full bg-gray-100 text-gray-700 py-3 px-4 rounded-lg font-medium hover:bg-gray-200 transition-colors"
              >
                刷新页面
              </button>
              
              <button
                onClick={this.handleGoHome}
                className="w-full bg-green-100 text-green-700 py-3 px-4 rounded-lg font-medium hover:bg-green-200 transition-colors flex items-center justify-center"
              >
                <Home className="w-5 h-5 mr-2" />
                返回首页
              </button>
            </div>

            {/* 开发环境显示错误详情 */}
            {process.env.NODE_ENV === 'development' && this.state.error && (
              <details className="text-left bg-gray-50 rounded-lg p-4">
                <summary className="cursor-pointer text-sm font-medium text-gray-700 hover:text-gray-900 mb-2">
                  🔧 开发者信息 (仅开发环境显示)
                </summary>
                <div className="space-y-3">
                  <div>
                    <h4 className="text-xs font-semibold text-red-600 mb-1">错误消息:</h4>
                    <pre className="text-xs bg-red-50 p-2 rounded text-red-700 overflow-auto">
                      {this.state.error.message}
                    </pre>
                  </div>
                  <div>
                    <h4 className="text-xs font-semibold text-red-600 mb-1">错误堆栈:</h4>
                    <pre className="text-xs bg-red-50 p-2 rounded text-red-700 overflow-auto max-h-32">
                      {this.state.error.stack}
                    </pre>
                  </div>
                  {this.state.errorInfo && (
                    <div>
                      <h4 className="text-xs font-semibold text-red-600 mb-1">组件堆栈:</h4>
                      <pre className="text-xs bg-red-50 p-2 rounded text-red-700 overflow-auto max-h-32">
                        {this.state.errorInfo.componentStack}
                      </pre>
                    </div>
                  )}
                </div>
              </details>
            )}
            
            <p className="text-xs text-gray-400 mt-4">
              错误ID: {Date.now().toString(36)}
            </p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;