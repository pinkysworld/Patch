import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { inferBackendPatchLine, PATCH_BACKEND_DIAGNOSTIC_CONTEXT_VERSION } from '../src/backend-diagnostic-context.js';
import { diagnosticFromError } from '../src/diagnostics.js';

test('C99 backend context version is explicit', () => {
  assert.equal(PATCH_BACKEND_DIAGNOSTIC_CONTEXT_VERSION, 1);
});

test('C99 nested recipe errors map only to one matching make line', () => {
  const source = `if true:\n  make helper():\n    show 1\n`;
  assert.equal(inferBackendPatchLine("C99 backend: nested recipe 'helper' is unsupported.", source), 2);
  const diagnostic = diagnosticFromError(new Error("C99 backend: nested recipe 'helper' is unsupported."), {
    phase: 'build', source, entry: '/tmp/main.patch'
  });
  assert.deepEqual(diagnostic.location, { entry: 'main.patch', line: 2, column: 3 });
});

test('C99 unknown recipe errors find one matching do line', () => {
  const source = `create number score = 0\nif true:\n  do missing(1)\n`;
  assert.equal(inferBackendPatchLine("C99 backend: unknown recipe 'missing'.", source), 3);
  const diagnostic = diagnosticFromError(new Error("C99 backend: unknown recipe 'missing'."), {
    phase: 'build', source, entry: 'main.patch'
  });
  assert.equal(diagnostic.code, 'PATCH2003');
  assert.deepEqual(diagnostic.location, { entry: 'main.patch', line: 3, column: 3 });
});

test('C99 return and literal repeat context map when unambiguous', () => {
  const returnSource = `make value():\n  return 3\nshow 1\n`;
  assert.equal(inferBackendPatchLine('C99 backend: return-valued recipes are outside the portable subset.', returnSource), 2);

  const repeatSource = `create number score = 0\nrepeat count + 1:\n  change score:\n    add 1\n`;
  assert.equal(inferBackendPatchLine("C99 backend: repeat count 'count + 1' must be a literal whole number.", repeatSource), 2);
});

test('C99 field-change context uses the nearest change target', () => {
  const source = `create thing player:\n  score = 0\n\nchange player:\n  add 1 to score\n`;
  assert.equal(inferBackendPatchLine("C99 backend: field change 'player.score' is outside the numeric subset.", source), 5);
});

test('ambiguous matching source context stays unmapped instead of guessing', () => {
  const source = `if true:\n  do missing(1)\nelse:\n  do missing(2)\n`;
  assert.equal(inferBackendPatchLine("C99 backend: unknown recipe 'missing'.", source), null);
  const diagnostic = diagnosticFromError(new Error("C99 backend: unknown recipe 'missing'."), { phase: 'build', source });
  assert.equal(diagnostic.location, null);
});

test('non-C99 toolchain errors never use source-context inference', () => {
  const source = `make helper():\n  return 1\n`;
  assert.equal(inferBackendPatchLine("clang: nested recipe 'helper' is unsupported at generated.c:12", source), null);
  assert.equal(inferBackendPatchLine('link.exe: return-valued recipes are outside the portable subset.', source), null);
});

test('backend diagnostic context ships with the content-addressed Studio bundle', () => {
  const buildSite = fs.readFileSync('scripts/build-site.js', 'utf8');
  const serviceWorker = fs.readFileSync('web/sw.js', 'utf8');
  assert.match(buildSite, /'backend-diagnostic-context\.js'/);
  assert.match(serviceWorker, /'\.\.\/src\/backend-diagnostic-context\.js'/);
});
