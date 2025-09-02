/**
 * AI智能填入功能：前端重复检测客户端
 * 用于调用后端重复检测API
 */

import type { DuplicateCheckResult } from '../../api/check-website-duplicate'

interface DuplicateCheckError {
  error: string
  code: string
  processing_time_ms?: number
}

interface DuplicateCheckResponse extends DuplicateCheckResult {}

export class DuplicateChecker {
  private static readonly API_ENDPOINT = '/api/check-website-duplicate'
  private static readonly REQUEST_TIMEOUT = 10000 // 10秒超时
  
  /**
   * 检查网站是否重复
   * @param url 网站URL
   * @returns 重复检测结果
   */
  static async checkDuplicate(url: string): Promise<DuplicateCheckResponse> {
    if (!url || typeof url !== 'string') {
      throw new Error('URL参数不能为空')
    }
    
    // 开发环境模拟响应 - 遵循KISS原则，快速测试功能
    if (import.meta.env.DEV) {
      return new Promise((resolve) => {
        setTimeout(() => {
          const normalizedUrl = url.toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/$/, '')
          
          // 模拟已知的重复网站
          const knownSites = ['github.com', 'google.com', 'chatgpt.com']
          const exists = knownSites.includes(normalizedUrl)
          
          if (exists) {
            resolve({
              exists: true,
              tool: {
                id: 'mock-tool-123',
                name: `${normalizedUrl.split('.')[0]} 工具`,
                tagline: '这是一个模拟的已存在工具',
                website_url: url,
                status: 'published',
                logo_url: `https://favicon.im/${normalizedUrl}?larger=true`,
                created_at: '2025-01-01T00:00:00Z',
                categories: ['方案设计']
              },
              cached: false,
              processing_time_ms: 150,
              normalized_url: normalizedUrl,
              display_url: normalizedUrl
            })
          } else {
            resolve({
              exists: false,
              cached: false,
              processing_time_ms: 120,
              normalized_url: normalizedUrl,
              display_url: normalizedUrl
            })
          }
        }, 800) // 模拟网络延迟
      })
    }
    
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), DuplicateChecker.REQUEST_TIMEOUT)
    
    try {
      const response = await fetch(DuplicateChecker.API_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url: url.trim() }),
        signal: controller.signal
      })
      
      clearTimeout(timeoutId)
      
      if (!response.ok) {
        const errorData: DuplicateCheckError = await response.json()
        throw new DuplicateCheckClientError(
          errorData.error || '检测失败',
          errorData.code || 'UNKNOWN_ERROR',
          response.status,
          errorData.processing_time_ms
        )
      }
      
      const result: DuplicateCheckResponse = await response.json()
      
      // 验证响应数据格式
      if (typeof result.exists !== 'boolean') {
        throw new Error('服务器返回数据格式错误')
      }
      
      return result
      
    } catch (error) {
      clearTimeout(timeoutId)
      
      if (error instanceof DuplicateCheckClientError) {
        throw error
      }
      
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          throw new DuplicateCheckClientError(
            '请求超时，请稍后重试',
            'REQUEST_TIMEOUT',
            408
          )
        }
        
        if (error.name === 'TypeError' && error.message.includes('fetch')) {
          throw new DuplicateCheckClientError(
            '网络连接失败，请检查网络连接',
            'NETWORK_ERROR',
            0
          )
        }
        
        throw new DuplicateCheckClientError(
          error.message,
          'CLIENT_ERROR',
          0
        )
      }
      
      throw new DuplicateCheckClientError(
        '未知错误',
        'UNKNOWN_ERROR',
        0
      )
    }
  }
  
  /**
   * 检查多个网站是否重复（批量检测）
   * @param urls 网站URL列表
   * @param options 批量检测选项
   * @returns 重复检测结果列表
   */
  static async checkMultiple(
    urls: string[], 
    options: {
      maxConcurrent?: number // 最大并发数
      delayMs?: number // 请求间隔延迟
    } = {}
  ): Promise<Array<{
    url: string
    result?: DuplicateCheckResponse
    error?: DuplicateCheckClientError
  }>> {
    const { maxConcurrent = 3, delayMs = 200 } = options
    const results: Array<{
      url: string
      result?: DuplicateCheckResponse
      error?: DuplicateCheckClientError
    }> = []
    
    // 分批处理
    for (let i = 0; i < urls.length; i += maxConcurrent) {
      const batch = urls.slice(i, i + maxConcurrent)
      
      const batchPromises = batch.map(async (url) => {
        try {
          const result = await this.checkDuplicate(url)
          return { url, result }
        } catch (error) {
          return { 
            url, 
            error: error instanceof DuplicateCheckClientError ? error : 
              new DuplicateCheckClientError('检测失败', 'UNKNOWN_ERROR', 0)
          }
        }
      })
      
      const batchResults = await Promise.all(batchPromises)
      results.push(...batchResults)
      
      // 添加延迟避免过快请求
      if (i + maxConcurrent < urls.length && delayMs > 0) {
        await new Promise(resolve => setTimeout(resolve, delayMs))
      }
    }
    
    return results
  }
}

/**
 * 重复检测客户端错误类
 */
export class DuplicateCheckClientError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly status: number,
    public readonly processingTime?: number
  ) {
    super(message)
    this.name = 'DuplicateCheckClientError'
  }
  
  /**
   * 是否是用户输入错误
   */
  get isUserError(): boolean {
    return this.status >= 400 && this.status < 500
  }
  
  /**
   * 是否是服务器错误
   */
  get isServerError(): boolean {
    return this.status >= 500
  }
  
  /**
   * 是否是网络错误
   */
  get isNetworkError(): boolean {
    return this.status === 0
  }
  
  /**
   * 获取用户友好的错误消息
   */
  get userFriendlyMessage(): string {
    switch (this.code) {
      case 'INVALID_INPUT':
      case 'INVALID_URL_FORMAT':
        return '请输入有效的网站地址'
      case 'REQUEST_TIMEOUT':
        return '检测超时，请稍后重试'
      case 'NETWORK_ERROR':
        return '网络连接失败，请检查网络连接'
      case 'DATABASE_ERROR':
        return '服务暂时不可用，请稍后重试'
      case 'SERVER_CONFIG_ERROR':
      case 'INTERNAL_ERROR':
        return '服务器内部错误，请联系技术支持'
      default:
        return this.message || '检测失败，请重试'
    }
  }
}

// 便捷函数
export const checkWebsiteDuplicate = DuplicateChecker.checkDuplicate

// 类型导出
export type { DuplicateCheckResult, DuplicateCheckResponse }