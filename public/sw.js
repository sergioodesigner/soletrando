// Service Worker for "Aprender Letras & Matemática"
const CACHE_NAME = 'aprender-offline-v2';
const AUDIO_CACHE = 'aprender-audio-recorded-v2';
// Runtime WASM da voz Faber (Piper no navegador) vindo de CDN — cache-first para funcionar offline
const PIPER_RUNTIME_CACHE = 'aprender-piper-runtime-v1';
// Modelo da voz Faber: gravado pela própria página (lib/piperTts.ts) — NÃO pode ser apagado aqui
const PIPER_MODEL_CACHE = 'aprender-piper-model-v1';
const PIPER_CDN_HOSTS = ['cdn.jsdelivr.net'];
const KEEP_CACHES = [CACHE_NAME, AUDIO_CACHE, PIPER_RUNTIME_CACHE, PIPER_MODEL_CACHE];

const STATIC_ASSETS = [
  '/',
  '/manifest.webmanifest',
  '/icon.svg',
  '/globals.css'
];

// Install: Cache essential app shell assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.warn('SW pre-cache warning:', err);
      });
    }).then(() => self.skipWaiting())
  );
});

// Activate: Clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (!KEEP_CACHES.includes(key)) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch: Smart routing for offline capability
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // 0. Runtime WASM da voz Faber (CDN) — Cache First
  if (PIPER_CDN_HOSTS.includes(url.hostname)) {
    event.respondWith(
      caches.open(PIPER_RUNTIME_CACHE).then(async (cache) => {
        const cached = await cache.match(request);
        if (cached) return cached;
        const networkResponse = await fetch(request);
        if (networkResponse.ok) {
          cache.put(request, networkResponse.clone());
        }
        return networkResponse;
      })
    );
    return;
  }

  // 1. Audio files — Cache First com rede
  if (url.pathname.startsWith('/audio/')) {
    event.respondWith(
      caches.open(AUDIO_CACHE).then(async (cache) => {
        const cachedResponse = await cache.match(request);
        if (cachedResponse) {
          return cachedResponse;
        }
        try {
          const networkResponse = await fetch(request);
          if (networkResponse.ok) {
            cache.put(request, networkResponse.clone());
          }
          return networkResponse;
        } catch (err) {
          return new Response(null, { status: 404, statusText: 'Audio Not Found Offline' });
        }
      })
    );
    return;
  }

  // 2. Navigation requests (HTML pages) - Network First with Cache Fallback
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).then((response) => {
        if (response.ok) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, responseClone));
        }
        return response;
      }).catch(() => {
        return caches.match('/') || caches.match(request);
      })
    );
    return;
  }

  // 3. Static assets (_next/static, css, js, images) - Stale While Revalidate
  if (
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.endsWith('.js') ||
    url.pathname.endsWith('.css') ||
    url.pathname.endsWith('.svg') ||
    url.pathname.endsWith('.png') ||
    url.pathname.endsWith('.jpg') ||
    url.pathname.endsWith('.webp') ||
    url.pathname.endsWith('.woff2')
  ) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        const fetchPromise = fetch(request).then((networkResponse) => {
          if (networkResponse.ok) {
            caches.open(CACHE_NAME).then((cache) => cache.put(request, networkResponse.clone()));
          }
          return networkResponse;
        }).catch(() => cachedResponse);

        return cachedResponse || fetchPromise;
      })
    );
    return;
  }

  // Default network fetch for other endpoints
  event.respondWith(
    fetch(request).catch(() => caches.match(request))
  );
});
