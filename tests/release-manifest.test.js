import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { buildReleaseManifest, formatSha256Sums, writeReleaseManifest } from '../scripts/release-manifest.js';
import { verifyRelease } from '../scripts/verify-release.js';

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

test('release verifier binds flat published asset names to checksums version and exact source commit', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'patch-release-verify-'));
  try {
    const dist = path.join(dir, 'release-dist');
    const meta = path.join(dir, 'release-meta');
    fs.mkdirSync(dist);
    fs.writeFileSync(path.join(dist, 'app.bin'), 'payload');
    writeReleaseManifest(['.'], { baseDir: dist, outDir: meta, commit: 'deadbeef' });
    const verified = verifyRelease({ baseDir: dist, metaDir: '../release-meta', commit: 'deadbeef', version: '0.2.0-beta.33' });
    assert.equal(verified.commit, 'deadbeef');
    assert.equal(verified.patchVersion, '0.2.0-beta.33');
    assert.deepEqual(verified.artifacts.map(item => item.path), ['app.bin']);
    assert.match(fs.readFileSync(path.join(meta, 'SHA256SUMS.txt'), 'utf8'), /^[a-f0-9]{64}  app\.bin\n$/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('release verifier rejects changed bytes commit drift and checksum drift', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'patch-release-tamper-'));
  try {
    const dist = path.join(dir, 'release-dist');
    const meta = path.join(dir, 'release-meta');
    fs.mkdirSync(dist);
    const artifact = path.join(dist, 'app.bin');
    fs.writeFileSync(artifact, 'payload');
    writeReleaseManifest(['.'], { baseDir: dist, outDir: meta, commit: 'deadbeef' });
    const options = { baseDir: dist, metaDir: '../release-meta', version: '0.2.0-beta.33' };
    assert.throws(() => verifyRelease({ ...options, commit: 'other' }), /commit/);
    fs.writeFileSync(artifact, 'tampered');
    assert.throws(() => verifyRelease({ ...options, commit: 'deadbeef' }), /(size|hash) mismatch/);
    fs.writeFileSync(artifact, 'payload');
    fs.writeFileSync(path.join(meta, 'SHA256SUMS.txt'), `${'0'.repeat(64)}  app.bin\n`);
    assert.throws(() => verifyRelease({ ...options, commit: 'deadbeef' }), /SHA256SUMS mismatch/);
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
