import { useState, useCallback, useRef, useEffect } from 'react';
import type { AsyncState, AsyncResult } from '../lib/type-utils';
import type { AppError } from '../lib/api';

/**
 * 高度类型安全的异步操作Hook
 * 提供完整的类型推断和错误处理
 */

// Hook配置选项
export interface AsyncOperationConfig {
  /** 组件卸载时是否取消操作 */
  cancelOnUnmount?: boolean;
  /** 自动重试次数 */
  retryCount?: number;
  /** 重试延迟（毫秒） */
  retryDelay?: number;
  /** 错误时是否自动重试 */
  autoRetry?: boolean;
  /** 初始数据 */
  initialData?: unknown;
}

// Hook返回类型
export interface AsyncOperationReturn<TData, TError = AppError> {
  // 状态
  readonly state: AsyncState<TData, TError>;
  readonly data: TData | null;
  readonly loading: boolean;
  readonly error: TError | null;
  readonly lastFetch: Date | null;
  
  // 操作方法
  execute: (...args: any[]) => Promise<AsyncResult<TData, TError>>;
  retry: () => Promise<AsyncResult<TData, TError>>;
  reset: () => void;
  cancel: () => void;
  
  // 状态检查
  readonly isIdle: boolean;
  readonly isLoading: boolean;
  readonly isSuccess: boolean;
  readonly isError: boolean;
}

// 内部状态类型
type OperationState<TData, TError> = AsyncState<TData, TError> & {
  isExecuting: boolean;
  abortController: AbortController | null;
  lastArgs: any[] | null;
}

/**
 * 类型安全的异步操作Hook
 */
export function useTypedAsyncOperation<
  TData,
  TError = AppError,
  TArgs extends readonly unknown[] = readonly unknown[]
>(
  asyncFn: (...args: TArgs) => Promise<TData>,
  config: AsyncOperationConfig = {}
): AsyncOperationReturn<TData, TError> {
  
  const {
    cancelOnUnmount = true,
    retryCount = 0,
    retryDelay = 1000,
    autoRetry = false,
    initialData = null
  } = config;

  // 内部状态
  const [state, setState] = useState<OperationState<TData, TError>>({
    data: initialData as TData | null,
    loading: false,
    error: null,
    lastFetch: null,
    isExecuting: false,
    abortController: null,
    lastArgs: null
  });

  // 引用管理
  const isMountedRef = useRef(true);
  const retryCountRef = useRef(0);
  const asyncFnRef = useRef(asyncFn);

  // 更新函数引用
  useEffect(() => {
    asyncFnRef.current = asyncFn;
  }, [asyncFn]);

  // 组件卸载清理
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      if (cancelOnUnmount && state.abortController) {
        state.abortController.abort();
      }
    };
  }, [cancelOnUnmount, state.abortController]);

  // 安全的状态更新
  const safeSetState = useCallback((
    updater: Partial<OperationState<TData, TError>> | 
             ((prev: OperationState<TData, TError>) => Partial<OperationState<TData, TError>>)
  ) => {
    if (isMountedRef.current) {
      setState(prev => ({
        ...prev,
        ...(typeof updater === 'function' ? updater(prev) : updater)
      }));
    }
  }, []);

  // 取消操作
  const cancel = useCallback(() => {
    if (state.abortController) {
      state.abortController.abort();
    }
    safeSetState({
      loading: false,
      isExecuting: false,
      abortController: null
    });
  }, [state.abortController, safeSetState]);

  // 重置状态
  const reset = useCallback(() => {
    cancel();
    retryCountRef.current = 0;
    safeSetState({
      data: initialData as TData | null,
      loading: false,
      error: null,
      lastFetch: null,
      isExecuting: false,
      lastArgs: null
    });
  }, [cancel, initialData, safeSetState]);

  // 执行异步操作
  const execute = useCallback(async (...args: TArgs): Promise<AsyncResult<TData, TError>> => {
    // 取消之前的请求
    if (state.abortController) {
      state.abortController.abort();
    }

    const abortController = new AbortController();
    
    safeSetState({
      loading: true,
      error: null,
      isExecuting: true,
      abortController,
      lastArgs: args as any[]
    });

    try {
      const result = await asyncFnRef.current(...args);
      
      if (!isMountedRef.current || abortController.signal.aborted) {
        return { success: false, data: null, error: { message: 'Operation cancelled' } as TError };
      }

      safeSetState({
        data: result,
        loading: false,
        error: null,
        lastFetch: new Date(),
        isExecuting: false,
        abortController: null
      });

      retryCountRef.current = 0;
      return { success: true, data: result, error: null };

    } catch (error) {
      if (!isMountedRef.current || abortController.signal.aborted) {
        return { success: false, data: null, error: { message: 'Operation cancelled' } as TError };
      }

      const typedError = error as TError;
      
      safeSetState({
        loading: false,
        error: typedError,
        lastFetch: new Date(),
        isExecuting: false,
        abortController: null
      });

      // 自动重试逻辑
      if (autoRetry && retryCountRef.current < retryCount) {
        retryCountRef.current++;
        
        setTimeout(() => {
          if (isMountedRef.current && state.lastArgs) {
            execute(...(state.lastArgs as TArgs));
          }
        }, retryDelay * retryCountRef.current);
      }

      return { success: false, data: null, error: typedError };
    }
  }, [state.abortController, state.lastArgs, safeSetState, autoRetry, retryCount, retryDelay]);

  // 手动重试
  const retry = useCallback(async (): Promise<AsyncResult<TData, TError>> => {
    if (state.lastArgs) {
      retryCountRef.current = 0;
      return execute(...(state.lastArgs as TArgs));
    }
    return { success: false, data: null, error: { message: 'No previous operation to retry' } as TError };
  }, [state.lastArgs, execute]);

  return {
    // 状态
    state: {
      data: state.data,
      loading: state.loading,
      error: state.error,
      lastFetch: state.lastFetch
    },
    data: state.data,
    loading: state.loading,
    error: state.error,
    lastFetch: state.lastFetch,
    
    // 方法
    execute,
    retry,
    reset,
    cancel,
    
    // 状态检查
    isIdle: !state.loading && !state.error && !state.data,
    isLoading: state.loading,
    isSuccess: !state.loading && !state.error && state.data !== null,
    isError: !state.loading && state.error !== null
  };
}

