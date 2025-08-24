import React from 'react'

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg'
  message?: string
  className?: string
}

const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ 
  size = 'md', 
  message = '加载中...', 
  className = '' 
}) => {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-8 h-8', 
    lg: 'w-12 h-12'
  }
  
  return (
    <div className={`flex flex-col items-center justify-center min-h-[200px] ${className}`}>
      <div 
        className={`${sizeClasses[size]} border-2 border-gray-300 border-t-blue-600 rounded-full animate-spin`}
        role="status"
        aria-label="加载中"
      />
      {message && (
        <p className="mt-4 text-sm text-gray-600 animate-pulse">
          {message}
        </p>
      )}
    </div>
  )
}

export default LoadingSpinner