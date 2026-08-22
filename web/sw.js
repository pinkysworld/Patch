const REVISION = '__PATCH_SITE_REV__';
const PATCH_RELEASE = '0.2.0-beta.35';
const CACHE_PREFIX = 'patch-studio-';
const CACHE = `${CACHE_PREFIX}${REVISION}`;
const LEGACY_CACHE_ID = 'patch-studio-0.2-beta.32-forms8-ux14-a11y1';
const versioned = path => /\.(?:js|css|webmanifest|svg)$/.test(path) ? `${path}?v=${REVISION}` : path;
const CORE = [
  './', './index.html', './language.html', './docs.html', './downloads.html', './help.html',
  './style.css', './site-navigation.css', './site-refresh.css', './site-pages.css', './studio-accessibility.css', './designer-inspector.css', './designer-data-editor.css', './designer-structure-ux.css', './designer-ux.css', './designer-layout-actions.css', './designer-table-actions.css', './designer-toolbox.css', './form-designer-workflow.css', './forms-designer.css', './designer-multiselect.css', './designer-responsive-layout.css', './form-window-resize.css', './beta35-studio.css', './studio-outline.css', './project-lifecycle.css', './recovery-manager.css', './studio-diagnostics.css',
  './runtime-integrity.js', './native-build.js', './project-lifecycle.js', './project-config-restore.js', './recovery-manager.js',
  './playground.js', './beta35-studio.js', './studio-outline.js', './forms-designer.js', './designer-selection.js', './designer-core-selection.js', './slider-stage1.js', './table-stage1.js', './tree-designer.js', './designer-workspace.js', './designer-data-editor.js', './designer-structural-keyboard.js', './designer-tabs-nested.js', './designer-tabs-control-model.js', './designer-tabs-control-actions.js', './designer-tabs-page-model.js', './designer-tabs-page-duplicate.js', './designer-control-duplicate-model.js', './designer-control-duplicate.js', './designer-form-duplicate-model.js', './designer-form-duplicate.js', './designer-form-delete-model.js', './designer-form-delete.js', './designer-structure-ux.js', './designer-ux.js', './designer-layout-actions.js', './designer-table-model.js', './designer-table-actions.js', './designer-tree-model.js', './designer-tree-duplicate.js', './designer-toolbox.js', './form-designer-workflow.js', './designer-alignment.js', './designer-alignment-guides.js', './designer-multiselect.js', './designer-layout-policy.js', './designer-responsive-layout.js', './form-window-resize.js', './studio-dom-sync.js', './studio-diagnostics.js', './studio-accessibility.js', './manifest.webmanifest', './icon.svg',
  '../src/interpreter.js', '../src/parser.js', '../src/expression.js', '../src/change.js', '../src/change-analysis.js',
  '../src/range-analysis.js', '../src/formal-range.js', '../src/formal-guard.js', '../src/formal-calls.js', '../src/formal-bridge.js', '../src/formal-source.js',
  '../src/source-validation.js', '../src/guard-validation.js', '../src/call-site-validation.js', '../src/compiler.js', '../src/diagnostics.js', '../src/backend-diagnostic-context.js', '../src/artifact-name.js', '../src/bundle.js', '../src/wasm.js',
  '../src/wasm-direct.js', '../src/c99.js', '../src/webapp.js', '../src/window-webapp.js', '../src/window-web-accessibility.js', '../src/window-build.js', '../src/menu-shortcut.js', '../src/window-events.js', '../src/designer.js', '../src/designer-data.js', '../src/designer-tabs-nested.js', '../src/form-layout.js', '../src/window-layout-policy.js', '../src/studio-project.js', '../src/studio-outline-model.js', '../src/studio-diagnostics.js', '../src/window-compiled.js', '../src/native-gui-ir.js', '../src/native-gui-ir-v08.js', '../src/native-gui-ir-v09.js', '../src/native-gui-ir-v10.js', '../src/native-gui-ir-v11.js', '../src/native-gui-ir-v12.js', '../src/native-tree-backend-adapter.js', '../src/sealed-native-gui.js', '../src/sealed-native-gui-v11.js', '../src/sealed-native-gui-v12.js',
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
  const sameOrigin = url.origin === self.location.origin;
  const codeAsset = sameOrigin && /\.(?:js|html|css|webmanifest|svg)$/.test(url.pathname);
  const runtimeAsset = sameOrigin && url.pathname.includes('/runtimes/');
  const freshFirst = event.request.mode === 'navigate' || codeAsset || runtimeAsset;

  if (freshFirst) {
    event.respondWith(fetch(event.request, { cache: 'no-store' }).then(response => {
      if (response.ok && sameOrigin) caches.open(CACHE).then(cache => cache.put(event.request, response.clone()));
      return response;
    }).catch(() => caches.match(event.request, { ignoreSearch: true }).then(cached => cached || caches.match(versioned('./index.html'), { ignoreSearch: true }))));
    return;
  }

  event.respondWith(caches.match(event.request, { ignoreSearch: true }).then(cached => cached || fetch(event.request)));
});