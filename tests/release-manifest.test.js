import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { buildReleaseManifest, formatSha256Sums, writeReleaseManifest } from '../scripts/release-manifest.js';

test('release manifest is deterministic, sorted and content-addressed', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'patch-release-manifest-'));
  try {
    fs.writeFileSync(path.join(dir, 'b.bin'), Buffer.from([2, 3, 4]));
    fs.writeFileSync(path.join(dir, 'a.txt'), 'Patch\n');
    const first = buildReleaseManifest(['b.bin', 'a.txt'], { baseDir: dir, commit: 'abc123' });
    const second = buildReleaseManifest(['a.txt', 'b.bin'], { baseDir: dir, commit: 'abc123' });
    assert.deepEqual(first, second);
    assert.deepEqual(first.artifacts.map(item => item.path), ['a.txt', 'b.bin']);
    assert.equal(first.artifacts[0].sha256, crypto.createHash('sha256').update('Patch\n').digest('hex'));
    assert.match(formatSha256Sums(first), /^[a-f0-9]{64}  a\.txt\n[a-f0-9]{64}  b\.bin\n$/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('release manifest writer emits JSON and SHA256SUMS', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'patch-release-write-'));
  try {
    fs.mkdirSync(path.join(dir, 'artifacts'));
    fs.writeFileSync(path.join(dir, 'artifacts', 'app.bin'), 'payload');
    writeReleaseManifest(['artifacts'], { baseDir: dir, outDir: path.join(dir, 'meta'), commit: null });
    const json = JSON.parse(fs.readFileSync(path.join(dir, 'meta', 'release-manifest.json'), 'utf8'));
    assert.equal(json.schema, 'patch-release-manifest');
    assert.equal(json.schemaVersion, 1);
    assert.equal(json.artifacts.length, 1);
    assert.equal(json.artifacts[0].path, 'artifacts/app.bin');
    assert.match(fs.readFileSync(path.join(dir, 'meta', 'SHA256SUMS.txt'), 'utf8'), /artifacts\/app\.bin/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('release manifest rejects missing artifacts', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'patch-release-missing-'));
  try {
    assert.throws(() => buildReleaseManifest(['missing.bin'], { baseDir: dir }), /does not exist/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
