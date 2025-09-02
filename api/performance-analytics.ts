/**
 * AI智能填入功能：性能分析工具
 * 用于监控和分析API性能指标
 */

import { createClient } from '@supabase/supabase-js'

interface PerformanceLogEntry {
  endpoint: string
  processing_time_ms: number
  cache_hit?: boolean
  result_exists?: boolean
  has_error?: boolean
  error_message?: string
  user_agent?: string
  ip_address?: string
  request_size_bytes?: number
  response_size_bytes?: number
  metadata?: Record<string, any>
}

interface PerformanceMetrics {
  api_calls_total: number
  cache_hits: number
  cache_misses: number
  avg_response_time_ms: number
  median_response_time_ms: number
  p95_response_time_ms: number
  min_response_time_ms: number
  max_response_time_ms: number
  duplicates_found: number
  errors: number
  error_rate_percent: number
  cache_hit_rate_percent: number
}

interface SlowQueryRecord {
  endpoint: string
  processing_time_ms: number
  cache_hit: boolean
  has_error: boolean
  error_message?: string
  created_at: string
}

export class PerformanceAnalytics {
  private supabase
  
  constructor(supabaseUrl?: string, serviceKey?: string) {
    const url = supabaseUrl || process.env.VITE_SUPABASE_URL
    const key = serviceKey || process.env.SUPABASE_SERVICE_ROLE_KEY
    
    if (!url || !key) {
      throw new Error('Supabase URL 和 Service Role Key 是必需的')
    }
    
    this.supabase = createClient(url, key)
  }
  
  /**
   * 记录API性能指标
   * @param entry 性能日志条目
   */
  async recordMetrics(entry: PerformanceLogEntry): Promise<boolean> {
    try {
      const { error } = await this.supabase
        .from('api_performance_logs')
        .insert({
          endpoint: entry.endpoint,
          processing_time_ms: entry.processing_time_ms,
          cache_hit: entry.cache_hit || false,
          result_exists: entry.result_exists || false,
          has_error: entry.has_error || false,
          error_message: entry.error_message || null,
          user_agent: entry.user_agent || null,
          ip_address: entry.ip_address || null,
          request_size_bytes: entry.request_size_bytes || null,
          response_size_bytes: entry.response_size_bytes || null,
          metadata: entry.metadata || null,
          created_at: new Date().toISOString()
        })
      
      if (error) {
        console.error('记录性能指标失败:', error)
        return false
      }
      
      return true
    } catch (error) {
      console.error('记录性能指标异常:', error)
      return false
    }
  }
  
  /**
   * 获取指定时间段的性能指标
   * @param endpoint API端点名称
   * @param hoursBack 回溯小时数，默认24小时
   * @returns 性能指标
   */
  async getMetrics(endpoint?: string, hoursBack = 24): Promise<PerformanceMetrics> {
    try {
      let query = this.supabase
        .from('api_performance_logs')
        .select('*')
        .gte('created_at', new Date(Date.now() - hoursBack * 60 * 60 * 1000).toISOString())
      
      if (endpoint) {
        query = query.eq('endpoint', endpoint)
      }
      
      const { data, error } = await query
      
      if (error || !data) {
        console.error('获取性能指标失败:', error)
        return this.getEmptyMetrics()
      }
      
      if (data.length === 0) {
        return this.getEmptyMetrics()
      }
      
      // 计算各项指标
      const totalCalls = data.length
      const cacheHits = data.filter(d => d.cache_hit).length
      const cacheMisses = totalCalls - cacheHits
      const duplicatesFound = data.filter(d => d.result_exists).length
      const errors = data.filter(d => d.has_error).length
      
      // 响应时间统计
      const responseTimes = data.map(d => d.processing_time_ms).sort((a, b) => a - b)
      const avgResponseTime = Math.round(responseTimes.reduce((sum, time) => sum + time, 0) / totalCalls)
      const medianResponseTime = this.calculatePercentile(responseTimes, 0.5)
      const p95ResponseTime = this.calculatePercentile(responseTimes, 0.95)
      const minResponseTime = responseTimes[0]
      const maxResponseTime = responseTimes[responseTimes.length - 1]
      
      // 计算百分比
      const errorRatePercent = Math.round((errors / totalCalls) * 100 * 100) / 100
      const cacheHitRatePercent = Math.round((cacheHits / totalCalls) * 100 * 100) / 100
      
      return {
        api_calls_total: totalCalls,
        cache_hits: cacheHits,
        cache_misses: cacheMisses,
        avg_response_time_ms: avgResponseTime,
        median_response_time_ms: medianResponseTime,
        p95_response_time_ms: p95ResponseTime,
        min_response_time_ms: minResponseTime,
        max_response_time_ms: maxResponseTime,
        duplicates_found: duplicatesFound,
        errors: errors,
        error_rate_percent: errorRatePercent,
        cache_hit_rate_percent: cacheHitRatePercent
      }
      
    } catch (error) {
      console.error('获取性能指标异常:', error)
      return this.getEmptyMetrics()
    }
  }
  
