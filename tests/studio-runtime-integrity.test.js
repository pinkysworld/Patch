import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const html = fs.readFileSync('web/index.html', 'utf8');
const runtimeIntegrity = fs.readFileSync('web/runtime-integrity.js', 'utf8');
const pages = fs.readFileSync('.github/workflows/pages.yml', 'utf8');
const pagesStatus = fs.readFileSync('.github/workflows/pages-status.yml', 'utf8');
const serviceWorker = fs.readFileSync('web/sw.js', 'utf8');

const browserRuntimeFiles = [
  'patch-windows-native-gui-runtime.exe',
  'patch-linux-native-gui-runtime.bin',
  'patch-macos-native-gui-runtime.bin',
  'patch-windows-console-runtime.bin',
  'patch-macos-console-runtime.bin',
  'patch-linux-console-runtime.bin',
  'patch-windows-window-runtime.zip',
  'patch-macos-window-runtime.zip',
  'patch-linux-window-runtime.zip'
];

test('runtime integrity wrapper loads before the native builder and covers every browser-consumed runtime template', () => {
  const integrityIndex = html.indexOf('./runtime-integrity.js');
  const nativeBuildIndex = html.indexOf('./native-build.js');
  assert.ok(integrityIndex > 0);
  assert.ok(nativeBuildIndex > integrityIndex);
  for (const file of browserRuntimeFiles) {
    assert.match(runtimeIntegrity, new RegExp(file.replaceAll('.', '\\.')));
  }
  assert.match(runtimeIntegrity, /runtime-manifest\.json/);
  assert.match(runtimeIntegrity, /crypto\.subtle\.digest\('SHA-256'/);
  assert.match(runtimeIntegrity, /failed SHA-256 verification/);
  assert.match(runtimeIntegrity, /integrity manifest is missing/);
});

test('Pages gates deployment on compatibility runtime plus current native GUI runtime v1.8 releases', () => {
  assert.match(pages, /RUNTIME_TAG: studio-runtime-v0\.6/);
  assert.match(pages, /WIN32_RUNTIME_TAG: native-win32-runtime-v1\.8/);
  assert.match(pages, /LINUX_NATIVE_RUNTIME_TAG: native-linux-runtime-v1\.8/);
  assert.match(pages, /MACOS_NATIVE_RUNTIME_TAG: native-macos-runtime-v1\.8/);
  assert.match(pages, /for tag in "\$RUNTIME_TAG" "\$WIN32_RUNTIME_TAG" "\$LINUX_NATIVE_RUNTIME_TAG" "\$MACOS_NATIVE_RUNTIME_TAG"/);
  assert.match(pages, /Patch Native Sealed TreeView Runtime v1\.3/);
  assert.match(pages, /Patch Native Sealed Slider Runtime v1\.4/);
  assert.match(pages, /Patch Native Sealed Shape Runtime v1\.6/);
  assert.match(pages, /Patch Native Sealed PaintBox Runtime v1\.7/);
  assert.match(pages, /Patch Native Sealed PaintBox Image Runtime v1\.8/);
});

test('Pages refuses a false green when required runtime releases are incomplete', () => {
  assert.match(pages, /Refusing to report a successful Pages run without a deployment/);
  assert.match(pages, /exit 1/);
  assert.doesNotMatch(pages, /finish successfully without replacing the current site/);
});

test('Pages derives the deployed runtime manifest from GitHub release asset digests', () => {
  assert.match(pages, /runtime-integrity-manifest\.js/);
  assert.match(pages, /\.assets\[\]/);
  assert.match(pages, /\.digest/);
  assert.match(pages, /runtime-manifest\.json/);
  for (const file of browserRuntimeFiles) {
    assert.ok(pages.includes(file) || ['patch-windows-native-gui-runtime.exe', 'patch-linux-native-gui-runtime.bin', 'patch-macos-native-gui-runtime.bin'].includes(file), `Pages runtime manifest contract should cover ${file}`);
  }
});

test('Pages deploys only after the canonical current-site gate succeeds', () => {
  assert.match(pages, /name: Validate current Patch Studio site surface/);
  assert.match(pages, /run: npm run check:site/);
  assert.doesNotMatch(pages, /run: node scripts\/check-site-beta34\.js/);
  assert.match(pages, /scripts\/check-site-v12\.js/);
  assert.match(pages, /scripts\/check-site-beta36\.js/);
  const validate = pages.indexOf('run: npm run check:site');
  const upload = pages.indexOf('uses: actions/upload-pages-artifact@v5');
  const deploy = pages.indexOf('uses: actions/deploy-pages@v5');
  assert.ok(validate > 0 && upload > validate && deploy > upload);
});

test('Pages verifies the canonical and public deployed site with one revision-consistent module graph', () => {
  const deploy = pages.indexOf('uses: actions/deploy-pages@v5');
  const smoke = pages.indexOf('name: Verify deployed Patch Studio critical assets');
  assert.ok(smoke > deploy);
  assert.match(pages, /PAGE_URL: \$\{\{ steps\.deployment\.outputs\.page_url \}\}/);
  assert.match(pages, /PUBLIC_URL: https:\/\/minh\.systems\/Patch\//);
  assert.ok(pages.includes('verify_base() {'));
  assert.ok(pages.includes('verify_base "$PAGE_URL" pages'));
  assert.ok(pages.includes('verify_base "$PUBLIC_URL" public'));
  assert.ok(pages.includes("grep -oE '\\./style\\.css\\?v=[0-9a-f]{16}'"));
  assert.ok(pages.includes('studio-bootstrap.js?v=${revision}'));
  assert.ok(pages.includes('studio-accessibility.js?v=${revision}'));
  for (const asset of ['index.html','site-navigation.css','playground.js','native-build.js','studio-bootstrap.js','studio-accessibility.js','designer-multiselect.js','sw.js','src/compiler.js','src/call-site-validation.js','src/independent-range-expression.js','src/independent-guard-expression.js']) {
    assert.ok(pages.includes(asset), `Pages live smoke should cover ${asset}`);
  }
  assert.match(pages, /curl --fail --silent --show-error --location/);
  assert.ok(pages.includes('src/compiler.js?v=${revision}'));
  assert.ok(pages.includes('./parser.js?v=${revision}'));
  assert.ok(pages.includes('sw.js?v=${encodeURIComponent(siteRevision)}'));
  assert.match(pages, /data-patch-version="0\.2\.0-beta\.36"/);
});

test('Pages deployment result is published as a queryable commit status', () => {
  assert.ok(pages.includes('.github/workflows/pages-status.yml'));
  assert.match(pagesStatus, /name: Publish Patch Studio Deployment Status/);
  assert.match(pagesStatus, /workflows: \[Deploy Patch Studio\]/);
  assert.match(pagesStatus, /statuses: write/);
  assert.match(pagesStatus, /contents: read/);
  assert.doesNotMatch(pagesStatus, /write-all/);
  assert.match(pagesStatus, /github\.event\.workflow_run\.head_branch == 'main'/);
  assert.match(pagesStatus, /STATUS_SHA: \$\{\{ github\.event\.workflow_run\.head_sha \}\}/);
  assert.match(pagesStatus, /DEPLOY_CONCLUSION: \$\{\{ github\.event\.workflow_run\.conclusion \}\}/);
  assert.match(pagesStatus, /context='patch-studio\/public-site'/);
  assert.match(pagesStatus, /state=success/);
  assert.match(pagesStatus, /state=failure/);
  assert.match(pagesStatus, /statuses\/\$STATUS_SHA/);
});

test('service worker fetches documents, code and runtime assets fresh-first with type-safe offline fallback', () => {
  assert.match(serviceWorker, /const navigation = event\.request\.mode === 'navigate'/);
  assert.match(serviceWorker, /const codeAsset = sameOrigin/);
  assert.match(serviceWorker, /const htmlAsset = sameOrigin/);
  assert.match(serviceWorker, /const runtimeAsset = sameOrigin/);
  assert.match(serviceWorker, /url\.pathname\.includes\('\/runtimes\/'\)/);
  assert.match(serviceWorker, /const freshFirst = navigation \|\| codeAsset \|\| htmlAsset \|\| runtimeAsset/);
  assert.match(serviceWorker, /const cached = await caches\.match\(event\.request, \{ ignoreSearch: true \}\)/);
  assert.match(serviceWorker, /if \(navigation\) \{/);
  assert.match(serviceWorker, /caches\.match\(versioned\('\.\/index\.html'\), \{ ignoreSearch: true \}\)/);
  assert.match(serviceWorker, /throw error/);
});
