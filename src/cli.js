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
import { diagnosticFromError } from './diagnostics.js';
import { createCliResult, PATCH_CLI_EXIT } from './cli-contract.js';

const argv = process.argv.slice(2);
const known = new Set(['run', 'run-wasm', 'check', 'changes', 'formal', 'certify', 'runtime-certify', 'build']);
const command = known.has(argv[0]) ? argv.shift() : 'run';
const jsonCommands = new Set(['check', 'formal', 'certify', 'build']);
const jsonIndex = argv.indexOf('--json');
const jsonRequested = jsonIndex >= 0;
if (jsonRequested) argv.splice(jsonIndex, 1);
const json = jsonRequested && jsonCommands.has(command);
const args = argv;
const file = args.shift();

if (jsonRequested && !jsonCommands.has(command)) {
  console.error("Patch CLI usage: --json is supported for check, formal, certify, and build.");
  process.exit(PATCH_CLI_EXIT.USAGE);
}

if (!file) {
  if (json) {
    emitJson(createCliResult({
      command,
      ok: false,
      exitCode: PATCH_CLI_EXIT.USAGE,
      data: { usage: usageFor(command) }
    }));
  } else {
    help();
  }
  process.exit(PATCH_CLI_EXIT.USAGE);
}

let source = '';
const entry = path.basename(file);
try {
  source = fs.readFileSync(file, 'utf8');

  if (command === 'run') {
    const result = new PatchInterpreter().run(source);
    for (const line of result.output) console.log(line);
    process.exit(PATCH_CLI_EXIT.OK);
  }

  if (command === 'run-wasm') {
    const name = option('--name') ?? appName(file);
    const { module, metadata } = compileToDirectWasm(source, { name, kind: 'console', entry });
    const result = await runDirectWasm(module, metadata);
    for (const line of result.output) console.log(line);
    process.exit(PATCH_CLI_EXIT.OK);
  }

  if (command === 'check') {
    const { ir } = compile(source, { name: appName(file), entry });
    const data = checkResultData(ir);
    if (json) {
      emitJson(createCliResult({ command, ok: true, exitCode: PATCH_CLI_EXIT.OK, entry, data }));
    } else {
      console.log(`Patch check passed: ${data.instructions} top-level instruction(s), ${data.recipeChangeSignatures} recipe change signature(s), ${data.changeCapabilityPolicies} change capability policy/policies, ${data.semanticBridge.supported}/${data.semanticBridge.total} semantic bridge entry/entries supported, ${data.formalSource.supported}/${data.formalSource.total} source/range entry/entries supported, ${data.sourceValidation.validated}/${data.sourceValidation.total} raw-source extraction entry/entries validated, ${data.guardValidation.validated}/${data.guardValidation.total} raw guard entry/entries validated, ${data.formalSource.rangeClaims} formal integer range claim(s), ${data.formalSource.guardClaims} formal guard claim(s).`);
    }
    process.exit(PATCH_CLI_EXIT.OK);
  }

  if (command === 'changes') {
    const { ir } = compile(source, { name: appName(file), entry });
    printChangeAnalysis(ir);
    process.exit(PATCH_CLI_EXIT.OK);
  }

  if (command === 'formal') {
    const { ir } = compile(source, { name: appName(file), entry });
    const mismatchCount =
      ir.formalBridge.summary.mismatches +
      ir.sourceValidation.summary.mismatches +
      ir.guardValidation.summary.mismatches;
    const exitCode = mismatchCount === 0 ? PATCH_CLI_EXIT.OK : PATCH_CLI_EXIT.FAILURE;
    if (json) {
      const diagnostic = mismatchCount === 0 ? null : diagnosticFromError(
        new Error(`Formal validation reported ${mismatchCount} mismatch(es).`),
        { phase: 'compiler', entry }
      );
      emitJson(createCliResult({
        command,
        ok: exitCode === PATCH_CLI_EXIT.OK,
        exitCode,
        entry,
        data: formalResultData(ir),
        diagnostic
      }));
    } else {
      printFormalCoverage(ir.formalBridge, ir.formalSource, ir.sourceValidation, ir.guardValidation);
    }
    process.exit(exitCode);
  }

  if (command === 'certify') {
    const name = option('--name') ?? appName(file);
    const out = option('--out') ?? `${name}.patchcert.lean`;
    const certificate = generateLeanCertificate(source, { name });
    fs.writeFileSync(out, certificate.lean, 'utf8');
    if (json) {
      emitJson(createCliResult({
        command,
        ok: true,
        exitCode: PATCH_CLI_EXIT.OK,
        entry,
        data: {
          artifact: { path: out, kind: 'lean-certificate' },
          sourceSha256: certificate.sourceSha256,
          sourceSchemaVersion: certificate.sourceSchemaVersion,
          sourceValidationSchemaVersion: certificate.sourceValidationSchemaVersion,
          evidenceSchemaVersion: certificate.evidenceSchemaVersion,
          rangeSchemaVersion: certificate.rangeSchemaVersion,
          certifiedRangeClaims: certificate.certifiedRangeClaims,
          certifiedRecipes: certificate.certified
        }
      }));
    } else {
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
    }
    process.exit(PATCH_CLI_EXIT.OK);
  }

  if (command === 'runtime-certify') {
    const name = option('--name') ?? appName(file);
    const out = option('--out') ?? `${name}.runtime.patchcert.lean`;
    const certificate = await generateLeanRuntimeCertificate(source, { name, entry });
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
    process.exit(PATCH_CLI_EXIT.OK);
  }

  if (command === 'build') {
    const target = option('--target') ?? 'portable';
    const name = option('--name') ?? appName(file);
    const explicitKind = option('--kind');
    const inferred = explicitKind ? null : compile(source, { name, entry });
    const kind = explicitKind ?? inferred.project.kind;

    if (target === 'portable') {
      const out = option('--out') ?? `${name}.patchapp`;
      const bundle = buildPatchApp(source, { name, kind, targets: [target] });
      fs.writeFileSync(out, serializePatchApp(bundle), 'utf8');
      if (json) emitBuildJson({ path: out, kind, target, format: bundle.format ?? 'patchapp', version: bundle.version ?? null });
      else {
        console.log(`Built ${out}`);
        console.log(`  type: ${kind}`);
        console.log('  target: portable .patchapp');
      }
      process.exit(PATCH_CLI_EXIT.OK);
    }

    if (target === 'wasm') {
      const out = option('--out') ?? `${name}.wasm`;
      const { module, payload } = compileToWasm(source, { name, kind, entry });
      fs.writeFileSync(out, module);
      if (json) emitBuildJson({ path: out, kind, target, format: payload.format, version: payload.version });
      else {
        console.log(`Built ${out}`);
        console.log(`  type: ${kind}`);
        console.log('  target: bootstrap WebAssembly module');
        console.log('  note: this target embeds Patch source + Change IR for a Patch host; use web for an executable Window app or wasm-direct for the supported Console subset.');
      }
      process.exit(PATCH_CLI_EXIT.OK);
    }

    if (target === 'wasm-direct') {
      if (kind === 'window') {
        throw new Error('Direct WebAssembly currently supports Console projects only. For a Window project use --target web or Patch Studio\'s Windows/macOS/Linux App builds.');
      }
      const out = option('--out') ?? `${name}.direct.wasm`;
      const { module, metadata } = compileToDirectWasm(source, { name, kind: 'console', entry });
      fs.writeFileSync(out, module);
      if (json) emitBuildJson({ path: out, kind: 'console', target, format: metadata.format, version: metadata.version }, metadata);
      else {
        console.log(`Built ${out}`);
        console.log('  type: console');
        console.log(`  target: direct WebAssembly ${metadata.version}`);
        console.log('  executes: numeric create/change/show/control-flow/recipe subset directly as Wasm instructions');
        console.log('  host ABI: patch.show_number(f64), patch.change_number(i32,f64,f64)');
      }
      process.exit(PATCH_CLI_EXIT.OK);
    }

    if (target === 'c99') {
      if (kind !== 'console') throw new Error('Portable C99 currently supports Console projects only.');
      const out = option('--out') ?? `${name}.c`;
      const built = compileToC99(source, { name, kind: 'console', entry });
      fs.writeFileSync(out, built.source, 'utf8');
      if (json) emitBuildJson({ path: out, kind: 'console', target, format: built.metadata.format, version: built.metadata.version }, built.metadata);
      else {
        console.log(`Built ${out}`);
        console.log(`  target: portable C99 ${built.metadata.version}`);
        console.log('  compile: cc -std=c99 -O2 -o App App.c -lm');
        console.log('  intended use: FreeBSD and generic Unix portability fallback');
      }
      process.exit(PATCH_CLI_EXIT.OK);
    }

    if (target === 'web') {
      const out = option('--out') ?? `${name}.html`;
      const built = buildStandaloneWebApp(source, { name, kind, entry });
      fs.writeFileSync(out, built.html, 'utf8');
      const projectKind = built.metadata?.projectKind ?? kind;
      if (json) emitBuildJson({ path: out, kind: projectKind, target, format: built.metadata?.format ?? 'patch-web-app', version: built.metadata?.version ?? null }, built.metadata ?? null);
      else {
        console.log(`Built ${out}`);
        console.log(`  type: ${projectKind}`);
        console.log('  target: standalone single-file Web App');
        console.log(projectKind === 'window'
          ? '  runtime: generated Patch Window browser runtime'
          : '  runtime: embedded direct Patch Wasm + tiny browser host');
        console.log('  run: open the HTML file in a modern browser');
      }
      process.exit(PATCH_CLI_EXIT.OK);
    }

    if (target === 'app' || target === 'native') {
      if (kind === 'window') {
        throw new Error('Local CLI Window packaging currently uses the dedicated Window packager through Patch Studio/GitHub Actions. Choose a Windows/macOS/Linux App in Patch Studio; --target app/native remains the local Console host for now.');
      }
      const out = option('--out');
      const built = buildNativeApp(source, {
        name,
        entry,
        out,
        bundle: target === 'app',
        desktopShell: target === 'app',
        quiet: json
      });
      if (json) emitBuildJson({ path: built.output, kind: 'console', target, format: built.outputKind, version: built.version ?? null }, { runtime: built.runtime, platform: built.platform });
      else {
        console.log(`Built ${built.output}`);
        console.log(`  target: ${built.outputKind}`);
        console.log(`  runtime: ${built.runtime}`);
        console.log('  note: the direct Patch Wasm module is embedded inside the standalone native Console host.');
      }
      process.exit(PATCH_CLI_EXIT.OK);
    }

    throw new Error(`Unknown build target '${target}'. Use portable, wasm, wasm-direct, c99, web, native, or app.`);
  }
} catch (err) {
  if (json) {
    emitJson(createCliResult({
      command,
      ok: false,
      exitCode: PATCH_CLI_EXIT.FAILURE,
      entry,
      diagnostic: diagnosticFromError(err, { phase: phaseForCommand(command), source, entry })
    }));
  } else {
    console.error(`Patch stopped: ${err.message}`);
  }
  process.exit(PATCH_CLI_EXIT.FAILURE);
}

