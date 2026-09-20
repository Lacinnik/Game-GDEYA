const CACHE_REVISION = 'platform-2.2-acceptance-20260920';
const CACHE_PREFIX = 'architectonica-public-';
const SHELL_CACHE = `${CACHE_PREFIX}${CACHE_REVISION}`;
const SHELL = [
  './manifest.webmanifest',
  './platform/',
  './platform/index.html',
  './platform/styles.css',
  './platform/app.js',
  './platform/products.registry.json',
  './platform/tzar-language.profiles.json',
  './labs/voidocr/',
  './labs/voidocr/index.html',
  './labs/voidocr/styles.css',
  './labs/voidocr/app.js',
  './labs/voidocr/storage.mjs',
  './labs/core-separation/',
  './labs/core-separation/index.html',
  './labs/core-separation/styles.css',
  './labs/core-separation/language.css',
  './labs/core-separation/catalog.mjs',
  './labs/core-separation/runtime.mjs',
  './labs/core-separation/app.mjs',
  './labs/core-separation/core/tzar-language.mjs',
  './labs/tzar-language-001.mjs',
  './labs/local-journal.mjs',
  './labs/tzar-language-evaluation.json',
  './labs/module/',
  './labs/module/index.html',
  './labs/module/styles.css',
  './labs/module/app.mjs',
  './labs/module/runtime.mjs',
  './labs/module/catalog.mjs',
  './labs/core-separation/manifest.json',
  './labs/core-separation/sw.js',
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
  if (/\/labs\/core-separation(?:\/|$)/u.test(pathname)) return caches.match('./labs/core-separation/index.html');
  if (/\/labs\/voidocr(?:\/|$)/u.test(pathname)) return caches.match('./labs/voidocr/index.html');
  if (/\/labs\/module(?:\/|$)/u.test(pathname)) return caches.match('./labs/module/index.html');
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
