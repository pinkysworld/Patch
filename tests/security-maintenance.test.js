import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const dependabot = fs.readFileSync('.github/dependabot.yml', 'utf8');
const codeql = fs.readFileSync('.github/workflows/codeql.yml', 'utf8');
const maintenance = fs.readFileSync('docs/SECURITY_MAINTENANCE.md', 'utf8');
const threatModel = fs.readFileSync('docs/THREAT_MODEL.md', 'utf8');
const checklist = fs.readFileSync('docs/SECURITY_REVIEW_CHECKLIST.md', 'utf8');
const leanBootstrap = fs.readFileSync('scripts/install-pinned-lean.sh', 'utf8');

const leanWorkflows = [
  '.github/workflows/formal.yml',
  '.github/workflows/assurance-evaluation.yml'
].map(file => [file, fs.readFileSync(file, 'utf8')]);

test('repository security policy checker is valid and passes current workflows', () => {
  execFileSync(process.execPath, ['--check', 'scripts/security-policy-check.js'], { stdio: 'pipe' });
  execFileSync(process.execPath, ['scripts/security-policy-check.js'], { stdio: 'pipe' });
});

test('Dependabot monitors GitHub Actions weekly', () => {
  assert.match(dependabot, /^version: 2/m);
  assert.match(dependabot, /package-ecosystem: github-actions/);
  assert.match(dependabot, /directory: \//);
  assert.match(dependabot, /interval: weekly/);
});

test('CodeQL uses least-privilege JavaScript security scanning on v4 actions', () => {
  assert.match(codeql, /security-events: write/);
  assert.match(codeql, /contents: read/);
  assert.match(codeql, /actions: read/);
  assert.match(codeql, /github\/codeql-action\/init@v4/);
  assert.match(codeql, /github\/codeql-action\/analyze@v4/);
  assert.match(codeql, /languages: javascript-typescript/);
  assert.match(codeql, /queries: security-extended/);
  assert.match(codeql, /schedule:/);
  assert.match(codeql, /github\.event\.pull_request\.draft == false/);
  assert.doesNotMatch(codeql, /pull_request_target/);
});

test('Lean bootstrap downloads before execution and every active formal workflow reuses it', () => {
  assert.match(leanBootstrap, /--output "\$INSTALLER"/);
  assert.match(leanBootstrap, /test -s "\$INSTALLER"/);
  assert.match(leanBootstrap, /sh "\$INSTALLER" -y --default-toolchain none/);
  assert.match(leanBootstrap, /leanprover\/lean4:v4\.30\.0/);
  assert.match(leanBootstrap, /elan" run "\$LEAN_TOOLCHAIN" lean --version/);
  assert.doesNotMatch(leanBootstrap, /curl[^\n|]*\|\s*(?:sh|bash)/i);
  for (const [file, workflow] of leanWorkflows) {
    assert.ok(workflow.includes('bash scripts/install-pinned-lean.sh'), file);
    assert.doesNotMatch(workflow, /curl[^\n|]*\|\s*(?:sh|bash)/i, file);
  }
});

test('maintenance policy defines dependency Action and native-toolchain response', () => {
  for (const marker of ['Update cadence', 'npm dependencies', 'GitHub Actions', 'Native toolchains', 'Emergency response', 'package-lock.json', 'Dependabot']) {
    assert.ok(maintenance.includes(marker), marker);
  }
});

test('threat model covers Studio cloud supply-chain native and release trust boundaries', () => {
  for (const marker of ['Browser / Patch Studio', 'Optional cloud build', 'GitHub Actions and supply chain', 'Generated Web applications', 'Generated and sealed native applications', 'Release distribution', 'Token exposure', 'Service Worker persistence or stale-code attack', 'Artifact substitution or tampering', 'Explicit non-goals / residual risk']) {
    assert.ok(threatModel.includes(marker), marker);
  }
});

test('security review checklist covers every security-sensitive product boundary', () => {
  for (const marker of ['Parser, compiler and semantic mutation', 'Studio browser boundary', 'Remote/cloud builds', 'GitHub Actions and dependencies', 'Generated Web/native applications', 'Release and distribution', 'Evidence before merge']) {
    assert.ok(checklist.includes(marker), marker);
  }
});
