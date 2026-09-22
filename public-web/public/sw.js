const CACHE_REVISION = 'module-journal-20260922-r3';
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
  './labs/meta-core/',
  './labs/meta-core/index.html',
  './labs/meta-core/styles.css',
  './labs/meta-core/app.mjs',
  './labs/meta-core/runtime.mjs',
  './labs/meta-core/handoff.mjs',
  './labs/meta-core/CONTRACT.md',
  './labs/meta-core/vendor/provenance.json',
  './labs/meta-core/vendor/LICENSE',
  './labs/meta-core/vendor/meta_core_v2.js',
  './labs/meta-core/vendor/skela_full_activation.js',
  './labs/meta-core/vendor/subject_core.js',
  './labs/meta-core/vendor/gdeya_demons_v1.js',
  './labs/meta-core/vendor/gdeya_demons_v1_angelic.js',
  './labs/meta-core/vendor/governance_core_v1.js',
  './labs/meta-core/vendor/negative_core_v1.js',
  './labs/meta-core/vendor/tzar_language_001.js',
  './labs/tzar-language-evaluation.json',
  './labs/module/',
  './labs/module/index.html',
  './labs/module/styles.css?v=module-journal-20260922-r2',
  './labs/module/app.mjs?v=module-journal-20260922-r2',
  './labs/module/runtime.mjs?v=module-journal-20260922-r2',
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
  if (/\/labs\/meta-core(?:\/|$)/u.test(pathname)) return caches.match('./labs/meta-core/index.html');
  if (/\/platform(?:\/|$)/u.test(pathname)) return caches.match('./platform/index.html');
  return undefined;
}

async function networkFirst(request, refresh = false) {
  try {
    const response = await fetch(request);
    if (refresh && response.ok) {
      try {
        const cache = await caches.open(SHELL_CACHE);
        await cache.put(request, response.clone());
      } catch { /* Cache quota must not replace a successful network response. */ }
    }
    return response;
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

  // Unversioned ES modules must not mix stale imports with a fresh HTML shell.
  if (/\.(?:m?js|css|json)$/u.test(url.pathname)) {
    event.respondWith(networkFirst(request, true));
    return;
  }

  event.respondWith(staleWhileRevalidate(event));
});