function checkResultData(ir) {
  const recipeChangeSignatures = Object.keys(ir.changeSignatures).filter(name => name !== '$program').length;
  const changeCapabilityPolicies = Object.keys(ir.changeCapabilities).length;
  const bridgeCovered = ir.formalBridge.summary.supported;
  const sourceCovered = ir.formalSource.summary.supported;
  const sourceValidated = ir.sourceValidation.summary.validated;
  const guardValidated = ir.guardValidation.summary.validated;
  return {
    project: ir.project,
    irVersion: ir.version,
    instructions: ir.instructions.length,
    recipeChangeSignatures,
    changeCapabilityPolicies,
    semanticBridge: {
      supported: bridgeCovered,
      total: bridgeCovered + ir.formalBridge.summary.unsupported,
      mismatches: ir.formalBridge.summary.mismatches
    },
    formalSource: {
      supported: sourceCovered,
      total: sourceCovered + ir.formalSource.summary.unsupported,
      rangeClaims: ir.formalSource.summary.rangeClaims ?? 0,
      guardClaims: ir.formalSource.summary.guardClaims ?? 0
    },
    sourceValidation: {
      validated: sourceValidated,
      total: sourceValidated + ir.sourceValidation.summary.unvalidated,
      mismatches: ir.sourceValidation.summary.mismatches
    },
    guardValidation: {
      validated: guardValidated,
      total: guardValidated + ir.guardValidation.summary.unvalidated,
      mismatches: ir.guardValidation.summary.mismatches
    }
  };
}

