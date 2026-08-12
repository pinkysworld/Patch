import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

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

function check(id, status, detail) { return { id, status, detail }; }
