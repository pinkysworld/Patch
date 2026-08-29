import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const downloads = fs.readFileSync('web/downloads.html', 'utf8');
const workflow = fs.readFileSync('.github/workflows/offline-compiler.yml', 'utf8');
const pages = ['web/index.html', 'web/language.html', 'web/docs.html', 'web/help.html'];
const assets = [
  'patch-windows-x64.exe',
  'patch-macos-arm64',
  'patch-macos-x64.tar.gz',
  'patch-linux-x64',
  'patch-freebsd-x64.tar.gz',
  'SHA256SUMS'
];

test('offline compiler download page and release workflow share one stable v0.2 asset contract', () => {
  assert.match(downloads, /offline-compiler-v0\.2/);
  assert.match(workflow, /TAG: offline-compiler-v0\.2/);
  assert.doesNotMatch(downloads, /releases\/download\/offline-compiler-v0\.1/);
  for (const asset of assets) {
    assert.ok(downloads.includes(asset), `downloads page: ${asset}`);
    assert.ok(workflow.includes(asset), `release workflow: ${asset}`);
  }
});

test('every primary public Patch page links to Downloads', () => {
  for (const page of pages) {
    const content = fs.readFileSync(page, 'utf8');
    assert.ok(content.includes('href="./downloads.html"'), `${page} should link Downloads`);
  }
});

test('downloads page exposes current v1.9 compiler, compatibility history and offline IDE', () => {
  assert.match(downloads, /Patch Studio Offline IDE/);
  assert.match(downloads, /npm run build:offline-ide/);
  assert.match(downloads, /without Electron/i);
  assert.match(downloads, /macOS Intel/);
  assert.match(downloads, /embedded Intel Node runtime/i);
  assert.match(downloads, /FreeBSD x64/);
  assert.match(downloads, /Native FreeBSD GUI is not claimed/i);
  assert.match(downloads, /patch link app\.patch --out App/);
  assert.match(downloads, /Native GUI IR <strong>1\.8<\/strong>/);
  assert.match(downloads, /payload <strong>v18<\/strong>/);
  assert.match(downloads, /runtime <strong>v1\.9<\/strong>/);
  assert.match(downloads, /TreeView/);
  assert.match(downloads, /ImageList/);
  assert.match(downloads, /Button <code>image list\.item<\/code>/);
  assert.match(downloads, /Native GUI IR 1\.3 \/ payload v13 \/ runtime v1\.4/);
  assert.match(downloads, /Native GUI IR 1\.2 \/ payload v12 \/ runtime v1\.3/);
  assert.match(downloads, /PictureBox note/i);
  assert.match(downloads, /portable image-source rendering/i);
});

test('generated public site contains downloads and current plus frozen native compiler assets but no paper page', () => {
  execFileSync(process.execPath, ['scripts/build-site.js'], { stdio: 'pipe' });
  assert.equal(fs.existsSync('_site/paper.html'), false, 'paper.html must remain outside the public site');
  for (const file of [
    '_site/downloads.html',
    '_site/workshop-sample-current.js',
    '_site/designer-alignment.js',
    '_site/designer-alignment-guides.js',
    '_site/designer-multiselect.js',
    '_site/designer-multiselect.css',
    '_site/src/native-gui-ir-v12.js',
    '_site/src/native-tree-backend-adapter.js',
    '_site/src/sealed-native-gui-v12.js',
    '_site/src/native-gui-ir-v13.js',
    '_site/src/native-slider-backend-adapter.js',
    '_site/src/sealed-native-gui-v13.js',
    '_site/src/native-gui-ir-v14.js',
    '_site/src/native-gui-ir-v15.js',
    '_site/src/native-gui-ir-v16.js',
    '_site/src/native-gui-ir-v17.js',
    '_site/src/native-gui-ir-v18.js',
    '_site/src/native-chrome-backend-adapter.js',
    '_site/src/native-shape-backend-adapter.js',
    '_site/src/native-paintbox-backend-adapter.js',
    '_site/src/native-paintbox-image-backend-adapter.js',
    '_site/src/native-imagelist-backend-adapter.js',
    '_site/src/sealed-native-gui-v14.js',
    '_site/src/sealed-native-gui-v15.js',
    '_site/src/sealed-native-gui-v16.js',
    '_site/src/sealed-native-gui-v17.js',
    '_site/src/sealed-native-gui-v18.js'
  ]) assert.ok(fs.existsSync(file), file);
});
