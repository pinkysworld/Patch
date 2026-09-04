import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { listDesignerControls, listDesignerWindows } from '../src/designer.js';
import {
  STUDIO_STRESS_FORMS,
  STUDIO_STRESS_CONTROLS_PER_FORM,
  buildStudioLargeProjectFixture,
  runStudioLargeProjectBenchmark,
  runStudioMainThreadBenchmark
} from '../scripts/benchmark-studio-large-project.js';

test('Studio large-project fixture is the backlog 10-Form / 200-control workload', () => {
  const source = buildStudioLargeProjectFixture();
  const windows = listDesignerWindows(source);
  const controls = listDesignerControls(source);
  assert.equal(STUDIO_STRESS_FORMS, 10);
  assert.equal(STUDIO_STRESS_CONTROLS_PER_FORM, 20);
  assert.equal(windows.length, 10);
  assert.equal(controls.length, 200);
  assert.equal(new Set(windows.map(window => window.id).map(Boolean)).size, 10);
  assert.equal(new Set(controls.filter(control => control.id).map(control => control.id)).size, 100);
});

test('Studio benchmark reports deterministic workload metadata without a flaky time gate', () => {
  const result = runStudioLargeProjectBenchmark({ iterations: 2, warmup: 0 });
  assert.equal(result.contract, 'patch-studio-large-project-benchmark-0.1');
  assert.equal(result.forms, 10);
  assert.equal(result.controls, 200);
  assert.equal(result.iterations, 2);
  assert.equal(result.warmup, 0);
  assert.ok(result.sourceBytes > 10_000);
  for (const field of ['medianMs', 'p95Ms', 'maxMs']) {
    assert.equal(Number.isFinite(result[field]), true, field);
    assert.ok(result[field] >= 0, field);
  }
});

test('Studio main-thread benchmark separates parse compile and design-model cost across representative projects', () => {
  const result = runStudioMainThreadBenchmark({ iterations: 1, warmup: 0 });
  assert.equal(result.contract, 'patch-studio-main-thread-benchmark-0.1');
  assert.deepEqual(result.cases.map(entry => entry.name), [
    'counter-window',
    'workshop-desk',
    'scale-10x20'
  ]);
  assert.deepEqual(result.cases.map(entry => entry.forms), [1, 7, 10]);
  assert.equal(result.cases[2].controls, 200);

  for (const benchmarkCase of result.cases) {
    assert.ok(benchmarkCase.sourceBytes > 0);
    assert.ok(benchmarkCase.sourceLines > 0);
    for (const phase of ['parse', 'compile', 'designModel']) {
      const measurement = benchmarkCase.phases[phase];
      assert.equal(measurement.samples, 1);
      for (const field of ['minMs', 'medianMs', 'p95Ms', 'meanMs', 'maxMs']) {
        assert.equal(Number.isFinite(measurement[field]), true, `${benchmarkCase.name}.${phase}.${field}`);
        assert.ok(measurement[field] >= 0, `${benchmarkCase.name}.${phase}.${field}`);
      }
    }
  }
});

test('Studio benchmark CLI is syntax-valid, machine-readable and exposed through npm', () => {
  execFileSync(process.execPath, ['--check', 'scripts/benchmark-studio-large-project.js'], { stdio: 'pipe' });
  const output = execFileSync(process.execPath, [
    'scripts/benchmark-studio-large-project.js', '--iterations', '1', '--warmup', '0'
  ], { encoding: 'utf8' });
  const parsed = JSON.parse(output);
  assert.equal(parsed.forms, 10);
  assert.equal(parsed.controls, 200);
  assert.equal(parsed.iterations, 1);

  const phaseOutput = execFileSync(process.execPath, [
    'scripts/benchmark-studio-large-project.js', '--main-thread', '--iterations', '1', '--warmup', '0'
  ], { encoding: 'utf8' });
  const phaseReport = JSON.parse(phaseOutput);
  assert.equal(phaseReport.contract, 'patch-studio-main-thread-benchmark-0.1');
  assert.equal(phaseReport.cases.length, 3);
  assert.ok(phaseReport.cases.every(entry => entry.phases.parse && entry.phases.compile && entry.phases.designModel));

  const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  assert.equal(pkg.scripts?.['benchmark:studio'], 'node scripts/benchmark-studio-large-project.js');
});
