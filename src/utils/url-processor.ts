/**
 * AI智能填入功能：URL处理工具类
 * 用于标准化和解析网站URL，支持重复检测功能
 */

export interface URLComponents {
  protocol: string
  subdomain: string
  domain: string
  path: string
  query: string
  fragment: string
}

export interface URLValidationResult {
  isValid: boolean
  error?: string
  normalized?: string
  components?: URLComponents
}

export class URLProcessor {
  
  /**
   * 验证URL格式是否有效
   * @param url 待验证的URL
   * @returns 验证结果
   */
  static validateURL(url: string): URLValidationResult {
    if (!url || typeof url !== 'string') {
      return {
        isValid: false,
        error: 'URL不能为空'
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
      // 如果没有协议，自动添加https
      const urlWithProtocol = trimmedUrl.startsWith('http') ? 
        trimmedUrl : `https://${trimmedUrl}`
      
      const urlObj = new URL(urlWithProtocol)
      
      // 验证域名格式
      if (!urlObj.hostname || urlObj.hostname.length < 3) {
        return {
          isValid: false,
          error: '无效的域名格式'
        }
      }

      // 验证域名是否包含点号（除非是localhost）
      if (!urlObj.hostname.includes('.') && urlObj.hostname !== 'localhost') {
        return {
          isValid: false,
          error: '域名格式无效，需要包含顶级域名'
        }
      }

      const components = this.parseURL(urlWithProtocol)
      const normalized = this.normalize(urlWithProtocol)

      return {
        isValid: true,
        normalized,
        components
      }
    } catch {
      return {
        isValid: false,
        error: '无效的URL格式'
      }
    }
  }

  /**
   * 解析URL为各个组件
   * @param url 待解析的URL
   * @returns URL组件
   */
  static parseURL(url: string): URLComponents {
    try {
      const urlWithProtocol = url.startsWith('http') ? url : `https://${url}`
      const urlObj = new URL(urlWithProtocol)
      
      const hostParts = urlObj.hostname.split('.')
      const domain = hostParts.length >= 2 ? 
        hostParts.slice(-2).join('.') : urlObj.hostname
      const subdomain = hostParts.length > 2 ? 
        hostParts.slice(0, -2).join('.') : ''
      
      return {
        protocol: urlObj.protocol,
        subdomain,
        domain,
        path: urlObj.pathname,
        query: urlObj.search,
        fragment: urlObj.hash
      }
    } catch {
      // 如果URL无效，返回基本解析
      const cleanUrl = url.toLowerCase()
        .replace(/^https?:\/\//, '')
        .replace(/^www\./, '')
      
      const domainMatch = cleanUrl.match(/^([^/?#]+)/)
      const domain = domainMatch ? domainMatch[1] : cleanUrl
      
      return {
        protocol: '',
        subdomain: '',
        domain,
        path: '',
        query: '',
        fragment: ''
      }
    }
  }
  
  /**
   * 标准化URL，用于重复检测
   * 规则：
   * - 统一转换为小写
   * - 移除协议前缀
   * - 移除www前缀
   * - 移除末尾斜杠
   * - 保留子域名和路径（不区分策略）
   * @param url 待标准化的URL
   * @returns 标准化后的URL
   */
  static normalize(url: string): string {
    if (!url) return ''
    
    try {
      const validation = this.validateURL(url)
      if (!validation.isValid || !validation.components) {
        throw new Error('Invalid URL')
      }
      
      const components = validation.components
      
      // 构建标准化URL：保留子域名和路径
      let normalized = ''
      
      // 添加子域名（如果存在）
      if (components.subdomain) {
        normalized += `${components.subdomain}.`
      }
      
      // 添加主域名
      normalized += components.domain
      
      // 添加路径（移除末尾斜杠）
      if (components.path && components.path !== '/') {
        normalized += components.path.replace(/\/+$/, '')
      }
      
      return normalized.toLowerCase()
      
    } catch {
      // 兜底处理：简单字符串处理
      return url
        .toLowerCase()
        .replace(/^https?:\/\//, '')     // 移除协议
        .replace(/^www\./, '')          // 移除www前缀
        .replace(/\/+$/, '')            // 移除末尾斜杠
        .trim()
    }
  }
  
  /**
   * 生成用于显示的友好URL格式
   * @param url 原始URL
   * @returns 友好显示格式
   */
  static getDisplayURL(url: string): string {
    try {
      const validation = this.validateURL(url)
      if (!validation.isValid || !validation.components) {
        return url
      }
      
      const components = validation.components
      let displayUrl = ''
      
      // 添加子域名（如果存在）
      if (components.subdomain) {
        displayUrl += `${components.subdomain}.`
      }
      
      // 添加主域名
      displayUrl += components.domain
      
      // 添加路径
      if (components.path && components.path !== '/') {
        displayUrl += components.path
      }
      
      return displayUrl
      
    } catch {
      return url.replace(/^https?:\/\//, '').replace(/^www\./, '')
    }
  }
  
  /**
   * 生成完整的可访问URL
   * @param url 原始URL
   * @returns 完整的URL（包含协议）
   */
  static getFullURL(url: string): string {
    if (!url) return ''
    
    const trimmedUrl = url.trim()
    if (trimmedUrl.startsWith('http')) {
      return trimmedUrl
    }
    
    return `https://${trimmedUrl}`
  }
  
  /**
   * 检查两个URL是否指向同一个资源
   * @param url1 第一个URL
   * @param url2 第二个URL
   * @returns 是否相同
   */
  static isSameResource(url1: string, url2: string): boolean {
    if (!url1 || !url2) return false
    
    try {
      const normalized1 = this.normalize(url1)
      const normalized2 = this.normalize(url2)
      
      return normalized1 === normalized2
    } catch {
      return false
    }
  }
  
  /**
   * 从URL中提取域名
   * @param url 原始URL
   * @returns 域名
   */
  static extractDomain(url: string): string {
    try {
      const components = this.parseURL(url)
      return components.domain
    } catch {
      return ''
    }
  }
  
  /**
   * 检查URL是否是有效的网站地址
   * @param url 待检查的URL
   * @returns 是否是有效的网站地址
   */
  static isValidWebsite(url: string): boolean {
    const validation = this.validateURL(url)
    return validation.isValid
  }
  
  /**
   * 获取URL的根域名（不包含子域名）
   * @param url 原始URL
   * @returns 根域名
   */
  static getRootDomain(url: string): string {
    try {
      const components = this.parseURL(url)
      return components.domain
    } catch {
      return ''
    }
  }
}

// 使用示例：
// URLProcessor.normalize('https://chat.openai.com/') -> 'chat.openai.com'
// URLProcessor.normalize('http://www.example.com/path/') -> 'example.com/path'
// URLProcessor.isSameResource('https://example.com', 'http://example.com/') -> true
