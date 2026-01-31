/**
 * ============================================
 * Service Worker - PWA 离线支持
 * ============================================
 *
 * 功能:
 * - 静态资源缓存 (Cache First)
 * - API 请求缓存 (Network First)
 * - 离线页面支持
 * - 自动更新管理
 */

// Bump this when changing caching logic to ensure clients get fresh assets.
const SW_VERSION = 'v2';
const STATIC_CACHE = `tumuai-static-${SW_VERSION}`;
const API_CACHE = `tumuai-api-${SW_VERSION}`;

// App shell used as a fallback for SPA routes (e.g. /tools) if the server responds 404.
const APP_SHELL_URL = '/';

// 需要缓存的静态资源
const STATIC_ASSETS = [
  // App shell (cached during install; fetch handler still uses Network First for navigation).
  APP_SHELL_URL,
  '/favicon.svg',
  '/manifest.json',
  '/icon.svg',
  '/logo.png',
  '/og-image.png',
  '/twitter-image.png'
];

// API 路由前缀
const API_PREFIXES = ['/api/', '/functions/'];

/**
 * 安装事件 - 缓存静态资源
 */
self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker...');

  event.waitUntil(
    (async () => {
      const cache = await caches.open(STATIC_CACHE);
      console.log('[SW] Caching static assets...');
      await cache.addAll(STATIC_ASSETS);
      console.log('[SW] Static assets cached');
    })()
  );

  // 立即激活新的 Service Worker
  self.skipWaiting();
});

/**
 * 激活事件 - 清理旧缓存
 */
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker...');

  event.waitUntil(
    (async () => {
      // 清理旧版本缓存
      const cacheNames = await caches.keys();
      const cachesToDelete = cacheNames.filter(
        (name) => name !== STATIC_CACHE && name !== API_CACHE
      );

      await Promise.all(
        cachesToDelete.map((name) => {
          console.log('[SW] Deleting old cache:', name);
          return caches.delete(name);
        })
      );

      // 立即控制所有客户端
      await self.clients.claim();
      console.log('[SW] Service worker activated');
    })()
  );
});

/**
 * 拦截网络请求
 */
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // 跳过非 HTTP 请求
  if (!url.protocol.startsWith('http')) {
    return;
  }

  // Only handle GET requests. Let the browser handle non-GET (POST/PUT/etc) normally.
  if (request.method !== 'GET') {
    return;
  }

  // 跳过 Supabase 实时订阅
  if (url.hostname.includes('supabase') && url.pathname.includes('/realtime')) {
    return;
  }

  // API 请求 - Network First 策略
  if (API_PREFIXES.some((prefix) => url.pathname.startsWith(prefix))) {
    event.respondWith(handleApiRequest(request));
    return;
  }

  // SPA 文档导航请求 - Network First + 404 fallback to app shell
  // This prevents hard-refresh on routes like /tools from showing Vercel 404.
  if (request.mode === 'navigate' || request.destination === 'document') {
    event.respondWith(handleDocumentRequest(request));
    return;
  }

  // 静态资源 - Cache First 策略
  if (STATIC_ASSETS.some((asset) => url.pathname === new URL(asset, self.location.origin).pathname)) {
    event.respondWith(handleStaticRequest(request));
    return;
  }

  // 图片资源 - Stale While Revalidate 策略
  if (request.destination === 'image') {
    event.respondWith(handleImageRequest(request));
    return;
  }

  // 其他请求 - Network First
  event.respondWith(handleNavigationRequest(request));
});

/**
 * 处理文档导航请求（SPA）
 * - Network First
 * - 如果服务端返回 404（通常是 SPA 路由未命中），回退到缓存的 App Shell (/)
 * - 网络异常时，也回退到缓存
 */
