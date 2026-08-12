#!/usr/bin/env node
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from '../src/parser.js';
import { compile } from '../src/compiler.js';
import { compileToDirectWasm } from '../src/wasm-direct.js';
import { compileToC99 } from '../src/c99.js';
import { diagnosticFromError } from '../src/diagnostics.js';
import {
  PATCH_FUZZ_DEFAULT_SEED,
  createSeededRandom,
  generateInvalidProgram,
  generateNumericProgram
} from './fuzz-corpus.js';

export function runCompilerFuzz(options = {}) {
  const seed = normalizeInteger(options.seed, PATCH_FUZZ_DEFAULT_SEED, 0, 0xffffffff);
  const cases = normalizeInteger(options.cases, 500, 1, 100000);
  const random = createSeededRandom(seed);
  const coverage = new Set();

  for (let index = 0; index < cases; index += 1) {
    const source = generateNumericProgram(random, index);
    try {
      const ast = parse(source);
      if (!Array.isArray(ast) || ast.length === 0) throw new Error('Parser returned an empty AST for a generated valid program.');
      const compiled = compile(source, { name: `Fuzz${index}`, kind: 'console', entry: 'main.patch' });
      if (!compiled?.ir?.instructions?.length) throw new Error('Compiler returned no Change IR instructions.');
      const direct = compileToDirectWasm(source, { name: `Fuzz${index}`, kind: 'console', entry: 'main.patch' });
      if (!WebAssembly.validate(direct.module)) throw new Error('Generated direct Wasm did not validate.');
      const c99 = compileToC99(source, { name: `Fuzz${index}`, kind: 'console', entry: 'main.patch' });
      if (!c99.source.includes('int main(void)')) throw new Error('Generated C99 source has no main function.');
      coverage.add(index % 5);
    } catch (error) {
      throw enrichFailure(error, { seed, index, kind: 'valid', source });
    }

    const invalid = generateInvalidProgram(random, index);
    let caught = null;
    try {
      compile(invalid.source, { name: `InvalidFuzz${index}`, kind: 'console', entry: 'main.patch' });
    } catch (error) {
      caught = error;
    }
    if (!caught) throw enrichFailure(new Error(`Generated invalid case '${invalid.kind}' was unexpectedly accepted.`), { seed, index, kind: invalid.kind, source: invalid.source });
    const diagnostic = diagnosticFromError(caught, { source: invalid.source, entry: 'main.patch', phase: 'compile' });
    if (diagnostic.code !== invalid.expectedCode) {
      throw enrichFailure(new Error(`Expected ${invalid.expectedCode} for ${invalid.kind}, received ${diagnostic.code}.`), { seed, index, kind: invalid.kind, source: invalid.source });
    }
  }

  if (coverage.size !== 5) throw new Error(`Fuzz corpus did not cover every numeric generator mode; saw ${[...coverage].sort().join(',')}.`);
  return { seed, cases, validCases: cases, invalidCases: cases, generatorModes: coverage.size };
}

function enrichFailure(error, context) {
  const wrapped = new Error([
    `Patch deterministic fuzz failure (${context.kind})`,
    `seed=${context.seed}`,
    `case=${context.index}`,
    '--- source ---',
    context.source,
    '--- failure ---',
    error?.stack ?? error?.message ?? String(error)
  ].join('\n'));
  wrapped.cause = error;
  return wrapped;
}

function normalizeInteger(value, fallback, min, max) {
  const number = value === undefined ? fallback : Number(value);
  if (!Number.isInteger(number) || number < min || number > max) throw new Error(`Expected integer ${min}..${max}, received '${value}'.`);
  return number;
}

function parseArgs(argv) {
  const options = {};
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--seed') options.seed = argv[++i];
    else if (argv[i] === '--cases') options.cases = argv[++i];
    else throw new Error(`Unknown fuzz argument '${argv[i]}'.`);
  }
  return options;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const result = runCompilerFuzz(parseArgs(process.argv.slice(2)));
    console.log(`ok deterministic Patch fuzz seed=${result.seed} valid=${result.validCases} invalid=${result.invalidCases} modes=${result.generatorModes}`);
  } catch (error) {
    console.error(error?.stack ?? String(error));
    process.exit(1);
  }
}
