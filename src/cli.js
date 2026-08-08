#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { PatchInterpreter } from './interpreter.js';
import { compile } from './compiler.js';
import { buildPatchApp, serializePatchApp } from './bundle.js';
import { compileToWasm } from './wasm.js';
import { compileToDirectWasm, runDirectWasm } from './wasm-direct.js';
import { compileToC99 } from './c99.js';
import { buildStandaloneWebApp } from './webapp.js';
import { buildNativeApp } from './native-app.js';
import { generateLeanCertificate } from './certificate.js';

const args = process.argv.slice(2);
const known = new Set(['run', 'run-wasm', 'check', 'changes', 'formal', 'certify', 'build']);
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

  if (command === 'run-wasm') {
    const name = option('--name') ?? appName(file);
    const { module, metadata } = compileToDirectWasm(source, { name, kind: 'console', entry: path.basename(file) });
    const result = await runDirectWasm(module, metadata);
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
    const sourceValidated = ir.sourceValidation.summary.validated;
    const validationTotal = sourceValidated + ir.sourceValidation.summary.unvalidated;
    const rangeClaims = ir.formalSource.summary.rangeClaims ?? 0;
    console.log(`Patch check passed: ${ir.instructions.length} top-level instruction(s), ${recipeSignatures} recipe change signature(s), ${policies} change capability policy/policies, ${bridgeCovered}/${bridgeTotal} semantic bridge entry/entries supported, ${sourceCovered}/${sourceTotal} source/range entry/entries supported, ${sourceValidated}/${validationTotal} raw-source extraction entry/entries validated, ${rangeClaims} formal integer range claim(s).`);
    process.exit(0);
  }

  if (command === 'changes') {
    const { ir } = compile(source, { name: appName(file) });
    printChangeAnalysis(ir);
    process.exit(0);
  }

  if (command === 'formal') {
    const { ir } = compile(source, { name: appName(file) });
    printFormalCoverage(ir.formalBridge, ir.formalSource, ir.sourceValidation);
    process.exit(ir.formalBridge.summary.mismatches === 0 && ir.sourceValidation.summary.mismatches === 0 ? 0 : 2);
  }

  if (command === 'certify') {
    const name = option('--name') ?? appName(file);
    const out = option('--out') ?? `${name}.patchcert.lean`;
    const certificate = generateLeanCertificate(source, { name });
    fs.writeFileSync(out, certificate.lean, 'utf8');
    console.log(`Generated ${out}`);
    console.log(`  source sha256: ${certificate.sourceSha256}`);
    console.log(`  source-core schema: ${certificate.sourceSchemaVersion}`);
    console.log(`  source-validation schema: ${certificate.sourceValidationSchemaVersion}`);
    console.log(`  evidence schema: ${certificate.evidenceSchemaVersion}`);
    console.log(`  range schema: ${certificate.rangeSchemaVersion}`);
    console.log(`  certified formal range claim(s): ${certificate.certifiedRangeClaims}`);
    console.log(`  certified recipe(s): ${certificate.certified.join(', ')}`);
    console.log('  source extraction: independently re-parsed from raw source and matched against the production AST-derived formal source view');
    console.log('  next: compile this certificate with the repository\'s Lean PatchRange module to validate integer range soundness, source-core normalization, evidence/signature correspondence and the semantic policy.');
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
      console.log('  target: bootstrap WebAssembly module');
      console.log('  note: this target embeds Patch source + Change IR for a Patch host; use wasm-direct or web for executable output.');
      process.exit(0);
    }

    if (target === 'wasm-direct') {
      const out = option('--out') ?? `${name}.direct.wasm`;
      const { module, metadata } = compileToDirectWasm(source, { name, kind, entry: path.basename(file) });
      fs.writeFileSync(out, module);
      console.log(`Built ${out}`);
      console.log(`  type: ${kind}`);
      console.log(`  target: direct WebAssembly ${metadata.version}`);
      console.log('  executes: numeric create/change/show/control-flow/recipe subset directly as Wasm instructions');
      console.log('  host ABI: patch.show_number(f64), patch.change_number(i32,f64,f64)');
      process.exit(0);
    }

    if (target === 'c99') {
      if (kind !== 'console') throw new Error('Portable C99 currently supports Console projects only.');
      const out = option('--out') ?? `${name}.c`;
      const built = compileToC99(source, { name, kind: 'console', entry: path.basename(file) });
      fs.writeFileSync(out, built.source, 'utf8');
      console.log(`Built ${out}`);
      console.log(`  target: portable C99 ${built.metadata.version}`);
      console.log('  compile: cc -std=c99 -O2 -o App App.c -lm');
      console.log('  intended use: FreeBSD and generic Unix portability fallback');
      process.exit(0);
    }

    if (target === 'web') {
      const out = option('--out') ?? `${name}.html`;
      const built = buildStandaloneWebApp(source, { name, entry: path.basename(file) });
      fs.writeFileSync(out, built.html, 'utf8');
      console.log(`Built ${out}`);
      console.log('  target: standalone single-file Web App');
      console.log('  run: open the HTML file in a modern browser');
      process.exit(0);
    }

    if (target === 'app' || target === 'native') {
      const out = option('--out');
      const built = buildNativeApp(source, {
        name,
        entry: path.basename(file),
        out,
        bundle: target === 'app',
        desktopShell: target === 'app'
      });
      console.log(`Built ${built.output}`);
      console.log(`  target: ${built.outputKind}`);
      console.log(`  runtime: ${built.runtime}`);
      console.log('  note: the direct Patch Wasm module is embedded inside the standalone native host.');
      process.exit(0);
    }

    throw new Error(`Unknown build target '${target}'. Use portable, wasm, wasm-direct, c99, web, native, or app.`);
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

