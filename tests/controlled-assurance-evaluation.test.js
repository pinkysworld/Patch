import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

const repo = path.resolve(new URL('..', import.meta.url).pathname);

test('process-isolated assurance runner preserves raw runs and robust aggregate statistics', () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'patch-controlled-eval-'));
  const outDir = path.join(temp, 'results');
  try {
    const result = spawnSync(process.execPath, [
      'scripts/run-controlled-assurance.js',
      '--preset', 'smoke',
      '--runs', '2',
      '--iterations', '1',
      '--warmup', '0',
      '--measurement-class', 'hosted-ci',
      '--out-dir', outDir,
      '--skip-certificate'
    ], {
      cwd: repo,
      encoding: 'utf8',
      env: { ...process.env, PATCH_EVAL_COMMIT: 'a'.repeat(40) },
      maxBuffer: 32 * 1024 * 1024
    });

    assert.equal(result.status, 0, result.stderr || result.stdout);
    const summary = JSON.parse(fs.readFileSync(path.join(outDir, 'controlled-summary.json'), 'utf8'));
    assert.equal(summary.format, 'patch-controlled-assurance-evaluation');
    assert.equal(summary.version, '0.1');
    assert.equal(summary.sourceCommit, 'a'.repeat(40));
    assert.equal(summary.measurementClass, 'hosted-ci');
    assert.match(summary.claimBoundary, /non-publication timing evidence/);
    assert.equal(summary.runs, 2);
    assert.equal(summary.rawRuns.length, 2);
    assert.equal(summary.protocolChecks.independentProcesses, true);
    assert.equal(summary.protocolChecks.stableEnvironmentIdentity, true);
    assert.match(summary.environmentFingerprintSha256, /^[0-9a-f]{64}$/);
    assert.equal(summary.aggregates.length, 1);

    const scenario = summary.aggregates[0];
    for (const phase of ['compileMs', 'executeMs', 'validateMs', 'correspondenceMs']) {
      const stats = scenario.acrossProcessRunMedians[phase];
      assert.equal(stats.count, 2);
      assert.equal(stats.samples.length, 2);
      for (const field of ['min', 'q1', 'median', 'q3', 'p95', 'max', 'mean', 'mad', 'iqr']) {
        assert.equal(Number.isFinite(stats[field]), true, `${phase}.${field}`);
      }
    }
    assert.equal(scenario.acrossProcessRunMedians.certificateGenerationMs, undefined);

    assert.equal(fs.existsSync(path.join(outDir, 'raw', 'run-01.json')), true);
    assert.equal(fs.existsSync(path.join(outDir, 'raw', 'run-02.json')), true);
    assert.equal(fs.existsSync(path.join(outDir, 'controlled-summary.csv')), true);
    const sums = fs.readFileSync(path.join(outDir, 'SHA256SUMS'), 'utf8');
    assert.match(sums, /controlled-summary\.json/);
    assert.match(sums, /raw\/run-01\.json/);
    assert.match(sums, /raw\/run-02\.csv/);
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
});

test('GitHub-hosted timing cannot be labelled controlled paper-quality measurement', () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'patch-controlled-eval-reject-'));
  try {
    const result = spawnSync(process.execPath, [
      'scripts/run-controlled-assurance.js',
      '--preset', 'smoke',
      '--runs', '1',
      '--iterations', '1',
      '--warmup', '0',
      '--measurement-class', 'controlled',
      '--machine-id', 'test-machine',
      '--label', 'test-run',
      '--out-dir', path.join(temp, 'results'),
      '--skip-certificate'
    ], {
      cwd: repo,
      encoding: 'utf8',
      env: { ...process.env, GITHUB_ACTIONS: 'true', PATCH_EVAL_COMMIT: 'b'.repeat(40) }
    });

    assert.notEqual(result.status, 0);
    assert.match(`${result.stderr}\n${result.stdout}`, /Refusing to label GitHub-hosted Actions timing as controlled/);
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
});
