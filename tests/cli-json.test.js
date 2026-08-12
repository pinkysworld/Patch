import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { PATCH_CLI_EXIT, PATCH_CLI_RESULT_FORMAT, PATCH_CLI_RESULT_VERSION, createCliResult } from '../src/cli-contract.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const entry = path.join(root, 'src', 'cli-entry.js');

function runCli(args, cwd = root) {
  return spawnSync(process.execPath, [entry, ...args], { cwd, encoding: 'utf8' });
}

function jsonResult(result) {
  assert.doesNotThrow(() => JSON.parse(result.stdout), `stdout was not JSON:\n${result.stdout}\nstderr:\n${result.stderr}`);
  return JSON.parse(result.stdout);
}

function assertEnvelope(result, command, exitCode) {
  const body = jsonResult(result);
  assert.equal(result.status, exitCode, result.stderr);
  assert.equal(body.format, PATCH_CLI_RESULT_FORMAT);
  assert.equal(body.version, PATCH_CLI_RESULT_VERSION);
  assert.equal(body.command, command);
  assert.equal(body.exitCode, exitCode);
  assert.equal(body.ok, exitCode === PATCH_CLI_EXIT.OK);
  return body;
}

test('CLI result contract preserves stable 0 1 2 exit taxonomy', () => {
  assert.deepEqual(PATCH_CLI_EXIT, { OK: 0, USAGE: 1, FAILURE: 2 });
  assert.doesNotThrow(() => createCliResult({ command: 'check', ok: true, exitCode: 0 }));
  assert.throws(() => createCliResult({ command: 'check', ok: true, exitCode: 2 }), /disagree/);
});

test('check --json returns versioned compiler coverage data', () => {
  const source = path.join(root, 'examples', 'range-soundness.patch');
  const result = runCli(['check', source, '--json']);
  const body = assertEnvelope(result, 'check', PATCH_CLI_EXIT.OK);
  assert.equal(body.entry, 'range-soundness.patch');
  assert.equal(body.diagnostic, null);
  assert.equal(body.data.irVersion, '0.10');
  assert.ok(body.data.instructions > 0);
  assert.ok(body.data.semanticBridge.total >= body.data.semanticBridge.supported);
  assert.ok(body.data.formalSource.rangeClaims >= 1);
});

test('--json may appear before the source path for supported commands', () => {
  const source = path.join(root, 'examples', 'score.patch');
  const result = runCli(['check', '--json', source]);
  const body = assertEnvelope(result, 'check', PATCH_CLI_EXIT.OK);
  assert.equal(body.entry, 'score.patch');
});

test('check --json returns stable PATCH diagnostic and exact source location on failure', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'patch-cli-json-bad-'));
  try {
    const source = path.join(dir, 'bad.patch');
    fs.writeFileSync(source, 'create number x = 1\nif true:\n  frobnicate x\n', 'utf8');
    const result = runCli(['check', source, '--json']);
    const body = assertEnvelope(result, 'check', PATCH_CLI_EXIT.FAILURE);
    assert.equal(result.stderr, '');
    assert.equal(body.data, null);
    assert.equal(body.diagnostic.format, 'patch-diagnostic');
    assert.equal(body.diagnostic.code, 'PATCH1001');
    assert.equal(body.diagnostic.phase, 'compiler');
    assert.deepEqual(body.diagnostic.location, { entry: 'bad.patch', line: 3, column: 3 });
    assert.match(body.diagnostic.message, /frobnicate x/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('JSON usage failure preserves exit 1 before source processing', () => {
  const result = runCli(['check', '--json']);
  const body = assertEnvelope(result, 'check', PATCH_CLI_EXIT.USAGE);
  assert.equal(body.entry, null);
  assert.equal(body.diagnostic, null);
  assert.match(body.data.usage, /patch check program\.patch/);
});

test('formal --json exposes all four validation layers', () => {
  const source = path.join(root, 'examples', 'range-soundness.patch');
  const result = runCli(['formal', source, '--json']);
  const body = assertEnvelope(result, 'formal', PATCH_CLI_EXIT.OK);
  for (const key of ['semanticBridge', 'formalSource', 'sourceValidation', 'guardValidation']) assert.ok(body.data[key], key);
  assert.equal(body.data.semanticBridge.summary.mismatches, 0);
  assert.equal(body.data.sourceValidation.summary.mismatches, 0);
  assert.equal(body.data.guardValidation.summary.mismatches, 0);
});

test('certify --json writes the same Lean artifact and reports evidence metadata', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'patch-cli-json-cert-'));
  try {
    const source = path.join(root, 'examples', 'range-soundness.patch');
    const out = path.join(dir, 'Range.lean');
    const result = runCli(['certify', source, '--out', out, '--json']);
    const body = assertEnvelope(result, 'certify', PATCH_CLI_EXIT.OK);
    assert.equal(body.data.artifact.path, out);
    assert.equal(body.data.artifact.kind, 'lean-certificate');
    assert.equal(fs.existsSync(out), true);
    assert.match(fs.readFileSync(out, 'utf8'), /PatchRange/);
    assert.match(body.data.sourceSha256, /^[a-f0-9]{64}$/);
    assert.ok(Array.isArray(body.data.certifiedRecipes));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('build --json writes a C99 artifact without embedding artifact bytes in stdout', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'patch-cli-json-build-'));
  try {
    const source = path.join(root, 'examples', 'direct-wasm-recipes.patch');
    const out = path.join(dir, 'Direct.c');
    const result = runCli(['build', '--json', source, '--target', 'c99', '--out', out]);
    const body = assertEnvelope(result, 'build', PATCH_CLI_EXIT.OK);
    assert.equal(body.data.artifact.path, out);
    assert.equal(body.data.artifact.kind, 'console');
    assert.equal(body.data.artifact.target, 'c99');
    assert.equal(body.data.artifact.format, 'patch-c99');
    assert.equal(fs.existsSync(out), true);
    assert.match(fs.readFileSync(out, 'utf8'), /Generated by Patch portable C99 backend/);
    assert.doesNotMatch(result.stdout, /patch_state_/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('build --json classifies an unknown target with PATCH2001 and exit 2', () => {
  const source = path.join(root, 'examples', 'score.patch');
  const result = runCli(['build', source, '--target', 'imaginary', '--json']);
  const body = assertEnvelope(result, 'build', PATCH_CLI_EXIT.FAILURE);
  assert.equal(body.diagnostic.code, 'PATCH2001');
  assert.equal(body.diagnostic.phase, 'build');
});

test('human-readable check remains the default without --json', () => {
  const source = path.join(root, 'examples', 'score.patch');
  const result = runCli(['check', source]);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /^Patch check passed:/);
  assert.throws(() => JSON.parse(result.stdout));
});

test('legacy run ignores trailing unrelated options exactly as before', () => {
  const source = path.join(root, 'examples', 'score.patch');
  const result = runCli(['run', source, '--json']);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /11/);
});
