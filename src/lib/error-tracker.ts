/**
 * ============================================
 * 错误追踪系统 - ErrorTracker
 * ============================================
 *
 * 功能:
 * - 全局 JavaScript 错误捕获
 * - Promise rejection 捕获
 * - React 错误边界集成
 * - API 错误追踪
 * - 用户会话信息记录
 * - 错误报告生成和发送
 */

// ============================================
// 类型定义
// ============================================

interface ErrorContext {
  userAgent: string;
  url: string;
  timestamp: number;
  userId?: string;
  sessionId: string;
  componentStack?: string;
  metadata?: Record<string, unknown>;
}

interface ErrorEntry {
  id: string;
  type: 'javascript' | 'promise' | 'react' | 'api' | 'network';
  message: string;
  stack?: string;
  context: ErrorContext;
  count: number;
  firstSeen: number;
  lastSeen: number;
  resolved: boolean;
}

interface ErrorReport {
  errors: ErrorEntry[];
  summary: {
    total: number;
    byType: Record<string, number>;
    topErrors: ErrorEntry[];
  };
}

// ============================================
// 错误追踪类
// ============================================

class ErrorTracker {
  private errors: Map<string, ErrorEntry> = new Map();
  private sessionId: string;
  private userId?: string;
  private config = {
    maxErrors: 100,
    enableReporting: true,
    reportEndpoint: '/api/errors'
  };

  constructor() {
    this.sessionId = this.generateSessionId();
    this.setupGlobalHandlers();
  }

