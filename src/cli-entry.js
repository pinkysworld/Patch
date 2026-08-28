#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { generateLeanCallCertificate } from './call-certificate.js';
import {
  formatPatchComponentCapabilityMatrixText,
  patchComponentCapabilityMatrix
} from './component-matrix.js';
import { collectDoctorReport, formatDoctorReport } from './doctor.js';
import { linkPatchSource } from './offline-linker.js';

const argv = process.argv.slice(2);
const command = argv[0];

if (command === 'doctor') {
  const report = collectDoctorReport();
  if (argv.includes('--json')) console.log(JSON.stringify(report, null, 2));
  else console.log(formatDoctorReport(report));
  process.exit(report.status === 'error' ? 2 : 0);
}

if (command === 'components') {
  const matrix = patchComponentCapabilityMatrix();
  if (argv.includes('--json')) console.log(JSON.stringify(matrix, null, 2));
  else process.stdout.write(formatPatchComponentCapabilityMatrixText(matrix));
  process.exit(0);
}

if (command === 'link') {
  const args = argv.slice(1);
  const file = args.shift();
  if (!file) {
    console.error('Use: patch link program.patch [--out App] [--name AppName] [--gui-payload-version 12|13]');
    process.exit(1);
  }
  try {
    const source = fs.readFileSync(file, 'utf8');
    const name = option(args, '--name') ?? appName(file);
    const out = option(args, '--out');
    const guiPayloadVersion = option(args, '--gui-payload-version')
      ?? process.env.PATCH_OFFLINE_GUI_PAYLOAD_VERSION
      ?? process.env.PATCH_SEALED_GUI_VERSION;
    const linked = linkPatchSource(source, {
      name,
      entry: path.basename(file),
      out,
      guiPayloadVersion,
      nodeRuntime: readRuntime(process.env.PATCH_OFFLINE_NODE_RUNTIME),
      consoleRuntime: readRuntime(process.env.PATCH_OFFLINE_CONSOLE_RUNTIME),
      guiRuntime: readRuntime(process.env.PATCH_OFFLINE_GUI_RUNTIME)
    });
    console.log(`Linked ${linked.output}`);
    console.log(`  type: ${linked.kind}`);
    console.log(`  target: ${linked.platform}`);
    console.log(`  format: ${linked.outputKind}`);
    if (linked.platform === 'freebsd') console.log('  backend: portable Patch C99 + local system C compiler');
    else if (linked.outputKind.includes('portable Console')) console.log('  backend: direct Patch Wasm + embedded Node app bundle');
    else console.log('  backend: local Patch compilation + embedded native runtime sealing');
    process.exit(0);
  } catch (err) {
    console.error(`Patch link stopped: ${err.message}`);
    process.exit(2);
  }
}

if (command !== 'call-certify') {
  const cliPath = fileURLToPath(new URL('./cli.js', import.meta.url));
  const result = spawnSync(process.execPath, [cliPath, ...argv], { stdio: 'inherit' });
  if (result.error) {
    console.error(`Patch stopped: ${result.error.message}`);
    process.exit(2);
  }
  process.exit(result.status ?? 2);
}

const args = argv.slice(1);
const file = args.shift();
if (!file) {
  console.error('Use: patch call-certify program.patch [--out Program.calls.patchcert.lean] [--name AppName]');
  process.exit(1);
}

try {
  const source = fs.readFileSync(file, 'utf8');
  const name = option(args, '--name') ?? appName(file);
  const out = option(args, '--out') ?? `${name}.calls.patchcert.lean`;
  const certificate = generateLeanCallCertificate(source, { name, entry: path.basename(file) });
  fs.writeFileSync(out, certificate.lean, 'utf8');
  console.log(`Generated ${out}`);
  console.log(`  source sha256: ${certificate.sourceSha256}`);
  console.log(`  formal-call schema: ${certificate.formalCallsVersion}`);
  console.log(`  recipe environment entries: ${certificate.environmentSize}`);
  console.log(`  certified recipe(s): ${certificate.certifiedRecipes.join(', ')}`);
  console.log('  assurance: Lean checks direct effects, rank-decreasing call resolution, safe-integer argument interval fit, and callee-signature containment in each caller signature.');
  console.log('  boundary: this is abstract call composition; concrete runtime argument-value substitution remains outside this certificate.');
} catch (err) {
  console.error(`Patch stopped: ${err.message}`);
  process.exit(2);
}

function option(args, name) {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : null;
}

function appName(filePath) {
  return path.basename(filePath, path.extname(filePath)).replace(/[^A-Za-z0-9_-]/g, '_') || 'PatchApp';
}

function readRuntime(filePath) {
  if (!filePath) return undefined;
  if (!fs.existsSync(filePath)) throw new Error(`Embedded runtime file is missing: ${filePath}`);
  return new Uint8Array(fs.readFileSync(filePath));
}
