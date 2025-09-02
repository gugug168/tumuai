/**
 * AI智能填入功能：缓存管理器
 * 用于管理重复检测的缓存，提升API响应速度
 */

import { createClient } from '@supabase/supabase-js'

interface CacheEntry {
  id: string
  original_url: string
  normalized_url: string
  exists: boolean
  existing_tool_id?: string
  cached_at: string
  expires_at: string
  created_at: string
  updated_at: string
}

interface CacheSetOptions {
  expirationHours?: number // 缓存过期时间（小时），默认1小时
}

interface CacheStats {
  total_entries: number
  expired_entries: number
  active_entries: number
  cache_hit_rate: number
  avg_age_hours: number
}

export class DuplicateCheckCache {
  private supabase
  private defaultExpirationHours = 1
  
  constructor(supabaseUrl?: string, serviceKey?: string) {
    // 使用传入的参数或环境变量
    const url = supabaseUrl || process.env.VITE_SUPABASE_URL
    const key = serviceKey || process.env.SUPABASE_SERVICE_ROLE_KEY
    
    if (!url || !key) {
      throw new Error('Supabase URL 和 Service Role Key 是必需的')
    }
    
    this.supabase = createClient(url, key)
  }
  
  /**
   * 获取缓存条目
   * @param normalizedUrl 标准化后的URL
   * @returns 缓存条目或null
   */
  async get(normalizedUrl: string): Promise<CacheEntry | null> {
    if (!normalizedUrl) {
      return null
    }
    
    try {
      const { data, error } = await this.supabase
        .from('website_duplicate_cache')
        .select('*')
        .eq('normalized_url', normalizedUrl)
        .gt('expires_at', new Date().toISOString())
        .maybeSingle()
      
      if (error) {
        console.error('缓存获取失败:', error)
        return null
      }
      
      return data
    } catch (error) {
      console.error('缓存获取异常:', error)
      return null
    }
  }
  
  /**
   * 设置缓存条目
   * @param originalUrl 原始URL
   * @param normalizedUrl 标准化URL
   * @param exists 是否存在重复
   * @param existingToolId 如果存在重复，对应的工具ID
   * @param options 缓存选项
   */
  async set(
    originalUrl: string,
    normalizedUrl: string,
    exists: boolean,
    existingToolId?: string,
    options: CacheSetOptions = {}
  ): Promise<boolean> {
    if (!originalUrl || !normalizedUrl) {
      return false
    }
    
    const expirationHours = options.expirationHours || this.defaultExpirationHours
    const expiresAt = new Date(Date.now() + expirationHours * 60 * 60 * 1000)
    
    try {
      const { error } = await this.supabase
        .from('website_duplicate_cache')
        .upsert({
          original_url: originalUrl,
          normalized_url: normalizedUrl,
          exists,
          existing_tool_id: existingToolId || null,
          expires_at: expiresAt.toISOString(),
          updated_at: new Date().toISOString()
        }, { 
          onConflict: 'normalized_url',
          ignoreDuplicates: false
        })
      
      if (error) {
        console.error('缓存设置失败:', error)
        return false
      }
      
      return true
    } catch (error) {
      console.error('缓存设置异常:', error)
      return false
    }
  }
  
  /**
   * 删除特定的缓存条目
   * @param normalizedUrl 标准化URL
   */
  async delete(normalizedUrl: string): Promise<boolean> {
    if (!normalizedUrl) {
      return false
    }
    
    try {
      const { error } = await this.supabase
        .from('website_duplicate_cache')
        .delete()
        .eq('normalized_url', normalizedUrl)
      
      if (error) {
        console.error('缓存删除失败:', error)
        return false
      }
      
      return true
    } catch (error) {
      console.error('缓存删除异常:', error)
      return false
    }
  }
  
  /**
   * 清理过期的缓存条目
   * @returns 清理的条目数量
   */
  async cleanup(): Promise<number> {
    try {
      const { error } = await this.supabase
        .rpc('cleanup_expired_duplicate_cache')
      
      if (error) {
        console.error('缓存清理失败:', error)
        return 0
      }
      
      // 由于rpc返回的是删除的行数，我们需要另一种方式获取结果
      // 或者修改数据库函数返回删除的行数
      const { data } = await this.supabase
        .from('website_duplicate_cache')
        .select('id', { count: 'exact', head: true })
        .lt('expires_at', new Date().toISOString())
      
      // 如果还有过期条目，继续清理
      if (data && typeof data.count === 'number' && data.count > 0) {
        await this.supabase
          .from('website_duplicate_cache')
          .delete()
          .lt('expires_at', new Date().toISOString())
        
        return data.count
      }
      
      return 0
    } catch (error) {
      console.error('缓存清理异常:', error)
      return 0
    }
  }
  