// 数据获取专用Hook
export function useTypedQuery<TData, TError = AppError>(
  queryFn: () => Promise<TData>,
  config: AsyncOperationConfig & {
    /** 是否在组件挂载时立即执行 */
    enabled?: boolean;
    /** 缓存时间（毫秒） */
    staleTime?: number;
    /** 重新获取间隔（毫秒） */
    refetchInterval?: number;
  } = {}
) {
  const { enabled = true, staleTime = 0, refetchInterval } = config;
  const asyncOp = useTypedAsyncOperation(queryFn, config);
  
  // 自动执行查询
  useEffect(() => {
    if (enabled) {
      // 检查数据是否过期
      const isStale = !asyncOp.lastFetch || 
                     (Date.now() - asyncOp.lastFetch.getTime()) > staleTime;
      
      if (isStale && !asyncOp.loading) {
        asyncOp.execute();
      }
    }
  }, [enabled, staleTime, asyncOp]);

  // 定时刷新
  useEffect(() => {
    if (refetchInterval && refetchInterval > 0) {
      const interval = setInterval(() => {
        if (enabled && !asyncOp.loading) {
          asyncOp.execute();
        }
      }, refetchInterval);

      return () => clearInterval(interval);
    }
  }, [refetchInterval, enabled, asyncOp]);

  return {
    ...asyncOp,
    refetch: asyncOp.execute
  };
}

// Mutation专用Hook
export function useTypedMutation<
  TData,
  TError = AppError,
  TVariables extends readonly unknown[] = readonly unknown[]
>(
  mutationFn: (...args: TVariables) => Promise<TData>,
  config: AsyncOperationConfig & {
    /** 成功回调 */
    onSuccess?: (data: TData) => void;
    /** 错误回调 */
    onError?: (error: TError) => void;
    /** 完成回调 */
    onSettled?: (data: TData | null, error: TError | null) => void;
  } = {}
) {
  const { onSuccess, onError, onSettled, ...restConfig } = config;
  const asyncOp = useTypedAsyncOperation(mutationFn, restConfig);

  const mutate = useCallback(async (...args: TVariables) => {
    const result = await asyncOp.execute(...args);
    
    if (result.success) {
      onSuccess?.(result.data);
    } else {
      onError?.(result.error);
    }
    
    onSettled?.(result.data, result.error);
    
    return result;
  }, [asyncOp.execute, onSuccess, onError, onSettled]);

  return {
    ...asyncOp,
    mutate,
    mutateAsync: mutate
  };
}