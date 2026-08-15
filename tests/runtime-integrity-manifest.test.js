import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { buildRuntimeIntegrityManifest } from '../scripts/runtime-integrity-manifest.js';

test('runtime integrity manifest is deterministic and content-addressed', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'patch-runtime-integrity-'));
  try {
    fs.writeFileSync(path.join(dir, 'runtime.bin'), 'payload');
    const digest = `sha256:${crypto.createHash('sha256').update('payload').digest('hex')}`;
    const manifest = buildRuntimeIntegrityManifest([
      { file: 'runtime.bin', releaseTag: 'runtime-v1', digest }
    ], { baseDir: dir });
    assert.equal(manifest.schema, 'patch-studio-runtime-integrity');
    assert.equal(manifest.schemaVersion, 1);
    assert.equal(manifest.assets[0].file, 'runtime.bin');
    assert.equal(manifest.assets[0].sha256, digest);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('runtime integrity manifest rejects a mismatched expected digest', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'patch-runtime-integrity-bad-'));
  try {
    fs.writeFileSync(path.join(dir, 'runtime.bin'), 'payload');
    const wrongDigest = `sha256:${'0'.repeat(64)}`;
    assert.throws(() => buildRuntimeIntegrityManifest([
      { file: 'runtime.bin', releaseTag: 'runtime-v1', digest: wrongDigest }
    ], { baseDir: dir }), /digest mismatch/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
