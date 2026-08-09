const CACHE = 'patch-studio-0.2-beta.27';
const CORE = [
  './', './index.html', './style.css', './playground.js', './native-build.js', './manifest.webmanifest', './icon.svg',
  '../src/interpreter.js', '../src/parser.js', '../src/expression.js', '../src/change.js', '../src/change-analysis.js',
  '../src/range-analysis.js', '../src/formal-range.js', '../src/formal-guard.js', '../src/formal-calls.js', '../src/formal-bridge.js', '../src/formal-source.js',
  '../src/source-validation.js', '../src/guard-validation.js', '../src/compiler.js', '../src/bundle.js', '../src/wasm.js',
  '../src/wasm-direct.js', '../src/c99.js', '../src/webapp.js', '../src/window-webapp.js', '../src/window-build.js',
  '../src/window-events.js', '../src/designer.js'
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(CORE)));
  self.skipWaiting();
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))));
  self.clients.claim();
});
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  const codeAsset = url.origin === self.location.origin && /\.(?:js|html)$/.test(url.pathname);
  const freshFirst = event.request.mode === 'navigate' || codeAsset;

  if (freshFirst) {
    event.respondWith(fetch(event.request).then(response => {
      if (response && response.status === 200 && response.type !== 'opaque') {
        const copy = response.clone();
        caches.open(CACHE).then(cache => cache.put(event.request, copy));
      }
      return response;
    }).catch(async () => {
      const cached = await caches.match(event.request);
      if (cached) return cached;
      if (event.request.mode === 'navigate') return caches.match('./index.html');
      throw new Error('Patch Studio asset is unavailable offline.');
    }));
    return;
  }

  event.respondWith(caches.match(event.request).then(hit => hit || fetch(event.request).then(response => {
    if (!response || response.status !== 200 || response.type === 'opaque') return response;
    const copy = response.clone();
    caches.open(CACHE).then(cache => cache.put(event.request, copy));
    return response;
  })));
});