async function handleDocumentRequest(request) {
  const cache = await caches.open(STATIC_CACHE);

  try {
    const response = await fetch(request);

    // Cache successful HTML navigations for offline support.
    if (response.ok && response.headers.get('Content-Type')?.includes('text/html')) {
      await cache.put(request, response.clone());
      return response;
    }

    // If the server responds 404 for an SPA route, serve the app shell instead.
    if (response.status === 404) {
      const cachedShell = await cache.match(APP_SHELL_URL) || await cache.match('/index.html');
      if (cachedShell) {
        return cachedShell;
      }
    }

    return response;
  } catch (error) {
    // Network failure: return cached route if present, otherwise app shell.
    const cachedResponse = await cache.match(request);
    if (cachedResponse) {
      console.log('[SW] Document served from cache:', request.url);
      return cachedResponse;
    }

    const cachedShell = await cache.match(APP_SHELL_URL) || await cache.match('/index.html');
    if (cachedShell) {
      console.log('[SW] App shell served from cache for:', request.url);
      return cachedShell;
    }

    // Fallback offline HTML
    return new Response(
      `<!DOCTYPE html>
      <html>
      <head>
        <title>离线 - TumuAI</title>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
            margin: 0;
            background: #f3f4f6;
            color: #1f2937;
          }
          .offline-card {
            text-align: center;
            padding: 2rem;
            background: white;
            border-radius: 1rem;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
            max-width: 400px;
            margin: 1rem;
          }
          h1 { margin: 0 0 0.5rem 0; color: #2563eb; }
          p { margin: 0 0 1rem 0; color: #6b7280; }
          button {
            background: #2563eb;
            color: white;
            border: none;
            padding: 0.5rem 1rem;
            border-radius: 0.5rem;
            cursor: pointer;
            font-size: 1rem;
          }
          button:hover { background: #1d4ed8; }
        </style>
      </head>
      <body>
        <div class="offline-card">
          <h1>离线模式</h1>
          <p>您当前处于离线状态，请检查网络连接后刷新页面。</p>
          <button onclick="window.location.reload()">重新连接</button>
        </div>
      </body>
      </html>`,
      {
        status: 200,
        headers: { 'Content-Type': 'text/html; charset=utf-8' }
      }
    );
  }
}

/**
 * 处理 API 请求 - Network First
 */
