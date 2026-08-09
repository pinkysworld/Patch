#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { generateTransitiveCallBodyCertificate } from '../src/transitive-call-body-certificate.js';

const args = process.argv.slice(2);
const file = args.shift();
if (!file) {
  console.error('Use: node scripts/generate-transitive-call-body-certificate.js program.patch [--out GeneratedTransitiveCallBodyCertificate.lean]');
  process.exit(1);
}
const outIndex = args.indexOf('--out');
const out = outIndex >= 0 && args[outIndex + 1]
  ? args[outIndex + 1]
  : `${path.basename(file, path.extname(file))}.transitive-trace.patchcert.lean`;

try {
  const source = fs.readFileSync(file, 'utf8');
  const certificate = generateTransitiveCallBodyCertificate(source, {
    name: path.basename(file, path.extname(file)),
    entry: path.basename(file)
  });
  fs.writeFileSync(out, certificate.lean, 'utf8');
  console.log(`Generated ${out}`);
  console.log(`  source sha256: ${certificate.sourceSha256}`);
  console.log(`  certified transitive call(s): ${certificate.certified.join(', ')}`);
  console.log(`  maximum nested call depth: ${certificate.artifact.summary.maxNestedCallDepth}`);
  console.log('  assurance: Lean re-evaluates exact outer binding and every finite nested call argument/binding, GuardExpr branch, static repeat and direct quantitative effect, then checks nested semantic-signature containment edge by edge and imports the complete transitive trace into the caller signature.');
  console.log('  boundary: root-program certification, recursion/cycles, dynamic repeat, persistent-state exact guards, returns and production-Wasm call equivalence remain outside the beta.30 candidate.');
} catch (err) {
  console.error(`Patch stopped: ${err.message}`);
  process.exit(2);
}
