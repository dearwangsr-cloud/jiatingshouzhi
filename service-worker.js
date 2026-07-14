const CACHE_NAME = 'family-finance-cache-v2';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './icon.svg',
  './manifest.json',
  'https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4',
  'https://cdn.jsdelivr.net/npm/chart.js'
];

// 安装阶段：强制跳过等待，直接占领控制权
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
});

// 激活阶段：清理旧版本缓存，保证存储空间干净
self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      self.clients.claim(),
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cache) => {
            if (cache !== CACHE_NAME) {
              return caches.delete(cache);
            }
          })
        );
      })
    ])
  );
});

// 核心：差异化拦截请求策略
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // 1. 如果是主 HTML 页面、或者本地同源文件 -> 【网络优先】策略
  if (event.request.mode === 'navigate' || url.origin === self.location.origin) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          // 联网请求成功：把最新的网页塞进缓存，然后返回给用户
          if (response.status === 200) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseClone);
            });
          }
          return response;
        })
        .catch(() => {
          // 离线时： fallback 降级到本地旧缓存
          return caches.match(event.request);
        })
    );
  } else {
    // 2. 如果是 CDN 等第三方库 -> 【缓存优先】策略，保证极速启动
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }
        return fetch(event.request).then((response) => {
          if (response.status === 200) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseClone);
            });
          }
          return response;
        });
      })
    );
  }
});