  /**
   * 生成会话 ID
   */
  private generateSessionId(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * 设置全局错误处理器
   */
  private setupGlobalHandlers() {
    if (typeof window === 'undefined') return;

    // JavaScript 错误
    window.addEventListener('error', (event) => {
      this.captureError({
        type: 'javascript',
        message: event.message,
        stack: event.error?.stack,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno
      });
    });

    // Promise rejection
    window.addEventListener('unhandledrejection', (event) => {
      this.captureError({
        type: 'promise',
        message: event.reason?.toString() || 'Unhandled Promise Rejection',
        stack: event.reason?.stack
      });
    });

    // 网络错误
    window.addEventListener('error', (event) => {
      if (event.target !== window) {
        const target = event.target as HTMLElement;
        this.captureError({
          type: 'network',
          message: `Resource failed to load: ${target.tagName} ${target.getAttribute('src') || target.getAttribute('href')}`
        });
      }
    }, true);
  }

  /**
   * 设置用户 ID
   */
  setUserId(userId: string) {
    this.userId = userId;
  }

  /**
   * 获取错误上下文
   */
  private getContext(): ErrorContext {
    return {
      userAgent: navigator.userAgent,
      url: window.location.href,
      timestamp: Date.now(),
      userId: this.userId,
      sessionId: this.sessionId
    };
  }

  /**
   * 生成错误唯一标识
   */
  private getErrorKey(message: string, stack?: string): string {
    // 使用消息和堆栈的前几行生成唯一 key
    const signature = message + (stack?.split('\n').slice(0, 3).join('') || '');
    // 简单哈希
    let hash = 0;
    for (let i = 0; i < signature.length; i++) {
      hash = ((hash << 5) - hash) + signature.charCodeAt(i);
      hash = hash & hash;
    }
    return `error-${Math.abs(hash)}`;
  }

  /**
   * 捕获错误
   */
  captureError(error: {
    type: ErrorEntry['type'];
    message: string;
    stack?: string;
    filename?: string;
    lineno?: number;
    colno?: number;
    componentStack?: string;
    metadata?: Record<string, unknown>;
  }): string {
    const key = this.getErrorKey(error.message, error.stack);
    const now = Date.now();
    const context = this.getContext();

    const existing = this.errors.get(key);

    if (existing) {
      // 更新现有错误计数
      existing.count += 1;
      existing.lastSeen = now;
      existing.context = context;
    } else {
      // 创建新错误条目
      const entry: ErrorEntry = {
        id: key,
        type: error.type,
        message: error.message,
        stack: error.stack,
        context,
        count: 1,
        firstSeen: now,
        lastSeen: now,
        resolved: false
      };

      this.errors.set(key, entry);

      // 限制错误数量
      if (this.errors.size > this.config.maxErrors) {
        const oldestKey = Array.from(this.errors.keys())[0];
        this.errors.delete(oldestKey);
      }

      // 开发环境打印错误
      if (process.env.NODE_ENV === 'development') {
        console.error(`🐛 Error captured [${error.type}]:`, error.message, error.stack || '');
      }
    }

    return key;
  }

  /**
   * 捕获 React 错误
   */
  captureReactError(error: Error, componentStack: string): string {
    return this.captureError({
      type: 'react',
      message: error.message,
      stack: error.stack,
      componentStack
    });
  }

  /**
   * 捕获 API 错误
   */
  captureApiError(endpoint: string, status: number, message?: string): string {
    return this.captureError({
      type: 'api',
      message: `API Error [${status}]: ${endpoint}${message ? ` - ${message}` : ''}`,
      metadata: { endpoint, status }
    });
  }

  /**
   * 获取错误详情
   */
  getError(id: string): ErrorEntry | undefined {
    return this.errors.get(id);
  }

  /**
   * 标记错误已解决
   */
  resolveError(id: string): boolean {
    const error = this.errors.get(id);
    if (error) {
      error.resolved = true;
      return true;
    }
    return false;
  }

  /**
   * 获取所有错误
   */
  getAllErrors(): ErrorEntry[] {
    return Array.from(this.errors.values()).sort((a, b) => b.lastSeen - a.lastSeen);
  }

  /**
   * 获取未解决的错误
   */
  getUnresolvedErrors(): ErrorEntry[] {
    return this.getAllErrors().filter(e => !e.resolved);
  }

  /**
   * 按类型获取错误
   */
  getErrorsByType(type: ErrorEntry['type']): ErrorEntry[] {
    return this.getAllErrors().filter(e => e.type === type);
  }

  /**
   * 生成错误报告
   */
  getReport(): ErrorReport {
    const errors = this.getAllErrors();
    const byType: Record<string, number> = {};

    errors.forEach(error => {
      byType[error.type] = (byType[error.type] || 0) + error.count;
    });

    // 获取最常见的错误
    const topErrors = [...errors]
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return {
      errors,
      summary: {
        total: errors.reduce((sum, e) => sum + e.count, 0),
        byType,
        topErrors
      }
    };
  }

  /**
   * 打印错误报告
   */
  printReport() {
    const report = this.getReport();

    console.group('🐛 Error Report');

    console.log(`Total Errors: ${report.summary.total}`);

    if (Object.keys(report.summary.byType).length > 0) {
      console.group('Errors by Type');
      console.table(report.summary.byType);
      console.groupEnd();
    }

    if (report.summary.topErrors.length > 0) {
      console.group('Top Errors');
      report.summary.topErrors.forEach((error, index) => {
        console.group(`${index + 1}. ${error.message} (${error.count}x)`);
        console.log('Type:', error.type);
        console.log('First Seen:', new Date(error.firstSeen).toISOString());
        console.log('Last Seen:', new Date(error.lastSeen).toISOString());
        if (error.stack) {
          console.log('Stack:', error.stack);
        }
        console.groupEnd();
      });
      console.groupEnd();
    }

    console.groupEnd();
  }

  /**
   * 发送错误报告到服务器
   */
  async sendReport(): Promise<boolean> {
    if (!this.config.enableReporting) return false;

    try {
      const report = this.getReport();

      const response = await fetch(this.config.reportEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...report,
          userAgent: navigator.userAgent,
          url: window.location.href,
          timestamp: Date.now()
        }),
        keepalive: true
      });

      return response.ok;
    } catch (error) {
      console.error('Failed to send error report:', error);
      return false;
    }
  }

  /**
   * 清除已解决的错误
   */
  clearResolved() {
    const unresolved = new Map<string, ErrorEntry>();

    this.errors.forEach((error, key) => {
      if (!error.resolved) {
        unresolved.set(key, error);
      }
    });

    this.errors = unresolved;
  }

  /**
   * 清除所有错误
   */
  clearAll() {
    this.errors.clear();
  }
}

// ============================================
// 全局实例
// ============================================

export const errorTracker = new ErrorTracker();

export default errorTracker;

// ============================================
// React 错误边界集成
// ============================================

import React from 'react';

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  onError?: (error: Error, componentStack: string) => void;
}

/**
 * 错误边界组件
 */
export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // 捕获错误到追踪器
    errorTracker.captureReactError(error, errorInfo.componentStack || '');

    // 调用自定义错误处理
    this.props.onError?.(error, errorInfo.componentStack || '');

    // 开发环境打印错误
    if (process.env.NODE_ENV === 'development') {
      console.error('React Error Boundary caught an error:', error, errorInfo);
    }
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-900 mb-2">出错了</h1>
            <p className="text-gray-600 mb-4">页面遇到了一些问题，请刷新重试</p>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              刷新页面
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
