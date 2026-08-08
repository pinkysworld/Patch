#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { generateLeanCallCertificate } from '../src/call-certificate.js';

const args = process.argv.slice(2);
const file = args.shift();
if (!file) {
  console.error('Use: node scripts/generate-call-certificate.js program.patch [--out GeneratedCallCertificate.lean]');
  process.exit(1);
}

const outIndex = args.indexOf('--out');
const out = outIndex >= 0 && args[outIndex + 1]
  ? args[outIndex + 1]
  : `${path.basename(file, path.extname(file))}.calls.patchcert.lean`;

try {
  const source = fs.readFileSync(file, 'utf8');
  const certificate = generateLeanCallCertificate(source, {
    name: path.basename(file, path.extname(file)),
    entry: path.basename(file)
  });
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
