// 性能监控和分析工具
export interface PerformanceMetric {
  name: string;
  value: number;
  unit: 'ms' | 'bytes' | 'count';
  timestamp: number;
  type: 'timing' | 'counter' | 'gauge';
  labels?: Record<string, string>;
}

export interface WebVitalsMetrics {
  CLS: number | null; // Cumulative Layout Shift
  FID: number | null; // First Input Delay  
  FCP: number | null; // First Contentful Paint
  LCP: number | null; // Largest Contentful Paint
  TTFB: number | null; // Time to First Byte
}

class PerformanceMonitor {
  private metrics: PerformanceMetric[] = [];
  private observers: PerformanceObserver[] = [];
  private webVitals: WebVitalsMetrics = {
    CLS: null,
    FID: null,
    FCP: null,
    LCP: null,
    TTFB: null
  };

  constructor() {
    this.init();
  }

  private init() {
    // 监听页面性能指标
    this.observeWebVitals();
    this.observeResourceTiming();
    this.observeNavigationTiming();
    this.observeLongTasks();
  }

  // 监听Web Vitals指标
  private observeWebVitals() {
    try {
      // 监听LCP (Largest Contentful Paint)
      const lcpObserver = new PerformanceObserver((entryList) => {
        const entries = entryList.getEntries();
        const lastEntry = entries[entries.length - 1] as PerformanceEntry;
        this.webVitals.LCP = lastEntry.startTime;
        this.recordMetric('LCP', lastEntry.startTime, 'ms', 'timing');
      });
      lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });
      this.observers.push(lcpObserver);

      // 监听FID (First Input Delay)
      const fidObserver = new PerformanceObserver((entryList) => {
        const entries = entryList.getEntries();
        entries.forEach((entry: any) => {
          this.webVitals.FID = entry.processingStart - entry.startTime;
          this.recordMetric('FID', entry.processingStart - entry.startTime, 'ms', 'timing');
        });
      });
      fidObserver.observe({ entryTypes: ['first-input'] });
      this.observers.push(fidObserver);

