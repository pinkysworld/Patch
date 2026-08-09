import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildLocalNativeKit,
  buildLocalNativeKitFiles,
  LocalNativeKitError
} from '../src/local-native-kit.js';

const SOURCE = 'create number score = 0\nchange score:\n  add 1\nshow score\n';

test('Windows local kit is token-free and carries the current Patch source', () => {
  const files = buildLocalNativeKitFiles(SOURCE, { platform: 'windows', kind: 'window', name: 'My App' });
  const names = files.map(file => file.name);
  assert.deepEqual(names, ['main.patch', 'README.txt', 'build.cmd', 'build.ps1']);
  assert.equal(files.find(file => file.name === 'main.patch').content, SOURCE);
  const readme = files.find(file => file.name === 'README.txt').content;
  assert.match(readme, /no GitHub token is needed/i);
  const powershell = files.find(file => file.name === 'build.ps1').content;
  assert.match(powershell, /build-native-window\.js/);
  assert.doesNotMatch(powershell, /Authorization|Bearer|workflow_dispatch/);
});

test('native Console local kit uses the existing local native CLI path', () => {
  const files = buildLocalNativeKitFiles(SOURCE, { platform: 'linux', kind: 'console', name: 'Score' });
  const shell = files.find(file => file.name === 'build.sh').content;
  assert.match(shell, /--target native/);
  assert.match(shell, /cargo/);
  assert.match(shell, /Patch\/archive\/refs\/heads\/main\.tar\.gz/);
});

test('FreeBSD local kit stays on the portable C99 path', () => {
  const files = buildLocalNativeKitFiles(SOURCE, { platform: 'freebsd', kind: 'console', name: 'Score' });
  const shell = files.find(file => file.name === 'build.sh').content;
  assert.match(shell, /--target c99/);
  assert.match(shell, /cc -std=c99/);
});

test('local kit emits a valid ZIP signature without third-party browser dependencies', () => {
  const kit = buildLocalNativeKit(SOURCE, { platform: 'macos', kind: 'window', name: 'My App' });
  assert.equal(kit.filename, 'My_App-macos-window-local-build.zip');
  assert.equal(kit.bytes[0], 0x50);
  assert.equal(kit.bytes[1], 0x4b);
  assert.equal(kit.bytes[2], 0x03);
  assert.equal(kit.bytes[3], 0x04);
  assert.ok(kit.bytes.length > SOURCE.length);
});

test('FreeBSD Window local kit fails closed', () => {
  assert.throws(
    () => buildLocalNativeKit(SOURCE, { platform: 'freebsd', kind: 'window', name: 'Nope' }),
    LocalNativeKitError
  );
});
