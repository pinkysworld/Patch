import test from 'node:test';
import assert from 'node:assert/strict';
import { parse } from '../src/parser.js';
import {
  buildStudioDiagnosticReport,
  formatStudioDiagnosticReport,
  redactDiagnosticText,
  serializeStudioDiagnosticReport,
  sha256Text
} from '../src/studio-diagnostics.js';

test('Studio diagnostic report hashes source without embedding it', async () => {
  const source = 'create text secret = "private project words"\nshow secret';
  const report = await buildStudioDiagnosticReport({
    patchVersion: '0.2.0-beta.33',
    source,
    projectKind: 'console',
    buildTarget: 'web',
    environment: { userAgent: 'TestBrowser', language: 'en', online: true }
  });
  assert.equal(report.project.sourceBytes, new TextEncoder().encode(source).length);
  assert.equal(report.project.sourceSha256, await sha256Text(source));
  assert.equal(report.privacy.sourceIncluded, false);
  assert.equal(report.privacy.uploaded, false);
  assert.equal(report.compiler.status, 'ok');
  assert.equal(report.version, 1);
  const json = serializeStudioDiagnosticReport(report);
  assert.doesNotMatch(json, /private project words/);
  assert.doesNotMatch(json, /create text secret/);
});

test('Studio diagnostics redact tokens email addresses and home directory users', () => {
  const raw = 'Bearer abc123 github_pat_SECRET_123 ghp_ABCDEF mail me@example.com /Users/michel/project /home/michel/project C:\\Users\\michel\\Patch';
  const redacted = redactDiagnosticText(raw);
  for (const secret of ['abc123','github_pat_SECRET_123','ghp_ABCDEF','me@example.com','/Users/michel','/home/michel','C:\\Users\\michel']) assert.ok(!redacted.includes(secret), secret);
  assert.match(redacted, /\[redacted-token\]/);
  assert.match(redacted, /\[redacted-email\]/);
  assert.match(redacted, /\[redacted-user\]/);
});

test('compiler and recent errors redact source echoes before reporting', async () => {
  const source = 'create text customer_secret = "TOP SECRET VALUE"\nshow customer_secret';
  const report = await buildStudioDiagnosticReport({
    source,
    projectKind: 'console',
    compilerError: new Error(`Parser failed near create text customer_secret = "TOP SECRET VALUE" at /Users/alice/Patch`),
    recentErrors: [{ time: '2026-08-12T10:00:00Z', type: 'studio-output', message: `Stopped at show customer_secret and token github_pat_SUPERSECRET` }]
  });
  const json = JSON.stringify(report);
  assert.doesNotMatch(json, /TOP SECRET VALUE/);
  assert.doesNotMatch(json, /github_pat_SUPERSECRET/);
  assert.doesNotMatch(json, /\/Users\/alice/);
  assert.match(report.compiler.error.message, /\[redacted-source\]/);
  assert.match(report.recentErrors[0].message, /\[redacted-token\]/);
  assert.match(report.compiler.error.code, /^PATCH\d{4}$/);
  assert.match(report.recentErrors[0].code, /^PATCH\d{4}$/);
});

test('compiler errors include stable code and exact line/column without source text', async () => {
  const source = 'if true:\n  nonsense command\nshow 1';
  let compilerError;
  try { parse(source); } catch (error) { compilerError = error; }
  const report = await buildStudioDiagnosticReport({ source, compilerError, entry: '/secret/path/main.patch' });
  assert.equal(report.compiler.error.code, 'PATCH1001');
  assert.deepEqual(report.compiler.error.location, { entry: 'main.patch', line: 2, column: 3 });
  const text = formatStudioDiagnosticReport(report);
  assert.match(text, /Compiler error: PATCH1001 main\.patch:2:3/);
  assert.doesNotMatch(text, /if true/);
});

test('plain-text diagnostics remain useful without carrying source', async () => {
  const source = 'create number value = 1\nshow value';
  const report = await buildStudioDiagnosticReport({
    patchVersion: '0.2.0-beta.33',
    source,
    projectKind: 'console',
    buildTarget: 'wasm-direct',
    environment: {
      userAgent: 'Browser/1', language: 'de-DE', online: false,
      standalone: true, serviceWorkerControlled: true
    }
  });
  const text = formatStudioDiagnosticReport(report);
  assert.match(text, /Patch Studio diagnostics 0\.2\.0-beta\.33/);
  assert.match(text, /Build target: wasm-direct/);
  assert.match(text, /source omitted/);
  assert.doesNotMatch(text, /create number value/);
});

test('recent Studio errors stay bounded to ten entries', async () => {
  const recentErrors = Array.from({ length: 15 }, (_, i) => ({
    time: new Date(2026, 0, 1, 0, i).toISOString(),
    type: 'test',
    message: `error-${i}`
  }));
  const report = await buildStudioDiagnosticReport({ source: '', recentErrors });
  assert.equal(report.recentErrors.length, 10);
  assert.equal(report.recentErrors[0].message, 'error-5');
  assert.equal(report.recentErrors[9].message, 'error-14');
});
