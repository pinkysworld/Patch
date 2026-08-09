import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('assurance benchmark CLI writes reproducible JSON and CSV in smoke mode', () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'patch-assurance-benchmark-'));
  try {
    const jsonPath = path.join(temp, 'report.json');
    const csvPath = path.join(temp, 'report.csv');
    const result = spawnSync(process.execPath, [
      'scripts/benchmark-assurance.js',
      '--preset', 'smoke',
      '--iterations', '1',
      '--warmup', '0',
      '--skip-certificate',
      '--out', jsonPath,
      '--csv', csvPath
    ], { cwd: root, encoding: 'utf8' });

    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.equal(fs.existsSync(jsonPath), true);
    assert.equal(fs.existsSync(csvPath), true);

    const report = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
    assert.equal(report.format, 'patch-assurance-evaluation');
    assert.equal(report.version, '0.1');
    assert.equal(report.preset, 'smoke');
    assert.equal(report.iterations, 1);
    assert.equal(report.warmup, 0);
    assert.equal(report.includeCertificateGeneration, false);
    assert.equal(report.scenarios.length, 1);
    assert.equal(report.scenarios[0].parameters.nestedDepth, 1);
    assert.equal(report.scenarios[0].parameters.invocations, 2);
    assert.equal(report.scenarios[0].artifacts.runtimeTransitions, 2);
    assert.equal(report.scenarios[0].artifacts.unsupportedCorrespondences, 0);
    assert.equal(report.scenarios[0].artifacts.leanCertificateBytes, null);
    assert.equal(report.scenarios[0].timings.compileMs.samples.length, 1);
    assert.equal(report.scenarios[0].timings.correspondenceMs.samples.length, 1);

    const csv = fs.readFileSync(csvPath, 'utf8');
    assert.match(csv, /scenario,nested_depth,invocations/);
    assert.match(csv, /smoke,1,2/);
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
});
