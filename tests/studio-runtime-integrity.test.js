import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const html = fs.readFileSync('web/index.html', 'utf8');
const runtimeIntegrity = fs.readFileSync('web/runtime-integrity.js', 'utf8');
const pages = fs.readFileSync('.github/workflows/pages.yml', 'utf8');
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

test('Pages gates deployment on compatibility runtime plus current native GUI runtime v1.4 releases', () => {
  assert.match(pages, /RUNTIME_TAG: studio-runtime-v0\.6/);
  assert.match(pages, /WIN32_RUNTIME_TAG: native-win32-runtime-v1\.4/);
  assert.match(pages, /LINUX_NATIVE_RUNTIME_TAG: native-linux-runtime-v1\.4/);
  assert.match(pages, /MACOS_NATIVE_RUNTIME_TAG: native-macos-runtime-v1\.4/);
  assert.match(pages, /for tag in "\$RUNTIME_TAG" "\$WIN32_RUNTIME_TAG" "\$LINUX_NATIVE_RUNTIME_TAG" "\$MACOS_NATIVE_RUNTIME_TAG"/);
  assert.match(pages, /Patch Native Sealed TreeView Runtime v1\.3/);
  assert.match(pages, /Patch Native Sealed Slider Runtime v1\.4/);
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
  assert.match(pages, /scripts\/check-site-beta35\.js/);
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
  for (const asset of ['index.html','site-navigation.css','playground.js','native-build.js','studio-bootstrap.js','studio-accessibility.js','sw.js','src/compiler.js','src/call-site-validation.js','src/independent-range-expression.js','src/independent-guard-expression.js']) {
    assert.ok(pages.includes(asset), `Pages live smoke should cover ${asset}`);
  }
  assert.match(pages, /curl --fail --silent --show-error --location/);
  assert.ok(pages.includes('src/compiler.js?v=${revision}'));
  assert.ok(pages.includes('./parser.js?v=${revision}'));
  assert.ok(pages.includes('sw.js?v=${encodeURIComponent(siteRevision)}'));
  assert.match(pages, /data-patch-version="0\.2\.0-beta\.35"/);
});

test('service worker fetches runtime assets fresh-first before offline fallback', () => {
  assert.match(serviceWorker, /runtimeAsset/);
  assert.match(serviceWorker, /url\.pathname\.includes\('\/runtimes\/'\)/);
  assert.match(serviceWorker, /freshFirst = event\.request\.mode === 'navigate' \|\| codeAsset \|\| runtimeAsset/);
});
