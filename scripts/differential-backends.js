#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { PatchInterpreter } from '../src/interpreter.js';
import { compileToDirectWasm, runDirectWasm } from '../src/wasm-direct.js';
import { compileToC99 } from '../src/c99.js';
import { differentialCorpus } from './fuzz-corpus.js';

export async function runBackendDifferential(options = {}) {
  const compiler = options.compiler ?? findCCompiler();
  const corpus = options.corpus ?? differentialCorpus();
  if (!Array.isArray(corpus) || corpus.length === 0) throw new Error('Differential corpus is empty.');
  const covered = new Set();
  let documentedSharedSubset = null;

  for (const item of corpus) {
    for (const capability of item.coverage ?? []) covered.add(capability);
    const interpreted = new PatchInterpreter().run(item.source);
    const directBuild = compileToDirectWasm(item.source, { name: `Diff_${safeName(item.name)}`, kind: 'console', entry: 'main.patch' });
    if (!WebAssembly.validate(directBuild.module)) throw new Error(`${item.name}: direct Wasm module did not validate.`);
    const direct = await runDirectWasm(directBuild.module, directBuild.metadata);
    assert.deepEqual(direct.output, interpreted.output, `${item.name}: interpreter/direct-Wasm output mismatch`);
    assert.deepEqual(direct.state, interpreted.state, `${item.name}: interpreter/direct-Wasm state mismatch`);

    const c99 = compileToC99(item.source, { name: `Diff_${safeName(item.name)}`, kind: 'console', entry: 'main.patch' });
    documentedSharedSubset ??= [...c99.metadata.supported];
    const cOutput = compileAndRunC(c99.source, compiler, item.name);
    assert.deepEqual(cOutput, interpreted.output, `${item.name}: interpreter/C99 output mismatch`);
  }

  const missing = (documentedSharedSubset ?? []).filter(capability => !covered.has(capability));
  if (missing.length) throw new Error(`Differential corpus does not cover documented C99/direct-Wasm shared subset: ${missing.join(', ')}`);
  return { cases: corpus.length, compiler, covered: [...covered].sort() };
}

function compileAndRunC(source, compiler, name) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'patch-differential-'));
  try {
    const stem = safeName(name) || 'case';
    const sourcePath = path.join(dir, `${stem}.c`);
    const executable = path.join(dir, process.platform === 'win32' ? `${stem}.exe` : stem);
    fs.writeFileSync(sourcePath, source);
    const compileResult = spawnSync(compiler, ['-std=c99', '-O0', sourcePath, '-lm', '-o', executable], { encoding: 'utf8', timeout: 30000 });
    if (compileResult.error) throw compileResult.error;
    if (compileResult.status !== 0) {
      throw new Error(`${name}: C99 compiler failed (${compileResult.status}).\n${compileResult.stdout ?? ''}\n${compileResult.stderr ?? ''}`);
    }
    const run = spawnSync(executable, [], { encoding: 'utf8', timeout: 10000 });
    if (run.error) throw run.error;
    if (run.status !== 0) throw new Error(`${name}: generated C99 executable failed (${run.status}).\n${run.stdout ?? ''}\n${run.stderr ?? ''}`);
    return outputLines(run.stdout);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

function outputLines(stdout) {
  const text = String(stdout ?? '').replace(/\r/g, '').trimEnd();
  return text ? text.split('\n') : [];
}

function findCCompiler() {
  const candidates = [process.env.CC, 'cc', 'gcc', 'clang'].filter(Boolean);
  for (const candidate of [...new Set(candidates)]) {
    const result = spawnSync(candidate, ['--version'], { encoding: 'utf8', timeout: 5000 });
    if (!result.error && result.status === 0) return candidate;
  }
  throw new Error('No C99 compiler found. Set CC or install cc/gcc/clang before running backend differential tests.');
}

function safeName(value) {
  return String(value ?? '').replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 80);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const result = await runBackendDifferential();
    console.log(`ok backend differential cases=${result.cases} c=${result.compiler} shared-subset=${result.covered.length}`);
  } catch (error) {
    console.error(error?.stack ?? String(error));
    process.exit(1);
  }
}
