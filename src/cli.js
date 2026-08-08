#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { PatchInterpreter } from './interpreter.js';
import { compile } from './compiler.js';
import { buildPatchApp, serializePatchApp } from './bundle.js';
import { compileToWasm } from './wasm.js';
import { generateLeanCertificate } from './certificate.js';

const args = process.argv.slice(2);
const known = new Set(['run', 'check', 'changes', 'formal', 'certify', 'build']);
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
    const recipeSignatures = Object.keys(ir.changeSignatures).filter(name => name !== '$program').length;
    const policies = Object.keys(ir.changeCapabilities).length;
    const bridgeCovered = ir.formalBridge.summary.supported;
    const bridgeTotal = bridgeCovered + ir.formalBridge.summary.unsupported;
    const sourceCovered = ir.formalSource.summary.supported;
    const sourceTotal = sourceCovered + ir.formalSource.summary.unsupported;
    console.log(`Patch check passed: ${ir.instructions.length} top-level instruction(s), ${recipeSignatures} recipe change signature(s), ${policies} change capability policy/policies, ${bridgeCovered}/${bridgeTotal} semantic bridge entry/entries supported, ${sourceCovered}/${sourceTotal} source-core entry/entries supported.`);
    process.exit(0);
  }

  if (command === 'changes') {
    const { ir } = compile(source, { name: appName(file) });
    printChangeAnalysis(ir);
    process.exit(0);
  }

  if (command === 'formal') {
    const { ir } = compile(source, { name: appName(file) });
    printFormalCoverage(ir.formalBridge, ir.formalSource);
    process.exit(ir.formalBridge.summary.mismatches === 0 ? 0 : 2);
  }

  if (command === 'certify') {
    const name = option('--name') ?? appName(file);
    const out = option('--out') ?? `${name}.patchcert.lean`;
    const certificate = generateLeanCertificate(source, { name });
    fs.writeFileSync(out, certificate.lean, 'utf8');
    console.log(`Generated ${out}`);
    console.log(`  source sha256: ${certificate.sourceSha256}`);
    console.log(`  source-core schema: ${certificate.sourceSchemaVersion}`);
    console.log(`  evidence schema: ${certificate.evidenceSchemaVersion}`);
    console.log(`  certified recipe(s): ${certificate.certified.join(', ')}`);
    console.log('  next: compile this certificate with the repository\'s Lean PatchSource module to validate source-core normalization, evidence/signature correspondence and the semantic policy.');
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

function printChangeAnalysis(ir) {
  const names = Object.keys(ir.changeSignatures).filter(name => name !== '$program');
  if (!names.length) console.log('No recipes declare persistent changes.');
  for (const name of names) {
    const signature = ir.changeSignatures[name];
    console.log(`${name}(${signature.params.join(', ')})`);
    if (!signature.changes.length) console.log('  changes: none');
    for (const change of signature.changes) {
      const amount = change.staticAmount ? ` by ${change.amount}` : change.amountRange ? ` by ${change.amountRange.min}..${change.amountRange.max}` : '';
      const via = change.via ? ` via ${change.via}` : '';
      const preview = change.committed === false ? ' [preview only]' : '';
      console.log(`  ${change.path}: ${change.operation}${amount}${via}${preview}`);
    }
    const rules = ir.changeCapabilities[name];
    if (rules?.length) {
      console.log('  allowed:');
      for (const rule of rules) {
        const path = rule.field ? `${rule.target}.${rule.field}` : rule.target;
        const bound = rule.maxAmount === null ? '' : ` up to ${rule.maxAmount}`;
        console.log(`    ${path}: ${rule.operation}${bound}`);
      }
    }
  }
}

function printFormalCoverage(bridge, sourceCore) {
  console.log(`Semantic bridge ${bridge.version} -> Lean model ${bridge.leanModel}`);
  console.log(`  theorem basis: ${bridge.theorem}`);
  for (const [name, entry] of Object.entries(bridge.entries)) {
    if (entry.supported) {
      console.log(`  ✓ ${name}: production signature matches independently reconstructed semantic-core signature`);
      continue;
    }
    console.log(`  · ${name}: outside semantic bridge subset`);
    for (const reason of entry.reasons) console.log(`      - ${reason}`);
  }
  console.log(`Semantic bridge summary: ${bridge.summary.supported} supported, ${bridge.summary.unsupported} unsupported, ${bridge.summary.mismatches} mismatch(es).`);

  console.log(`Formal source core ${sourceCore.version} -> Lean model ${sourceCore.leanModel}`);
  for (const [name, entry] of Object.entries(sourceCore.entries)) {
    if (entry.supported) {
      console.log(`  ✓ ${name}: source-level add/remove/set/clear structure can be emitted for Lean normalization`);
      continue;
    }
    console.log(`  · ${name}: outside formal source-core subset`);
    for (const reason of entry.reasons) console.log(`      - ${reason}`);
  }
  console.log(`Source-core summary: ${sourceCore.summary.supported} supported, ${sourceCore.summary.unsupported} unsupported.`);
  console.log('Note: beta.8 certificates let Lean normalize the formal SourceStmt to semantic evidence and then check the independent production signature/policy. JavaScript source/AST -> SourceStmt extraction and production range-analysis soundness remain explicit proof obligations.');
}

function option(name) {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : null;
}

function appName(filePath) {
  return path.basename(filePath, path.extname(filePath)).replace(/[^A-Za-z0-9_-]/g, '_') || 'PatchApp';
}

function help() {
  console.error(`Patch beta\n\nRun:\n  patch run program.patch\n\nCheck:\n  patch check program.patch\n\nInspect semantic change signatures and policies:\n  patch changes program.patch\n\nInspect semantic-bridge and formal source-core coverage:\n  patch formal program.patch\n\nGenerate Lean-checkable source/evidence certificate:\n  patch certify program.patch --out Program.patchcert.lean\n\nBuild portable bundle:\n  patch build program.patch --kind console --target portable\n  patch build program.patch --kind window --target portable --out MyApp.patchapp\n\nBuild bootstrap WebAssembly module:\n  patch build program.patch --kind console --target wasm --out MyApp.wasm`);
}
