// Service Worker: 缓存所有资源实现离线访问
const CACHE_NAME = 'math-sonification-v2';
const ASSETS = [
  './',
  './index.html',
  './style.css',
  './src/app.js',
  './src/audio-engine.js',
  './src/math-engine.js',
  './src/scanner.js',
  './src/navigator.js',
  './src/sound-effects.js',
  './src/speech.js',
  './src/visualizer.js',
  './src/presets.js',
  './src/tutorial.js',
  './src/selftest.js',
  './src/expr-speech.js',
  './src/calibration.js',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  // CDN 资源（math.js）走网络优先
  if (event.request.url.includes('cdn.jsdelivr.net')) {
    event.respondWith(
      fetch(event.request).catch(() => caches.match(event.request))
    );
    return;
  }
  // 本地资源走缓存优先
  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request))
  );
});
