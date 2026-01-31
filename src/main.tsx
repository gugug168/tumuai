import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { checkVersionAndRefresh, shouldCleanupCache, cleanupOldCache } from './lib/cache-cleanup';

// Canonical domain guard:
// A lot of users may still open the legacy Netlify URL. That host doesn't have our Vercel `/api/*`
// functions, which results in 503 and a broken Tools page. Redirect to the canonical domain early.
if (typeof window !== 'undefined') {
  const CANONICAL_HOST = 'www.tumuai.net';
  const host = window.location.hostname;
  const isLegacyNetlifyHost = host.endsWith('netlify.app');

  if (isLegacyNetlifyHost && host !== CANONICAL_HOST) {
    const target = `https://${CANONICAL_HOST}${window.location.pathname}${window.location.search}${window.location.hash}`;
    window.location.replace(target);
  }
}

// 应用启动前的缓存清理和版本检查
try {
  // 检查版本并处理升级
  const needsRefresh = checkVersionAndRefresh();

  // 如果不需要刷新，检查是否需要清理缓存
  if (!needsRefresh && shouldCleanupCache()) {
    cleanupOldCache();
  }
} catch (error) {
  console.warn('缓存清理过程出现问题:', error);
}

// 注册 Service Worker - 非 Hook 方式
if ('serviceWorker' in navigator && typeof window !== 'undefined') {
  let refreshing = false;

  // When a new service worker takes control, reload once to ensure the new hashed assets are used.
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (refreshing) return;
    refreshing = true;
    window.location.reload();
  });

  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' }).then((registration) => {
      // If a SW is already waiting (e.g. user kept the tab open), activate it now.
      if (registration.waiting) {
        registration.waiting.postMessage({ type: 'SKIP_WAITING' });
      }

      // When a new SW is found, activate it as soon as it's installed.
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        if (!newWorker) return;

        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            newWorker.postMessage({ type: 'SKIP_WAITING' });
          }
        });
      });

      // Best-effort: ask for an update on page load.
      registration.update().catch(() => {});
    }).catch((error) => {
      console.error('[SW] Registration failed:', error);
    });
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
