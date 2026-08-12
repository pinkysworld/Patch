import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { collectDoctorReport, formatDoctorReport } from '../src/doctor.js';

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
