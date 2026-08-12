const REVISION = '__PATCH_SITE_REV__';
const CACHE_PREFIX = 'patch-studio-';
const CACHE = `${CACHE_PREFIX}${REVISION}`;
// Known previous cache id retained only so migration remains explicit and auditable.
// It is never used as the active cache identity.
const LEGACY_CACHE_ID = 'patch-studio-0.2-beta.32-forms8-ux14-a11y1';
const versioned = path => /\.(?:js|css|webmanifest|svg)$/.test(path) ? `${path}?v=${REVISION}` : path;
const CORE = [
  './', './index.html', './style.css', './studio-accessibility.css', './designer-inspector.css', './forms-designer.css', './project-lifecycle.css', './recovery-manager.css', './studio-diagnostics.css', './playground.js', './forms-designer.js', './native-build.js', './project-lifecycle.js', './recovery-manager.js', './studio-diagnostics.js', './studio-accessibility.js', './manifest.webmanifest', './icon.svg',
  '../src/interpreter.js', '../src/parser.js', '../src/expression.js', '../src/change.js', '../src/change-analysis.js',
  '../src/range-analysis.js', '../src/formal-range.js', '../src/formal-guard.js', '../src/formal-calls.js', '../src/formal-bridge.js', '../src/formal-source.js',
  '../src/source-validation.js', '../src/guard-validation.js', '../src/compiler.js', '../src/diagnostics.js', '../src/bundle.js', '../src/wasm.js',
  '../src/wasm-direct.js', '../src/c99.js', '../src/webapp.js', '../src/window-webapp.js', '../src/window-build.js',
  '../src/window-events.js', '../src/designer.js', '../src/form-layout.js', '../src/studio-project.js', '../src/studio-diagnostics.js', '../src/window-compiled.js', '../src/native-gui-ir.js', '../src/sealed-native-gui.js',
  '../src/sealed-native-package.js', '../src/local-native-kit.js', '../src/prebuilt-native.js', '../src/prebuilt-window.js'
].map(versioned);

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(CORE)));
  self.skipWaiting();
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys
    .filter(key => key !== CACHE && (key.startsWith(CACHE_PREFIX) || key === LEGACY_CACHE_ID))
    .map(key => caches.delete(key)))));
  self.clients.claim();
});
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  const codeAsset = url.origin === self.location.origin && /\.(?:js|html|css|webmanifest|svg)$/.test(url.pathname);
  const freshFirst = event.request.mode === 'navigate' || codeAsset;

  if (freshFirst) {
    event.respondWith(fetch(event.request, { cache: 'no-store' }).then(response => {
      if (response && response.status === 200 && response.type !== 'opaque') {
        const copy = response.clone();
        caches.open(CACHE).then(cache => cache.put(event.request, copy));
      }
      return response;
    }).catch(async () => {
      const cached = await caches.match(event.request, { ignoreSearch: true });
      if (cached) return cached;
      if (event.request.mode === 'navigate') return caches.match('./index.html', { ignoreSearch: true });
      throw new Error('Patch Studio asset is unavailable offline.');
    }));
    return;
  }

  event.respondWith(caches.match(event.request, { ignoreSearch: true }).then(hit => hit || fetch(event.request).then(response => {
    if (!response || response.status !== 200 || response.type === 'opaque') return response;
    const copy = response.clone();
    caches.open(CACHE).then(cache => cache.put(event.request, copy));
    return response;
  })));
});
