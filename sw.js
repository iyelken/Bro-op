// Bro-op Service Worker
// Cache-first strategy for app shell, network-first for everything else
//
// VERSIONING: bump CACHE_NAME on every release so the new SW installs
// and waits, giving us a chance to notify the user via the in-app banner.
// IMPORTANT: this must change every time index.html is updated, otherwise
// the browser won't fetch the new SW and the update banner won't fire.
const CACHE_NAME = 'broop-v0-24-0-alpha1';
const APP_SHELL = ['./', './index.html'];

self.addEventListener('install', (event) => {
  // Pre-cache the app shell. Do NOT call skipWaiting() here — we want the
  // new SW to wait until the user explicitly confirms via the in-app
  // "yeni versiyon hazır" banner, which posts a SKIP_WAITING message.
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
});

self.addEventListener('activate', (event) => {
  // Clean up old caches
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Listen for messages from the page — currently used by the update banner
// to tell the waiting SW to activate immediately when the user clicks "YENİLE".
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  // Only handle same-origin GETs
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    caches.open(CACHE_NAME).then((cache) =>
      cache.match(event.request).then((cached) => {
        const networkFetch = fetch(event.request)
          .then((res) => {
            if (res && res.ok) {
              cache.put(event.request, res.clone()).catch(() => {});
            }
            return res;
          })
          .catch(() => cached);
        // Return cached immediately if available, but update in background
        return cached || networkFetch;
      })
    )
  );
});
