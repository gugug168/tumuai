/**
 * 超时保护工具
 * 用于 Vercel Serverless Functions，确保在10秒限制前返回
 */

interface TimeoutOptions {
  timeoutMs: number;
  errorMessage?: string;
}

/**
 * 包装异步函数，添加超时保护
 * @param fn 要执行的异步函数
 * @param options 超时配置
 * @returns 包装后的函数
 */
export function withTimeout<T>(
  fn: () => Promise<T>,
  options: TimeoutOptions = { timeoutMs: 8000 }
): Promise<T> {
  const { timeoutMs, errorMessage = 'Request timeout' } = options;

  return Promise.race([
    fn(),
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(errorMessage)), timeoutMs)
    ),
  ]);
}

/**
 * 创建可取消的 Promise
 */
export function createCancellablePromise<T>(promise: Promise<T>) {
  let cancelled = false;

  const wrappedPromise = new Promise<T>((resolve, reject) => {
    promise
      .then((value) => {
        if (!cancelled) resolve(value);
      })
      .catch((error) => {
        if (!cancelled) reject(error);
      });
  });

  return {
    promise: wrappedPromise,
    cancel: () => {
      cancelled = true;
    },
    isCancelled: () => cancelled,
  };
}

/**
 * 批量处理带超时限制
 * @param items 要处理的项目
 * @param processor 处理函数
 * @param options 配置选项
 */
export async function processBatchWithTimeout<T, R>(
  items: T[],
  processor: (item: T) => Promise<R>,
  options: {
    maxConcurrent?: number;
    itemTimeoutMs?: number;
    totalTimeoutMs?: number;
    onProgress?: (completed: number, total: number) => void;
  } = {}
): Promise<R[]> {
  const {
    maxConcurrent = 3,
    itemTimeoutMs = 5000,
    totalTimeoutMs = 9000,
    onProgress,
  } = options;

  const results: R[] = [];
  let completed = 0;

  // 创建批次
  const batches: T[][] = [];
  for (let i = 0; i < items.length; i += maxConcurrent) {
    batches.push(items.slice(i, i + maxConcurrent));
  }

  // 总超时保护
  const totalTimeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error('Total batch timeout')), totalTimeoutMs);
  });

  try {
    for (const batch of batches) {
      const batchResults = await Promise.race([
        Promise.all(
          batch.map((item) =>
            withTimeout(processor(item), { timeoutMs: itemTimeoutMs })
          )
        ),
        totalTimeoutPromise,
      ]);

      results.push(...(batchResults as R[]));
      completed += batch.length;
      onProgress?.(completed, items.length);
    }
  } catch (error) {
    // 如果是总超时，返回已完成的结果
    if (error instanceof Error && error.message === 'Total batch timeout') {
      console.warn(`Batch processing timed out after ${totalTimeoutMs}ms, returning ${results.length} results`);
      return results;
    }
    throw error;
  }

  return results;
}

/**
 * 安全的 fetch 包装器，带超时和大小限制
 */
export async function safeFetch(
  url: string,
  options: RequestInit & { timeoutMs?: number; maxBytes?: number } = {}
): Promise<{ bytes: ArrayBuffer; contentType: string }> {
  const { timeoutMs = 8000, maxBytes } = options;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const contentType = response.headers.get('content-type') || 'image/jpeg';

    // 检查内容长度
    const contentLength = response.headers.get('content-length');
    if (contentLength && maxBytes && parseInt(contentLength) > maxBytes) {
      throw new Error(`Response too large: ${contentLength} bytes`);
    }

    const buffer = await response.arrayBuffer();

    // 验证实际大小
    if (maxBytes && buffer.byteLength > maxBytes) {
      throw new Error(`Response too large: ${buffer.byteLength} bytes`);
    }

    return { bytes: buffer, contentType };
  } finally {
    clearTimeout(timeoutId);
  }
}
