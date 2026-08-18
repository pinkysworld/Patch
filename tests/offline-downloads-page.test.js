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

test('offline compiler download page and release workflow share one stable asset contract', () => {
  assert.match(downloads, /offline-compiler-v0\.1/);
  assert.match(workflow, /TAG: offline-compiler-v0\.1/);
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

test('downloads page clearly distinguishes standalone, Intel macOS kit and FreeBSD requirements', () => {
  assert.match(downloads, /normal local workflows do not need a GitHub token/i);
  assert.match(downloads, /macOS Intel/);
  assert.match(downloads, /portable tar\.gz kit/);
  assert.match(downloads, /includes its own Intel Node runtime/i);
  assert.match(downloads, /FreeBSD x64/);
  assert.match(downloads, /requires local Node 22\+ and cc/i);
  assert.match(downloads, /Native FreeBSD Window\/GUI linking is not claimed yet/);
  assert.match(downloads, /patch link app\.patch --out App/);
  assert.match(downloads, /payload <strong>v12<\/strong>/);
  assert.match(downloads, /runtime <strong>v1\.3<\/strong>/);
  assert.match(downloads, /hierarchical TreeView/);
});

test('generated public site contains the downloads page and current Designer/native compiler assets', () => {
  execFileSync(process.execPath, ['scripts/build-site.js'], { stdio: 'pipe' });
  for (const file of [
    '_site/downloads.html',
    '_site/designer-alignment.js',
    '_site/designer-alignment-guides.js',
    '_site/designer-multiselect.js',
    '_site/designer-multiselect.css',
    '_site/src/native-gui-ir-v12.js',
    '_site/src/native-tree-backend-adapter.js',
    '_site/src/sealed-native-gui-v12.js'
  ]) assert.ok(fs.existsSync(file), file);
});
