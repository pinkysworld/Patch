#!/usr/bin/env node
import fs from 'node:fs';
import { compileToDirectWasm, runDirectWasm } from '../src/wasm-direct.js';
import { validateDirectTrace } from '../src/direct-trace-validator.js';

const file = process.argv[2] ?? 'examples/direct-wasm-recipes.patch';
const source = fs.readFileSync(file, 'utf8');
const { module, metadata, compiled } = compileToDirectWasm(source, {
  name: 'DirectTraceValidation',
  kind: 'console',
  entry: file
});

if (!WebAssembly.validate(module)) throw new Error('Direct Wasm module failed WebAssembly validation.');

const direct = await runDirectWasm(module, metadata);
const validation = validateDirectTrace(compiled.ir, direct.trace);

if (!validation.ok) throw new Error('Direct trace validation did not report success.');

console.log(`ok direct trace validation: ${validation.contract.sites.length} change site(s), ${direct.trace.length} observed transition(s)`);
for (const event of validation.expectedTrace) {
  console.log(`  site ${event.siteId} ${event.scope}:${event.line ?? '?'} ${event.target}: ${event.before} -> ${event.after}`);
}
