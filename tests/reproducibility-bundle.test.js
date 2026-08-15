import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { buildReproducibilityBundle, verifyReproducibilityBundle } from '../scripts/reproducibility-bundle.js';

const COMMIT = '0123456789abcdef0123456789abcdef01234567';

test('reproducibility bundle captures tracked source plus explicit generated evidence', () => {
  const root = makeRepo();
  try {
    fs.mkdirSync(path.join(root, 'generated'), { recursive: true });
    fs.writeFileSync(path.join(root, 'generated', 'evidence.json'), '{"ok":true}\n');
    fs.writeFileSync(path.join(root, 'untracked.txt'), 'must stay out\n');

    const { out, manifest } = buildReproducibilityBundle({
      root,
      out: 'reproducibility/bundle',
      commit: COMMIT,
      generated: ['generated/evidence.json']
    });

    assert.equal(manifest.schema, 'patch-reproducibility-bundle');
    assert.equal(manifest.schemaVersion, 1);
    assert.equal(manifest.patchVersion, '0.2.0-beta.34');
    assert.equal(manifest.sourceCommit, COMMIT);
    assert.deepEqual(manifest.files.map(entry => entry.path), [
      'source/a.txt',
      'source/generated/evidence.json',
      'source/package.json'
    ]);
    assert.ok(fs.existsSync(path.join(out, 'environment.json')));
    assert.ok(fs.existsSync(path.join(out, 'REPRODUCE.txt')));
    assert.equal(fs.existsSync(path.join(out, 'source', 'untracked.txt')), false);

    const verified = verifyReproducibilityBundle({ bundle: out, version: '0.2.0-beta.34', commit: COMMIT });
    assert.equal(verified.fileCount, 3);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('reproducibility bundle verification fails on tampered copied evidence', () => {
  const root = makeRepo();
  try {
    const { out } = buildReproducibilityBundle({ root, out: 'reproducibility/bundle', commit: COMMIT });
    fs.appendFileSync(path.join(out, 'source', 'a.txt'), 'tamper\n');
    assert.throws(() => verifyReproducibilityBundle({ bundle: out }), /(size|SHA-256) mismatch/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('reproducibility bundle verification binds expected version and commit', () => {
  const root = makeRepo();
  try {
    const { out } = buildReproducibilityBundle({ root, out: 'reproducibility/bundle', commit: COMMIT });
    assert.throws(() => verifyReproducibilityBundle({ bundle: out, version: '0.2.0-beta.999' }), /version mismatch/);
    assert.throws(() => verifyReproducibilityBundle({ bundle: out, commit: 'f'.repeat(40) }), /commit mismatch/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

function makeRepo() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'patch-repro-bundle-'));
  fs.writeFileSync(path.join(root, 'package.json'), '{"version":"0.2.0-beta.34"}\n');
  fs.writeFileSync(path.join(root, 'a.txt'), 'alpha\n');
  execFileSync('git', ['init', '-q'], { cwd: root });
  execFileSync('git', ['add', 'package.json', 'a.txt'], { cwd: root });
  return root;
}
