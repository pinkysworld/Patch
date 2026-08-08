import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const entry = path.join(root, 'src', 'cli-entry.js');

test('CLI dispatcher preserves existing run behavior', () => {
  const result = spawnSync(process.execPath, [entry, 'run', path.join(root, 'examples', 'score.patch')], {
    cwd: root,
    encoding: 'utf8'
  });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /11/);
});

test('CLI dispatcher generates a Lean call-composition certificate', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'patch-call-cli-'));
  try {
    const out = path.join(dir, 'Calls.lean');
    const result = spawnSync(process.execPath, [entry, 'call-certify', path.join(root, 'examples', 'formal-calls.patch'), '--out', out], {
      cwd: root,
      encoding: 'utf8'
    });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(fs.existsSync(out), true);
    const lean = fs.readFileSync(out, 'utf8');
    assert.match(lean, /checkRecipeEnv callEnv = true/);
    assert.match(result.stdout, /abstract call composition/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('CLI dispatcher rejects cyclic formal call environments', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'patch-call-cli-bad-'));
  try {
    const source = path.join(dir, 'cycle.patch');
    fs.writeFileSync(source, `make first(amount number 0..5):\n  do second(amount)\n\nmake second(amount number 0..5):\n  do first(amount)\n`, 'utf8');
    const result = spawnSync(process.execPath, [entry, 'call-certify', source], {
      cwd: root,
      encoding: 'utf8'
    });
    assert.equal(result.status, 2);
    assert.match(result.stderr, /recursive\/cyclic call graph/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
