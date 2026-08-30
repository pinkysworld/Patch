import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {
  localModuleSpecifiers,
  offlineCompilerSourceManifest
} from '../scripts/offline-compiler-source-graph.js';

test('offline compiler source graph includes CLI runtime dependencies but excludes Studio-only modules', () => {
  const manifest = offlineCompilerSourceManifest(process.cwd());
  const files = new Set(manifest.files);
  for (const required of [
    'src/cli-entry.js',
    'src/cli.js',
    'src/offline-linker.js',
    'src/compiler.js',
    'src/parser.js',
    'src/interpreter.js'
  ]) assert.equal(files.has(required), true, `missing ${required}`);

  for (const studioOnly of [
    'src/studio-design-model.js',
    'src/studio-design-cache.js',
    'src/studio-form-materialization.js'
  ]) assert.equal(files.has(studioOnly), false, `unexpected Studio-only dependency ${studioOnly}`);

  assert.deepEqual([...manifest.files].sort(), manifest.files);
  assert.ok(manifest.files.length > 20);
});

test('offline compiler source graph understands multiline, side-effect and dynamic local imports', () => {
  const source = `import {\n  one,\n  two\n} from './multi.js';\nimport './side.js';\nexport { three } from './exported.js';\nconst lazy = import('./lazy.js');\nimport fs from 'node:fs';`;
  assert.deepEqual(localModuleSpecifiers(source), [
    './exported.js', './lazy.js', './multi.js', './side.js'
  ]);
});

test('offline compiler source graph paths remain repository-relative and inside src', () => {
  const manifest = offlineCompilerSourceManifest(process.cwd());
  for (const file of manifest.files) {
    assert.equal(path.posix.normalize(file), file);
    assert.equal(file.startsWith('src/'), true);
    assert.equal(file.includes('..'), false);
    assert.equal(file.endsWith('.js'), true);
  }
});
