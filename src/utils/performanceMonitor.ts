// 性能监控和分析工具
// 提供全面的性能指标收集、分析和报告功能

interface PerformanceEntry {
  name: string;
  type: 'render' | 'api' | 'navigation' | 'interaction' | 'custom';
  startTime: number;
  endTime?: number;
  duration?: number;
  metadata?: Record<string, any>;
  component?: string;
}

interface PerformanceMetrics {
  // 渲染性能
  averageRenderTime: number;
  slowRenders: number;
  totalRenders: number;
  renderP95: number;
  renderP99: number;
  
  // API性能
  averageApiTime: number;
  slowApiCalls: number;
  totalApiCalls: number;
  apiP95: number;
  apiP99: number;
  failedApiCalls: number;
  
  // 交互性能
  totalInteractions: number;
  averageInteractionDelay: number;
  
  // Web Vitals
  largestContentfulPaint?: number;
  firstInputDelay?: number;
  cumulativeLayoutShift?: number;
  
  // 内存使用
  memoryUsed?: number;
  memoryLimit?: number;
}

interface PerformanceBudget {
  maxRenderTime: number;        // 最大渲染时间 (ms)
  maxApiTime: number;           // 最大API调用时间 (ms)
  maxInteractionDelay: number;  // 最大交互延迟 (ms)
  maxBundleSize: number;        // 最大bundle大小 (bytes)
  maxMemoryUsage: number;       // 最大内存使用 (MB)
}

class PerformanceMonitor {
  private entries: PerformanceEntry[] = [];
  private observers: PerformanceObserver[] = [];
  private budget: PerformanceBudget;
  private maxEntries = 1000;
  private isEnabled = true;

  constructor(budget?: Partial<PerformanceBudget>) {
    this.budget = {
      maxRenderTime: 16,      // 60 FPS
      maxApiTime: 1000,       // 1秒
      maxInteractionDelay: 100, // 100ms
      maxBundleSize: 500 * 1024, // 500KB
      maxMemoryUsage: 50,     // 50MB
      ...budget
    };

    this.initializeObservers();
  }

