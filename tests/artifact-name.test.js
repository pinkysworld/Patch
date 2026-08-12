import test from 'node:test';
import assert from 'node:assert/strict';
import { PATCH_ARTIFACT_NAMING_VERSION, patchArtifactFilename, patchArtifactStem } from '../src/artifact-name.js';

test('artifact naming contract is deterministic and sanitizes unusual project names once', () => {
  assert.equal(PATCH_ARTIFACT_NAMING_VERSION, 1);
  assert.equal(patchArtifactStem('  My App!!!  '), 'My_App');
  assert.equal(patchArtifactStem('***'), 'PatchApp');
  assert.equal(patchArtifactStem('A.B C'), 'A_B_C');
  assert.equal(patchArtifactStem('  My App!!!  '), patchArtifactStem('  My App!!!  '));
});

test('logical Studio artifacts use stable target-specific suffixes', () => {
  assert.equal(patchArtifactFilename('My App', 'project'), 'My_App.patchproject');
  assert.equal(patchArtifactFilename('My App', 'portable'), 'My_App.patchapp');
  assert.equal(patchArtifactFilename('My App', 'web'), 'My_App.html');
  assert.equal(patchArtifactFilename('My App', 'wasm-direct'), 'My_App.direct.wasm');
  assert.equal(patchArtifactFilename('My App', 'wasm-bootstrap'), 'My_App.bootstrap.wasm');
  assert.equal(patchArtifactFilename('My App', 'c99'), 'My_App.c');
});

test('native artifact names encode platform and project kind deterministically', () => {
  assert.equal(patchArtifactFilename('Desk App', 'native-ready', { platform: 'windows', kind: 'window' }), 'Desk_App-windows-window.zip');
  assert.equal(patchArtifactFilename('Desk App', 'native-local-kit', { platform: 'linux', kind: 'console' }), 'Desk_App-linux-console-local-build.zip');
  assert.equal(patchArtifactFilename('Desk App', 'native-cloud', { platform: 'macos', kind: 'window' }), 'Desk_App-macos-window-build.zip');
  assert.equal(patchArtifactFilename('Desk App', 'native-cloud', { platform: 'windows', kind: 'window', aotSingleExe: true }), 'Desk_App-windows-aot-single-exe.zip');
  assert.equal(patchArtifactFilename('Desk App', 'windows-exe'), 'Desk_App.exe');
});

test('native naming fails closed for unsupported platforms', () => {
  assert.throws(() => patchArtifactFilename('App', 'native-ready', { platform: 'haiku', kind: 'window' }), /supported platform/);
  assert.throws(() => patchArtifactFilename('App', 'unknown'), /Unknown Patch artifact naming target/);
});
