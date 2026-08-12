import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { compileToDirectWasm } from '../src/wasm-direct.js';
import { compileToC99 } from '../src/c99.js';
import { diagnosticFromError, PATCH_DIAGNOSTIC_CODES } from '../src/diagnostics.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cli = path.join(root, 'src', 'cli-entry.js');
const unsupportedSource = `create number score = 1
  
create text name = "Mia"
show score
`;

test('diagnostic normalization recognizes narrow backend at-line Patch source hints', () => {
  const source = 'show 1\n  create text name = "Mia"\n';
  const diagnostic = diagnosticFromError(
    new Error('Direct Wasm backend: create text at line 2 is outside the direct numeric subset.'),
    { phase: 'build', source, entry: '/private/work/main.patch' }
  );
  assert.equal(diagnostic.code, PATCH_DIAGNOSTIC_CODES.BUILD);
  assert.deepEqual(diagnostic.location, { entry: 'main.patch', line: 2, column: 3 });
  assert.match(diagnostic.message, /at line 2/);
});

test('diagnostic normalization does not treat arbitrary generated-tool line numbers as Patch locations', () => {
  const diagnostic = diagnosticFromError(
    new Error('clang: generated.c:17:9: error: expected expression'),
    { phase: 'build', source: 'show 1\n', entry: 'main.patch' }
  );
  assert.equal(diagnostic.location, null);
});

test('real direct-Wasm unsupported errors map back to the original Patch line', () => {
  let error;
  try { compileToDirectWasm(unsupportedSource, { kind: 'console', name: 'BackendLocation' }); }
  catch (caught) { error = caught; }
  assert.ok(error);
  const diagnostic = diagnosticFromError(error, { phase: 'build', source: unsupportedSource, entry: 'main.patch' });
  assert.equal(diagnostic.code, PATCH_DIAGNOSTIC_CODES.BUILD);
  assert.equal(diagnostic.location?.line, 3);
  assert.equal(diagnostic.location?.column, 1);
});

test('C99 conservative backend validation preserves the same Patch source location', () => {
  let error;
  try { compileToC99(unsupportedSource, { kind: 'console', name: 'C99Location' }); }
  catch (caught) { error = caught; }
  assert.ok(error);
  const diagnostic = diagnosticFromError(error, { phase: 'build', source: unsupportedSource, entry: 'main.patch' });
  assert.equal(diagnostic.code, PATCH_DIAGNOSTIC_CODES.BUILD);
  assert.equal(diagnostic.location?.line, 3);
  assert.equal(diagnostic.location?.column, 1);
});

test('CLI build --json exposes direct-Wasm and C99 backend Patch locations', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'patch-backend-location-'));
  try {
    const source = path.join(dir, 'backend-location.patch');
    fs.writeFileSync(source, unsupportedSource, 'utf8');
    for (const target of ['wasm-direct', 'c99']) {
      const result = spawnSync(process.execPath, [cli, 'build', source, '--target', target, '--json'], {
        cwd: root,
        encoding: 'utf8'
      });
      assert.equal(result.status, 2, `${target}\nstdout=${result.stdout}\nstderr=${result.stderr}`);
      assert.equal(result.stderr, '');
      const body = JSON.parse(result.stdout);
      assert.equal(body.command, 'build');
      assert.equal(body.ok, false);
      assert.equal(body.diagnostic.code, PATCH_DIAGNOSTIC_CODES.BUILD);
      assert.deepEqual(body.diagnostic.location, { entry: 'backend-location.patch', line: 3, column: 1 });
    }
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
