import test from 'node:test';
import assert from 'node:assert/strict';
import { parse } from '../src/parser.js';
import {
  PATCH_DIAGNOSTIC_CODES,
  diagnosticFromError,
  formatPatchDiagnostic,
  serializePatchDiagnostic,
  validatePatchDiagnostic
} from '../src/diagnostics.js';

test('unknown statements receive a stable syntax code and exact source line', () => {
  const source = 'create number score = 0\n  nonsense command\nshow score';
  let error;
  try { parse(source); } catch (caught) { error = caught; }
  const diagnostic = diagnosticFromError(error, { source, entry: '/private/project/main.patch', phase: 'compile' });
  assert.equal(diagnostic.code, PATCH_DIAGNOSTIC_CODES.UNKNOWN_STATEMENT);
  assert.deepEqual(diagnostic.location, { entry: 'main.patch', line: 2, column: 3 });
  assert.equal(diagnostic.message, "I do not understand 'nonsense command'.");
  assert.match(formatPatchDiagnostic(diagnostic), /^PATCH1001 main\.patch:2:3 /);
  assert.equal(JSON.parse(serializePatchDiagnostic(diagnostic)).code, 'PATCH1001');
  assert.equal(validatePatchDiagnostic(diagnostic), diagnostic);
});

test('indentation and missing-block diagnostics have stable categories', () => {
  const cases = [
    ['  show 1', PATCH_DIAGNOSTIC_CODES.INDENTATION, 1, 3],
    ['if true:', PATCH_DIAGNOSTIC_CODES.EXPECTED_BLOCK, 1, 1]
  ];
  for (const [source, code, line, column] of cases) {
    let error;
    try { parse(source); } catch (caught) { error = caught; }
    const diagnostic = diagnosticFromError(error, { source, entry: 'main.patch', phase: 'compile' });
    assert.equal(diagnostic.code, code);
    assert.equal(diagnostic.location.line, line);
    assert.equal(diagnostic.location.column, column);
  }
});

test('build target failures receive stable build codes without source locations', () => {
  const unknown = diagnosticFromError(new Error("Unknown build target 'moon'."), { phase: 'build' });
  assert.equal(unknown.code, PATCH_DIAGNOSTIC_CODES.UNKNOWN_BUILD_TARGET);
  assert.equal(unknown.location, null);

  const unsupported = diagnosticFromError(new Error('Direct WebAssembly currently supports Console projects only.'), { phase: 'build' });
  assert.equal(unsupported.code, PATCH_DIAGNOSTIC_CODES.UNSUPPORTED_TARGET_KIND);
});

test('explicit PATCH codes survive normalization', () => {
  const error = Object.assign(new Error('Custom checked failure'), { code: 'PATCH7777', line: 4, column: 9 });
  const diagnostic = diagnosticFromError(error, { source: '\n\n\n        bad', entry: 'custom.patch', phase: 'check' });
  assert.equal(diagnostic.code, 'PATCH7777');
  assert.deepEqual(diagnostic.location, { entry: 'custom.patch', line: 4, column: 9 });
});
