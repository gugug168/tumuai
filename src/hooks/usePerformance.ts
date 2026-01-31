import { useEffect, useCallback, useRef } from 'react';

interface PerformanceEntry {
  name: string;
  startTime: number;
  duration?: number;
  type: 'render' | 'api' | 'interaction' | 'navigation';
  metadata?: Record<string, any>;
}

interface PerformanceMetrics {
  renders: PerformanceEntry[];
  apis: PerformanceEntry[];
  interactions: PerformanceEntry[];
  averageRenderTime: number;
  averageApiTime: number;
  totalRenders: number;
  slowRenders: number; // >16ms
}

const IS_DEV = import.meta.env.DEV;

// In production we intentionally keep this hook "lightweight".
// IMPORTANT: the returned helpers must be referentially stable, otherwise any downstream
// `useEffect(..., [recordApiCall])` will re-run on every render and can cause request loops.
const PROD_EMPTY_METRICS: PerformanceMetrics = {
  renders: [],
  apis: [],
  interactions: [],
  averageRenderTime: 0,
  averageApiTime: 0,
  totalRenders: 0,
  slowRenders: 0
};

const prodRecordApiCall = async <T>(
  _name: string,
  apiCall: () => Promise<T>,
  _metadata?: Record<string, any>
): Promise<T> => apiCall();

const PROD_PERF_HELPERS = {
  startTiming: () => '',
  endTiming: () => {},
  recordRender: () => {},
  recordApiCall: prodRecordApiCall,
  recordInteraction: () => {},
  getMetrics: () => PROD_EMPTY_METRICS,
  printReport: () => PROD_EMPTY_METRICS,
  clearMetrics: () => {},
  renderCount: 0
} as const;

// 全局性能数据存储
const performanceData: {
  entries: PerformanceEntry[];
  startTimes: Map<string, number>;
} = {
  entries: [],
  startTimes: new Map()
};

