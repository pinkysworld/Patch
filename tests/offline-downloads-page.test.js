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
  'patch-macos-x64',
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

test('downloads page clearly distinguishes standalone and FreeBSD portable-kit requirements', () => {
  assert.match(downloads, /without a GitHub token or network connection after download/);
  assert.match(downloads, /FreeBSD x64/);
  assert.match(downloads, /Requires local Node 22\+ and cc/);
  assert.match(downloads, /Native FreeBSD Window\/GUI linking is not claimed yet/);
  assert.match(downloads, /patch link app\.patch --out App/);
});

test('generated public site contains the downloads page and offline Designer assets', () => {
  execFileSync(process.execPath, ['scripts/build-site.js'], { stdio: 'pipe' });
  for (const file of [
    '_site/downloads.html',
    '_site/designer-alignment.js',
    '_site/designer-alignment-guides.js',
    '_site/designer-multiselect.js',
    '_site/designer-multiselect.css'
  ]) assert.ok(fs.existsSync(file), file);
});
