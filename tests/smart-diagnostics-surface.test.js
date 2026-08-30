import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const surface = fs.readFileSync('web/studio-diagnostics.js', 'utf8');
const diagnostics = fs.readFileSync('src/diagnostics.js', 'utf8');

test('Studio diagnostics owns the direct smart-diagnostic surface', () => {
  assert.match(surface, /smartDiagnosticCard/);
  assert.match(surface, /Was ist passiert\?/);
  assert.match(surface, /Warum\?/);
  assert.match(surface, /Empfohlene Lösung/);
  assert.match(surface, /Fix anwenden/);
  assert.match(surface, /Im Code zeigen/);
  assert.match(diagnostics, /PATCH_DIAGNOSTIC_ASSIST_FORMAT = 'patch-diagnostic-assist'/);
  assert.match(diagnostics, /PATCH_DIAGNOSTIC_ASSIST_VERSION = '0\.1'/);
});

test('smart source fixes stay on the canonical Studio mutation path', () => {
  assert.match(surface, /code\.dispatchEvent\(new Event\('input', \{ bubbles: true \}\)\)/);
  assert.match(surface, /code\.dispatchEvent\(new Event\('change', \{ bubbles: true \}\)\)/);
  assert.doesNotMatch(surface, /\.innerHTML\s*=/);
});

test('ambiguous repairs remain explanation-only in the assist contract', () => {
  assert.match(diagnostics, /ranked\[1\].*distance === ranked\[0\].*distance/);
  assert.match(diagnostics, /fix: null/);
});
