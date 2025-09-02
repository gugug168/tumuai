/**
 * AI智能填入功能：网站重复检测API
 * 检查提交的网站URL是否已存在于平台中
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import { URLProcessor } from '../src/utils/url-processor'
import { DuplicateCheckCache } from './cache-manager'
import { PerformanceAnalytics } from './performance-analytics'

interface DuplicateCheckResult {
  exists: boolean
  tool?: {
    id: string
    name: string
    tagline: string
    website_url: string
    status: string
    logo_url?: string
    created_at: string
    categories: string[]
  }
  cached: boolean
  processing_time_ms: number
  normalized_url: string
  display_url: string
}

interface RequestBody {
  url: string
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const startTime = Date.now()
  let performanceAnalytics: PerformanceAnalytics | null = null
  let normalizedUrl = ''
  let cached = false
  let hasError = false
  let errorMessage = ''
  
  // 设置CORS头
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  
  // 处理OPTIONS预检请求
  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }
  
  // 只允许POST请求
  if (req.method !== 'POST') {
    return res.status(405).json({ 
      error: 'Method not allowed',
      code: 'METHOD_NOT_ALLOWED' 
    })
  }
  
  try {
    // 初始化性能分析
    try {
      performanceAnalytics = new PerformanceAnalytics()
    } catch (analyticsError) {
      console.warn('性能分析初始化失败:', analyticsError)
      // 不阻塞主要功能，继续执行
    }
    
    // 1. 输入验证
    const { url }: RequestBody = req.body
    
    if (!url || typeof url !== 'string') {
      hasError = true
      errorMessage = 'Invalid URL parameter'
      
      return res.status(400).json({ 
        error: 'URL参数是必需的',
        code: 'INVALID_INPUT' 
      })
    }
    
    // 2. URL格式验证和标准化
    const validation = URLProcessor.validateURL(url.trim())
    
    if (!validation.isValid) {
      hasError = true
      errorMessage = validation.error || 'Invalid URL format'
      
      return res.status(400).json({
        error: validation.error || '无效的URL格式',
        code: 'INVALID_URL_FORMAT'
      })
    }
    
    normalizedUrl = validation.normalized || ''
    const displayUrl = URLProcessor.getDisplayURL(url)
    
    // 3. 初始化Supabase客户端
    const supabaseUrl = process.env.VITE_SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    
    if (!supabaseUrl || !serviceKey) {
      hasError = true
      errorMessage = 'Missing Supabase configuration'
      
      return res.status(500).json({
        error: 'Server configuration error',
        code: 'SERVER_CONFIG_ERROR'
      })
    }
    
    const supabase = createClient(supabaseUrl, serviceKey)
    const cache = new DuplicateCheckCache(supabaseUrl, serviceKey)
    
    // 4. 检查缓存
    console.log(`🔍 检查重复网站: ${normalizedUrl}`)
    
    const cachedResult = await cache.get(normalizedUrl)
    if (cachedResult) {
      cached = true
      console.log(`✅ 缓存命中: ${normalizedUrl}`)
      
      const result: DuplicateCheckResult = {
        exists: cachedResult.exists,
        cached: true,
        processing_time_ms: Date.now() - startTime,
        normalized_url: normalizedUrl,
        display_url: displayUrl
      }
      
      // 如果缓存显示存在重复，获取最新的工具详情
      if (cachedResult.exists && cachedResult.existing_tool_id) {
        const { data: tool } = await supabase
          .from('tools')
          .select('id, name, tagline, website_url, status, logo_url, created_at, categories')
          .eq('id', cachedResult.existing_tool_id)
          .single()
        
        if (tool) {
          result.tool = tool
        } else {
          // 工具已被删除，更新缓存
          await cache.set(url, normalizedUrl, false)
          result.exists = false
        }
      }
      
      // 记录性能指标
      if (performanceAnalytics) {
        performanceAnalytics.recordMetrics({
          endpoint: 'check-website-duplicate',
          processing_time_ms: result.processing_time_ms,
          cache_hit: true,
          result_exists: result.exists,
          has_error: false,
          user_agent: req.headers['user-agent'] as string,
          ip_address: req.headers['x-forwarded-for'] as string || req.socket.remoteAddress
        }).catch(err => console.warn('性能指标记录失败:', err))
      }
      
      return res.status(200).json(result)
    }
    
    // 5. 数据库查询（缓存未命中）
    console.log(`🔍 数据库查询: ${normalizedUrl}`)
    
    const { data: existingTools, error: dbError } = await supabase
      .from('tools')
      .select('id, name, tagline, website_url, status, logo_url, created_at, categories')
      .eq('normalized_url', normalizedUrl)
      .in('status', ['published', 'pending'])
      .limit(1)
    
    if (dbError) {
      hasError = true
      errorMessage = `Database query failed: ${dbError.message}`
      console.error('数据库查询失败:', dbError)
      
      return res.status(500).json({
        error: '数据库查询失败',
        code: 'DATABASE_ERROR'
      })
    }
    
    const processingTime = Date.now() - startTime
    
    // 6. 构建响应结果
    const exists = existingTools && existingTools.length > 0
    const result: DuplicateCheckResult = {
      exists,
      cached: false,
      processing_time_ms: processingTime,
      normalized_url: normalizedUrl,
      display_url: displayUrl
    }
    
    if (exists && existingTools[0]) {
      result.tool = existingTools[0]
    }
    
    // 7. 更新缓存（异步，不阻塞响应）
    cache.set(
      url,
      normalizedUrl, 
      exists, 
      exists ? existingTools[0]?.id : undefined
    ).catch(err => console.warn('缓存更新失败:', err))
    
    // 8. 记录性能指标（异步）
    if (performanceAnalytics) {
      performanceAnalytics.recordMetrics({
        endpoint: 'check-website-duplicate',
        processing_time_ms: processingTime,
        cache_hit: false,
        result_exists: exists,
        has_error: false,
        user_agent: req.headers['user-agent'] as string,
        ip_address: req.headers['x-forwarded-for'] as string || req.socket.remoteAddress,
        request_size_bytes: JSON.stringify(req.body).length,
        response_size_bytes: JSON.stringify(result).length,
        metadata: {
          normalized_url: normalizedUrl,
          display_url: displayUrl,
          original_url: url
        }
      }).catch(err => console.warn('性能指标记录失败:', err))
    }
    
    console.log(`✅ 重复检测完成: ${normalizedUrl} - ${exists ? '存在重复' : '无重复'} (${processingTime}ms)`)
    
    // 9. 返回结果
    return res.status(200).json(result)
    
  } catch (error) {
    hasError = true
    const err = error as Error
    errorMessage = err.message || 'Unknown error'
    
    console.error('重复检测API异常:', error)
    
    const processingTime = Date.now() - startTime
    
    // 记录错误指标
    if (performanceAnalytics) {
      performanceAnalytics.recordMetrics({
        endpoint: 'check-website-duplicate',
        processing_time_ms: processingTime,
        cache_hit: cached,
        result_exists: false,
        has_error: true,
        error_message: errorMessage,
        user_agent: req.headers['user-agent'] as string,
        ip_address: req.headers['x-forwarded-for'] as string || req.socket.remoteAddress
      }).catch(analyticsErr => console.warn('错误指标记录失败:', analyticsErr))
    }
    
    return res.status(500).json({
      error: 'Internal server error',
      code: 'INTERNAL_ERROR',
      processing_time_ms: processingTime
    })
  }
}

// 导出类型供前端使用
export type { DuplicateCheckResult }