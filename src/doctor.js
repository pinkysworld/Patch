import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { compileToC99 } from './c99.js';
import { compile } from './compiler.js';
import { PatchInterpreter } from './interpreter.js';
import { compileToDirectWasm, DirectWasmUnsupportedError } from './wasm-direct.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const NUMERIC_SOURCE = `create number score = 1
change score:
  add 1
show score
`;

const THING_SOURCE = `create thing player:
  score = 1
show player.score
`;

export function collectDoctorReport(options = {}) {
  const cwd = path.resolve(options.cwd ?? process.cwd());
  const nodeVersion = options.nodeVersion ?? process.versions.node;
  const platform = options.platform ?? process.platform;
  const arch = options.arch ?? process.arch;
  const checks = [];

  const patchVersion = readPatchVersion();
  const nodeMajor = Number.parseInt(String(nodeVersion).split('.')[0], 10);
  checks.push(check(
    'node-version',
    Number.isInteger(nodeMajor) && nodeMajor >= 22 ? 'ok' : 'error',
    `Node ${nodeVersion}; Patch requires Node >=22 for the development CLI.`
  ));

  const writable = checkWritable(cwd);
  checks.push(check(
    'workspace-writable',
    writable.ok ? 'ok' : 'error',
    writable.ok ? `Workspace is writable: ${cwd}` : `Workspace is not writable: ${writable.error}`
  ));

  const tempWritable = checkWritable(os.tmpdir());
  checks.push(check(
    'temp-writable',
    tempWritable.ok ? 'ok' : 'error',
    tempWritable.ok ? `Temporary directory is writable: ${os.tmpdir()}` : `Temporary directory is not writable: ${tempWritable.error}`
  ));

  const nodeTool = probe(process.execPath, ['--version']);
  checks.push(check('node-runtime', nodeTool.ok ? 'ok' : 'error', nodeTool.detail));

  const cCompiler = probe(platform === 'win32' ? 'clang' : 'cc', ['--version']);
  checks.push(check(
    'c99-toolchain',
    cCompiler.ok ? 'ok' : 'warn',
    cCompiler.ok ? cCompiler.detail : 'No system C compiler detected. This is optional unless you build the portable C99 target locally.'
  ));

  const git = probe('git', ['--version']);
  checks.push(check(
    'git',
    git.ok ? 'ok' : 'warn',
    git.ok ? git.detail : 'Git was not detected. Patch can run without Git, but repository/release workflows need it.'
  ));

  const compilers = probeCompilerBackends();
  checks.push(check('compiler-backends', compilers.ok ? 'ok' : 'error', compilers.detail));

  const overall = checks.some(item => item.status === 'error')
    ? 'error'
    : checks.some(item => item.status === 'warn') ? 'warn' : 'ok';

  return {
    schema: 'patch-doctor',
    schemaVersion: 1,
    status: overall,
    patchVersion,
    nodeVersion,
    platform,
    arch,
    cwd,
    checks
  };
}

export function formatDoctorReport(report) {
  const icon = { ok: '✓', warn: '!', error: '×' };
  const lines = [
    `Patch doctor ${report.patchVersion}`,
    `Status: ${report.status}`,
    `Runtime: Node ${report.nodeVersion} on ${report.platform}/${report.arch}`,
    ''
  ];
  for (const item of report.checks) lines.push(`${icon[item.status] ?? '?'} ${item.id}: ${item.detail}`);
  return lines.join('\n');
}

function readPatchVersion() {
  try {
    return JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).version ?? 'unknown';
  } catch {
    return 'unknown';
  }
}

function checkWritable(directory) {
  const probePath = path.join(directory, `.patch-doctor-${process.pid}-${Date.now()}`);
  try {
    fs.writeFileSync(probePath, 'patch');
    fs.rmSync(probePath, { force: true });
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error.message };
  }
}

function probe(command, args) {
  const result = spawnSync(command, args, { encoding: 'utf8', shell: false });
  if (result.error || result.status !== 0) return { ok: false, detail: result.error?.message ?? `${command} exited with status ${result.status}` };
  const firstLine = `${result.stdout ?? ''}${result.stderr ?? ''}`.trim().split(/\r?\n/)[0];
  return { ok: true, detail: firstLine || `${command} is available.` };
}

function probeCompilerBackends() {
  try {
    const numericCompiled = compile(NUMERIC_SOURCE, { name: 'DoctorNumeric', kind: 'console', entry: 'doctor.patch' });
    if (!numericCompiled?.ir?.instructions?.length) {
      return { ok: false, detail: 'Compiler produced no Change IR for a numeric Console program.' };
    }

    const numericRun = new PatchInterpreter().run(NUMERIC_SOURCE);
    if (!hasOutput(numericRun.output, '2')) {
      return { ok: false, detail: `Interpreter numeric run expected 2, got ${JSON.stringify(numericRun.output)}.` };
    }

    const wasm = compileToDirectWasm(NUMERIC_SOURCE, { name: 'DoctorNumeric', kind: 'console', entry: 'doctor.patch' });
    if (!(wasm.module instanceof Uint8Array) || wasm.module.length === 0) {
      return { ok: false, detail: 'Direct Wasm compile did not emit a module for a numeric Console program.' };
    }
    const wasmOutput = runDirectWasmSync(wasm.module);
    if (!hasOutput(wasmOutput, '2')) {
      return { ok: false, detail: `Direct Wasm numeric run expected 2, got ${JSON.stringify(wasmOutput)}.` };
    }

    const c99 = compileToC99(NUMERIC_SOURCE, { name: 'DoctorNumeric', kind: 'console', entry: 'doctor.patch' });
    if (!c99.source?.includes('int main(void)') || !c99.source.includes('patch_show_number')) {
      return { ok: false, detail: 'C99 backend did not emit a numeric Console program.' };
    }

    const thingCompiled = compile(THING_SOURCE, { name: 'DoctorThing', kind: 'console', entry: 'doctor.patch' });
    if (!thingCompiled.ir.instructions.some(item => item.code === 'CREATE_THING')) {
      return { ok: false, detail: 'Compiler did not lower CREATE_THING for a Thing program.' };
    }

    const thingRun = new PatchInterpreter().run(THING_SOURCE);
    if (!hasOutput(thingRun.output, '1')) {
      return { ok: false, detail: `Interpreter Thing run expected 1, got ${JSON.stringify(thingRun.output)}.` };
    }

    const wasmThing = expectUnsupported(THING_SOURCE, compileToDirectWasm, 'Direct Wasm');
    if (!wasmThing.ok) return wasmThing;
    const c99Thing = expectUnsupported(THING_SOURCE, compileToC99, 'C99');
    if (!c99Thing.ok) return c99Thing;

    return {
      ok: true,
      detail: 'Interpreter, direct Wasm and C99 numeric subset match; Things fail closed on Wasm/C99.'
    };
  } catch (error) {
    return { ok: false, detail: `Compiler backend self-check failed: ${error.message}` };
  }
}

function expectUnsupported(source, compileFn, label) {
  try {
    compileFn(source, { name: 'DoctorThing', kind: 'console', entry: 'doctor.patch' });
    return { ok: false, detail: `${label} accepted a Thing program instead of failing closed.` };
  } catch (error) {
    const closed = /things are outside the direct numeric Wasm subset/.test(error.message);
    if (label === 'Direct Wasm' && !(error instanceof DirectWasmUnsupportedError)) {
      return { ok: false, detail: `Direct Wasm Thing fail-closed expected DirectWasmUnsupportedError, got ${error?.constructor?.name}: ${error.message}` };
    }
    if (!closed) {
      return { ok: false, detail: `${label} Thing fail-closed expected unsupported Thing error, got ${error?.constructor?.name}: ${error.message}` };
    }
    return { ok: true };
  }
}

function runDirectWasmSync(moduleBytes) {
  const output = [];
  const compiled = new WebAssembly.Module(moduleBytes);
  const instance = new WebAssembly.Instance(compiled, {
    patch: {
      show_number(value) { output.push(String(value)); },
      change_number() {}
    }
  });
  instance.exports.run();
  return output;
}

function hasOutput(output, expected) {
  return Array.isArray(output) && output.some(line => String(line) === expected);
}

function check(id, status, detail) { return { id, status, detail }; }