  private initializeObservers() {
    if (typeof window === 'undefined') return;

    // 观察导航时序
    if ('PerformanceObserver' in window) {
      try {
        const navigationObserver = new PerformanceObserver((list) => {
          list.getEntries().forEach((entry) => {
            this.recordEntry({
              name: 'navigation',
              type: 'navigation',
              startTime: entry.startTime,
              duration: entry.duration,
              metadata: {
                type: entry.entryType,
                transferSize: (entry as any).transferSize
              }
            });
          });
        });
        navigationObserver.observe({ entryTypes: ['navigation'] });
        this.observers.push(navigationObserver);
      } catch (error) {
        console.warn('Navigation observer not supported:', error);
      }

      // 观察LCP
      try {
        const lcpObserver = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          const lastEntry = entries[entries.length - 1];
          this.recordEntry({
            name: 'LCP',
            type: 'custom',
            startTime: lastEntry.startTime,
            duration: lastEntry.startTime,
            metadata: {
              element: (lastEntry as any).element?.tagName
            }
          });
        });
        lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });
        this.observers.push(lcpObserver);
      } catch (error) {
        console.warn('LCP observer not supported:', error);
      }

      // 观察FID
      try {
        const fidObserver = new PerformanceObserver((list) => {
          list.getEntries().forEach((entry) => {
            this.recordEntry({
              name: 'FID',
              type: 'interaction',
              startTime: entry.startTime,
              duration: (entry as any).processingStart - entry.startTime,
              metadata: {
                inputType: entry.name
              }
            });
          });
        });
        fidObserver.observe({ entryTypes: ['first-input'] });
        this.observers.push(fidObserver);
      } catch (error) {
        console.warn('FID observer not supported:', error);
      }

      // 观察布局偏移
      try {
        const clsObserver = new PerformanceObserver((list) => {
          list.getEntries().forEach((entry) => {
            this.recordEntry({
              name: 'CLS',
              type: 'custom',
              startTime: entry.startTime,
              duration: 0,
              metadata: {
                value: (entry as any).value,
                hadRecentInput: (entry as any).hadRecentInput
              }
            });
          });
        });
        clsObserver.observe({ entryTypes: ['layout-shift'] });
        this.observers.push(clsObserver);
      } catch (error) {
        console.warn('CLS observer not supported:', error);
      }
    }
  }

  // 记录性能条目
  recordEntry(entry: Omit<PerformanceEntry, 'endTime'>) {
    if (!this.isEnabled) return;

    const fullEntry: PerformanceEntry = {
      ...entry,
      endTime: entry.startTime + (entry.duration || 0)
    };

    this.entries.push(fullEntry);

    // 限制条目数量，防止内存泄漏
    if (this.entries.length > this.maxEntries) {
      this.entries.splice(0, this.entries.length - this.maxEntries);
    }

    // 检查性能预算违规
    this.checkBudgetViolation(fullEntry);
  }

  // 开始计时
  startTiming(name: string, type: PerformanceEntry['type'], component?: string): string {
    const timingId = `${component || 'global'}_${name}_${Date.now()}`;
    
    this.recordEntry({
      name: timingId,
      type,
      startTime: performance.now(),
      component,
      metadata: { phase: 'start' }
    });

    return timingId;
  }

  // 结束计时
  endTiming(timingId: string): number | null {
    const startEntry = this.entries.find(entry => 
      entry.name === timingId && entry.metadata?.phase === 'start'
    );

    if (!startEntry) {
      console.warn(`No start entry found for timing: ${timingId}`);
      return null;
    }

    const endTime = performance.now();
    const duration = endTime - startEntry.startTime;

    this.recordEntry({
      name: startEntry.name.replace('_start', ''),
      type: startEntry.type,
      startTime: startEntry.startTime,
      duration,
      component: startEntry.component,
      metadata: { 
        ...startEntry.metadata,
        phase: 'complete'
      }
    });

    return duration;
  }

  // 测量函数执行时间
  measureFunction<T>(
    name: string, 
    fn: () => T, 
    type: PerformanceEntry['type'] = 'custom',
    component?: string
  ): T {
    const startTime = performance.now();
    
    try {
      const result = fn();
      const duration = performance.now() - startTime;
      
      this.recordEntry({
        name,
        type,
        startTime,
        duration,
        component,
        metadata: { success: true }
      });
      
      return result;
    } catch (error) {
      const duration = performance.now() - startTime;
      
      this.recordEntry({
        name,
        type,
        startTime,
        duration,
        component,
        metadata: { 
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      });
      
      throw error;
    }
  }

  // 测量异步函数执行时间
  async measureAsyncFunction<T>(
    name: string,
    fn: () => Promise<T>,
    type: PerformanceEntry['type'] = 'api',
    component?: string
  ): Promise<T> {
    const startTime = performance.now();
    
    try {
      const result = await fn();
      const duration = performance.now() - startTime;
      
      this.recordEntry({
        name,
        type,
        startTime,
        duration,
        component,
        metadata: { success: true }
      });
      
      return result;
    } catch (error) {
      const duration = performance.now() - startTime;
      
      this.recordEntry({
        name,
        type,
        startTime,
        duration,
        component,
        metadata: { 
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      });
      
      throw error;
    }
  }

  // 计算百分位数
  private calculatePercentile(values: number[], percentile: number): number {
    if (values.length === 0) return 0;
    
    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.ceil((percentile / 100) * sorted.length) - 1;
    return sorted[index] || 0;
  }

  // 获取性能指标
  getMetrics(): PerformanceMetrics {
    const renderEntries = this.entries.filter(e => e.type === 'render' && e.duration);
    const apiEntries = this.entries.filter(e => e.type === 'api' && e.duration);
    const interactionEntries = this.entries.filter(e => e.type === 'interaction' && e.duration);

    const renderTimes = renderEntries.map(e => e.duration!);
    const apiTimes = apiEntries.map(e => e.duration!);
    const interactionTimes = interactionEntries.map(e => e.duration!);

    // Web Vitals
    const lcpEntry = this.entries.find(e => e.name === 'LCP');
    const fidEntry = this.entries.find(e => e.name === 'FID');
    const clsEntries = this.entries.filter(e => e.name === 'CLS');
    const clsValue = clsEntries.reduce((sum, entry) => sum + (entry.metadata?.value || 0), 0);

    // 内存信息
    let memoryUsed: number | undefined;
    let memoryLimit: number | undefined;
    
    if ('memory' in performance) {
      const memory = (performance as any).memory;
      memoryUsed = memory.usedJSHeapSize / 1024 / 1024; // MB
      memoryLimit = memory.jsHeapSizeLimit / 1024 / 1024; // MB
    }

    return {
      // 渲染性能
      averageRenderTime: renderTimes.length > 0 
        ? renderTimes.reduce((sum, time) => sum + time, 0) / renderTimes.length
        : 0,
      slowRenders: renderTimes.filter(time => time > this.budget.maxRenderTime).length,
      totalRenders: renderEntries.length,
      renderP95: this.calculatePercentile(renderTimes, 95),
      renderP99: this.calculatePercentile(renderTimes, 99),

      // API性能
      averageApiTime: apiTimes.length > 0
        ? apiTimes.reduce((sum, time) => sum + time, 0) / apiTimes.length
        : 0,
      slowApiCalls: apiTimes.filter(time => time > this.budget.maxApiTime).length,
      totalApiCalls: apiEntries.length,
      apiP95: this.calculatePercentile(apiTimes, 95),
      apiP99: this.calculatePercentile(apiTimes, 99),
      failedApiCalls: apiEntries.filter(e => e.metadata?.success === false).length,

      // 交互性能
      totalInteractions: interactionEntries.length,
      averageInteractionDelay: interactionTimes.length > 0
        ? interactionTimes.reduce((sum, time) => sum + time, 0) / interactionTimes.length
        : 0,

      // Web Vitals
      largestContentfulPaint: lcpEntry?.duration,
      firstInputDelay: fidEntry?.duration,
      cumulativeLayoutShift: clsValue,

      // 内存
      memoryUsed,
      memoryLimit
    };
  }

  // 检查性能预算违规
  private checkBudgetViolation(entry: PerformanceEntry) {
    let violated = false;
    let message = '';

    switch (entry.type) {
      case 'render':
        if (entry.duration && entry.duration > this.budget.maxRenderTime) {
          violated = true;
          message = `Slow render: ${entry.name} took ${entry.duration.toFixed(2)}ms (budget: ${this.budget.maxRenderTime}ms)`;
        }
        break;
      
      case 'api':
        if (entry.duration && entry.duration > this.budget.maxApiTime) {
          violated = true;
          message = `Slow API call: ${entry.name} took ${entry.duration.toFixed(2)}ms (budget: ${this.budget.maxApiTime}ms)`;
        }
        break;
      
      case 'interaction':
        if (entry.duration && entry.duration > this.budget.maxInteractionDelay) {
          violated = true;
          message = `Slow interaction: ${entry.name} took ${entry.duration.toFixed(2)}ms (budget: ${this.budget.maxInteractionDelay}ms)`;
        }
        break;
    }

    if (violated) {
      console.warn(`🚨 Performance Budget Violation: ${message}`);
      
      // 在开发环境中发出更强烈的警告
      if (process.env.NODE_ENV === 'development') {
        console.trace('Performance budget violation stack trace');
      }
    }
  }

  // 生成性能报告
  generateReport(): string {
    const metrics = this.getMetrics();
    const componentMetrics = this.getComponentMetrics();

    let report = '📊 Performance Report\n';
    report += '='.repeat(50) + '\n\n';

    // 总体指标
    report += '📈 Overall Metrics:\n';
    report += `-  Total Renders: ${metrics.totalRenders}\n`;
    report += `-  Slow Renders: ${metrics.slowRenders} (>${this.budget.maxRenderTime}ms)\n`;
    report += `-  Average Render Time: ${metrics.averageRenderTime.toFixed(2)}ms\n`;
    report += `-  Render P95: ${metrics.renderP95.toFixed(2)}ms\n`;
    report += `-  Total API Calls: ${metrics.totalApiCalls}\n`;
    report += `-  Failed API Calls: ${metrics.failedApiCalls}\n`;
    report += `-  Average API Time: ${metrics.averageApiTime.toFixed(2)}ms\n`;
    report += `-  API P95: ${metrics.apiP95.toFixed(2)}ms\n\n`;

    // Web Vitals
    report += '🌐 Web Vitals:\n';
    if (metrics.largestContentfulPaint) {
      report += `-  LCP: ${metrics.largestContentfulPaint.toFixed(2)}ms\n`;
    }
    if (metrics.firstInputDelay) {
      report += `-  FID: ${metrics.firstInputDelay.toFixed(2)}ms\n`;
    }
    if (metrics.cumulativeLayoutShift) {
      report += `-  CLS: ${metrics.cumulativeLayoutShift.toFixed(3)}\n`;
    }
    report += '\n';

    // 内存使用
    if (metrics.memoryUsed) {
      report += '💾 Memory Usage:\n';
      report += `-  Used: ${metrics.memoryUsed.toFixed(2)}MB\n`;
      if (metrics.memoryLimit) {
        report += `-  Limit: ${metrics.memoryLimit.toFixed(2)}MB\n`;
        report += `-  Usage: ${((metrics.memoryUsed / metrics.memoryLimit) * 100).toFixed(1)}%\n`;
      }
      report += '\n';
    }

    // 组件性能
    if (componentMetrics.length > 0) {
      report += '🧩 Component Performance:\n';
      componentMetrics.forEach(comp => {
        report += `-  ${comp.name}: ${comp.averageRenderTime.toFixed(2)}ms avg, ${comp.totalRenders} renders\n`;
      });
      report += '\n';
    }

    // 性能建议
    report += '💡 Performance Recommendations:\n';
    
    if (metrics.slowRenders > 0) {
      report += `-  Consider optimizing ${metrics.slowRenders} slow renders\n`;
    }
    if (metrics.failedApiCalls > 0) {
      report += `-  Investigate ${metrics.failedApiCalls} failed API calls\n`;
    }
    if (metrics.renderP95 > this.budget.maxRenderTime * 2) {
      report += `-  Render P95 is high, consider React.memo or useMemo optimization\n`;
    }
    if (metrics.apiP95 > this.budget.maxApiTime) {
      report += `-  API P95 is high, consider caching or request optimization\n`;
    }

    return report;
  }

  // 获取组件级别的性能指标
  getComponentMetrics() {
    const componentEntries = this.entries
      .filter(entry => entry.component && entry.type === 'render' && entry.duration)
      .reduce((acc, entry) => {
        const component = entry.component!;
        if (!acc[component]) {
          acc[component] = [];
        }
        acc[component].push(entry.duration!);
        return acc;
      }, {} as Record<string, number[]>);

    return Object.entries(componentEntries).map(([name, times]) => ({
      name,
      totalRenders: times.length,
      averageRenderTime: times.reduce((sum, time) => sum + time, 0) / times.length,
      slowRenders: times.filter(time => time > this.budget.maxRenderTime).length,
      p95: this.calculatePercentile(times, 95)
    }));
  }

  // 导出性能数据
  exportData() {
    return {
      entries: [...this.entries],
      metrics: this.getMetrics(),
      componentMetrics: this.getComponentMetrics(),
      budget: this.budget,
      timestamp: new Date().toISOString()
    };
  }

  // 清理数据
  clear() {
    this.entries = [];
  }

  // 启用/禁用监控
  setEnabled(enabled: boolean) {
    this.isEnabled = enabled;
  }

  // 销毁监控器
  destroy() {
    this.observers.forEach(observer => observer.disconnect());
    this.observers = [];
    this.entries = [];
  }
}

// 全局性能监控器实例
export const performanceMonitor = new PerformanceMonitor();

// 装饰器函数用于自动性能测量
export const measurePerformance = (
  name?: string,
  type: PerformanceEntry['type'] = 'custom'
) => {
  return (target: any, propertyKey: string, descriptor: PropertyDescriptor) => {
    const originalMethod = descriptor.value;
    const measureName = name || `${target.constructor.name}.${propertyKey}`;

    descriptor.value = function(...args: any[]) {
      return performanceMonitor.measureFunction(
        measureName,
        () => originalMethod.apply(this, args),
        type,
        target.constructor.name
      );
    };

    return descriptor;
  };
};

// React Hook用于性能监控
export const usePerformanceMonitoring = (componentName: string) => {
  return {
    startTiming: (name: string, type: PerformanceEntry['type'] = 'render') =>
      performanceMonitor.startTiming(name, type, componentName),
    
    endTiming: (timingId: string) =>
      performanceMonitor.endTiming(timingId),
    
    measureFunction: <T>(name: string, fn: () => T, type: PerformanceEntry['type'] = 'custom') =>
      performanceMonitor.measureFunction(name, fn, type, componentName),
    
    measureAsyncFunction: <T>(name: string, fn: () => Promise<T>, type: PerformanceEntry['type'] = 'api') =>
      performanceMonitor.measureAsyncFunction(name, fn, type, componentName)
  };
};