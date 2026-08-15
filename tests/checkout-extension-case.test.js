import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { evaluateSecurityCase } from '../src/security-case-study.js';
import { compileToDirectWasm, runDirectWasm } from '../src/wasm-direct.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const caseRoot = path.join(root, 'case-studies', 'checkout-extension');
const scenario = JSON.parse(fs.readFileSync(path.join(caseRoot, 'scenario.json'), 'utf8'));

test('safe checkout extension compiles, executes and carries both helper effects into protected authority', async () => {
  const source = fs.readFileSync(path.join(caseRoot, scenario.safe.file), 'utf8');
  const analysis = evaluateSecurityCase(source, { name: 'checkout-extension-safe' });
  assert.equal(analysis.patch.accepted, true);
  assert.equal(analysis.coarseTargetWrite.accepted, true);

  const effects = analysis.patch.signatures.checkout_extension.changes;
  const discount = effects.find(effect => effect.target === 'balance');
  const reward = effects.find(effect => effect.target === 'points');
  assert.ok(discount);
  assert.ok(reward);
  assert.equal(discount.operation, 'decrease');
  assert.equal(discount.amountRange?.max ?? discount.amount, 25);
  assert.match(discount.via ?? '', /apply_discount/);
  assert.equal(reward.operation, 'increase');
  assert.equal(reward.amountRange?.max ?? reward.amount, 10);
  assert.match(reward.via ?? '', /grant_loyalty/);

  const compiled = compileToDirectWasm(source, { name: 'CheckoutExtensionSafe', kind: 'console' });
  const execution = await runDirectWasm(compiled.module, compiled.metadata);
  assert.equal(execution.state.balance, 80);
  assert.equal(execution.state.points, 8);
  assert.equal(execution.state.cashback, 0);
  assert.deepEqual(execution.trace.map(item => [item.target, item.before, item.after]), [
    ['balance', 100, 80],
    ['points', 0, 8]
  ]);
});

test('checkout extension escalation variants have the expected semantic-authority decisions', () => {
  const observed = scenario.variants.map(variant => {
    const source = fs.readFileSync(path.join(caseRoot, variant.file), 'utf8');
    const result = evaluateSecurityCase(source, { name: `checkout-${variant.id}` });
    assert.equal(result.patch.accepted, variant.patchExpected === 'accept', variant.id);
    assert.equal(result.coarseTargetWrite.accepted, variant.coarseWriteExpected, variant.id);
    if (variant.errorContains) assert.match(result.patch.error?.message ?? '', new RegExp(escapeRegex(variant.errorContains)), variant.id);
    return [variant.id, result.patch.accepted, result.coarseTargetWrite.accepted];
  });

  assert.deepEqual(observed, [
    ['reward-escalation', false, true],
    ['direction-escalation', false, true],
    ['target-escalation', false, false]
  ]);
});

test('checkout extension evaluator emits one reproducibly timestamped application-level report', () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'patch-checkout-extension-'));
  try {
    const jsonPath = path.join(temp, 'report.json');
    const mdPath = path.join(temp, 'report.md');
    const result = spawnSync(process.execPath, [
      'scripts/evaluate-checkout-extension.js',
      '--out', jsonPath,
      '--markdown', mdPath
    ], {
      cwd: root,
      encoding: 'utf8',
      env: { ...process.env, SOURCE_DATE_EPOCH: '1700000000' }
    });
    assert.equal(result.status, 0, result.stderr || result.stdout);

    const report = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
    assert.equal(report.format, 'patch-realistic-extension-case-report');
    assert.equal(report.generatedAt, '2023-11-14T22:13:20.000Z');
    assert.equal(report.scenario, 'checkout-loyalty-extension');
    assert.deepEqual(report.safe.finalState, { balance: 80, points: 8, cashback: 0 });
    assert.equal(report.summary.variants, 3);
    assert.equal(report.summary.patchRejectedVariants, 3);
    assert.equal(report.summary.coarseAcceptedVariants, 2);
    assert.equal(report.summary.semanticAuthorityDifferentialRejects, 2);
    assert.equal(report.summary.bothReject, 1);
    assert.equal(report.safe.runtimeTrace.length, 2);

    const markdown = fs.readFileSync(mdPath, 'utf8');
    assert.match(markdown, /Checkout loyalty extension case/);
    assert.match(markdown, /reward-escalation/);
    assert.match(markdown, /internal ablation/);
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
});

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
