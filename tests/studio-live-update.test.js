import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const buildSite = fs.readFileSync('scripts/build-site.js', 'utf8');
const serviceWorkerSource = fs.readFileSync('web/sw.js', 'utf8');
const accessibility = fs.readFileSync('web/studio-accessibility.js', 'utf8');
const bootstrap = fs.readFileSync('web/studio-bootstrap.js', 'utf8');
const playgroundSource = fs.readFileSync('web/playground.js', 'utf8');
const studioHtml = fs.readFileSync('web/index.html', 'utf8');

test('Patch site build content-addresses every public page and service-worker cache', () => {
  assert.match(buildSite, /createHash\('sha256'\)/);
  assert.match(buildSite, /computeSiteRevision\(\)/);
  assert.match(buildSite, /SITE_HTML_FILES = \['index\.html','language\.html','docs\.html','help\.html'\]/);
  assert.match(buildSite, /SITE_HTML_FILES\.splice\(3, 0, 'downloads\.html'\)/);
  assert.match(buildSite, /for \(const name of SITE_HTML_FILES\)/);
  assert.match(buildSite, /versionLocalAssetReferences\(source, siteRevision\)/);
  assert.match(buildSite, /replaceAll\('__PATCH_SITE_REV__', siteRevision\)/);

  execFileSync(process.execPath, ['scripts/build-site.js'], { stdio: 'pipe' });
  const html = fs.readFileSync('_site/index.html', 'utf8');
  const builtWorker = fs.readFileSync('_site/sw.js', 'utf8');
  const revision = /\.\/style\.css\?v=([a-f0-9]{16})/.exec(html)?.[1];
  assert.ok(revision, 'generated Studio HTML should expose a 16-hex content revision');

  for (const asset of [
    'site-navigation.css', 'studio-accessibility.css', 'studio-command-palette.css', 'designer-multiselect.css', 'form-window-resize.css', 'manifest.webmanifest',
    'studio-bootstrap.js', 'native-build.js', 'project-lifecycle.js', 'project-config-restore.js', 'recovery-manager.js',
    'playground.js', 'forms-designer.js', 'designer-alignment-guides.js', 'designer-multiselect.js',
    'form-window-resize.js', 'studio-diagnostics.js', 'studio-command-palette.js', 'studio-accessibility.js'
  ]) assert.ok(html.includes(`./${asset}?v=${revision}`), asset);

  for (const page of ['language.html','docs.html','downloads.html','help.html']) {
    const content = fs.readFileSync(`_site/${page}`, 'utf8');
    assert.ok(content.includes(`./style.css?v=${revision}`), `${page} style revision`);
    assert.ok(content.includes(`./site-navigation.css?v=${revision}`), `${page} navigation revision`);
  }

  assert.equal(builtWorker.includes('__PATCH_SITE_REV__'), false);
  assert.ok(builtWorker.includes(`const REVISION = '${revision}'`));
  assert.match(builtWorker, /const CACHE_PREFIX = 'patch-studio-'/);
  assert.match(builtWorker, /const CACHE = `\$\{CACHE_PREFIX\}\$\{REVISION\}`/);
});

test('site builder content-addresses the complete transitive browser module graph', () => {
  execFileSync(process.execPath, ['scripts/build-site.js'], { stdio: 'pipe' });
  const html = fs.readFileSync('_site/index.html', 'utf8');
  const revision = /\.\/style\.css\?v=([a-f0-9]{16})/.exec(html)?.[1];
  assert.ok(revision);

  const playground = fs.readFileSync('_site/playground.js', 'utf8');
  const compiler = fs.readFileSync('_site/src/compiler.js', 'utf8');
  assert.ok(playground.includes(`from './src/compiler.js?v=${revision}'`));
  assert.ok(playground.includes(`from './src/interpreter.js?v=${revision}''`) === false);
  assert.ok(playground.includes(`from './src/interpreter.js?v=${revision}'`));
  assert.ok(compiler.includes(`from './parser.js?v=${revision}'`));
  assert.ok(compiler.includes(`from './call-site-validation.js?v=${revision}'`));

  assert.match(buildSite, /versionRelativeModuleSpecifiers\(content, siteRevision\)/);
  assert.match(buildSite, /validateGeneratedModuleRevisions\(\)/);
  assert.match(buildSite, /unversioned relative module imports/);
});

