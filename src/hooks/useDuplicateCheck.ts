/**
 * useDuplicateCheck Hook - 重复检测功能
 *
 * 从 SmartURLInput 组件中提取的重复检测逻辑
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import {
  checkWebsiteDuplicate,
  DuplicateCheckClientError,
  type DuplicateCheckResult
} from '../lib/duplicate-checker';
import { URLProcessor } from '../utils/url-processor';

/**
 * 防抖函数实现
 */
const debounce = <T extends (...args: any[]) => any>(
  func: T,
  wait: number
): ((...args: Parameters<T>) => void) & { cancel: () => void } => {
  let timeout: NodeJS.Timeout | undefined;

  const debouncedFn = (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };

  debouncedFn.cancel = () => {
    clearTimeout(timeout);
    timeout = undefined;
  };

  return debouncedFn;
};

// 检测状态
export type CheckStatus = 'idle' | 'checking' | 'valid' | 'duplicate' | 'invalid' | 'error';

// 重复信息扩展
export interface DuplicateInfo extends DuplicateCheckResult {}

export interface UseDuplicateCheckOptions {
  debounceMs?: number;
  onStatusChange?: (status: CheckStatus) => void;
  onDuplicateFound?: (info: DuplicateInfo) => void;
  onValid?: (info: DuplicateCheckResult) => void;
}

export interface UseDuplicateCheckResult {
  status: CheckStatus;
  duplicateInfo: DuplicateInfo | null;
  displayURL: string;
  errorMessage: string;
  processingTime: number;
  check: (url: string) => void;
  reset: () => void;
}

/**
 * 重复检测 Hook
 */
export function useDuplicateCheck(options: UseDuplicateCheckOptions = {}): UseDuplicateCheckResult {
  const {
    debounceMs = 800,
    onStatusChange,
    onDuplicateFound,
    onValid
  } = options;

  const [status, setStatus] = useState<CheckStatus>('idle');
  const [duplicateInfo, setDuplicateInfo] = useState<DuplicateInfo | null>(null);
  const [displayURL, setDisplayURL] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [processingTime, setProcessingTime] = useState(0);

  // 防抖检测函数引用
  const debouncedCheckRef = useRef<((url: string) => void) & { cancel: () => void }>();

  /**
   * 执行检测
   */
  const performCheck = useCallback(async (url: string) => {
    if (!url.trim()) {
      setStatus('idle');
      setDuplicateInfo(null);
      setDisplayURL('');
      setErrorMessage('');
      onStatusChange?.('idle');
      return;
    }

    // 前端URL格式验证
    const validation = URLProcessor.validateURL(url);
    if (!validation.isValid) {
      setStatus('invalid');
      setErrorMessage(validation.error || '无效的URL格式');
      setDisplayURL('');
      onStatusChange?.('invalid');
      return;
    }

    const display = URLProcessor.getDisplayURL(url);
    setDisplayURL(display);
    setStatus('checking');
    setErrorMessage('');
    onStatusChange?.('checking');

    const startTime = performance.now();

    try {
      // 调用重复检测API
      const result = await checkWebsiteDuplicate(url);
      const endTime = performance.now();

      setProcessingTime(result.processing_time_ms);

      if (result.exists) {
        setStatus('duplicate');
        setDuplicateInfo(result);
        onStatusChange?.('duplicate');
        onDuplicateFound?.(result);
      } else {
        setStatus('valid');
        setDuplicateInfo(null);
        onStatusChange?.('valid');
        onValid?.(result);
      }
    } catch (error) {
      const endTime = performance.now();

      setStatus('error');

      if (error instanceof DuplicateCheckClientError) {
        setErrorMessage(error.userFriendlyMessage);
      } else if (error instanceof Error) {
        setErrorMessage('检测失败，请稍后重试');
      } else {
        setErrorMessage('检测失败，请稍后重试');
      }
      onStatusChange?.('error');
    }
  }, [onStatusChange, onDuplicateFound, onValid]);

  /**
   * 初始化防抖函数
   */
  useEffect(() => {
    debouncedCheckRef.current = debounce(performCheck, debounceMs);

    return () => {
      if (debouncedCheckRef.current) {
        debouncedCheckRef.current.cancel();
      }
    };
  }, [performCheck, debounceMs]);

  /**
   * 触发检测（带防抖）
   */
  const check = useCallback((url: string) => {
    if (debouncedCheckRef.current) {
      debouncedCheckRef.current(url);
    }
  }, []);

  /**
   * 重置状态
   */
  const reset = useCallback(() => {
    setStatus('idle');
    setDuplicateInfo(null);
    setDisplayURL('');
    setErrorMessage('');
    setProcessingTime(0);
    if (debouncedCheckRef.current) {
      debouncedCheckRef.current.cancel();
    }
  }, []);

  return {
    status,
    duplicateInfo,
    displayURL,
    errorMessage,
    processingTime,
    check,
    reset
  };
}
