import test from 'node:test';
import assert from 'node:assert/strict';
import { compileToC99 } from '../src/c99.js';
import {
  createSeededRandom,
  differentialCorpus,
  generateInvalidProgram,
  generateNumericProgram
} from '../scripts/fuzz-corpus.js';
import { runCompilerFuzz } from '../scripts/fuzz-compiler.js';

test('seeded Patch fuzz generator is deterministic and seed-sensitive', () => {
  const a = createSeededRandom(12345);
  const b = createSeededRandom(12345);
  const c = createSeededRandom(54321);
  const left = Array.from({ length: 8 }, (_, index) => generateNumericProgram(a, index));
  const same = Array.from({ length: 8 }, (_, index) => generateNumericProgram(b, index));
  const other = Array.from({ length: 8 }, (_, index) => generateNumericProgram(c, index));
  assert.deepEqual(left, same);
  assert.notDeepEqual(left, other);
});

test('numeric generator cycles through mutation branch repeat recipe and ranged-recipe modes', () => {
  const random = createSeededRandom(1);
  const sources = Array.from({ length: 5 }, (_, index) => generateNumericProgram(random, index));
  assert.match(sources[0], /set =/);
  assert.match(sources[0], /\n  clear\n/);
  assert.match(sources[1], /if .* and not false:/);
  assert.match(sources[2], /repeat \d+:/);
  assert.match(sources[3], /make v3_twice\(amount\):/);
  assert.match(sources[4], /amount number 0\.\.5/);
  assert.match(sources[4], /may increase up to 10/);
});

test('invalid generator produces stable known diagnostic families', () => {
  const random = createSeededRandom(2);
  const cases = Array.from({ length: 4 }, (_, index) => generateInvalidProgram(random, index));
  assert.deepEqual(cases.map(item => item.expectedCode), ['PATCH1001', 'PATCH1002', 'PATCH1003', 'PATCH1004']);
  assert.deepEqual(cases.map(item => item.kind), ['unknown-statement', 'indentation', 'missing-block', 'invalid-structure']);
});

test('small deterministic fuzz smoke exercises parser compiler direct-Wasm and C99 lowering', () => {
  const result = runCompilerFuzz({ seed: 424242, cases: 20 });
  assert.deepEqual(result, { seed: 424242, cases: 20, validCases: 20, invalidCases: 20, generatorModes: 5 });
});

test('differential corpus tracks every C99 documented shared-subset capability', () => {
  const corpus = differentialCorpus();
  const covered = new Set(corpus.flatMap(item => item.coverage));
  const metadata = compileToC99(corpus[0].source, { name: 'Coverage', kind: 'console' }).metadata;
  assert.ok(metadata.supported.length >= 8);
  for (const capability of metadata.supported) assert.ok(covered.has(capability), capability);
  assert.ok(corpus.length >= 6);
});
