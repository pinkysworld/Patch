import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const buildSite = fs.readFileSync('scripts/build-site.js', 'utf8');
const serviceWorkerSource = fs.readFileSync('web/sw.js', 'utf8');
const accessibility = fs.readFileSync('web/studio-accessibility.js', 'utf8');

test('Patch site build content-addresses every public page and service-worker cache', () => {
  assert.match(buildSite, /createHash\('sha256'\)/);
  assert.match(buildSite, /computeSiteRevision\(\)/);
  assert.match(buildSite, /SITE_HTML_FILES = \['index\.html','language\.html','docs\.html','help\.html'\]/);
  assert.match(buildSite, /for \(const name of SITE_HTML_FILES\)/);
  assert.match(buildSite, /versionLocalAssetReferences\(source, siteRevision\)/);
  assert.match(buildSite, /replaceAll\('__PATCH_SITE_REV__', siteRevision\)/);

  execFileSync(process.execPath, ['scripts/build-site.js'], { stdio: 'pipe' });
  const html = fs.readFileSync('_site/index.html', 'utf8');
  const builtWorker = fs.readFileSync('_site/sw.js', 'utf8');
  const revision = /\.\/style\.css\?v=([a-f0-9]{16})/.exec(html)?.[1];
  assert.ok(revision, 'generated Studio HTML should expose a 16-hex content revision');

  for (const asset of [
    'site-navigation.css', 'studio-accessibility.css', 'form-window-resize.css', 'manifest.webmanifest',
    'native-build.js', 'project-lifecycle.js', 'project-config-restore.js', 'recovery-manager.js',
    'playground.js', 'forms-designer.js', 'form-window-resize.js', 'studio-diagnostics.js', 'studio-accessibility.js'
  ]) assert.ok(html.includes(`./${asset}?v=${revision}`), asset);

  for (const page of ['language.html','docs.html','help.html']) {
    const content = fs.readFileSync(`_site/${page}`, 'utf8');
    assert.ok(content.includes(`./style.css?v=${revision}`), `${page} style revision`);
    assert.ok(content.includes(`./site-navigation.css?v=${revision}`), `${page} navigation revision`);
  }

  assert.equal(builtWorker.includes('__PATCH_SITE_REV__'), false);
  assert.ok(builtWorker.includes(`const REVISION = '${revision}'`));
  assert.match(builtWorker, /const CACHE_PREFIX = 'patch-studio-'/);
  assert.match(builtWorker, /const CACHE = `\$\{CACHE_PREFIX\}\$\{REVISION\}`/);
});

test('Studio service worker bypasses stale HTTP cache but keeps offline fallback', () => {
  assert.match(serviceWorkerSource, /cache: 'no-store'/);
  assert.match(serviceWorkerSource, /ignoreSearch: true/);
  assert.match(serviceWorkerSource, /\.map\(versioned\)/);
  assert.match(serviceWorkerSource, /self\.skipWaiting\(\)/);
  assert.match(serviceWorkerSource, /self\.clients\.claim\(\)/);
});

test('Studio cache cleanup is scoped to Patch caches on the shared Pages origin', () => {
  assert.match(serviceWorkerSource, /LEGACY_CACHE_ID = 'patch-studio-0\.2-beta\.32-forms8-ux14-a11y1'/);
  assert.match(serviceWorkerSource, /key\.startsWith\(CACHE_PREFIX\)/);
  assert.match(serviceWorkerSource, /key !== CACHE/);
  assert.doesNotMatch(serviceWorkerSource, /keys\.filter\(k => k !== CACHE\)/);
});

test('Studio actively checks for a new worker and reloads once after activation', () => {
  assert.match(accessibility, /installServiceWorkerRefresh\(\)/);
  assert.match(accessibility, /register\('\.\/sw\.js', \{ updateViaCache: 'none' \}\)/);
  assert.match(accessibility, /await registration\.update\(\)/);
  assert.match(accessibility, /addEventListener\('controllerchange'/);
  assert.match(accessibility, /patch-studio-sw-reload-guard/);
  assert.match(accessibility, /window\.location\.reload\(\)/);
});