async function handleApiRequest(request) {
  const cache = await caches.open(API_CACHE);

  try {
    // 先尝试网络请求
    const response = await fetch(request);

    // 只缓存成功的 GET 请求
    if (response.ok && request.method === 'GET') {
      // 克隆响应以便缓存
      const responseToCache = response.clone();
      await cache.put(request, responseToCache);
    }

    return response;
  } catch (error) {
    // 网络失败，尝试从缓存获取
    const cachedResponse = await cache.match(request);
    if (cachedResponse) {
      console.log('[SW] API request served from cache:', request.url);
      return cachedResponse;
    }

    // 返回离线响应
    return new Response(
      JSON.stringify({
        error: 'Network request failed',
        message: 'No cached data available'
      }),
      {
        status: 503,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}

/**
 * 处理静态资源请求 - Cache First
 */
async function handleStaticRequest(request) {
  const cache = await caches.open(STATIC_CACHE);

  // 先尝试从缓存获取
  const cachedResponse = await cache.match(request);
  if (cachedResponse) {
    console.log('[SW] Static asset served from cache:', request.url);
    return cachedResponse;
  }

  // 缓存未命中，从网络获取
  try {
    const response = await fetch(request);
    if (response.ok) {
      const responseToCache = response.clone();
      await cache.put(request, responseToCache);
    }
    return response;
  } catch (error) {
    console.error('[SW] Failed to fetch static asset:', request.url);
    throw error;
  }
}

/**
 * 处理图片请求 - Stale While Revalidate
 */
async function handleImageRequest(request) {
  const cache = await caches.open(STATIC_CACHE);

  // 先从缓存获取（无论是否过期）
  const cachedResponse = await cache.match(request);

  // 后台更新缓存
  const fetchPromise = fetch(request).then((response) => {
    if (response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  }).catch(() => null);

  // 返回缓存的响应或等待网络请求
  return cachedResponse || fetchPromise;
}

/**
 * 处理导航请求 - Network First
 */
async function handleNavigationRequest(request) {
  const cache = await caches.open(STATIC_CACHE);

  try {
    // 先尝试网络请求
    const response = await fetch(request);

    // 缓存成功的 HTML 响应
    if (response.ok && response.headers.get('Content-Type')?.includes('text/html')) {
      const responseToCache = response.clone();
      await cache.put(request, responseToCache);
    }

    return response;
  } catch (error) {
    // 网络失败，尝试从缓存获取
    const cachedResponse = await cache.match(request);
    if (cachedResponse) {
      console.log('[SW] Navigation served from cache:', request.url);
      return cachedResponse;
    }

    // 返回离线页面
    const offlineCache = await caches.match('/offline.html');
    if (offlineCache) {
      return offlineCache;
    }

    // 返回基本的离线响应
    return new Response(
      `<!DOCTYPE html>
      <html>
      <head>
        <title>离线 - TumuAI</title>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
            margin: 0;
            background: #f3f4f6;
            color: #1f2937;
          }
          .offline-card {
            text-align: center;
            padding: 2rem;
            background: white;
            border-radius: 1rem;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
            max-width: 400px;
            margin: 1rem;
          }
          h1 { margin: 0 0 0.5rem 0; color: #2563eb; }
          p { margin: 0 0 1rem 0; color: #6b7280; }
          button {
            background: #2563eb;
            color: white;
            border: none;
            padding: 0.5rem 1rem;
            border-radius: 0.5rem;
            cursor: pointer;
            font-size: 1rem;
          }
          button:hover { background: #1d4ed8; }
        </style>
      </head>
      <body>
        <div class="offline-card">
          <h1>离线模式</h1>
          <p>您当前处于离线状态，请检查网络连接后刷新页面。</p>
          <button onclick="window.location.reload()">重新连接</button>
        </div>
      </body>
      </html>`,
      {
        status: 200,
        headers: { 'Content-Type': 'text/html; charset=utf-8' }
      }
    );
  }
}

/**
 * 消息处理 - 用于手动缓存管理
 */
self.addEventListener('message', (event) => {
  const { type, payload } = event.data;

  switch (type) {
    case 'SKIP_WAITING':
      // 跳过等待，立即激活新 Service Worker
      self.skipWaiting();
      break;

    case 'CLEAR_CACHE':
      // 清除所有缓存
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => caches.delete(cacheName))
        );
      }).then(() => {
        event.ports[0].postMessage({ type: 'CACHE_CLEARED' });
      });
      break;

    case 'PRECACHE_ASSETS':
      // 预缓存指定资源
      (async () => {
        const cache = await caches.open(STATIC_CACHE);
        const urls = payload.urls || [];
        await cache.addAll(urls);
        event.ports[0].postMessage({
          type: 'PRECACHE_COMPLETE',
          count: urls.length
        });
      })();
      break;

    default:
      console.warn('[SW] Unknown message type:', type);
  }
});

/**
 * 后台同步（可选功能）
 */
self.addEventListener('sync', (event) => {
  console.log('[SW] Background sync:', event.tag);

  if (event.tag === 'sync-favorites') {
    event.waitUntil(syncFavorites());
  }
});

/**
 * 同步收藏数据
 */
async function syncFavorites() {
  // 这里可以实现收藏数据的后台同步逻辑
  console.log('[SW] Syncing favorites...');
}

/**
 * 推送通知（可选功能）
 */
self.addEventListener('push', (event) => {
  const options = {
    body: event.data?.text() || 'TumuAI 有新内容更新',
    icon: '/icon-192x192.png',
    badge: '/favicon.svg',
    vibrate: [200, 100, 200],
    data: {
      url: '/'
    }
  };

  event.waitUntil(self.registration.showNotification('TumuAI', options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.openWindow(event.notification.data?.url || '/')
  );
});
