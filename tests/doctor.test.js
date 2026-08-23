import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { collectDoctorReport, formatDoctorReport } from '../src/doctor.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('doctor reports a stable machine-readable schema', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'patch-doctor-test-'));
  try {
    const report = collectDoctorReport({ cwd: dir });
    assert.equal(report.schema, 'patch-doctor');
    assert.equal(report.schemaVersion, 1);
    assert.ok(['ok', 'warn'].includes(report.status));
    assert.equal(report.cwd, dir);
    assert.ok(report.checks.some(item => item.id === 'node-version' && item.status === 'ok'));
    assert.ok(report.checks.some(item => item.id === 'workspace-writable' && item.status === 'ok'));
    assert.match(formatDoctorReport(report), /Patch doctor/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('doctor fails the report when the Node runtime is below the supported floor', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'patch-doctor-old-node-'));
  try {
    const report = collectDoctorReport({ cwd: dir, nodeVersion: '18.20.0' });
    assert.equal(report.status, 'error');
    assert.equal(report.checks.find(item => item.id === 'node-version')?.status, 'error');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('doctor self-checks interpreter, direct Wasm and C99 plus Thing fail-closed', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'patch-doctor-compilers-'));
  try {
    const report = collectDoctorReport({ cwd: dir });
    const compilers = report.checks.find(item => item.id === 'compiler-backends');
    assert.ok(compilers, 'compiler-backends check must be present');
    assert.equal(compilers.status, 'ok', compilers.detail);
    assert.match(compilers.detail, /Interpreter, direct Wasm and C99 numeric subset match/);
    assert.match(compilers.detail, /Things fail closed on Wasm\/C99/);
    const toolchain = report.checks.find(item => item.id === 'c99-toolchain');
    if (toolchain?.status === 'ok' && process.platform !== 'win32') {
      assert.match(compilers.detail, /host C99 compiled and printed 2/);
    }
    assert.match(formatDoctorReport(report), /compiler-backends: Interpreter, direct Wasm and C99 numeric subset match/);
    assert.ok(report.checks.some(item => item.id === 'c99-toolchain'), 'environment c99-toolchain probe remains separate from the backend self-check');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('CLI doctor --json exposes the compiler-backends self-check', () => {
  const result = spawnSync(process.execPath, [path.join(root, 'src', 'cli-entry.js'), 'doctor', '--json'], {
    cwd: root,
    encoding: 'utf8'
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const report = JSON.parse(result.stdout);
  assert.equal(report.schema, 'patch-doctor');
  const compilers = report.checks.find(item => item.id === 'compiler-backends');
  assert.equal(compilers?.status, 'ok', compilers?.detail);
});
