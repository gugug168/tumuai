import React from 'react'
import { Loader2, RefreshCw } from 'lucide-react'

interface PageLoaderProps {
  message?: string
  showRetry?: boolean
  onRetry?: () => void
  fullScreen?: boolean
  className?: string
}

const PageLoader: React.FC<PageLoaderProps> = ({
  message = '页面加载中...',
  showRetry = false,
  onRetry,
  fullScreen = true,
  className = ''
}) => {
  const containerClass = fullScreen 
    ? 'fixed inset-0 bg-white bg-opacity-95 flex items-center justify-center z-50' 
    : 'flex items-center justify-center py-12'

  return (
    <div className={`${containerClass} ${className}`}>
      <div className="text-center">
        <div className="relative mb-4">
          <Loader2 className="w-12 h-12 mx-auto text-indigo-600 animate-spin" />
        </div>
        
        <p className="text-gray-600 text-lg font-medium mb-2">
          {message}
        </p>
        
        <div className="text-sm text-gray-400">
          请稍候，正在为您准备内容...
        </div>
        
        {showRetry && onRetry && (
          <button
            onClick={onRetry}
            className="mt-6 inline-flex items-center px-4 py-2 bg-indigo-100 text-indigo-700 rounded-lg hover:bg-indigo-200 transition-colors"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            重新加载
          </button>
        )}
        
        {/* 进度动画点 */}
        <div className="flex justify-center mt-4 space-x-1">
          <div className="w-2 h-2 bg-indigo-600 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
          <div className="w-2 h-2 bg-indigo-600 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
          <div className="w-2 h-2 bg-indigo-600 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
        </div>
      </div>
    </div>
  )
}

export default PageLoader