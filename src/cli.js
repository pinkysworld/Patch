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
import { generateLeanRuntimeCertificate } from './runtime-certificate.js';

const args = process.argv.slice(2);
const known = new Set(['run', 'run-wasm', 'check', 'changes', 'formal', 'certify', 'runtime-certify', 'build']);
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
    const sourceValidationTotal = sourceValidated + ir.sourceValidation.summary.unvalidated;
    const guardValidated = ir.guardValidation.summary.validated;
    const guardValidationTotal = guardValidated + ir.guardValidation.summary.unvalidated;
    const rangeClaims = ir.formalSource.summary.rangeClaims ?? 0;
    const guardClaims = ir.formalSource.summary.guardClaims ?? 0;
    console.log(`Patch check passed: ${ir.instructions.length} top-level instruction(s), ${recipeSignatures} recipe change signature(s), ${policies} change capability policy/policies, ${bridgeCovered}/${bridgeTotal} semantic bridge entry/entries supported, ${sourceCovered}/${sourceTotal} source/range entry/entries supported, ${sourceValidated}/${sourceValidationTotal} raw-source extraction entry/entries validated, ${guardValidated}/${guardValidationTotal} raw guard entry/entries validated, ${rangeClaims} formal integer range claim(s), ${guardClaims} formal guard claim(s).`);
    process.exit(0);
  }

  if (command === 'changes') {
    const { ir } = compile(source, { name: appName(file) });
    printChangeAnalysis(ir);
    process.exit(0);
  }

  if (command === 'formal') {
    const { ir } = compile(source, { name: appName(file) });
    printFormalCoverage(ir.formalBridge, ir.formalSource, ir.sourceValidation, ir.guardValidation);
    process.exit(
      ir.formalBridge.summary.mismatches === 0 &&
      ir.sourceValidation.summary.mismatches === 0 &&
      ir.guardValidation.summary.mismatches === 0 ? 0 : 2
    );
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

  if (command === 'runtime-certify') {
    const name = option('--name') ?? appName(file);
    const out = option('--out') ?? `${name}.runtime.patchcert.lean`;
    const certificate = await generateLeanRuntimeCertificate(source, { name, entry: path.basename(file) });
    fs.writeFileSync(out, certificate.lean, 'utf8');
    console.log(`Generated ${out}`);
    console.log(`  source sha256: ${certificate.sourceSha256}`);
    console.log(`  observed direct trace sha256: ${certificate.runtimeTraceSha256}`);
    console.log(`  runtime schema: ${certificate.runtimeSchemaVersion}`);
    console.log(`  path-witness schema: ${certificate.runtimePathWitnessVersion}`);
    console.log(`  guard-validation schema: ${certificate.guardValidationVersion}`);
    console.log(`  observed semantic effect occurrence(s): ${certificate.observedEffects}`);
    console.log(`  checked formal guard occurrence(s): ${certificate.checkedGuardClaims}`);
    console.log(`  certified protected invocation(s): ${certificate.certifiedInvocations}`);
    console.log(`  runtime-correspondence invocation(s): ${certificate.certified.join(', ')}`);
    console.log('  assurance: direct Wasm was executed; semantic effects, invocation environments and control-flow witnesses are proof-free evidence; Lean checks SourceStmt/GuardTree shape, branch choice against concrete integer/Boolean guard evaluation, SourceExecutes execution, concrete-to-formal effect refinement, and concrete effect containment in the declared Change Capability.');
    process.exit(0);
  }

  if (command === 'build') {
    const target = option('--target') ?? 'portable';
    const name = option('--name') ?? appName(file);
    const explicitKind = option('--kind');
    const inferred = explicitKind ? null : compile(source, { name, entry: path.basename(file) });
    const kind = explicitKind ?? inferred.project.kind;

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
      console.log('  note: this target embeds Patch source + Change IR for a Patch host; use web for an executable Window app or wasm-direct for the supported Console subset.');
      process.exit(0);
    }

    if (target === 'wasm-direct') {
      if (kind === 'window') {
        throw new Error('Direct WebAssembly currently supports Console projects only. For a Window project use --target web or Patch Studio\'s Windows/macOS/Linux App builds.');
      }
      const out = option('--out') ?? `${name}.direct.wasm`;
      const { module, metadata } = compileToDirectWasm(source, { name, kind: 'console', entry: path.basename(file) });
      fs.writeFileSync(out, module);
      console.log(`Built ${out}`);
      console.log('  type: console');
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
      const built = buildStandaloneWebApp(source, { name, kind, entry: path.basename(file) });
      fs.writeFileSync(out, built.html, 'utf8');
      console.log(`Built ${out}`);
      console.log(`  type: ${built.metadata?.projectKind ?? kind}`);
      console.log('  target: standalone single-file Web App');
      console.log(built.metadata?.projectKind === 'window'
        ? '  runtime: generated Patch Window browser runtime'
        : '  runtime: embedded direct Patch Wasm + tiny browser host');
      console.log('  run: open the HTML file in a modern browser');
      process.exit(0);
    }

    if (target === 'app' || target === 'native') {
      if (kind === 'window') {
        throw new Error('Local CLI Window packaging currently uses the dedicated Window packager through Patch Studio/GitHub Actions. Choose a Windows/macOS/Linux App in Patch Studio; --target app/native remains the local Console host for now.');
      }
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
      console.log('  note: the direct Patch Wasm module is embedded inside the standalone native Console host.');
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

function printFormalCoverage(bridge, sourceCore, sourceValidation, guardValidation) {
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

  console.log(`Formal source/range/guard core ${sourceCore.version} -> Lean model ${sourceCore.leanModel}`);
  for (const [name, entry] of Object.entries(sourceCore.entries)) {
    if (entry.supported) {
      const guard = entry.guardSupported
        ? `${entry.guardClaims.length} guard claim(s) in the beta.23 parameter fragment`
        : `guard-aware runtime coverage unavailable: ${(entry.guardReasons ?? []).join('; ') || 'unsupported guard'}`;
      console.log(`  ✓ ${name}: source changes are covered; ${entry.rangeClaims.length} numeric range claim(s); ${guard}`);
      continue;
    }
    console.log(`  · ${name}: outside formal source/range subset`);
    for (const reason of entry.reasons) console.log(`      - ${reason}`);
  }
  console.log(`Source/range summary: ${sourceCore.summary.supported} supported, ${sourceCore.summary.unsupported} unsupported, ${sourceCore.summary.rangeClaims ?? 0} formal integer range claim(s), ${sourceCore.summary.guardClaims ?? 0} formal guard claim(s).`);

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

  console.log(`Raw guard extraction validation ${guardValidation.version}`);
  for (const [name, entry] of Object.entries(guardValidation.entries)) {
    if (entry.validated) {
      console.log(`  ✓ ${name}: raw source independently reconstructs GuardTree, guard claims and recipe guard variables`);
      continue;
    }
    console.log(`  · ${name}: not guard-validated for beta.23 runtime correspondence`);
    for (const reason of entry.reasons) console.log(`      - ${reason}`);
  }
  console.log(`Guard extraction summary: ${guardValidation.summary.validated} validated, ${guardValidation.summary.unvalidated} unvalidated, ${guardValidation.summary.mismatches} mismatch(es).`);
  console.log('Note: static source/signature/policy certification remains independent of guard-aware runtime coverage. Beta.23 runtime certification additionally requires translation-validated parameter guards and concrete safe-integer invocation values; Lean checks each branch choice against guard evaluation before deriving SourceExecutes/refinement/capability conclusions. This remains restricted correspondence rather than full compiler verification.');
}

function option(name) {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : null;
}

function appName(filePath) {
  return path.basename(filePath, path.extname(filePath)).replace(/[^A-Za-z0-9_-]/g, '_') || 'PatchApp';
}

function help() {
  console.error(`Patch beta\n\nRun with interpreter:\n  patch run program.patch\n\nRun direct Wasm (Console subset):\n  patch run-wasm program.patch\n\nCheck:\n  patch check program.patch\n\nInspect semantic change signatures and policies:\n  patch changes program.patch\n\nInspect formal source/range/guard and translation-validation coverage:\n  patch formal program.patch\n\nGenerate static Lean certificate:\n  patch certify program.patch --out Program.patchcert.lean\n\nExecute direct Wasm and generate guard-aware Lean runtime/capability certificate:\n  patch runtime-certify program.patch --out Program.runtime.patchcert.lean\n\nBuild portable bundle:\n  patch build program.patch --target portable\n\nBuild standalone single-file Web App (Console or Window inferred):\n  patch build program.patch --target web --out MyApp.html\n\nBuild direct WebAssembly (Console subset):\n  patch build program.patch --target wasm-direct --out MyApp.direct.wasm\n\nBuild portable C99 for FreeBSD/Unix Console:\n  patch build program.patch --target c99 --out MyApp.c\n\nBuild local native Console app for the current OS:\n  patch build program.patch --target app --name MyApp\n\nBuild local native Console executable for the current OS:\n  patch build program.patch --target native --out MyApp\n\nWindow desktop packages:\n  use Patch Studio -> Windows/macOS/Linux App\n\nAdvanced bootstrap Wasm carrier:\n  patch build program.patch --target wasm --out MyApp.bootstrap.wasm`);
}
