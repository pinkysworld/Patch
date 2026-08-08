#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { generateConcreteCallCertificate } from '../src/concrete-call-certificate.js';

const args = process.argv.slice(2);
const file = args.shift();
if (!file) {
  console.error('Use: node scripts/generate-concrete-call-certificate.js program.patch [--out GeneratedConcreteCallCertificate.lean]');
  process.exit(1);
}
const outIndex = args.indexOf('--out');
const out = outIndex >= 0 && args[outIndex + 1]
  ? args[outIndex + 1]
  : `${path.basename(file, path.extname(file))}.concrete-calls.patchcert.lean`;

try {
  const source = fs.readFileSync(file, 'utf8');
  const certificate = generateConcreteCallCertificate(source, {
    name: path.basename(file, path.extname(file)),
    entry: path.basename(file)
  });
  fs.writeFileSync(out, certificate.lean, 'utf8');
  console.log(`Generated ${out}`);
  console.log(`  source sha256: ${certificate.sourceSha256}`);
  console.log(`  certified concrete binding(s): ${certificate.certified.join(', ')}`);
  console.log('  assurance: Lean re-evaluates inter-recipe variable arguments, checks exact positional parameter binding, and connects concrete values through beta.25 abstract intervals to declared callee intervals.');
  console.log('  boundary: root calls, richer arithmetic substitution, effect execution under the bound environment and production-Wasm call equivalence remain outside this first beta.26 slice.');
} catch (err) {
  console.error(`Patch stopped: ${err.message}`);
  process.exit(2);
}