      // 监听CLS (Cumulative Layout Shift)
      let clsValue = 0;
      const clsObserver = new PerformanceObserver((entryList) => {
        const entries = entryList.getEntries();
        entries.forEach((entry: any) => {
          if (!entry.hadRecentInput) {
            clsValue += entry.value;
          }
        });
        this.webVitals.CLS = clsValue;
        this.recordMetric('CLS', clsValue, 'count', 'gauge');
      });
      clsObserver.observe({ entryTypes: ['layout-shift'] });
      this.observers.push(clsObserver);

    } catch (error) {
      console.warn('Web Vitals监控初始化失败:', error);
    }
  }

  // 监听资源加载时间
  private observeResourceTiming() {
    try {
      const resourceObserver = new PerformanceObserver((entryList) => {
        const entries = entryList.getEntries();
        entries.forEach((entry: PerformanceResourceTiming) => {
          const duration = entry.responseEnd - entry.startTime;
          const resourceType = this.getResourceType(entry.name);
          
          this.recordMetric('resource_load_time', duration, 'ms', 'timing', {
            resource_type: resourceType,
            resource_name: entry.name.split('/').pop() || 'unknown'
          });

          // 特别监控大资源文件
          if (duration > 1000) {
            this.recordMetric('slow_resource', duration, 'ms', 'timing', {
              resource_type: resourceType,
              resource_name: entry.name
            });
          }
        });
      });
      
      resourceObserver.observe({ entryTypes: ['resource'] });
      this.observers.push(resourceObserver);
    } catch (error) {
      console.warn('资源时间监控初始化失败:', error);
    }
  }

  // 监听导航时间
  private observeNavigationTiming() {
    try {
      const navigationObserver = new PerformanceObserver((entryList) => {
        const entries = entryList.getEntries();
        entries.forEach((entry: PerformanceNavigationTiming) => {
          // DOM加载完成时间
          const domContentLoaded = entry.domContentLoadedEventEnd - entry.navigationStart;
          this.recordMetric('dom_content_loaded', domContentLoaded, 'ms', 'timing');

          // 页面完全加载时间
          const loadComplete = entry.loadEventEnd - entry.navigationStart;
          this.recordMetric('page_load_complete', loadComplete, 'ms', 'timing');

          // DNS解析时间
          const dnsLookup = entry.domainLookupEnd - entry.domainLookupStart;
          this.recordMetric('dns_lookup', dnsLookup, 'ms', 'timing');

          // TCP连接时间
          const tcpConnect = entry.connectEnd - entry.connectStart;
          this.recordMetric('tcp_connect', tcpConnect, 'ms', 'timing');

          // TTFB (Time to First Byte)
          const ttfb = entry.responseStart - entry.navigationStart;
          this.webVitals.TTFB = ttfb;
          this.recordMetric('TTFB', ttfb, 'ms', 'timing');

          // FCP (First Contentful Paint)
          if (entry.type === 'navigate') {
            const fcpEntries = performance.getEntriesByType('paint') as PerformancePaintTiming[];
            const fcpEntry = fcpEntries.find(e => e.name === 'first-contentful-paint');
            if (fcpEntry) {
              this.webVitals.FCP = fcpEntry.startTime;
              this.recordMetric('FCP', fcpEntry.startTime, 'ms', 'timing');
            }
          }
        });
      });
      
      navigationObserver.observe({ entryTypes: ['navigation'] });
      this.observers.push(navigationObserver);
    } catch (error) {
      console.warn('导航时间监控初始化失败:', error);
    }
  }

  // 监听长任务
  private observeLongTasks() {
    try {
      const longTaskObserver = new PerformanceObserver((entryList) => {
        const entries = entryList.getEntries();
        entries.forEach((entry) => {
          this.recordMetric('long_task', entry.duration, 'ms', 'timing', {
            task_name: entry.name
          });
        });
      });
      
      longTaskObserver.observe({ entryTypes: ['longtask'] });
      this.observers.push(longTaskObserver);
    } catch (error) {
      console.warn('长任务监控初始化失败:', error);
    }
  }

  // 记录自定义性能指标
  recordMetric(
    name: string, 
    value: number, 
    unit: 'ms' | 'bytes' | 'count', 
    type: 'timing' | 'counter' | 'gauge',
    labels?: Record<string, string>
  ) {
    const metric: PerformanceMetric = {
      name,
      value,
      unit,
      type,
      timestamp: Date.now(),
      labels
    };

    this.metrics.push(metric);
    
    // 保持最近1000个指标
    if (this.metrics.length > 1000) {
      this.metrics = this.metrics.slice(-1000);
    }

    // 输出到控制台（开发环境）
    if (process.env.NODE_ENV === 'development') {
      console.log(`📊 性能指标: ${name} = ${value}${unit}`, labels || '');
    }
  }

  // 测量函数执行时间
  async measureFunction<T>(
    name: string, 
    fn: () => Promise<T> | T,
    labels?: Record<string, string>
  ): Promise<T> {
    const startTime = performance.now();
    
    try {
      const result = await fn();
      const duration = performance.now() - startTime;
      
      this.recordMetric(`function_${name}`, duration, 'ms', 'timing', labels);
      
      return result;
    } catch (error) {
      const duration = performance.now() - startTime;
      this.recordMetric(`function_${name}_error`, duration, 'ms', 'timing', labels);
      throw error;
    }
  }

  // 测量React组件渲染时间
  measureComponentRender(componentName: string, renderTime: number) {
    this.recordMetric('component_render', renderTime, 'ms', 'timing', {
      component: componentName
    });
  }

  // 测量API请求时间
  measureApiRequest(endpoint: string, method: string, duration: number, status: number) {
    this.recordMetric('api_request', duration, 'ms', 'timing', {
      endpoint,
      method,
      status: status.toString()
    });
  }

  // 测量内存使用
  measureMemoryUsage() {
    if ('memory' in performance) {
      const memory = (performance as any).memory;
      this.recordMetric('memory_used', memory.usedJSHeapSize, 'bytes', 'gauge');
      this.recordMetric('memory_total', memory.totalJSHeapSize, 'bytes', 'gauge');
      this.recordMetric('memory_limit', memory.jsHeapSizeLimit, 'bytes', 'gauge');
    }
  }

  // 获取资源类型
  private getResourceType(url: string): string {
    if (url.match(/\.(js|mjs)$/)) return 'script';
    if (url.match(/\.css$/)) return 'stylesheet';
    if (url.match(/\.(png|jpg|jpeg|gif|webp|svg)$/)) return 'image';
    if (url.match(/\.(woff|woff2|ttf|eot)$/)) return 'font';
    if (url.includes('api') || url.includes('function')) return 'api';
    return 'other';
  }

  // 获取性能报告
  getPerformanceReport() {
    const now = Date.now();
    const oneHourAgo = now - 60 * 60 * 1000;
    
    const recentMetrics = this.metrics.filter(m => m.timestamp > oneHourAgo);
    
    const groupedMetrics = recentMetrics.reduce((groups, metric) => {
      if (!groups[metric.name]) {
        groups[metric.name] = [];
      }
      groups[metric.name].push(metric);
      return groups;
    }, {} as Record<string, PerformanceMetric[]>);

    const summary = Object.entries(groupedMetrics).map(([name, metrics]) => {
      const values = metrics.map(m => m.value);
      const avg = values.reduce((a, b) => a + b, 0) / values.length;
      const min = Math.min(...values);
      const max = Math.max(...values);
      const p95 = this.percentile(values, 95);
      
      return {
        name,
        count: metrics.length,
        avg: Math.round(avg * 100) / 100,
        min: Math.round(min * 100) / 100,
        max: Math.round(max * 100) / 100,
        p95: Math.round(p95 * 100) / 100,
        unit: metrics[0].unit
      };
    });

    return {
      summary,
      webVitals: this.webVitals,
      totalMetrics: this.metrics.length,
      reportTime: new Date().toISOString()
    };
  }

  // 计算百分位数
  private percentile(values: number[], p: number): number {
    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.ceil((p / 100) * sorted.length) - 1;
    return sorted[index] || 0;
  }

  // 导出指标数据
  exportMetrics() {
    return {
      metrics: this.metrics,
      webVitals: this.webVitals
    };
  }

  // 清理监听器
  dispose() {
    this.observers.forEach(observer => observer.disconnect());
    this.observers = [];
    this.metrics = [];
  }
}

