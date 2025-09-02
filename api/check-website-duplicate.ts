/**
 * AI智能填入功能：网站重复检测API
 * 检查提交的网站URL是否已存在于平台中
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

// 本地URL处理函数
interface URLValidationResult {
  isValid: boolean
  error?: string
  normalized?: string
}

function validateAndNormalizeURL(url: string): URLValidationResult {
  if (!url || typeof url !== 'string') {
    return {
      isValid: false,
      error: '无效的URL参数'
    }
  }
  
  const trimmedUrl = url.trim()
  
  if (!trimmedUrl) {
    return {
      isValid: false,
      error: 'URL不能为空'
    }
  }
  
  try {
    // 如果URL没有协议，添加https://
    let normalizedUrl = trimmedUrl
    if (!normalizedUrl.match(/^https?:\/\//)) {
      normalizedUrl = `https://${normalizedUrl}`
    }
    
    const urlObj = new URL(normalizedUrl)
    
    // 标准化域名（转小写，移除www前缀）
    let hostname = urlObj.hostname.toLowerCase()
    if (hostname.startsWith('www.')) {
      hostname = hostname.substring(4)
    }
    
    // 重构标准化的URL
    const normalized = `${urlObj.protocol}//${hostname}${urlObj.pathname === '/' ? '' : urlObj.pathname}`
    
    return {
      isValid: true,
      normalized
    }
  } catch (error) {
    return {
      isValid: false,
      error: '无效的URL格式'
    }
  }
}

function getDisplayURL(url: string): string {
  try {
    const urlObj = new URL(url.startsWith('http') ? url : `https://${url}`)
    let hostname = urlObj.hostname.toLowerCase()
    if (hostname.startsWith('www.')) {
      hostname = hostname.substring(4)
    }
    return hostname
  } catch {
    return url
  }
}

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
    console.log('🔍 开始重复检测API处理...')
    
    // 1. 输入验证
    const { url }: RequestBody = req.body
    
    if (!url || typeof url !== 'string') {
      return res.status(400).json({
        error: '缺少或无效的URL参数',
        code: 'MISSING_URL'
      })
    }
    
    console.log('📝 输入URL:', url)
    
    // 2. URL格式验证和标准化
    const validation = validateAndNormalizeURL(url.trim())
    
    if (!validation.isValid) {
      return res.status(400).json({
        error: validation.error || '无效的URL格式',
        code: 'INVALID_URL_FORMAT'
      })
    }
    
    const normalizedUrl = validation.normalized || ''
    const displayUrl = getDisplayURL(url)
    
    console.log('🔗 标准化URL:', normalizedUrl)
    console.log('👁️ 显示URL:', displayUrl)
    
    // 3. 初始化Supabase客户端
    const supabaseUrl = process.env.VITE_SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    
    if (!supabaseUrl || !serviceKey) {
      console.error('❌ Supabase配置缺失')
      return res.status(500).json({
        error: 'Server configuration error',
        code: 'SERVER_CONFIG_ERROR'
      })
    }
    
    const supabase = createClient(supabaseUrl, serviceKey)
    
    // 4. 检查重复工具
    console.log('🔍 查询数据库重复工具...')
    
    const { data: existingTools, error } = await supabase
      .from('tools')
      .select('id, name, tagline, website_url, status, logo_url, created_at, categories')
      .eq('website_url', normalizedUrl)
      .limit(1)
    
    if (error) {
      console.error('❌ 数据库查询错误:', error)
      return res.status(500).json({
        error: 'Database query failed',
        code: 'DATABASE_ERROR'
      })
    }
    
    // 5. 构建响应结果
    const processingTime = Date.now() - startTime
    
    if (existingTools && existingTools.length > 0) {
      const existingTool = existingTools[0]
      
      const result: DuplicateCheckResult = {
        exists: true,
        tool: {
          id: existingTool.id,
          name: existingTool.name,
          tagline: existingTool.tagline || '',
          website_url: existingTool.website_url,
          status: existingTool.status,
          logo_url: existingTool.logo_url || undefined,
          created_at: existingTool.created_at,
          categories: existingTool.categories || []
        },
        cached: false,
        processing_time_ms: processingTime,
        normalized_url: normalizedUrl,
        display_url: displayUrl
      }
      
      console.log('🚨 发现重复工具:', existingTool.name)
      return res.status(200).json(result)
    } else {
      const result: DuplicateCheckResult = {
        exists: false,
        cached: false,
        processing_time_ms: processingTime,
        normalized_url: normalizedUrl,
        display_url: displayUrl
      }
      
      console.log('✅ 无重复工具:', normalizedUrl)
      return res.status(200).json(result)
    }
    
  } catch (error) {
    console.error('❌ 重复检测API错误:', error)
    
    return res.status(500).json({
      error: 'Internal server error',
      code: 'INTERNAL_ERROR',
      processing_time_ms: Date.now() - startTime
    })
  }
}