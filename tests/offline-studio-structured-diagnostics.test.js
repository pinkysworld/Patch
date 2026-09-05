import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { buildStudioProjectBundle } from '../src/studio-project.js';
import {
  OFFLINE_BUILD_BRIDGE_PROTOCOL,
  startOfflineBuildBridge,
  sanitizeBuildDiagnostic
} from '../src/offline-studio-build-bridge.js';
import builderModule from '../scripts/offline-studio-compiler-builder.cjs';

const { parseCompilerDiagnostic, stripCompilerDiagnosticRecord } = builderModule;
const DIAGNOSTIC_PREFIX = 'PATCH_DIAGNOSTIC_JSON:';

function tempRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'patch-offline-diagnostic-'));
}

function syntaxDiagnostic(overrides = {}) {
  return {
    format: 'patch-diagnostic',
    version: 1,
    code: 'PATCH1001',
    severity: 'error',
    phase: 'build',
    message: "I do not understand 'frobnicate score'.",
    location: {
      entry: 'main.patch',
      file: 'logic/bad.patch',
      line: 2,
      column: 3
    },
    ...overrides
  };
}

test('patch link --diagnostics-json maps a project-v4 syntax failure back to its owning file', () => {
  const root = tempRoot();
  try {
    const bundle = buildStudioProjectBundle({
      name: 'BrokenInstalledBuild',
      kind: 'window',
      files: [
        { path: 'main.patch', content: 'window "Broken" size 320, 200:\n  text "Ready"\n' },
        { path: 'logic/bad.patch', content: 'if true:\n  frobnicate score\n' }
      ]
    });
    const projectFile = path.join(root, 'broken.patchproject');
    fs.writeFileSync(projectFile, `${JSON.stringify(bundle, null, 2)}\n`, 'utf8');

    const run = spawnSync(process.execPath, [
      'src/cli-entry.js', 'link', projectFile,
      '--name', 'BrokenInstalledBuild',
      '--out', path.join(root, 'out', 'BrokenInstalledBuild'),
      '--diagnostics-json'
    ], {
      cwd: process.cwd(),
      encoding: 'utf8',
      maxBuffer: 2 * 1024 * 1024
    });

    assert.equal(run.status, 2, run.stderr || run.stdout);
    const diagnostic = parseCompilerDiagnostic(run.stderr);
    assert.ok(diagnostic, run.stderr);
    assert.equal(diagnostic.code, 'PATCH1001');
    assert.equal(diagnostic.phase, 'build');
    assert.deepEqual(diagnostic.location, {
      entry: 'main.patch',
      file: 'logic/bad.patch',
      line: 2,
      column: 3
    });
    assert.match(diagnostic.message, /frobnicate score/i);
    assert.match(run.stderr, /Patch link stopped:/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('Offline Studio compiler adapter separates the machine diagnostic record from human stderr', () => {
  const diagnostic = syntaxDiagnostic();
  const raw = `${DIAGNOSTIC_PREFIX}${JSON.stringify(diagnostic)}\nPatch link stopped: line 2: bad source`;
  assert.deepEqual(parseCompilerDiagnostic(raw), diagnostic);
  assert.equal(stripCompilerDiagnosticRecord(raw), 'Patch link stopped: line 2: bad source');
  assert.equal(parseCompilerDiagnostic(`${DIAGNOSTIC_PREFIX}{bad json}`), null);
});

test('Offline Studio bridge independently validates structured compiler diagnostics', () => {
  const accepted = sanitizeBuildDiagnostic(syntaxDiagnostic());
  assert.equal(accepted.code, 'PATCH1001');
  assert.deepEqual(accepted.location, {
    entry: 'main.patch',
    file: 'logic/bad.patch',
    line: 2,
    column: 3
  });

  assert.equal(sanitizeBuildDiagnostic({ ...syntaxDiagnostic(), command: 'rm -rf /' }), null);
  assert.equal(sanitizeBuildDiagnostic(syntaxDiagnostic({ location: { entry: '/tmp/main.patch', line: 1, column: 1 } })), null);
  assert.equal(sanitizeBuildDiagnostic(syntaxDiagnostic({ code: 'SHELL001' })), null);
});

test('localhost build bridge returns validated compiler diagnostics as a bounded HTTP 422 error field', async () => {
  const root = tempRoot();
  const source = path.join(root, 'main.patch');
  fs.writeFileSync(source, 'window "Broken":\n  frobnicate score\n', 'utf8');
  const token = 'structured-diagnostic-token-0123456789';
  const origin = 'http://127.0.0.1:41888';
  const diagnostic = syntaxDiagnostic({
    location: { entry: 'main.patch', line: 2, column: 3 }
  });
  const builder = () => {
    const error = new Error('compiler stopped with structured diagnostic');
    error.diagnostic = diagnostic;
    throw error;
  };

  let bridge;
  try {
    bridge = await startOfflineBuildBridge({ workspaceRoot: root, token, allowedOrigin: origin, builder, platform: 'linux' });
    const response = await fetch(`${bridge.origin}${bridge.path}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        Origin: origin,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        protocol: OFFLINE_BUILD_BRIDGE_PROTOCOL,
        action: 'build-native-window',
        requestId: 'diagnostic-001',
        source: 'main.patch',
        appName: 'BrokenApp'
      })
    });
    const value = await response.json();
    assert.equal(response.status, 422);
    assert.equal(value.ok, false);
    assert.equal(value.error, 'build-diagnostic');
    assert.equal(value.diagnostic.code, 'PATCH1001');
    assert.deepEqual(value.diagnostic.location, { entry: 'main.patch', line: 2, column: 3 });
    assert.doesNotMatch(JSON.stringify(value), /window \"Broken\"/);
  } finally {
    if (bridge) await bridge.close();
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('installed-build browser client renders structured diagnostic code and source location', () => {
  const client = fs.readFileSync('scripts/offline-studio-native-build-client.js', 'utf8');
  assert.match(client, /validPatchDiagnostic/);
  assert.match(client, /Compiler diagnostic:/);
  assert.match(client, /diagnostic\.location\.file \|\| diagnostic\.location\.entry/);
  assert.match(client, /error\.diagnostic = value\.diagnostic/);
});