// 创建全局性能监控实例
export const performanceMonitor = new PerformanceMonitor();

// React组件性能监控Hook
export function usePerformanceMonitor(componentName: string) {
  const startTime = performance.now();
  
  React.useEffect(() => {
    return () => {
      const renderTime = performance.now() - startTime;
      performanceMonitor.measureComponentRender(componentName, renderTime);
    };
  }, [componentName, startTime]);
}

// 全局错误和性能事件监听
if (typeof window !== 'undefined') {
  // 监听未处理的错误
  window.addEventListener('error', (event) => {
    performanceMonitor.recordMetric('javascript_error', 1, 'count', 'counter', {
      message: event.message,
      filename: event.filename || 'unknown',
      line: event.lineno?.toString() || 'unknown'
    });
  });

  // 监听Promise rejection
  window.addEventListener('unhandledrejection', (event) => {
    performanceMonitor.recordMetric('promise_rejection', 1, 'count', 'counter', {
      reason: event.reason?.toString() || 'unknown'
    });
  });

  // 页面可见性变化
  document.addEventListener('visibilitychange', () => {
    const state = document.visibilityState;
    performanceMonitor.recordMetric('visibility_change', 1, 'count', 'counter', {
      state
    });
    
    // 页面隐藏时测量内存
    if (state === 'hidden') {
      performanceMonitor.measureMemoryUsage();
    }
  });
}

// 定期内存监控
if (typeof window !== 'undefined') {
  setInterval(() => {
    performanceMonitor.measureMemoryUsage();
  }, 30000); // 每30秒监控一次内存
}

export default performanceMonitor;