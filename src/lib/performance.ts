// 性能监控工具库
export interface PerformanceMetric {
  name: string
  duration: number
  timestamp: number
  details?: Record<string, any>
}

class PerformanceMonitor {
  private metrics: PerformanceMetric[] = []
  private activeTimers: Map<string, number> = new Map()

  /**
   * 开始计时
   */
  start(name: string): void {
    this.activeTimers.set(name, Date.now())
  }

  /**
   * 结束计时并记录指标
   */
  end(name: string, details?: Record<string, any>): PerformanceMetric {
    const startTime = this.activeTimers.get(name)
    if (!startTime) {
      throw new Error(`未找到名为 "${name}" 的计时器`)
    }

    const duration = Date.now() - startTime
    const metric: PerformanceMetric = {
      name,
      duration,
      timestamp: Date.now(),
      details
    }

    this.metrics.push(metric)
    this.activeTimers.delete(name)
    
    // 在开发环境下输出日志
    if (process.env.NODE_ENV === 'development') {
      console.log(`⚡ ${name}: ${duration}ms`, details ? details : '')
    }

    return metric
  }

  /**
   * 获取所有指标
   */
  getMetrics(): PerformanceMetric[] {
    return [...this.metrics]
  }

  /**
   * 获取特定名称的指标
   */
  getMetricsByName(name: string): PerformanceMetric[] {
    return this.metrics.filter(metric => metric.name === name)
  }

  /**
   * 计算平均时长
   */
  getAverageTime(name: string): number {
    const metrics = this.getMetricsByName(name)
    if (metrics.length === 0) return 0
    
    const total = metrics.reduce((sum, metric) => sum + metric.duration, 0)
    return Math.round(total / metrics.length)
  }

  /**
   * 清除所有指标
   */
  clear(): void {
    this.metrics = []
    this.activeTimers.clear()
  }

  /**
   * 导出性能报告
   */
  exportReport(): {
    totalMetrics: number
    averageTimes: Record<string, number>
    recentMetrics: PerformanceMetric[]
  } {
    const uniqueNames = [...new Set(this.metrics.map(m => m.name))]
    const averageTimes: Record<string, number> = {}
    
    uniqueNames.forEach(name => {
      averageTimes[name] = this.getAverageTime(name)
    })

    return {
      totalMetrics: this.metrics.length,
      averageTimes,
      recentMetrics: this.metrics.slice(-10) // 最近10条记录
    }
  }
}

// 全局性能监控实例
export const performanceMonitor = new PerformanceMonitor()

// 管理员登录相关性能指标
export const ADMIN_PERFORMANCE_METRICS = {
  LOGIN_TOTAL: 'admin_login_total',
  LOGIN_AUTH: 'admin_login_auth',
  LOGIN_PERMISSION_CHECK: 'admin_login_permission_check',
  DASHBOARD_LOAD: 'admin_dashboard_load',
  STATS_FETCH: 'admin_stats_fetch'
} as const

/**
 * 包装异步函数以自动监控性能
 */
export function withPerformanceMonitoring<T extends any[], R>(
  name: string,
  fn: (...args: T) => Promise<R>,
  getDetails?: (...args: T) => Record<string, any>
): (...args: T) => Promise<R> {
  return async (...args: T): Promise<R> => {
    performanceMonitor.start(name)
    try {
      const result = await fn(...args)
      performanceMonitor.end(name, getDetails?.(...args))
      return result
    } catch (error) {
      performanceMonitor.end(name, { 
        error: true, 
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        ...(getDetails?.(...args) || {})
      })
      throw error
    }
  }
}