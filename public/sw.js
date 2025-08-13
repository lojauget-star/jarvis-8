const STATIC_CACHE_NAME = 'jarvis-static-v2';
const DYNAMIC_CACHE_NAME = 'jarvis-dynamic-v2';

// These are the core files for the app shell.
// The build assets (JS, CSS) will be cached dynamically on first visit.
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/icon.svg',
  '/manifest.json'
];

// INSTALL: Cache static assets
self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(STATIC_CACHE_NAME).then(cache => {
      console.log('Service Worker: Caching app shell');
      return cache.addAll(STATIC_ASSETS);
    })
  );
});

// ACTIVATE: Clean up old caches
self.addEventListener('activate', event => {
  const cacheWhitelist = [STATIC_CACHE_NAME, DYNAMIC_CACHE_NAME];
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            console.log('Service Worker: Deleting old cache', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// FETCH: Serve from cache, fallback to network, and cache dynamically
self.addEventListener('fetch', event => {
  // Ignore Netlify function calls and non-GET requests
  if (event.request.url.includes('/.netlify/functions/') || event.request.method !== 'GET') {
    return;
  }

  event.respondWith(
    caches.match(event.request).then(cachedResponse => {
      if (cachedResponse) {
        return cachedResponse;
      }

      return fetch(event.request).then(networkResponse => {
        if (!networkResponse || networkResponse.status !== 200 || (networkResponse.type !== 'basic' && networkResponse.type !== 'opaque')) {
          return networkResponse;
        }

        const responseToCache = networkResponse.clone();
        caches.open(DYNAMIC_CACHE_NAME).then(cache => {
          cache.put(event.request, responseToCache);
        });

        return networkResponse;
      });
    })
  );
});