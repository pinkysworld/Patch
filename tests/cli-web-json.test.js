import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const entry = path.resolve('src/cli-entry.js');

test('build web --json reports the standalone Web artifact rather than embedded direct Wasm', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'patch-web-json-'));
  try {
    const out = path.join(dir, 'Golden.html');
    const source = path.resolve('compat/source-0.2/core-number.patch');
    const result = spawnSync(process.execPath, [entry, 'build', source, '--target', 'web', '--out', out, '--json'], { encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    const body = JSON.parse(result.stdout);
    assert.equal(body.format, 'patch-cli-result');
    assert.equal(body.command, 'build');
    assert.equal(body.ok, true);
    assert.equal(body.data.artifact.target, 'web');
    assert.equal(body.data.artifact.format, 'patch-standalone-web');
    assert.equal(body.data.artifact.version, '0.2');
    assert.equal(body.data.metadata.directWasmVersion, '0.4-trace');
    assert.equal(body.data.metadata.execution, 'embedded-direct-wasm');
    assert.equal(fs.existsSync(out), true);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
