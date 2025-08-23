import { useState, useCallback } from 'react';
import { parseError, type AppError, ERROR_CODES } from '../lib/api';

export interface ErrorState {
  hasError: boolean;
  error: AppError | null;
  isLoading: boolean;
}

export function useErrorHandler() {
  const [errorState, setErrorState] = useState<ErrorState>({
    hasError: false,
    error: null,
    isLoading: false
  });

  const clearError = useCallback(() => {
    setErrorState(prev => ({
      ...prev,
      hasError: false,
      error: null
    }));
  }, []);

  const setLoading = useCallback((loading: boolean) => {
    setErrorState(prev => ({
      ...prev,
      isLoading: loading
    }));
  }, []);

  const handleError = useCallback((error: unknown) => {
    const appError = parseError(error);
    setErrorState({
      hasError: true,
      error: appError,
      isLoading: false
    });
    return appError;
  }, []);

  const executeAsync = useCallback(async <T>(
    asyncOperation: () => Promise<T>,
    onSuccess?: (result: T) => void,
    onError?: (error: AppError) => void
  ): Promise<T | null> => {
    try {
      setLoading(true);
      clearError();
      
      const result = await asyncOperation();
      
      if (onSuccess) {
        onSuccess(result);
      }
      
      setLoading(false);
      return result;
    } catch (error) {
      const appError = handleError(error);
      
      if (onError) {
        onError(appError);
      }
      
      return null;
    }
  }, [clearError, handleError, setLoading]);

  const retry = useCallback(async <T>(
    asyncOperation: () => Promise<T>,
    maxRetries: number = 3,
    delay: number = 1000
  ): Promise<T | null> => {
    let lastError: AppError;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        setLoading(true);
        const result = await asyncOperation();
        setLoading(false);
        clearError();
        return result;
      } catch (error) {
        lastError = parseError(error);
        
        // 不重试的错误类型
        if ([ERROR_CODES.AUTH_ERROR, ERROR_CODES.FORBIDDEN, ERROR_CODES.VALIDATION_ERROR].includes(lastError.code)) {
          handleError(error);
          return null;
        }
        
        if (attempt === maxRetries) {
          break;
        }
        
        console.warn(`操作失败，正在重试 (${attempt}/${maxRetries}):`, lastError.message);
        await new Promise(resolve => setTimeout(resolve, delay * attempt));
      }
    }
    
    handleError(lastError!);
    return null;
  }, [clearError, handleError, setLoading]);

  return {
    ...errorState,
    clearError,
    setLoading,
    handleError,
    executeAsync,
    retry,
    
    // 便捷的错误类型检查
    isNetworkError: errorState.error?.code === ERROR_CODES.NETWORK_ERROR,
    isAuthError: errorState.error?.code === ERROR_CODES.AUTH_ERROR,
    isServerError: errorState.error?.code === ERROR_CODES.SERVER_ERROR,
    isTimeoutError: errorState.error?.code === ERROR_CODES.TIMEOUT_ERROR,
    
    // 用户友好的错误消息
    errorMessage: errorState.error?.message || null,
    
    // 是否可以重试
    canRetry: errorState.error ? ![ERROR_CODES.AUTH_ERROR, ERROR_CODES.FORBIDDEN, ERROR_CODES.VALIDATION_ERROR].includes(errorState.error.code) : false
  };
}
