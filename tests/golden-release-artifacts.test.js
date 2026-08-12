import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { buildPatchApp } from '../src/bundle.js';
import { compileToWasm } from '../src/wasm.js';
import { compileToDirectWasm } from '../src/wasm-direct.js';
import { compileToC99 } from '../src/c99.js';
import { buildStandaloneWebApp } from '../src/webapp.js';

const contract = JSON.parse(fs.readFileSync('compat/release-golden-v1.json', 'utf8'));
const consoleSource = fs.readFileSync(contract.consoleSource, 'utf8');
const windowSource = fs.readFileSync(contract.windowSource, 'utf8');
const options = { name: contract.project.name, entry: contract.project.entry };

test('logical release golden contract pins current artifact format boundaries', () => {
  assert.equal(contract.schema, 'patch-release-golden-contract');
  assert.equal(contract.version, 1);

  const patchapp = buildPatchApp(consoleSource, { ...options, kind: 'console', targets: ['portable'] });
  assert.equal(patchapp.format, contract.artifacts.patchapp.format);
  assert.equal(patchapp.version, contract.artifacts.patchapp.version);
  assert.equal(patchapp.ir.version, contract.artifacts.patchapp.irVersion);

  const bootstrap = compileToWasm(consoleSource, { ...options, kind: 'console' });
  assert.equal(bootstrap.payload.format, contract.artifacts.bootstrapWasm.format);
  assert.equal(bootstrap.payload.version, contract.artifacts.bootstrapWasm.version);
  assert.equal(bootstrap.payload.ir.version, contract.artifacts.bootstrapWasm.irVersion);
  assert.equal(Buffer.from(bootstrap.module.subarray(0, 8)).toString('hex'), contract.artifacts.bootstrapWasm.magicHex);

  const direct = compileToDirectWasm(consoleSource, { ...options, kind: 'console' });
  assert.equal(direct.metadata.format, contract.artifacts.directWasm.format);
  assert.equal(direct.metadata.version, contract.artifacts.directWasm.version);
  assert.equal(direct.metadata.irVersion, contract.artifacts.directWasm.irVersion);
  assert.equal(Buffer.from(direct.module.subarray(0, 8)).toString('hex'), contract.artifacts.directWasm.magicHex);

  const c99 = compileToC99(consoleSource, { ...options, kind: 'console' });
  assert.equal(c99.metadata.format, contract.artifacts.c99.format);
  assert.equal(c99.metadata.version, contract.artifacts.c99.version);
  assert.equal(c99.metadata.irVersion, contract.artifacts.c99.irVersion);

  const consoleWeb = buildStandaloneWebApp(consoleSource, { ...options, kind: 'console' });
  assert.equal(consoleWeb.metadata.format, contract.artifacts.consoleWeb.format);
  assert.equal(consoleWeb.metadata.version, contract.artifacts.consoleWeb.version);
  assert.equal(consoleWeb.metadata.projectKind, contract.artifacts.consoleWeb.projectKind);
  assert.equal(consoleWeb.metadata.execution, contract.artifacts.consoleWeb.execution);
  assert.equal(consoleWeb.directWasmMetadata.format, contract.artifacts.directWasm.format);

  const windowWeb = buildStandaloneWebApp(windowSource, { ...options, kind: 'window' });
  assert.equal(windowWeb.metadata.format, contract.artifacts.windowWeb.format);
  assert.equal(windowWeb.metadata.version, contract.artifacts.windowWeb.version);
  assert.equal(windowWeb.metadata.projectKind, contract.artifacts.windowWeb.projectKind);
  assert.equal(windowWeb.metadata.irVersion, contract.artifacts.windowWeb.irVersion);
});

test('logical release rebuilds are byte-reproducible across separate Node processes', () => {
  const first = runFingerprint();
  const second = runFingerprint();
  assert.equal(first.status, 0, first.stderr);
  assert.equal(second.status, 0, second.stderr);
  assert.equal(first.stdout, second.stdout);

  const fingerprint = JSON.parse(first.stdout);
  assert.equal(fingerprint.schema, 'patch-logical-release-fingerprint');
  assert.equal(fingerprint.version, 1);
  assert.match(fingerprint.sources.consoleSha256, /^[a-f0-9]{64}$/);
  assert.match(fingerprint.sources.windowSha256, /^[a-f0-9]{64}$/);
  assert.deepEqual(Object.keys(fingerprint.artifacts).sort(), ['bootstrapWasm','c99','consoleWeb','directWasm','patchapp','windowWeb'].sort());
  for (const [name, artifact] of Object.entries(fingerprint.artifacts)) {
    assert.ok(artifact.bytes > 0, name);
    assert.match(artifact.sha256, /^[a-f0-9]{64}$/, name);
  }
});

test('standalone Console Web metadata identifies the wrapper rather than its embedded Wasm engine', () => {
  const built = buildStandaloneWebApp(consoleSource, { ...options, kind: 'console' });
  assert.equal(built.metadata.format, 'patch-standalone-web');
  assert.equal(built.metadata.version, '0.2');
  assert.equal(built.metadata.execution, 'embedded-direct-wasm');
  assert.equal(built.directWasmMetadata.format, 'patch-wasm-direct');
  assert.match(built.html, /"format":"patch-standalone-web"/);
});

function runFingerprint() {
  return spawnSync(process.execPath, ['scripts/logical-release-fingerprint.js'], { encoding: 'utf8' });
}
