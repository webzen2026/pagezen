// ==========================================
// PageZen — service worker
// Caches the whole app shell on install so PageZen keeps working fully
// offline / without ever being hosted online (it only needs to be packaged
// and submitted to the Microsoft Store — see README-STORE.txt).
//
// IMPORTANT: bump CACHE_NAME (e.g. 'pagezen-v2') whenever you change
// index.html and re-package, otherwise an already-installed copy may keep
// serving the old cached version.
// ==========================================

const CACHE_NAME = 'pagezen-v5';

const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './manifest.json',
  './icons/favicon.ico',
  './icons/favicon-16.png',
  './icons/favicon-32.png',
  './icons/apple-touch-icon.png',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // Cache files one by one - if one fails (e.g. a renamed/missing file),
      // the rest of the install still succeeds.
      return Promise.all(
        ASSETS_TO_CACHE.map((url) =>
          cache.add(url).catch((err) => {
            console.log('[SW] Failed to cache:', url, err);
          })
        )
      );
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) =>
      Promise.all(
        cacheNames.map((name) => {
          if (name !== CACHE_NAME) {
            console.log('[SW] Deleting old cache:', name);
            return caches.delete(name);
          }
        })
      )
    )
  );
  self.clients.claim();
});

// Cache-first: PageZen is meant to run without ever being hosted online, so
// the cached app shell is used first; the network is only a fallback (and
// silently used to refresh the cache when it *is* available).
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      const cached = await cache.match(event.request);
      if (cached) {
        // Refresh the cache in the background when possible; ignore failures.
        fetch(event.request).then((res) => {
          if (res && res.ok) cache.put(event.request, res.clone()).catch(() => {});
        }).catch(() => {});
        return cached;
      }
      try {
        const networkResponse = await fetch(event.request);
        if (networkResponse && networkResponse.ok) {
          cache.put(event.request, networkResponse.clone()).catch(() => {});
        }
        return networkResponse;
      } catch (err) {
        // Nothing cached and no network - fall back to the main page for
        // navigations so the app shell still loads.
        if (event.request.mode === 'navigate') {
          const fallback = await cache.match('./index.html');
          if (fallback) return fallback;
        }
        throw err;
      }
    })()
  );
});