  /**
   * 获取缓存统计信息
   * @returns 缓存统计
   */
  async getStats(): Promise<CacheStats> {
    try {
      const now = new Date()
      
      // 获取总条目数
      const { count: totalCount } = await this.supabase
        .from('website_duplicate_cache')
        .select('id', { count: 'exact', head: true })
      
      // 获取过期条目数
      const { count: expiredCount } = await this.supabase
        .from('website_duplicate_cache')
        .select('id', { count: 'exact', head: true })
        .lt('expires_at', now.toISOString())
      
      // 获取活跃条目数
      const activeCount = (totalCount || 0) - (expiredCount || 0)
      
      // 获取最近24小时的缓存命中统计（从性能日志）
      const { data: hitStats } = await this.supabase
        .from('api_performance_logs')
        .select('cache_hit')
        .eq('endpoint', 'check-website-duplicate')
        .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      
      let cacheHitRate = 0
      if (hitStats && hitStats.length > 0) {
        const hits = hitStats.filter(stat => stat.cache_hit).length
        cacheHitRate = Math.round((hits / hitStats.length) * 100 * 100) / 100 // 保留2位小数
      }
      
      // 获取平均缓存年龄
      const { data: ageData } = await this.supabase
        .from('website_duplicate_cache')
        .select('created_at')
        .gte('expires_at', now.toISOString())
        .limit(100) // 限制查询量
      
      let avgAgeHours = 0
      if (ageData && ageData.length > 0) {
        const totalAgeMs = ageData.reduce((sum, entry) => {
          const ageMs = now.getTime() - new Date(entry.created_at).getTime()
          return sum + ageMs
        }, 0)
        avgAgeHours = Math.round((totalAgeMs / ageData.length / (60 * 60 * 1000)) * 100) / 100
      }
      
      return {
        total_entries: totalCount || 0,
        expired_entries: expiredCount || 0,
        active_entries: Math.max(0, activeCount),
        cache_hit_rate: cacheHitRate,
        avg_age_hours: avgAgeHours
      }
      
    } catch (error) {
      console.error('获取缓存统计失败:', error)
      return {
        total_entries: 0,
        expired_entries: 0,
        active_entries: 0,
        cache_hit_rate: 0,
        avg_age_hours: 0
      }
    }
  }
  
  /**
   * 检查缓存是否健康（过期条目不超过总数的20%）
   * @returns 缓存是否健康
   */
  async isHealthy(): Promise<boolean> {
    try {
      const stats = await this.getStats()
      
      if (stats.total_entries === 0) {
        return true // 空缓存认为是健康的
      }
      
      const expiredRatio = stats.expired_entries / stats.total_entries
      return expiredRatio <= 0.2 // 过期条目不超过20%
    } catch (error) {
      console.error('检查缓存健康状态失败:', error)
      return false
    }
  }
  
  /**
   * 清除所有缓存（慎用！）
   * @returns 清除的条目数量
   */
  async clearAll(): Promise<number> {
    try {
      const { count } = await this.supabase
        .from('website_duplicate_cache')
        .select('id', { count: 'exact', head: true })
      
      const { error } = await this.supabase
        .from('website_duplicate_cache')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000') // 删除所有
      
      if (error) {
        console.error('清除所有缓存失败:', error)
        return 0
      }
      
      return count || 0
    } catch (error) {
      console.error('清除所有缓存异常:', error)
      return 0
    }
  }
  
  /**
   * 获取最近的缓存条目（用于调试）
   * @param limit 数量限制
   * @returns 缓存条目列表
   */
  async getRecentEntries(limit = 10): Promise<CacheEntry[]> {
    try {
      const { data, error } = await this.supabase
        .from('website_duplicate_cache')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit)
      
      if (error) {
        console.error('获取最近缓存条目失败:', error)
        return []
      }
      
      return data || []
    } catch (error) {
      console.error('获取最近缓存条目异常:', error)
      return []
    }
  }
}