export function usePerformance(componentName?: string) {
  // Production: return lightweight no-op helpers to avoid runtime overhead.
  if (!IS_DEV) {
    return PROD_PERF_HELPERS;
  }

  const componentRef = useRef<string>(componentName || 'Unknown');
  const renderCountRef = useRef(0);
  const lastRenderTime = useRef<number>(0);

  // 开始性能计时
  const startTiming = useCallback((name: string, type: PerformanceEntry['type'], metadata?: Record<string, any>) => {
    const key = `${componentRef.current}_${name}`;
    performanceData.startTimes.set(key, performance.now());
    
    // 记录开始事件
    const entry: PerformanceEntry = {
      name: `${componentRef.current}_${name}`,
      startTime: performance.now(),
      type,
      metadata
    };
    
    return key;
  }, []);

  // 结束性能计时
  const endTiming = useCallback((key: string) => {
    const startTime = performanceData.startTimes.get(key);
    if (!startTime) {
      console.warn(`Performance timing not found for key: ${key}`);
      return;
    }

    const duration = performance.now() - startTime;
    performanceData.startTimes.delete(key);

    // 找到对应的entry并更新duration
    const existingEntry = performanceData.entries.find(entry => 
      entry.name === key && entry.startTime === startTime
    );

    if (existingEntry) {
      existingEntry.duration = duration;
    } else {
      // 创建新的完成事件记录
      const entry: PerformanceEntry = {
        name: key,
        startTime,
        duration,
        type: 'render' // 默认类型
      };
      performanceData.entries.push(entry);
    }

    // 记录慢操作
    if (duration > 100) { // 超过100ms的操作
      console.warn(`⚠️ Slow operation detected: ${key} took ${duration.toFixed(2)}ms`);
    }

    // 限制entries数量，避免内存泄漏
    if (performanceData.entries.length > 1000) {
      performanceData.entries.splice(0, 500); // 删除前一半
    }
  }, []);

  // 记录组件渲染
  const recordRender = useCallback(() => {
    renderCountRef.current++;
    const now = performance.now();
    
    if (lastRenderTime.current > 0) {
      const renderDuration = now - lastRenderTime.current;
      
      const entry: PerformanceEntry = {
        name: `${componentRef.current}_render`,
        startTime: lastRenderTime.current,
        duration: renderDuration,
        type: 'render',
        metadata: {
          renderCount: renderCountRef.current
        }
      };
      
      performanceData.entries.push(entry);

      // 记录慢渲染
      if (renderDuration > 16) { // 超过16ms（60fps阈值）
        console.warn(`🐌 Slow render detected in ${componentRef.current}: ${renderDuration.toFixed(2)}ms`);
      }
    }
    
    lastRenderTime.current = now;
  }, []);

  // 记录API调用
  const recordApiCall = useCallback(async <T>(
    name: string,
    apiCall: () => Promise<T>,
    metadata?: Record<string, any>
  ): Promise<T> => {
    const key = startTiming(name, 'api', metadata);
    
    try {
      const result = await apiCall();
      endTiming(key);
      return result;
    } catch (error) {
      endTiming(key);
      // 记录API错误
      const errorEntry: PerformanceEntry = {
        name: `${componentRef.current}_${name}_error`,
        startTime: performance.now(),
        type: 'api',
        metadata: {
          ...metadata,
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      };
      performanceData.entries.push(errorEntry);
      throw error;
    }
  }, [startTiming, endTiming]);

  // 记录用户交互（仅开发环境）
  const recordInteraction = useCallback((interactionName: string, metadata?: Record<string, any>) => {
    const entry: PerformanceEntry = {
      name: `${componentRef.current}_${interactionName}`,
      startTime: performance.now(),
      type: 'interaction',
      metadata
    };
    performanceData.entries.push(entry);
  }, []);

  // 获取性能指标
  const getMetrics = useCallback((): PerformanceMetrics => {
    const renders = performanceData.entries.filter(entry => 
      entry.type === 'render' && entry.name.includes(componentRef.current)
    );
    
    const apis = performanceData.entries.filter(entry => 
      entry.type === 'api' && entry.name.includes(componentRef.current)
    );
    
    const interactions = performanceData.entries.filter(entry => 
      entry.type === 'interaction' && entry.name.includes(componentRef.current)
    );

    const renderDurations = renders.filter(r => r.duration).map(r => r.duration!);
    const apiDurations = apis.filter(a => a.duration).map(a => a.duration!);

    return {
      renders,
      apis,
      interactions,
      averageRenderTime: renderDurations.length > 0 
        ? renderDurations.reduce((sum, d) => sum + d, 0) / renderDurations.length 
        : 0,
      averageApiTime: apiDurations.length > 0 
        ? apiDurations.reduce((sum, d) => sum + d, 0) / apiDurations.length 
        : 0,
      totalRenders: renders.length,
      slowRenders: renders.filter(r => r.duration && r.duration > 16).length
    };
  }, []);

  // 打印性能报告
  const printReport = useCallback(() => {
    const metrics = getMetrics();
    
    console.group(`📊 Performance Report - ${componentRef.current}`);
    console.log(`Total Renders: ${metrics.totalRenders}`);
    console.log(`Slow Renders (>16ms): ${metrics.slowRenders}`);
    console.log(`Average Render Time: ${metrics.averageRenderTime.toFixed(2)}ms`);
    console.log(`Average API Time: ${metrics.averageApiTime.toFixed(2)}ms`);
    console.log(`Total API Calls: ${metrics.apis.length}`);
    console.log(`Total Interactions: ${metrics.interactions.length}`);
    console.groupEnd();
    
    return metrics;
  }, [getMetrics]);

  // 清理性能数据
  const clearMetrics = useCallback(() => {
    const component = componentRef.current;
    performanceData.entries = performanceData.entries.filter(entry => 
      !entry.name.includes(component)
    );
    
    // 清理startTimes中的相关条目
    Array.from(performanceData.startTimes.keys()).forEach(key => {
      if (key.includes(component)) {
        performanceData.startTimes.delete(key);
      }
    });
    
    renderCountRef.current = 0;
    lastRenderTime.current = 0;
    
    console.log(`🧹 Cleared metrics for ${component}`);
  }, []);

  // Web Vitals 监控
  useEffect(() => {
    // LCP (Largest Contentful Paint) 监控
    const observeLCP = new PerformanceObserver((entryList) => {
      const entries = entryList.getEntries();
      const lastEntry = entries[entries.length - 1];
      
      const entry: PerformanceEntry = {
        name: `${componentRef.current}_LCP`,
        startTime: lastEntry.startTime,
        duration: lastEntry.startTime,
        type: 'navigation',
        metadata: {
          element: lastEntry.element?.tagName || 'Unknown'
        }
      };
      performanceData.entries.push(entry);
    });

    // FID (First Input Delay) 监控
    const observeFID = new PerformanceObserver((entryList) => {
      const entries = entryList.getEntries();
      entries.forEach((entry) => {
        const performanceEntry: PerformanceEntry = {
          name: `${componentRef.current}_FID`,
          startTime: entry.startTime,
          duration: entry.processingStart - entry.startTime,
          type: 'interaction',
          metadata: {
            inputType: entry.name
          }
        };
        performanceData.entries.push(performanceEntry);
      });
    });

    try {
      observeLCP.observe({ type: 'largest-contentful-paint', buffered: true });
      observeFID.observe({ type: 'first-input', buffered: true });
    } catch (error) {
      console.warn('Performance Observer not supported:', error);
    }

    return () => {
      observeLCP.disconnect();
      observeFID.disconnect();
    };
  }, []);

  // 在组件每次渲染时记录（仅开发环境）
  useEffect(() => {
    recordRender();
  });

  return {
    startTiming,
    endTiming,
    recordRender,
    recordApiCall,
    recordInteraction,
    getMetrics,
    printReport,
    clearMetrics,
    renderCount: renderCountRef.current
  };
}

// 全局性能工具函数
export const globalPerformance = {
  getAllEntries: () => [...performanceData.entries],
  
  getEntriesByComponent: (componentName: string) => 
    performanceData.entries.filter(entry => entry.name.includes(componentName)),
  
  getSlowOperations: (threshold: number = 100) =>
    performanceData.entries.filter(entry => entry.duration && entry.duration > threshold),
  
  clearAll: () => {
    performanceData.entries.length = 0;
    performanceData.startTimes.clear();
    console.log('🧹 All performance data cleared');
  },
  
  generateReport: () => {
    const entries = performanceData.entries;
    const components = [...new Set(entries.map(e => e.name.split('_')[0]))];
    
    console.group('📊 Global Performance Report');
    
    components.forEach(component => {
      const componentEntries = entries.filter(e => e.name.includes(component));
      const renders = componentEntries.filter(e => e.type === 'render');
      const apis = componentEntries.filter(e => e.type === 'api');
      
      console.group(`🔍 Component: ${component}`);
      console.log(`Renders: ${renders.length}`);
      console.log(`API Calls: ${apis.length}`);
      console.log(`Avg Render Time: ${
        renders.filter(r => r.duration).length > 0
          ? (renders.filter(r => r.duration).reduce((sum, r) => sum + r.duration!, 0) / renders.filter(r => r.duration).length).toFixed(2)
          : 0
      }ms`);
      console.groupEnd();
    });
    
    console.groupEnd();
  }
};
