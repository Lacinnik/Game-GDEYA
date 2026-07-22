const CACHE_REVISION = 'platform-2.0-stable-1';
const CACHE_PREFIX = 'architectonica-public-';
const SHELL_CACHE = `${CACHE_PREFIX}${CACHE_REVISION}`;
const SHELL = [
  './manifest.webmanifest',
  './platform/',
  './platform/index.html',
  './platform/styles.css',
  './platform/app.js',
  './platform/products.registry.json',
  './labs/voidocr/',
  './labs/voidocr/index.html',
  './labs/voidocr/styles.css',
  './labs/voidocr/app.js',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE)
      .then((cache) => cache.addAll(SHELL))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys
          .filter((key) => key.startsWith(CACHE_PREFIX) && key !== SHELL_CACHE)
          .map((key) => caches.delete(key)),
      ))
      .then(() => self.clients.claim()),
  );
});

function navigationFallback(request) {
  const { pathname } = new URL(request.url);
  if (/\/labs\/voidocr(?:\/|$)/u.test(pathname)) return caches.match('./labs/voidocr/index.html');
  if (/\/platform(?:\/|$)/u.test(pathname)) return caches.match('./platform/index.html');
  return undefined;
}

async function networkFirst(request) {
  try {
    return await fetch(request);
  } catch {
    return (await caches.match(request)) || (await navigationFallback(request)) || Response.error();
  }
}

async function staleWhileRevalidate(event) {
  const cached = await caches.match(event.request);
  const update = fetch(event.request)
    .then(async (response) => {
      if (response.ok || response.type === 'opaque') {
        const cache = await caches.open(SHELL_CACHE);
        await cache.put(event.request, response.clone());
      }
      return response;
    })
    .catch(() => null);
  event.waitUntil(update);
  return cached || update.then((response) => response || Response.error());
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request));
    return;
  }

  event.respondWith(staleWhileRevalidate(event));
});
