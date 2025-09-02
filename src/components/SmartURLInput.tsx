/**
 * AI智能填入功能：智能URL输入框组件
 * 支持实时重复检测、URL验证和友好的状态提示
 */

import React, { useState, useCallback, useEffect } from 'react'
import { 
  CheckCircle, 
  XCircle, 
  AlertTriangle, 
  Globe, 
  ExternalLink, 
  Clock,
  Loader2,
  Info,
  Sparkles,
  Wand2,
  AlertCircle
} from 'lucide-react'

// 原生debounce实现 - 遵循KISS原则，避免外部依赖
const debounce = <T extends (...args: any[]) => any>(
  func: T, 
  wait: number
): ((...args: Parameters<T>) => void) & { cancel: () => void } => {
  let timeout: NodeJS.Timeout | undefined
  
  const debouncedFn = (...args: Parameters<T>) => {
    clearTimeout(timeout)
    timeout = setTimeout(() => func(...args), wait)
  }
  
  debouncedFn.cancel = () => {
    clearTimeout(timeout)
    timeout = undefined
  }
  
  return debouncedFn
}

import { URLProcessor } from '../utils/url-processor'
import { 
  checkWebsiteDuplicate, 
  DuplicateCheckClientError,
  type DuplicateCheckResult 
} from '../lib/duplicate-checker'

// AI智能填入相关类型定义
interface AIAnalysisResult {
  name: string;
  tagline: string;
  description: string;
  features: string[];
  pricing: 'Free' | 'Freemium' | 'Paid' | 'Trial';
  categories: string[];
  confidence: number;
  reasoning: string;
}

interface AISmartFillResponse {
  success: boolean;
  data?: AIAnalysisResult;
  error?: {
    code: string;
    message: string;
    retryable: boolean;
  };
  apiUsage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    cost: number;
  };
  metadata: {
    analysisTime: number;
    timestamp: string;
    websiteContentFetched: boolean;
    apiVersion: string;
  };
}

interface DuplicateInfo extends DuplicateCheckResult {}

interface SmartURLInputProps {
  value: string
  onChange: (url: string) => void
  onDuplicateChange: (info: DuplicateInfo) => void
  onAIFillComplete?: (data: AIAnalysisResult) => void // AI填入完成回调
  enableAIFill?: boolean // 是否启用AI智能填入
  placeholder?: string
  disabled?: boolean
  className?: string
}

type CheckStatus = 'idle' | 'checking' | 'valid' | 'duplicate' | 'invalid' | 'error' | 'ai-analyzing' | 'ai-complete'