  /**
   * 获取慢查询记录
   * @param thresholdMs 慢查询阈值（毫秒），默认1000ms
   * @param hoursBack 回溯小时数，默认24小时
   * @param limit 返回记录数限制，默认20
   * @returns 慢查询记录
   */
  async getSlowQueries(
    thresholdMs = 1000, 
    hoursBack = 24, 
    limit = 20
  ): Promise<SlowQueryRecord[]> {
    try {
      const { data, error } = await this.supabase
        .rpc('get_slow_api_calls', {
          threshold_ms: thresholdMs,
          hours_back: hoursBack
        })
        .limit(limit)
      
      if (error) {
        console.error('获取慢查询记录失败:', error)
        return []
      }
      
      return data || []
    } catch (error) {
      console.error('获取慢查询记录异常:', error)
      return []
    }
  }
  
  /**
   * 获取实时性能监控数据（最近1小时）
   * @returns 实时性能指标
   */
  async getRealtimeMetrics(): Promise<PerformanceMetrics[]> {
    try {
      const { data, error } = await this.supabase
        .from('api_performance_realtime')
        .select('*')
      
      if (error || !data) {
        console.error('获取实时性能指标失败:', error)
        return []
      }
      
      return data.map(item => ({
        api_calls_total: item.calls_last_hour || 0,
        cache_hits: item.cache_hits_last_hour || 0,
        cache_misses: (item.calls_last_hour || 0) - (item.cache_hits_last_hour || 0),
        avg_response_time_ms: Math.round(item.avg_processing_time_ms || 0),
        median_response_time_ms: 0, // 实时视图不计算中位数
        p95_response_time_ms: Math.round(item.p95_processing_time_ms || 0),
        min_response_time_ms: 0,
        max_response_time_ms: 0,
        duplicates_found: 0,
        errors: item.errors_last_hour || 0,
        error_rate_percent: item.calls_last_hour > 0 ? 
          Math.round(((item.errors_last_hour || 0) / item.calls_last_hour) * 100 * 100) / 100 : 0,
        cache_hit_rate_percent: item.calls_last_hour > 0 ? 
          Math.round(((item.cache_hits_last_hour || 0) / item.calls_last_hour) * 100 * 100) / 100 : 0
      }))
    } catch (error) {
      console.error('获取实时性能指标异常:', error)
      return []
    }
  }
  
  /**
   * 清理旧的性能日志（保留指定天数）
   * @param retentionDays 保留天数，默认30天
   * @returns 清理的记录数量
   */
  async cleanupOldLogs(retentionDays = 30): Promise<number> {
    try {
      const { data } = await this.supabase
        .rpc('cleanup_old_api_performance_logs')
      
      return data || 0
    } catch (error) {
      console.error('清理旧性能日志异常:', error)
      return 0
    }
  }
  
  /**
   * 获取API健康状态检查
   * @returns 健康状态信息
   */
  async getHealthCheck(): Promise<{
    status: 'healthy' | 'warning' | 'critical'
    metrics: PerformanceMetrics
    issues: string[]
  }> {
    try {
      const metrics = await this.getMetrics('check-website-duplicate', 1) // 最近1小时
      const issues: string[] = []
      let status: 'healthy' | 'warning' | 'critical' = 'healthy'
      
      // 检查响应时间
      if (metrics.avg_response_time_ms > 2000) {
        issues.push('平均响应时间过长 (>2s)')
        status = 'warning'
      }
      
      if (metrics.p95_response_time_ms > 5000) {
        issues.push('P95响应时间过长 (>5s)')
        status = 'critical'
      }
      
      // 检查错误率
      if (metrics.error_rate_percent > 5) {
        issues.push('错误率过高 (>5%)')
        status = status === 'critical' ? 'critical' : 'warning'
      }
      
      if (metrics.error_rate_percent > 15) {
        issues.push('错误率严重过高 (>15%)')
        status = 'critical'
      }
      
      // 检查缓存命中率
      if (metrics.api_calls_total > 10 && metrics.cache_hit_rate_percent < 30) {
        issues.push('缓存命中率过低 (<30%)')
        status = status === 'critical' ? 'critical' : 'warning'
      }
      
      return {
        status,
        metrics,
        issues
      }
    } catch (error) {
      console.error('健康检查异常:', error)
      return {
        status: 'critical',
        metrics: this.getEmptyMetrics(),
        issues: ['健康检查失败']
      }
    }
  }
  
  /**
   * 计算百分位数
   * @param sortedArray 已排序的数组
   * @param percentile 百分位数 (0-1)
   * @returns 百分位数值
   */
  private calculatePercentile(sortedArray: number[], percentile: number): number {
    if (sortedArray.length === 0) return 0
    
    const index = percentile * (sortedArray.length - 1)
    const lower = Math.floor(index)
    const upper = Math.ceil(index)
    
    if (lower === upper) {
      return Math.round(sortedArray[lower])
    }
    
    const weight = index - lower
    return Math.round(sortedArray[lower] * (1 - weight) + sortedArray[upper] * weight)
  }
  
  /**
   * 获取空的性能指标对象
   * @returns 空的性能指标
   */
  private getEmptyMetrics(): PerformanceMetrics {
    return {
      api_calls_total: 0,
      cache_hits: 0,
      cache_misses: 0,
      avg_response_time_ms: 0,
      median_response_time_ms: 0,
      p95_response_time_ms: 0,
      min_response_time_ms: 0,
      max_response_time_ms: 0,
      duplicates_found: 0,
      errors: 0,
      error_rate_percent: 0,
      cache_hit_rate_percent: 0
    }
  }
}