function printFormalCoverage(bridge, sourceCore, sourceValidation) {
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

  console.log(`Formal source/range core ${sourceCore.version} -> Lean model ${sourceCore.leanModel}`);
  for (const [name, entry] of Object.entries(sourceCore.entries)) {
    if (entry.supported) {
      console.log(`  ✓ ${name}: source changes are covered; ${entry.rangeClaims.length} numeric range claim(s) use the formal integer fragment`);
      continue;
    }
    console.log(`  · ${name}: outside formal source/range subset`);
    for (const reason of entry.reasons) console.log(`      - ${reason}`);
  }
  console.log(`Source/range summary: ${sourceCore.summary.supported} supported, ${sourceCore.summary.unsupported} unsupported, ${sourceCore.summary.rangeClaims ?? 0} formal integer range claim(s).`);

  console.log(`Raw-source extraction validation ${sourceValidation.version}`);
  for (const [name, entry] of Object.entries(sourceValidation.entries)) {
    if (entry.validated) {
      console.log(`  ✓ ${name}: raw source independently reconstructs the production SourceStmt and range claims`);
      continue;
    }
    console.log(`  · ${name}: not source-validated`);
    for (const reason of entry.reasons) console.log(`      - ${reason}`);
  }
  console.log(`Source extraction summary: ${sourceValidation.summary.validated} validated, ${sourceValidation.summary.unvalidated} unvalidated, ${sourceValidation.summary.mismatches} mismatch(es).`);
  console.log('Note: Lean checks the formal range/source/evidence/signature/policy chain. The independent raw-source parser now translation-validates SourceStmt/range extraction for supported entries, but this is not a machine-checked proof of parser correctness. Production runtime-to-formal execution correspondence remains an explicit proof obligation.');
}

function option(name) {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : null;
}

function appName(filePath) {
  return path.basename(filePath, path.extname(filePath)).replace(/[^A-Za-z0-9_-]/g, '_') || 'PatchApp';
}

function help() {
  console.error(`Patch beta\n\nRun with interpreter:\n  patch run program.patch\n\nRun direct Wasm:\n  patch run-wasm program.patch\n\nCheck:\n  patch check program.patch\n\nInspect semantic change signatures and policies:\n  patch changes program.patch\n\nInspect formal + source-extraction coverage:\n  patch formal program.patch\n\nGenerate Lean certificate:\n  patch certify program.patch --out Program.patchcert.lean\n\nBuild portable bundle:\n  patch build program.patch --target portable\n\nBuild standalone single-file Web App:\n  patch build program.patch --target web --out MyApp.html\n\nBuild direct WebAssembly (requires Patch host ABI):\n  patch build program.patch --target wasm-direct --out MyApp.direct.wasm\n\nBuild portable C99 for FreeBSD/Unix:\n  patch build program.patch --target c99 --out MyApp.c\n\nBuild native app for the current OS:\n  patch build program.patch --target app --name MyApp\n\nBuild native console executable for the current OS:\n  patch build program.patch --target native --out MyApp\n\nAdvanced bootstrap Wasm carrier:\n  patch build program.patch --target wasm --out MyApp.bootstrap.wasm`);
}