const SmartURLInput: React.FC<SmartURLInputProps> = ({ 
  value, 
  onChange, 
  onDuplicateChange,
  onAIFillComplete,
  enableAIFill = true,
  placeholder = '输入工具网站地址，如：https://chatgpt.com',
  disabled = false,
  className = ''
}) => {
  const [checkStatus, setCheckStatus] = useState<CheckStatus>('idle')
  const [duplicateInfo, setDuplicateInfo] = useState<DuplicateInfo | null>(null)
  const [displayURL, setDisplayURL] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [processingTime, setProcessingTime] = useState(0)
  
  // AI智能填入相关状态
  const [aiAnalysisData, setAiAnalysisData] = useState<AIAnalysisResult | null>(null)
  const [aiError, setAiError] = useState('')
  const [aiCost, setAiCost] = useState(0)
  const [showAIButton, setShowAIButton] = useState(false)
  
  // AI智能分析函数
  const analyzeWithAI = useCallback(async (url: string) => {
    if (!enableAIFill || !url.trim()) return;
    
    try {
      setCheckStatus('ai-analyzing');
      setAiError('');
      
      const response = await fetch('/api/ai-smart-fill', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          websiteUrl: url,
          includeContent: true
        })
      });
      
      // 检查响应状态和Content-Type
      if (!response.ok) {
        const contentType = response.headers.get('content-type');
        let errorMessage = `API请求失败 (${response.status})`;
        
        if (contentType && contentType.includes('application/json')) {
          try {
            const errorData = await response.json();
            errorMessage = errorData.error?.message || errorData.error || errorMessage;
          } catch (e) {
            // JSON解析失败，使用默认错误信息
          }
        } else {
          // 非JSON响应，可能是HTML错误页面
          const textResponse = await response.text();
          console.error('Non-JSON API response:', textResponse.substring(0, 500));
          errorMessage = '服务器返回了非预期的响应格式';
        }
        
        throw new Error(errorMessage);
      }
      
      const data: AISmartFillResponse = await response.json();
      
      if (data.success && data.data) {
        setAiAnalysisData(data.data);
        setAiCost(data.apiUsage.cost);
        setCheckStatus('ai-complete');
        
        // 触发父组件回调
        onAIFillComplete?.(data.data);
      } else {
        setAiError(data.error?.message || 'AI分析失败');
        setCheckStatus('valid'); // 回到有效状态，但显示AI错误
      }
    } catch (error) {
      console.error('AI Analysis Error:', error);
      setAiError('AI分析服务暂时不可用，请稍后重试');
      setCheckStatus('valid');
    }
  }, [enableAIFill, onAIFillComplete]);

  // 防抖检测函数 - 添加取消标记防止竞态条件
  const debouncedCheck = useCallback(
    debounce(async (url: string) => {
      console.log('🔍 Starting URL check for:', url); // 调试日志
      
      if (!url.trim()) {
        console.log('📭 Empty URL, resetting to idle state');
        setCheckStatus('idle')
        setDuplicateInfo(null)
        setDisplayURL('')
        setErrorMessage('')
        onDuplicateChange({ exists: false, cached: false, processing_time_ms: 0, normalized_url: '', display_url: '' })
        return
      }
      
      // 前端URL格式验证
      const validation = URLProcessor.validateURL(url)
      if (!validation.isValid) {
        console.log('❌ URL validation failed:', validation.error);
        setCheckStatus('invalid')
        setErrorMessage(validation.error || '无效的URL格式')
        setDisplayURL('')
        return
      }
      
      const display = URLProcessor.getDisplayURL(url)
      setDisplayURL(display)
      setCheckStatus('checking')
      setErrorMessage('')
      
      console.log('🚀 Calling duplicate check API for:', url);
      const startTime = performance.now();
      
      try {
        // 调用重复检测API
        const result = await checkWebsiteDuplicate(url)
        const endTime = performance.now();
        console.log(`✅ Duplicate check completed in ${endTime - startTime}ms:`, result);
        
        setProcessingTime(result.processing_time_ms)
        
        if (result.exists) {
          console.log('🔄 URL exists, setting duplicate status');
          setCheckStatus('duplicate')
          setDuplicateInfo(result)
          setShowAIButton(false)
          onDuplicateChange(result)
        } else {
          console.log('✨ URL is new, setting valid status');
          setCheckStatus('valid')
          setDuplicateInfo(null)
          setShowAIButton(enableAIFill) // 非重复时显示AI按钮
          onDuplicateChange(result)
        }
        
      } catch (error) {
        const endTime = performance.now();
        console.error(`❌ Duplicate check failed in ${endTime - startTime}ms:`, error);
        
        setCheckStatus('error')
        
        if (error instanceof DuplicateCheckClientError) {
          setErrorMessage(error.userFriendlyMessage)
          console.error('URL检测失败 (DuplicateCheckClientError):', {
            message: error.message,
            code: error.code,
            statusCode: error.statusCode,
            userMessage: error.userFriendlyMessage
          })
        } else if (error instanceof Error) {
          setErrorMessage('检测失败，请稍后重试')
          console.error('URL检测失败 (Error):', {
            name: error.name,
            message: error.message,
            stack: error.stack?.split('\n').slice(0, 5) // 只显示前5行堆栈
          })
        } else {
          setErrorMessage('检测失败，请稍后重试')
          console.error('URL检测失败 (Unknown):', error)
        }
      }
    }, 800),
    [onDuplicateChange, enableAIFill] // 添加enableAIFill到依赖数组
  )
  
  // 监听输入变化
  useEffect(() => {
    debouncedCheck(value)
    return () => debouncedCheck.cancel()
  }, [value, debouncedCheck])
  
  // 获取状态图标
  const getStatusIcon = () => {
    const iconProps = { className: "w-5 h-5" }
    
    switch (checkStatus) {
      case 'checking':
        return <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
      case 'ai-analyzing':
        return <Wand2 className="w-5 h-5 animate-pulse text-purple-500" />
      case 'ai-complete':
        return <Sparkles {...iconProps} className="w-5 h-5 text-purple-500" />
      case 'valid':
        return <CheckCircle {...iconProps} className="w-5 h-5 text-green-500" />
      case 'duplicate':
        return <XCircle {...iconProps} className="w-5 h-5 text-red-500" />
      case 'invalid':
        return <AlertTriangle {...iconProps} className="w-5 h-5 text-yellow-500" />
      case 'error':
        return <AlertTriangle {...iconProps} className="w-5 h-5 text-red-500" />
      default:
        return <Globe {...iconProps} className="w-5 h-5 text-gray-400" />
    }
  }
  
  // 获取输入框样式
  const getInputStyle = () => {
    const baseStyle = `w-full rounded-lg border px-4 py-3 pr-12 transition-all duration-200 focus:ring-2 focus:ring-offset-2 ${className}`
    
    if (disabled) {
      return `${baseStyle} border-gray-200 bg-gray-50 text-gray-500 cursor-not-allowed`
    }
    
    switch (checkStatus) {
      case 'valid':
        return `${baseStyle} border-green-300 bg-green-50 text-green-900 focus:border-green-500 focus:ring-green-500`
      case 'ai-analyzing':
        return `${baseStyle} border-purple-300 bg-purple-50 text-purple-900 focus:border-purple-500 focus:ring-purple-500`
      case 'ai-complete':
        return `${baseStyle} border-purple-300 bg-purple-50 text-purple-900 focus:border-purple-500 focus:ring-purple-500`
      case 'duplicate':
        return `${baseStyle} border-red-300 bg-red-50 text-red-900 focus:border-red-500 focus:ring-red-500`
      case 'invalid':
      case 'error':
        return `${baseStyle} border-yellow-300 bg-yellow-50 text-yellow-900 focus:border-yellow-500 focus:ring-yellow-500`
      case 'checking':
        return `${baseStyle} border-blue-300 bg-blue-50 text-blue-900 focus:border-blue-500 focus:ring-blue-500`
      default:
        return `${baseStyle} border-gray-300 bg-white text-gray-900 focus:border-indigo-500 focus:ring-indigo-500`
    }
  }
  
  // 获取状态提示文本
  const getStatusText = () => {
    switch (checkStatus) {
      case 'checking':
        return '正在检测...'
      case 'ai-analyzing':
        return 'AI正在分析网站内容...'
      case 'ai-complete':
        return `AI分析完成 ${aiCost > 0 ? `(成本: $${aiCost.toFixed(3)})` : ''}`
      case 'valid':
        return `网站可添加 ${processingTime > 0 ? `(${processingTime}ms)` : ''}`
      case 'duplicate':
        return '该网站已存在'
      case 'invalid':
        return errorMessage
      case 'error':
        return errorMessage
      default:
        return ''
    }
  }
  
  // 获取状态颜色类名
  const getStatusTextColor = () => {
    switch (checkStatus) {
      case 'checking':
        return 'text-blue-600'
      case 'ai-analyzing':
        return 'text-purple-600'
      case 'ai-complete':
        return 'text-purple-600'
      case 'valid':
        return 'text-green-600'
      case 'duplicate':
        return 'text-red-600'
      case 'invalid':
      case 'error':
        return 'text-yellow-600'
      default:
        return 'text-gray-500'
    }
  }
  
  return (
    <div className="space-y-3">
      {/* 主输入框 */}
      <div className="relative">
        <input
          type="url"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          className={getInputStyle()}
          autoComplete="url"
          spellCheck={false}
        />
        
        {/* 状态图标 */}
        <div className="absolute inset-y-0 right-0 flex items-center pr-4 pointer-events-none">
          {getStatusIcon()}
        </div>
      </div>
      
      {/* 状态信息栏和AI按钮 */}
      <div className="flex items-center justify-between min-h-[24px]">
        <div className="flex items-center space-x-2">
          {/* 状态文本 */}
          {getStatusText() && (
            <div className={`flex items-center space-x-1 text-sm font-medium ${getStatusTextColor()}`}>
              <span>{getStatusText()}</span>
            </div>
          )}
          
          {/* 显示URL */}
          {displayURL && checkStatus !== 'invalid' && checkStatus !== 'error' && (
            <div className="text-xs text-gray-500">
              检测地址: {displayURL}
            </div>
          )}
          
          {/* AI错误提示 */}
          {aiError && checkStatus !== 'ai-analyzing' && (
            <div className="flex items-center space-x-1 text-xs text-red-500">
              <AlertCircle className="w-3 h-3" />
              <span>{aiError}</span>
            </div>
          )}
        </div>
        
        <div className="flex items-center space-x-2">
          {/* AI智能填入按钮 */}
          {showAIButton && checkStatus === 'valid' && (
            <button
              onClick={() => analyzeWithAI(value)}
              disabled={disabled}
              className="inline-flex items-center space-x-1 px-3 py-1.5 text-xs font-medium text-purple-700 bg-purple-100 border border-purple-200 rounded-md hover:bg-purple-200 hover:text-purple-800 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Sparkles className="w-3 h-3" />
              <span>AI智能填入</span>
            </button>
          )}
          
          {/* 性能信息 */}
          {processingTime > 0 && checkStatus !== 'checking' && checkStatus !== 'ai-analyzing' && (
            <div className="flex items-center space-x-1 text-xs text-gray-400">
              <Clock className="w-3 h-3" />
              <span>{processingTime}ms {duplicateInfo?.cached ? '(缓存)' : ''}</span>
            </div>
          )}
        </div>
      </div>
      
      {/* AI分析结果面板 */}
      {checkStatus === 'ai-complete' && aiAnalysisData && (
        <AIAnalysisResultPanel data={aiAnalysisData} cost={aiCost} />
      )}
      
      {/* 重复网站详情面板 */}
      {checkStatus === 'duplicate' && duplicateInfo?.tool && (
        <DuplicateWarningPanel tool={duplicateInfo.tool} />
      )}
      
      {/* 帮助信息 */}
      {checkStatus === 'idle' && (
        <div className="flex items-start space-x-2 p-3 bg-gray-50 rounded-lg">
          <Info className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
          <div className="text-sm text-gray-600">
            <p>输入网站地址后将自动检测是否已存在相同工具。</p>
            <p className="mt-1 text-xs text-gray-500">
              支持格式：example.com 或 https://example.com
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

// 重复网站警告面板组件
const DuplicateWarningPanel: React.FC<{ 
  tool: NonNullable<DuplicateInfo['tool']> 
}> = ({ tool }) => (
  <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
    <div className="flex items-start space-x-3">
      <div className="flex-shrink-0">
        <XCircle className="w-5 h-5 text-red-400 mt-0.5" />
      </div>
      
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h4 className="text-sm font-semibold text-red-800 mb-2">
              该网站已存在于平台
            </h4>
            
            <div className="space-y-2">
              {/* 工具信息 */}
              <div className="flex items-center space-x-2">
                {tool.logo_url && (
                  <img 
                    src={tool.logo_url} 
                    alt={tool.name}
                    className="w-5 h-5 rounded object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none'
                    }}
                  />
                )}
                <span className="font-medium text-red-900 text-sm">{tool.name}</span>
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                  tool.status === 'published' 
                    ? 'bg-green-100 text-green-800' 
                    : 'bg-yellow-100 text-yellow-800'
                }`}>
                  {tool.status === 'published' ? '已发布' : '待审核'}
                </span>
              </div>
              
              {/* 工具描述 */}
              {tool.tagline && (
                <p className="text-sm text-red-700 leading-relaxed">
                  {tool.tagline}
                </p>
              )}
              
              {/* 分类标签 */}
              {tool.categories && tool.categories.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {tool.categories.slice(0, 3).map((category, index) => (
                    <span 
                      key={index}
                      className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-red-100 text-red-700"
                    >
                      {category}
                    </span>
                  ))}
                  {tool.categories.length > 3 && (
                    <span className="text-xs text-red-600">
                      +{tool.categories.length - 3} 更多
                    </span>
                  )}
                </div>
              )}
              
              {/* 添加时间 */}
              <p className="text-xs text-red-600">
                添加时间: {new Date(tool.created_at).toLocaleDateString('zh-CN', {
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric'
                })}
              </p>
            </div>
          </div>
        </div>
        
        {/* 操作按钮 */}
        <div className="mt-3 flex flex-wrap gap-2">
          <a
            href={`/tools/${tool.id}`}
            className="inline-flex items-center space-x-1 text-sm text-red-600 hover:text-red-800 transition-colors"
          >
            <span>查看工具详情</span>
            <ExternalLink className="w-3 h-3" />
          </a>
          
          <a
            href={tool.website_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center space-x-1 text-sm text-red-600 hover:text-red-800 transition-colors"
          >
            <span>访问原网站</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>
    </div>
  </div>
)

// AI分析结果面板组件
const AIAnalysisResultPanel: React.FC<{ 
  data: AIAnalysisResult; 
  cost: number; 
}> = ({ data, cost }) => {
  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return 'text-green-600 bg-green-100';
    if (confidence >= 0.6) return 'text-yellow-600 bg-yellow-100';
    return 'text-red-600 bg-red-100';
  };

  const getPricingColor = (pricing: string) => {
    switch (pricing) {
      case 'Free': return 'bg-green-100 text-green-800';
      case 'Freemium': return 'bg-blue-100 text-blue-800';
      case 'Paid': return 'bg-red-100 text-red-800';
      case 'Trial': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="p-4 bg-purple-50 border border-purple-200 rounded-lg">
      <div className="flex items-start space-x-3">
        <div className="flex-shrink-0">
          <Sparkles className="w-5 h-5 text-purple-500 mt-0.5" />
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between mb-3">
            <h4 className="text-sm font-semibold text-purple-800">
              AI智能分析结果
            </h4>
            <div className="flex items-center space-x-2 text-xs">
              <span className={`px-2 py-1 rounded-full font-medium ${getConfidenceColor(data.confidence)}`}>
                置信度: {Math.round(data.confidence * 100)}%
              </span>
              {cost > 0 && (
                <span className="text-gray-500">
                  成本: ${cost.toFixed(3)}
                </span>
              )}
            </div>
          </div>
          
          <div className="space-y-3">
            {/* 基本信息 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                  工具名称
                </label>
                <p className="mt-1 text-sm font-medium text-gray-900">
                  {data.name}
                </p>
              </div>
              
              <div>
                <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                  定价模式
                </label>
                <span className={`mt-1 inline-flex px-2 py-1 text-xs font-medium rounded-full ${getPricingColor(data.pricing)}`}>
                  {data.pricing}
                </span>
              </div>
            </div>
            
            {/* 标语 */}
            <div>
              <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                产品标语
              </label>
              <p className="mt-1 text-sm text-gray-800 leading-relaxed">
                {data.tagline}
              </p>
            </div>
            
            {/* 描述 */}
            <div>
              <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                详细描述
              </label>
              <p className="mt-1 text-sm text-gray-700 leading-relaxed">
                {data.description}
              </p>
            </div>
            
            {/* 功能特性 */}
            {data.features && data.features.length > 0 && (
              <div>
                <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                  核心功能
                </label>
                <div className="mt-2 flex flex-wrap gap-2">
                  {data.features.map((feature, index) => (
                    <span 
                      key={index}
                      className="inline-flex items-center px-2.5 py-1 rounded-full text-xs bg-purple-100 text-purple-800"
                    >
                      {feature}
                    </span>
                  ))}
                </div>
              </div>
            )}
            
            {/* 分类标签 */}
            {data.categories && data.categories.length > 0 && (
              <div>
                <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                  工具分类
                </label>
                <div className="mt-2 flex flex-wrap gap-2">
                  {data.categories.map((category, index) => (
                    <span 
                      key={index}
                      className="inline-flex items-center px-2.5 py-1 rounded-md text-xs bg-indigo-100 text-indigo-800"
                    >
                      {category}
                    </span>
                  ))}
                </div>
              </div>
            )}
            
            {/* AI推理过程 */}
            {data.reasoning && (
              <div className="pt-3 border-t border-purple-200">
                <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                  AI分析推理
                </label>
                <p className="mt-1 text-xs text-gray-600 italic">
                  {data.reasoning}
                </p>
              </div>
            )}
            
            {/* 操作提示 */}
            <div className="pt-2 border-t border-purple-200">
              <div className="flex items-center space-x-1 text-xs text-purple-600">
                <Info className="w-3 h-3" />
                <span>AI已为您智能填入信息，请在表单中确认并完善细节</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SmartURLInput