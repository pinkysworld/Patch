#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { generateTransitiveRuntimeCertificate } from '../src/transitive-runtime-certificate.js';

const args = process.argv.slice(2);
if (!args.length) {
  console.error('Usage: node scripts/generate-transitive-runtime-certificate.js <file.patch> [--out GeneratedTransitiveRuntimeCertificate.lean]');
  process.exit(1);
}

const input = args[0];
let out = 'formal/GeneratedTransitiveRuntimeCertificate.lean';
for (let index = 1; index < args.length; index += 1) {
  if (args[index] === '--out' && args[index + 1]) {
    out = args[index + 1];
    index += 1;
  }
}

const source = fs.readFileSync(input, 'utf8');
const result = await generateTransitiveRuntimeCertificate(source, {
  name: path.basename(input, path.extname(input))
});
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, result.lean);
console.log(`Generated ${out}`);
console.log(`  source sha256: ${result.sourceSha256}`);
console.log(`  direct-Wasm trace sha256: ${result.runtimeTraceSha256}`);
console.log(`  certified call-aware transitive runtime witness(es): ${result.certified.join(', ')}`);
console.log(`  correspondence schema: ${result.correspondenceVersion}`);
console.log(`  certificate schema: ${result.certificateVersion}`);
console.log(`  direct-effect validation schema: ${result.directEffectValidationVersion}`);
console.log('  assurance: the direct-Wasm module was executed; the complete target/before/after trace was independently validated; recipe scope and semantic operations were reconstructed by the validator; unambiguous scoped effect slices are then re-evaluated by Lean against the beta.30 exact call tree and caller signature.');
console.log('  boundary: runtime capture, independent-validator correctness and scoped-slice attribution remain proof-free evidence boundaries; ambiguous repeated traces fail closed.');