test('site builder validates module imports and local HTML asset closure before success', () => {
  assert.match(buildSite, /validateGeneratedModuleClosure\(\)/);
  assert.match(buildSite, /validateGeneratedHtmlAssetClosure\(\)/);
  assert.match(buildSite, /unresolved relative module imports/);
  assert.match(buildSite, /unresolved local HTML assets/);
  assert.ok(buildSite.includes("const assetExtension = /\\.(?:js|css|webmanifest|svg|png|ico)$/i;"));
});

test('Studio service worker bypasses stale HTTP cache and keeps type-safe offline fallback', () => {
  assert.match(serviceWorkerSource, /cache: 'no-store'/);
  assert.match(serviceWorkerSource, /ignoreSearch: true/);
  assert.match(serviceWorkerSource, /\.map\(versioned\)/);
  assert.match(serviceWorkerSource, /self\.skipWaiting\(\)/);
  assert.match(serviceWorkerSource, /self\.clients\.claim\(\)/);
  assert.match(serviceWorkerSource, /const navigation = event\.request\.mode === 'navigate'/);
  assert.match(serviceWorkerSource, /if \(navigation\) \{/);
  assert.match(serviceWorkerSource, /throw error/);
  assert.match(serviceWorkerSource, /Returning index\.html for a missing JavaScript\/CSS\/runtime request/);
});

test('Studio cache cleanup is scoped to Patch caches on the shared Pages origin', () => {
  assert.match(serviceWorkerSource, /LEGACY_CACHE_ID = 'patch-studio-0\.2-beta\.32-forms8-ux14-a11y1'/);
  assert.match(serviceWorkerSource, /key\.startsWith\(CACHE_PREFIX\)/);
  assert.match(serviceWorkerSource, /key !== CACHE/);
  assert.doesNotMatch(serviceWorkerSource, /keys\.filter\(k => k !== CACHE\)/);
});

test('Studio service-worker registration has one early revision-bound owner', () => {
  assert.doesNotMatch(accessibility, /serviceWorker\.register/);
  assert.doesNotMatch(playgroundSource, /serviceWorker\.register/);
  assert.doesNotMatch(bootstrap, /^\s*import\s/m);
  assert.match(bootstrap, /document\.currentScript\?\.src/);
  assert.match(bootstrap, /searchParams\.get\('v'\)/);
  assert.match(bootstrap, /register\(`\.\/sw\.js\?v=\$\{encodeURIComponent\(siteRevision\)\}`/);
  assert.match(bootstrap, /scope: '\.\/'/);
  assert.match(bootstrap, /navigator\.serviceWorker\.register\('\.\/sw\.js', \{ updateViaCache: 'none' \}\)/);
  assert.match(bootstrap, /await registration\.update\(\)/);
  assert.match(bootstrap, /addEventListener\('controllerchange'/);
  assert.match(bootstrap, /patch-studio-sw-reload-guard/);
  assert.match(bootstrap, /window\.location\.reload\(\)/);
});

test('Studio recovery bootstrap can repair a stale deployment before application modules execute', () => {
  assert.match(studioHtml, /<script src="\.\/studio-bootstrap\.js"><\/script>\s*<script type="module" src="\.\/runtime-integrity\.js"><\/script>/);
  assert.ok(buildSite.includes("'studio-bootstrap.js','runtime-integrity.js'"));
  assert.match(serviceWorkerSource, /'\.\/studio-bootstrap\.js'/);
});

test('generated Studio propagates one revision into the sole worker refresh entrypoint', () => {
  execFileSync(process.execPath, ['scripts/build-site.js'], { stdio: 'pipe' });
  const html = fs.readFileSync('_site/index.html', 'utf8');
  const revision = /\.\/style\.css\?v=([a-f0-9]{16})/.exec(html)?.[1];
  assert.ok(revision);
  assert.ok(html.includes(`./studio-bootstrap.js?v=${revision}`));
  assert.ok(html.includes(`./studio-accessibility.js?v=${revision}`));

  const builtBootstrap = fs.readFileSync('_site/studio-bootstrap.js', 'utf8');
  const builtAccessibility = fs.readFileSync('_site/studio-accessibility.js', 'utf8');
  const builtPlayground = fs.readFileSync('_site/playground.js', 'utf8');
  assert.match(builtBootstrap, /document\.currentScript\?\.src/);
  assert.match(builtBootstrap, /searchParams\.get\('v'\)/);
  assert.match(builtBootstrap, /register\(`\.\/sw\.js\?v=\$\{encodeURIComponent\(siteRevision\)\}`/);
  assert.match(builtBootstrap, /scope: '\.\/'/);
  assert.doesNotMatch(builtAccessibility, /serviceWorker\.register/);
  assert.doesNotMatch(builtPlayground, /serviceWorker\.register/);
});