function formalResultData(ir) {
  return {
    project: ir.project,
    irVersion: ir.version,
    semanticBridge: ir.formalBridge,
    formalSource: ir.formalSource,
    sourceValidation: ir.sourceValidation,
    guardValidation: ir.guardValidation
  };
}

function emitBuildJson(artifact, metadata = null) {
  emitJson(createCliResult({
    command: 'build',
    ok: true,
    exitCode: PATCH_CLI_EXIT.OK,
    entry,
    data: { artifact, metadata }
  }));
}

function emitJson(result) {
  console.log(JSON.stringify(result, null, 2));
}

function phaseForCommand(value) {
  if (value === 'build') return 'build';
  if (value === 'run' || value === 'run-wasm') return 'runtime';
  return 'compiler';
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
  for (const [name, item] of Object.entries(bridge.entries)) {
    if (item.supported) {
      console.log(`  ✓ ${name}: production signature matches independently reconstructed semantic-core signature`);
      continue;
    }
    console.log(`  · ${name}: outside semantic bridge subset`);
    for (const reason of item.reasons) console.log(`      - ${reason}`);
  }
  console.log(`Semantic bridge summary: ${bridge.summary.supported} supported, ${bridge.summary.unsupported} unsupported, ${bridge.summary.mismatches} mismatch(es).`);

  console.log(`Formal source/range/guard core ${sourceCore.version} -> Lean model ${sourceCore.leanModel}`);
  for (const [name, item] of Object.entries(sourceCore.entries)) {
    if (item.supported) {
      const guard = item.guardSupported
        ? `${item.guardClaims.length} guard claim(s) in the beta.23 parameter fragment`
        : `guard-aware runtime coverage unavailable: ${(item.guardReasons ?? []).join('; ') || 'unsupported guard'}`;
      console.log(`  ✓ ${name}: source changes are covered; ${item.rangeClaims.length} numeric range claim(s); ${guard}`);
      continue;
    }
    console.log(`  · ${name}: outside formal source/range subset`);
    for (const reason of item.reasons) console.log(`      - ${reason}`);
  }
  console.log(`Source/range summary: ${sourceCore.summary.supported} supported, ${sourceCore.summary.unsupported} unsupported, ${sourceCore.summary.rangeClaims ?? 0} formal integer range claim(s), ${sourceCore.summary.guardClaims ?? 0} formal guard claim(s).`);

  console.log(`Raw-source extraction validation ${sourceValidation.version}`);
  for (const [name, item] of Object.entries(sourceValidation.entries)) {
    if (item.validated) {
      console.log(`  ✓ ${name}: raw source independently reconstructs the production SourceStmt and range claims`);
      continue;
    }
    console.log(`  · ${name}: not source-validated`);
    for (const reason of item.reasons) console.log(`      - ${reason}`);
  }
  console.log(`Source extraction summary: ${sourceValidation.summary.validated} validated, ${sourceValidation.summary.unvalidated} unvalidated, ${sourceValidation.summary.mismatches} mismatch(es).`);

  console.log(`Raw guard extraction validation ${guardValidation.version}`);
  for (const [name, item] of Object.entries(guardValidation.entries)) {
    if (item.validated) {
      console.log(`  ✓ ${name}: raw source independently reconstructs GuardTree, guard claims and recipe guard variables`);
      continue;
    }
    console.log(`  · ${name}: not guard-validated for beta.23 runtime correspondence`);
    for (const reason of item.reasons) console.log(`      - ${reason}`);
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

function usageFor(value) {
  if (value === 'check') return 'patch check program.patch [--json]';
  if (value === 'formal') return 'patch formal program.patch [--json]';
  if (value === 'certify') return 'patch certify program.patch [--out Program.patchcert.lean] [--json]';
  if (value === 'build') return 'patch build program.patch --target <target> [--out artifact] [--json]';
  return 'patch <command> program.patch';
}

function help() {
  console.error(`Patch beta\n\nRun with interpreter:\n  patch run program.patch\n\nRun direct Wasm (Console subset):\n  patch run-wasm program.patch\n\nCheck:\n  patch check program.patch [--json]\n\nInspect semantic change signatures and policies:\n  patch changes program.patch\n\nInspect formal source/range/guard and translation-validation coverage:\n  patch formal program.patch [--json]\n\nGenerate static Lean certificate:\n  patch certify program.patch --out Program.patchcert.lean [--json]\n\nExecute direct Wasm and generate guard-aware Lean runtime/capability certificate:\n  patch runtime-certify program.patch --out Program.runtime.patchcert.lean\n\nBuild portable bundle:\n  patch build program.patch --target portable [--json]\n\nBuild standalone single-file Web App (Console or Window inferred):\n  patch build program.patch --target web --out MyApp.html [--json]\n\nBuild direct WebAssembly (Console subset):\n  patch build program.patch --target wasm-direct --out MyApp.direct.wasm [--json]\n\nBuild portable C99 for FreeBSD/Unix Console:\n  patch build program.patch --target c99 --out MyApp.c [--json]\n\nBuild local native Console app for the current OS:\n  patch build program.patch --target app --name MyApp [--json]\n\nBuild local native Console executable for the current OS:\n  patch build program.patch --target native --out MyApp [--json]\n\nWindow desktop packages:\n  use Patch Studio -> Windows/macOS/Linux App\n\nAdvanced bootstrap Wasm carrier:\n  patch build program.patch --target wasm --out MyApp.bootstrap.wasm [--json]`);
}
