import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const downloads = fs.readFileSync('web/downloads.html', 'utf8');
const workflow = fs.readFileSync('.github/workflows/offline-compiler.yml', 'utf8');
const pages = ['web/index.html', 'web/language.html', 'web/docs.html', 'web/paper.html', 'web/help.html'];
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

test('downloads page distinguishes current v1.5, Intel macOS kit, FreeBSD and historical compatibility', () => {
  assert.match(downloads, /normal local workflows do not need a GitHub token/i);
  assert.match(downloads, /macOS Intel/);
  assert.match(downloads, /portable tar\.gz kit/);
  assert.match(downloads, /includes its own Intel Node runtime/i);
  assert.match(downloads, /FreeBSD x64/);
  assert.match(downloads, /requires local Node 22\+ and cc/i);
  assert.match(downloads, /Native FreeBSD Window\/GUI linking is not claimed yet/);
  assert.match(downloads, /patch link app\.patch --out App/);
  assert.match(downloads, /Native GUI IR <strong>1\.4<\/strong>/);
  assert.match(downloads, /payload <strong>v14<\/strong>/);
  assert.match(downloads, /runtime <strong>v1\.5<\/strong>/);
  assert.match(downloads, /native Slider/i);
  assert.match(downloads, /hierarchical TreeView/);
  assert.match(downloads, /Native GUI IR 1\.3 \/ payload v13 \/ runtime v1\.4/);
  assert.match(downloads, /Native GUI IR 1\.2 \/ payload v12 \/ runtime v1\.3/);
  assert.match(downloads, /PictureBox note/i);
  assert.match(downloads, /portable image-source rendering/i);
});

test('generated public site contains downloads and current plus frozen native compiler assets', () => {
  execFileSync(process.execPath, ['scripts/build-site.js'], { stdio: 'pipe' });
  for (const file of [
    '_site/downloads.html',
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
    '_site/src/native-chrome-backend-adapter.js',
    '_site/src/sealed-native-gui-v14.js'
  ]) assert.ok(fs.existsSync(file), file);
});
