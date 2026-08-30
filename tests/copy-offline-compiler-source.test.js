import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { copyOfflineCompilerSource } from '../scripts/copy-offline-compiler-source.js';

test('portable Offline Compiler source copy contains the CLI closure and excludes Studio-only src modules', t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'patch-offline-source-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const result = copyOfflineCompilerSource(root);

  for (const required of ['src/cli-entry.js', 'src/cli.js', 'src/parser.js', 'src/offline-linker.js']) {
    assert.equal(fs.existsSync(path.join(root, required)), true, required);
  }
  for (const excluded of ['src/studio-design-model.js', 'src/studio-design-cache.js', 'src/studio-form-materialization.js']) {
    assert.equal(fs.existsSync(path.join(root, excluded)), false, excluded);
  }
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'offline-compiler-source-manifest.json'), 'utf8'));
  assert.deepEqual(manifest.files, result.manifest.files);
  assert.equal(manifest.files.includes('src/studio-design-model.js'), false);
});
