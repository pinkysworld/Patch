#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { generateLeanCallCertificate } from './call-certificate.js';
import { collectDoctorReport, formatDoctorReport } from './doctor.js';

const argv = process.argv.slice(2);
const command = argv[0];

if (command === 'doctor') {
  const report = collectDoctorReport();
  if (argv.includes('--json')) console.log(JSON.stringify(report, null, 2));
  else console.log(formatDoctorReport(report));
  process.exit(report.status === 'error' ? 2 : 0);
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
  console.log('  boundary: this is abstract call composition; stronger concrete-call certificates use their dedicated beta.26/beta.27 generators.');
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
