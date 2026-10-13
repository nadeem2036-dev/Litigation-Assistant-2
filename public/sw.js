/**
 * Service Worker for KPST Litigation Assistant PWA
 * Strategy: Network-First, Fallback-to-Cache with Offline Standalone Support
 */

const CACHE_NAME = 'kpst-litigation-v3';

// Core application shell assets cached during Service Worker installation
const CORE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon.svg',
  '/favicon.ico',
  '/apple-touch-icon.png',
  '/pwa-192x192.png',
  '/pwa-512x512.png',
  '/pwa-maskable-512x512.png',
];

// Installation event: Pre-cache critical application shell
self.addEventListener('install', (event) => {
  console.log('[Service Worker] Installing KPST Litigation Assistant service worker...');
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[Service Worker] Pre-caching core application assets...');
      return cache.addAll(CORE_ASSETS).catch((err) => {
        console.warn('[Service Worker] Warning pre-caching some assets:', err);
      });
    }).then(() => {
      // Force activation immediately without waiting for older workers to shutdown
      return self.skipWaiting();
    })
  );
});

// Activation event: Purge deprecated cache versions and claim clients
self.addEventListener('activate', (event) => {
  console.log('[Service Worker] Activating new Service Worker version...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('[Service Worker] Deleting obsolete cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      // Immediately take control of all open client tabs/windows
      return self.clients.claim();
    })
  );
});

// Fetch event: Implement Network-First with Fallback-to-Cache strategy
self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // Only handle HTTP/HTTPS GET requests (Cache API does not support POST/PUT)
  if (request.method !== 'GET') {
    return;
  }

  // 1. Navigation requests (HTML page loads / reloads / deep routes)
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseClone);
            });
          }
          return networkResponse;
        })
        .catch(async () => {
          console.log('[Service Worker] Network offline for navigation. Serving cached index.html...');
          const cache = await caches.open(CACHE_NAME);
          const cachedResponse = await cache.match(request);
          if (cachedResponse) return cachedResponse;
          // Fallback to cached root/index.html
          return (await cache.match('/index.html')) || (await cache.match('/'));
        })
    );
    return;
  }

  // 2. API requests (KPST and PHC court status / causelist data / version checks)
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseClone);
            });
          }
          return networkResponse;
        })
        .catch(async () => {
          console.log('[Service Worker] API network failure. Falling back to cached court data for:', url.pathname);
          const cachedResponse = await caches.match(request);
          if (cachedResponse) {
            return cachedResponse;
          }
          // Fallback offline API JSON response
          return new Response(
            JSON.stringify({
              offline: true,
              message: 'You are currently working in offline mode. Cached data is in effect.',
              timestamp: new Date().toISOString(),
            }),
            {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            }
          );
        })
    );
    return;
  }

  // 3. Static assets (JS, CSS, images, icons, fonts)
  event.respondWith(
    fetch(request)
      .then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseClone);
          });
        }
        return networkResponse;
      })
      .catch(async () => {
        const cachedResponse = await caches.match(request);
        if (cachedResponse) {
          return cachedResponse;
        }
        // Fallback for missing icon/image
        if (request.destination === 'image') {
          return (await caches.match('/icon.svg')) || (await caches.match('/favicon.ico'));
        }
        return new Response('Network error occurred while offline', {
          status: 503,
          statusText: 'Service Unavailable (Offline)',
        });
      })
  );
});

// Communication with frontend (e.g., skipWaiting trigger on manual update)
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
