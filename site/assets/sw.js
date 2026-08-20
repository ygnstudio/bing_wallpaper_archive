/**
 * Service Worker
 * 缓存策略：
 * - HTML / JS / CSS：安装时预缓存
 * - data/index.json：Network First（每天更新）
 * - 缩略图：Cache First，长期缓存
 */

const CACHE_NAME = 'bing-wallpaper-v1';

const CORE_URLS = [
  './',
  './index.html',
  './about.html'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    fetch('./assets/manifest.json')
      .then(r => r.ok ? r.json() : { assets: [] })
      .then(m => [...CORE_URLS, ...(m.assets || [])])
      .then(urls => caches.open(CACHE_NAME).then(cache => cache.addAll(urls)))
      .then(() => self.skipWaiting())
      .catch(err => {
        console.warn('[SW] precache failed', err);
        return self.skipWaiting();
      })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== 'GET') return;

  if (url.pathname.endsWith('/data/index.json')) {
    event.respondWith(networkFirst(request));
    return;
  }

  if (url.pathname.includes('/thumbnails/')) {
    event.respondWith(cacheFirst(request));
    return;
  }

  event.respondWith(cacheFirst(request));
});

async function cacheFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch (e) {
    return cached || new Response('Offline', { status: 503 });
  }
}

async function networkFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch (e) {
    const cached = await cache.match(request);
    return cached || new Response('Offline', { status: 503 });
  }
}
