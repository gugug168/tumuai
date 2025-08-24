// 错误类型定义
export interface AppError {
  code: string;
  message: string;
  details?: unknown;
  timestamp: string;
}

// 常见错误代码
export const ERROR_CODES = {
  NETWORK_ERROR: 'NETWORK_ERROR',
  TIMEOUT_ERROR: 'TIMEOUT_ERROR',
  SERVER_ERROR: 'SERVER_ERROR',
  AUTH_ERROR: 'AUTH_ERROR',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  NOT_FOUND: 'NOT_FOUND',
  FORBIDDEN: 'FORBIDDEN',
  UNKNOWN_ERROR: 'UNKNOWN_ERROR'
} as const;

// 创建标准化错误
export function createAppError(code: string, message: string, details?: unknown): AppError {
  return {
    code,
    message,
    details,
    timestamp: new Date().toISOString()
  };
}

// 解析错误信息
export function parseError(error: unknown): AppError {
  // 网络相关错误
  if (error.code === 'ETIMEDOUT' || error.name === 'AbortError') {
    return createAppError(ERROR_CODES.TIMEOUT_ERROR, '请求超时，请检查网络连接', error);
  }

  // HTTP 状态码错误
  if (error.status) {
    switch (error.status) {
      case 401:
        return createAppError(ERROR_CODES.AUTH_ERROR, '身份验证失败，请重新登录', error);
      case 403:
        return createAppError(ERROR_CODES.FORBIDDEN, '权限不足，无法执行此操作', error);
      case 404:
        return createAppError(ERROR_CODES.NOT_FOUND, '请求的资源不存在', error);
      case 422:
        return createAppError(ERROR_CODES.VALIDATION_ERROR, '数据验证失败，请检查输入', error);
      case 500:
      case 503:
        return createAppError(ERROR_CODES.SERVER_ERROR, '服务器暂时不可用，请稍后重试', error);
      default:
        return createAppError(ERROR_CODES.UNKNOWN_ERROR, `请求失败 (${error.status})`, error);
    }
  }

  // Supabase 错误
  if (error.message && error.code) {
    // 数据库连接错误
    if (error.message.includes('Failed to fetch') || error.message.includes('fetch')) {
      return createAppError(ERROR_CODES.NETWORK_ERROR, '网络连接失败，请检查网络设置', error);
    }
    
    // 权限错误
    if (error.message.includes('permission') || error.message.includes('policy')) {
      return createAppError(ERROR_CODES.FORBIDDEN, '数据访问权限不足', error);
    }

    return createAppError(ERROR_CODES.UNKNOWN_ERROR, error.message, error);
  }

  // 通用错误
  if (error.message) {
    return createAppError(ERROR_CODES.UNKNOWN_ERROR, error.message, error);
  }

  return createAppError(ERROR_CODES.UNKNOWN_ERROR, '发生未知错误，请重试', error);
}

// 导入类型工具
import type { AsyncResult } from './type-utils'

// 统一的 API 请求包装器 - 增强泛型支持
export const apiRequest = async <TData>(
  promise: Promise<TData>
): Promise<TData> => {
  try {
    const response = await promise;
    return response;
  } catch (error) {
    const appError = parseError(error);
    console.error('API请求失败:', appError);
    throw new Error(appError.message);
  }
};

// 安全的API请求包装器，返回Result类型
export const safeApiRequest = async <TData, TError = AppError>(
  promise: Promise<TData>
): Promise<AsyncResult<TData, TError>> => {
  try {
    const data = await promise;
    return { success: true, data, error: null };
  } catch (error) {
    const appError = parseError(error) as TError;
    console.error('API请求失败:', appError);
    return { success: false, data: null, error: appError };
  }
};

// 带重试的 API 请求
export const apiRequestWithRetry = async <T>(
  promiseFactory: () => Promise<T>,
  maxRetries: number = 3,
  delay: number = 1000
): Promise<T> => {
  let lastError: AppError;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await promiseFactory();
    } catch (error) {
      lastError = parseError(error);
      
      // 不重试的错误类型
      if ([ERROR_CODES.AUTH_ERROR, ERROR_CODES.FORBIDDEN, ERROR_CODES.VALIDATION_ERROR].includes(lastError.code)) {
        throw new Error(lastError.message);
      }
      
      if (attempt === maxRetries) {
        break;
      }
      
      console.warn(`API请求失败 (尝试 ${attempt}/${maxRetries}):`, lastError.message);
      await new Promise(resolve => setTimeout(resolve, delay * attempt));
    }
  }
  
  throw new Error(lastError!.message);
};