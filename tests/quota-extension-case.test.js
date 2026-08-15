import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { evaluateRealisticExtensionCase } from '../src/realistic-extension-case.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const caseRoot = path.join(root, 'case-studies', 'quota-extension');
const scenario = JSON.parse(fs.readFileSync(path.join(caseRoot, 'scenario.json'), 'utf8'));

test('safe usage quota extension executes and imports all bounded helper effects', async () => {
  const report = await evaluateRealisticExtensionCase(caseRoot, { wasmName: 'UsageQuotaExtensionSafe' });
  assert.equal(report.scenario, 'usage-quota-extension');
  assert.deepEqual(report.safe.finalState, { used: 35, remaining: 85, bonus: 5, admin_credit: 0 });
  assert.deepEqual(report.safe.runtimeTrace.map(item => [item.target, item.before, item.after]), [
    ['used', 20, 35],
    ['remaining', 100, 85],
    ['bonus', 0, 5]
  ]);

  const effects = report.safe.protectedSignature.changes;
  const used = effects.find(effect => effect.target === 'used');
  const remaining = effects.find(effect => effect.target === 'remaining');
  const bonus = effects.find(effect => effect.target === 'bonus');
  assert.equal(used.operation, 'increase');
  assert.equal(used.amountRange?.max ?? used.amount, 30);
  assert.match(used.via ?? '', /record_usage/);
  assert.equal(remaining.operation, 'decrease');
  assert.equal(remaining.amountRange?.max ?? remaining.amount, 30);
  assert.match(remaining.via ?? '', /record_usage/);
  assert.equal(bonus.operation, 'increase');
  assert.equal(bonus.amountRange?.max ?? bonus.amount, 10);
  assert.match(bonus.via ?? '', /grant_bonus/);
});

test('usage quota escalation variants separate semantic authority from target-only authority', async () => {
  const report = await evaluateRealisticExtensionCase(caseRoot);
  assert.deepEqual(report.variants.map(item => [item.id, item.patchAccepted, item.coarseWriteAccepted]), [
    ['magnitude-escalation', false, true],
    ['direction-escalation', false, true],
    ['target-escalation', false, false]
  ]);
  assert.equal(report.summary.variants, 3);
  assert.equal(report.summary.patchRejectedVariants, 3);
  assert.equal(report.summary.semanticAuthorityDifferentialRejects, 2);
  assert.equal(report.summary.bothReject, 1);
});

test('generic extension evaluator emits reproducible quota report', () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'patch-quota-extension-'));
  try {
    const jsonPath = path.join(temp, 'report.json');
    const mdPath = path.join(temp, 'report.md');
    const result = spawnSync(process.execPath, [
      'scripts/evaluate-extension-case.js', '--case', 'quota-extension', '--out', jsonPath, '--markdown', mdPath
    ], {
      cwd: root,
      encoding: 'utf8',
      env: { ...process.env, SOURCE_DATE_EPOCH: '1700000000' }
    });
    assert.equal(result.status, 0, result.stderr || result.stdout);
    const report = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
    assert.equal(report.version, '0.2');
    assert.equal(report.generatedAt, '2023-11-14T22:13:20.000Z');
    assert.deepEqual(report.safe.finalState, { used: 35, remaining: 85, bonus: 5, admin_credit: 0 });
    const markdown = fs.readFileSync(mdPath, 'utf8');
    assert.match(markdown, /Usage quota extension case/);
    assert.match(markdown, /magnitude-escalation/);
    assert.match(markdown, /internal ablation/);
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
});

assert.equal(scenario.variants.length, 3);
