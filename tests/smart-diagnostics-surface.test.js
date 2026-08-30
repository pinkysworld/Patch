import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const runtimeIntegrity = fs.readFileSync('web/runtime-integrity.js', 'utf8');
const surface = fs.readFileSync('web/smart-diagnostics.js', 'utf8');

test('Studio loads the direct smart-diagnostic surface from an existing early module', () => {
  assert.match(runtimeIntegrity, /import '\.\/smart-diagnostics\.js';/);
  assert.match(surface, /smartDiagnosticCard/);
  assert.match(surface, /Was ist passiert\?/);
  assert.match(surface, /Warum\?/);
  assert.match(surface, /Empfohlene Lösung/);
  assert.match(surface, /Fix anwenden/);
  assert.match(surface, /Im Code zeigen/);
});

test('smart source fixes stay on the canonical Studio mutation path', () => {
  assert.match(surface, /code\.dispatchEvent\(new Event\('input', \{ bubbles: true \}\)\)/);
  assert.match(surface, /code\.dispatchEvent\(new Event\('change', \{ bubbles: true \}\)\)/);
  assert.doesNotMatch(surface, /\.innerHTML\s*=/);
});
