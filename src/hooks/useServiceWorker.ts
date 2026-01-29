import { useEffect, useState, useCallback, useRef } from 'react';

interface ServiceWorkerState {
  isSupported: boolean;
  isRegistered: boolean;
  isWaiting: boolean;
  isOffline: boolean;
  updateAvailable: boolean;
}

/**
 * useServiceWorker Hook - 管理 Service Worker 注册和更新
 *
 * 功能:
 * - 自动注册 Service Worker
 * - 检测更新可用
 * - 处理更新激活
 * - 离线状态监听
 * - 手动缓存管理
 */
export function useServiceWorker() {
  const [state, setState] = useState<ServiceWorkerState>({
    isSupported: 'serviceWorker' in navigator,
    isRegistered: false,
    isWaiting: false,
    isOffline: !navigator.onLine,
    updateAvailable: false
  });

  const swRef = useRef<ServiceWorkerRegistration | null>(null);
  const messageChannelRef = useRef<MessageChannel | null>(null);

  /**
   * 注册 Service Worker
   */
  const register = useCallback(async () => {
    if (!('serviceWorker' in navigator)) {
      console.warn('[SW] Service Worker not supported');
      return;
    }

    try {
      const registration = await navigator.serviceWorker.register('/sw.js', {
        updateViaCache: 'all' // 强制通过 Service Worker 更新缓存
      });

      swRef.current = registration;
      setState((prev) => ({ ...prev, isRegistered: true }));

      console.log('[SW] Service Worker registered:', registration.scope);

      // 检查是否有等待更新的 SW
      if (registration.waiting) {
        setState((prev) => ({ ...prev, isWaiting: true, updateAvailable: true }));
      }

      // 监听更新
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;

        if (newWorker) {
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              setState((prev) => ({
                ...prev,
                isWaiting: true,
                updateAvailable: true
              }));
            }
          });
        }
      });

      // 监听控制器变化（新 SW 已激活）
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        console.log('[SW] New service worker activated');
        window.location.reload();
      });

    } catch (error) {
      console.error('[SW] Service Worker registration failed:', error);
    }
  }, []);

  /**
   * 激活等待中的 Service Worker
   */
  const activateUpdate = useCallback(() => {
    if (swRef.current?.waiting) {
      // 发送消息让等待中的 SW 跳过等待
      swRef.current.waiting.postMessage({ type: 'SKIP_WAITING' });
      setState((prev) => ({ ...prev, isWaiting: false }));
    }
  }, []);

  /**
   * 清除所有缓存
   */
  const clearCache = useCallback(async (): Promise<boolean> => {
    if (!swRef.current) return false;

    return new Promise((resolve) => {
      const channel = new MessageChannel();
      messageChannelRef.current = channel;

      channel.port1.onmessage = (event) => {
        if (event.data.type === 'CACHE_CLEARED') {
          resolve(true);
        }
      };

      swRef.current.active?.postMessage(
        { type: 'CLEAR_CACHE' },
        [channel.port2]
      );
    });
  }, []);

  /**
   * 预缓存资源
   */
  const precacheAssets = useCallback(async (urls: string[]): Promise<number> => {
    if (!swRef.current) return 0;

    return new Promise((resolve) => {
      const channel = new MessageChannel();

      channel.port1.onmessage = (event) => {
        if (event.data.type === 'PRECACHE_COMPLETE') {
          resolve(event.data.count);
        }
      };

      swRef.current.active?.postMessage(
        { type: 'PRECACHE_ASSETS', payload: { urls } },
        [channel.port2]
      );
    });
  }, []);

  /**
   * 检查离线状态变化
   */
  useEffect(() => {
    const handleOnline = () => {
      setState((prev) => ({ ...prev, isOffline: false }));
      console.log('[SW] Connection restored');
    };

    const handleOffline = () => {
      setState((prev) => ({ ...prev, isOffline: true }));
      console.log('[SW] Connection lost');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  /**
   * 组件挂载时注册 Service Worker
   */
  useEffect(() => {
    register();

    return () => {
      messageChannelRef.current?.port1.close();
    };
  }, [register]);

  return {
    ...state,
    register,
    activateUpdate,
    clearCache,
    precacheAssets
  };
}

/**
 * 简化版 Hook - 仅注册 Service Worker
 */
export function useServiceWorkerRegister() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch((error) => {
        console.error('[SW] Registration failed:', error);
      });
    }
  }, []);
}

/**
 * 获取 Service Worker 更新状态的简化 Hook
 */
export function useSWUpdate() {
  const [updateAvailable, setUpdateAvailable] = useState(false);

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then((registration) => {
        if (registration?.waiting) {
          setUpdateAvailable(true);
        }

        registration.addEventListener('updatefound', () => {
          if (registration?.installing) {
            setUpdateAvailable(true);
          }
        });
      });
    }
  }, []);

  const activateUpdate = () => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistration()?.then((registration) => {
        registration?.waiting?.postMessage({ type: 'SKIP_WAITING' });
      });
    }
  };

  return { updateAvailable, activateUpdate };
}

export default useServiceWorker;
