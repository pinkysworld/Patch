#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { generateConcreteCallBodyCertificate } from '../src/concrete-call-body-certificate.js';

const args = process.argv.slice(2);
const file = args.shift();
if (!file) {
  console.error('Use: node scripts/generate-concrete-call-body-certificate.js program.patch [--out GeneratedConcreteCallBodyCertificate.lean]');
  process.exit(1);
}
const outIndex = args.indexOf('--out');
const out = outIndex >= 0 && args[outIndex + 1]
  ? args[outIndex + 1]
  : `${path.basename(file, path.extname(file))}.callee-trace.patchcert.lean`;

try {
  const source = fs.readFileSync(file, 'utf8');
  const certificate = generateConcreteCallBodyCertificate(source, {
    name: path.basename(file, path.extname(file)),
    entry: path.basename(file)
  });
  fs.writeFileSync(out, certificate.lean, 'utf8');
  console.log(`Generated ${out}`);
  console.log(`  source sha256: ${certificate.sourceSha256}`);
  console.log(`  certified structured call(s): ${certificate.certified.join(', ')}`);
  console.log('  assurance: Lean re-evaluates exact call binding and every direct quantitative effect in the supported sequence/static-repeat callee body, checks the full claimed effect trace, checks callee signature coverage, and imports the complete trace into the caller semantic signature.');
  console.log('  boundary: branches, nested recipe calls, dynamic repeat, arbitrary state-dependent amounts and production-Wasm call equivalence remain outside beta.28.');
} catch (err) {
  console.error(`Patch stopped: ${err.message}`);
  process.exit(2);
}
