import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { evaluateSecurityCase, PATCH_SECURITY_CASE_STUDY_VERSION } from '../src/security-case-study.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const caseRoot = path.join(root, 'case-studies', 'security');
const manifest = JSON.parse(fs.readFileSync(path.join(caseRoot, 'cases.json'), 'utf8'));

test('security case manifest matches Patch and coarse target-write decisions', () => {
  const results = manifest.cases.map(entry => {
    const source = fs.readFileSync(path.join(caseRoot, entry.file), 'utf8');
    const result = evaluateSecurityCase(source, { name: entry.id });
    assert.equal(result.version, PATCH_SECURITY_CASE_STUDY_VERSION);
    assert.equal(result.patch.accepted, entry.patchExpected === 'accept', entry.id);
    assert.equal(result.coarseTargetWrite.accepted, entry.coarseWriteExpected, entry.id);
    if (entry.errorContains) assert.match(result.patch.error?.message ?? '', new RegExp(escapeRegex(entry.errorContains)), entry.id);
    return { entry, result };
  });

  const differential = results.filter(({ result }) => result.coarseTargetWrite.accepted && !result.patch.accepted);
  assert.deepEqual(differential.map(({ entry }) => entry.id), [
    'loyalty-over-limit',
    'wallet-direction-escalation',
    'campaign-transitive-escalation',
    'dynamic-unbounded'
  ]);

  const targetEscape = results.find(({ entry }) => entry.id === 'target-escape');
  assert.equal(targetEscape.result.patch.accepted, false);
  assert.equal(targetEscape.result.coarseTargetWrite.accepted, false);
});

test('transitive helper effects are visible to both the coarse target baseline and Patch signature analysis', () => {
  const safe = fs.readFileSync(path.join(caseRoot, 'campaign-transitive-safe.patch'), 'utf8');
  const result = evaluateSecurityCase(safe, { name: 'campaign-transitive-safe' });
  assert.equal(result.patch.accepted, true);
  assert.equal(result.coarseTargetWrite.accepted, true);
  assert.deepEqual(result.coarseTargetWrite.policies[0].reachableTargets, ['points']);
  assert.equal(result.patch.signatures.campaign.changes[0].operation, 'increase');
  assert.equal(result.patch.signatures.campaign.changes[0].amount, 8);
  assert.match(result.patch.signatures.campaign.changes[0].via ?? '', /grant_small/);
});

test('security evaluator CLI writes JSON, CSV and markdown evidence', () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'patch-security-cases-'));
  try {
    const jsonPath = path.join(temp, 'report.json');
    const csvPath = path.join(temp, 'report.csv');
    const mdPath = path.join(temp, 'table.md');
    const result = spawnSync(process.execPath, [
      'scripts/evaluate-security-cases.js',
      '--out', jsonPath,
      '--csv', csvPath,
      '--markdown', mdPath
    ], { cwd: root, encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr || result.stdout);

    const report = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
    assert.equal(report.format, 'patch-security-case-study-report');
    assert.equal(report.summary.cases, 8);
    assert.equal(report.summary.patchAccepts, 3);
    assert.equal(report.summary.patchRejects, 5);
    assert.equal(report.summary.coarseAccepts, 7);
    assert.equal(report.summary.semanticAuthorityDifferentialRejects, 4);
    assert.equal(report.summary.bothReject, 1);

    assert.match(fs.readFileSync(csvPath, 'utf8'), /loyalty-over-limit,magnitude-control,false,true/);
    const markdown = fs.readFileSync(mdPath, 'utf8');
    assert.match(markdown, /semantic authority adds rejection/);
    assert.match(markdown, /internal ablation/);
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
});

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
