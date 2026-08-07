#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { PatchInterpreter } from './interpreter.js';
import { compile } from './compiler.js';
import { buildPatchApp, serializePatchApp } from './bundle.js';
import { compileToWasm } from './wasm.js';

const args = process.argv.slice(2);
const known = new Set(['run', 'check', 'build']);
const command = known.has(args[0]) ? args.shift() : 'run';
const file = args.shift();

if (!file) {
  help();
  process.exit(1);
}

try {
  const source = fs.readFileSync(file, 'utf8');

  if (command === 'run') {
    const result = new PatchInterpreter().run(source);
    for (const line of result.output) console.log(line);
    process.exit(0);
  }

  if (command === 'check') {
    const { ir } = compile(source, { name: appName(file) });
    console.log(`Patch check passed: ${ir.instructions.length} top-level instruction(s), ${ir.capabilities.length} capability set(s).`);
    process.exit(0);
  }

  if (command === 'build') {
    const kind = option('--kind') ?? 'console';
    const target = option('--target') ?? 'portable';
    const name = option('--name') ?? appName(file);

    if (target === 'portable') {
      const out = option('--out') ?? `${name}.patchapp`;
      const bundle = buildPatchApp(source, { name, kind, targets: [target] });
      fs.writeFileSync(out, serializePatchApp(bundle), 'utf8');
      console.log(`Built ${out}`);
      console.log(`  type: ${kind}`);
      console.log('  target: portable .patchapp');
      process.exit(0);
    }

    if (target === 'wasm') {
      const out = option('--out') ?? `${name}.wasm`;
      const { module } = compileToWasm(source, { name, kind, entry: path.basename(file) });
      fs.writeFileSync(out, module);
      console.log(`Built ${out}`);
      console.log(`  type: ${kind}`);
      console.log('  target: WebAssembly bootstrap module');
      console.log('  note: this beta embeds Patch source + Change IR for a Patch host; direct Change IR-to-Wasm execution is the next backend stage.');
      process.exit(0);
    }

    throw new Error(`Unknown build target '${target}'. Use portable or wasm.`);
  }
} catch (err) {
  console.error(`Patch stopped: ${err.message}`);
  process.exit(2);
}

function option(name) {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : null;
}

function appName(filePath) {
  return path.basename(filePath, path.extname(filePath)).replace(/[^A-Za-z0-9_-]/g, '_') || 'PatchApp';
}

function help() {
  console.error(`Patch beta\n\nRun:\n  patch run program.patch\n\nCheck:\n  patch check program.patch\n\nBuild portable bundle:\n  patch build program.patch --kind console --target portable\n  patch build program.patch --kind window --target portable --out MyApp.patchapp\n\nBuild bootstrap WebAssembly module:\n  patch build program.patch --kind console --target wasm --out MyApp.wasm`);
}
