/**
 * 环境感知的日志工具
 * 生产环境自动禁用 debug/info 日志，避免暴露调试信息
 */

const isDevelopment = import.meta.env.DEV;

type LogLevel = 'log' | 'info' | 'warn' | 'error' | 'debug';

interface LogEntry {
  level: LogLevel;
  timestamp: string;
  message: string;
  data?: unknown[];
}

class Logger {
  private isDev: boolean;

  constructor() {
    this.isDev = isDevelopment;
  }

  /**
   * 开发环境日志 - 生产环境不输出
   */
  log(...args: unknown[]): void {
    if (this.isDev) {
      console.log('[App]', ...args);
    }
  }

  /**
   * 信息日志 - 生产环境不输出
   */
  info(...args: unknown[]): void {
    if (this.isDev) {
      console.info('[App Info]', ...args);
    }
  }

  /**
   * 调试日志 - 生产环境不输出
   */
  debug(...args: unknown[]): void {
    if (this.isDev) {
      console.debug('[App Debug]', ...args);
    }
  }

  /**
   * 警告日志 - 所有环境输出
   */
  warn(...args: unknown[]): void {
    console.warn('[App Warning]', ...args);
  }

  /**
   * 错误日志 - 所有环境输出（重要：生产环境也需要记录错误）
   */
  error(...args: unknown[]): void {
    console.error('[App Error]', ...args);
  }

  /**
   * 性能日志 - 生产环境不输出
   */
  performance(metricName: string, value: number, unit: string = 'ms'): void {
    if (this.isDev) {
      console.log(`[Performance] ${metricName}: ${value}${unit}`);
    }
  }

  /**
   * API 请求日志 - 生产环境简化输出
   */
  apiRequest(endpoint: string, duration?: number): void {
    if (this.isDev) {
      if (duration !== undefined) {
        console.log(`[API] ${endpoint} (${duration}ms)`);
      } else {
        console.log(`[API] ${endpoint}`);
      }
    } else {
      // 生产环境只记录慢请求
      if (duration !== undefined && duration > 3000) {
        console.warn(`[Slow API] ${endpoint} (${duration}ms)`);
      }
    }
  }

  /**
   * 创建带有上下文的日志器
   */
  withContext(context: string): Omit<Logger, 'withContext'> {
    const contextLogger = {
      log: (...args: unknown[]) => this.log(`[${context}]`, ...args),
      info: (...args: unknown[]) => this.info(`[${context}]`, ...args),
      debug: (...args: unknown[]) => this.debug(`[${context}]`, ...args),
      warn: (...args: unknown[]) => this.warn(`[${context}]`, ...args),
      error: (...args: unknown[]) => this.error(`[${context}]`, ...args),
      performance: (metricName: string, value: number, unit?: string) =>
        this.performance(`${context}.${metricName}`, value, unit),
      apiRequest: (endpoint: string, duration?: number) =>
        this.apiRequest(`${context} → ${endpoint}`, duration),
    };
    return contextLogger;
  }
}

// 导出单例
export const logger = new Logger();

// 导出类型
export type { LogLevel, LogEntry };
