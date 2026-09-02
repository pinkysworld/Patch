import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const runner = fs.readFileSync('scripts/offline-studio-portable-runner.cjs', 'utf8');
const builder = fs.readFileSync('scripts/build-portable-offline-studio.js', 'utf8');
const checker = fs.readFileSync('scripts/check-portable-offline-studio.js', 'utf8');
const runtimeKitBuilder = fs.readFileSync('scripts/build-offline-studio-runtime-kit.js', 'utf8');
const runtimeKitChecker = fs.readFileSync('scripts/check-offline-studio-runtime-kit.js', 'utf8');
const workflow = fs.readFileSync('.github/workflows/offline-studio.yml', 'utf8');

test('portable Offline Studio runner is filesystem-backed, local-only and asset-verified', () => {
  execFileSync(process.execPath, ['--check', 'scripts/offline-studio-portable-runner.cjs'], { stdio: 'pipe' });
  execFileSync(process.execPath, ['--check', 'scripts/build-portable-offline-studio.js'], { stdio: 'pipe' });
  execFileSync(process.execPath, ['--check', 'scripts/check-portable-offline-studio.js'], { stdio: 'pipe' });
  assert.doesNotMatch(runner, /node:sea|getAsset\(/);
  assert.match(runner, /server\.listen\(0, '127\.0\.0\.1'/);
  assert.match(runner, /crypto\.createHash\('sha256'\)/);
  assert.match(runner, /sha256 !== entry\.sha256/);
  assert.match(runner, /size mismatch/);
  assert.match(runner, /relative\.includes\('\\\\'\)/);
  assert.match(runner, /segment !== '\.\.'/);
  assert.match(runner, /frame-ancestors 'none'/);
  assert.match(runner, /connect-src 'self'/);
});

test('portable Offline Studio supports common desktop openers without assuming xdg-open on all Unix hosts', () => {
  for (const command of ['xdg-open', 'gio', 'sensible-browser', 'firefox', 'chromium', 'google-chrome']) {
    assert.ok(runner.includes(`'${command}'`), command);
  }
  assert.match(runner, /process\.env\.PATH/);
  assert.match(runner, /fs\.constants\.X_OK/);
  assert.match(runner, /process\.platform === 'darwin'/);
  assert.match(runner, /process\.platform === 'win32'/);
});

test('portable bundle ships Unix and Windows launchers and verifies the same site manifest', () => {
  assert.match(builder, /buildOfflineStudioManifest/);
  assert.match(builder, /PatchStudio\.cjs/);
  assert.match(builder, /patch-studio/);
  assert.match(builder, /PatchStudio\.cmd/);
  assert.match(builder, /Node\.js 18 or newer/);
  assert.match(builder, /FreeBSD/);
  assert.match(checker, /PATCH_OFFLINE_STUDIO_SMOKE/);
  assert.match(checker, /portable Unix launcher smoke/);
});

test('embedded-runtime kit carries the current host Node beside the same portable Studio', () => {
  execFileSync(process.execPath, ['--check', 'scripts/build-offline-studio-runtime-kit.js'], { stdio: 'pipe' });
  execFileSync(process.execPath, ['--check', 'scripts/check-offline-studio-runtime-kit.js'], { stdio: 'pipe' });
  assert.match(runtimeKitBuilder, /fs\.copyFileSync\(process\.execPath, runtimeTarget\)/);
  assert.match(runtimeKitBuilder, /patch-offline-studio-runtime-kit/);
  assert.match(runtimeKitBuilder, /runtime\/node/);
  assert.match(runtimeKitChecker, /runtime-kit smoke/);
  assert.match(runtimeKitChecker, /metadata\.arch !== process\.arch/);
});

test('Offline Studio CI verifies x64 and ARM64 SEA builds plus an Intel macOS runtime kit', () => {
  for (const marker of [
    'ubuntu-latest', 'ubuntu-24.04-arm',
    'windows-latest', 'windows-11-arm',
    'macos-latest', 'macos-15-intel',
    'Linux-X64', 'Linux-ARM64',
    'Windows-X64', 'Windows-ARM64',
    'macOS-ARM64', 'macOS-X64'
  ]) assert.ok(workflow.includes(marker), marker);
  assert.match(workflow, /Offline Studio \(macOS Intel runtime kit\)/);
  assert.match(workflow, /check-offline-studio-runtime-kit\.js/);
  assert.match(workflow, /PatchStudio-macos-x64\.tar\.gz/);
  assert.match(workflow, /Portable Node \/ generic Unix compatibility/);
  assert.match(workflow, /PatchStudio-portable-node18\.tar\.gz/);
  assert.match(workflow, /needs: \[executable, macos-intel-runtime-kit, portable\]/);
});
