import test from 'node:test';
import assert from 'node:assert/strict';
import { offlineCompilerAffected } from '../scripts/offline-compiler-affected.js';

test('Studio-only src changes do not require the expensive Offline Compiler matrix', () => {
  const result = offlineCompilerAffected([
    'src/studio-design-model.js',
    'src/studio-design-cache.js',
    'src/studio-form-materialization.js'
  ]);
  assert.equal(result.affected, false);
  assert.match(result.reason, /outside the Offline Compiler dependency closure/);
});

test('a real CLI dependency requires an Offline Compiler rebuild', () => {
  const result = offlineCompilerAffected(['src/parser.js']);
  assert.equal(result.affected, true);
  assert.deepEqual(result.matched, ['src/parser.js']);
});

test('runtime builder and release-input changes remain affected', () => {
  for (const file of [
    'native-runtime/gtk-sealed-gui-v18.cpp',
    'scripts/build-offline-compiler.js',
    'docs/OFFLINE_COMPILER.md',
    '.github/workflows/offline-compiler.yml'
  ]) {
    const result = offlineCompilerAffected([file]);
    assert.equal(result.affected, true, file);
  }
});

test('mixed changes rebuild when any path affects the compiler', () => {
  const result = offlineCompilerAffected(['src/studio-design-model.js', 'src/compiler.js']);
  assert.equal(result.affected, true);
  assert.deepEqual(result.matched, ['src/compiler.js']);
});
