#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { evaluateSecurityCase } from '../src/security-case-study.js';
import { compileToDirectWasm, runDirectWasm } from '../src/wasm-direct.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const caseRoot = path.join(root, 'case-studies', 'checkout-extension');
const manifest = JSON.parse(fs.readFileSync(path.join(caseRoot, 'scenario.json'), 'utf8'));
const options = parseArgs(process.argv.slice(2));

const safeSource = fs.readFileSync(path.join(caseRoot, manifest.safe.file), 'utf8');
const safeAnalysis = evaluateSecurityCase(safeSource, { name: `${manifest.name}-safe` });
verifyDecision('safe', manifest.safe, safeAnalysis);
const safeCompiled = compileToDirectWasm(safeSource, { name: 'CheckoutExtensionSafe', kind: 'console' });
const safeExecution = await runDirectWasm(safeCompiled.module, safeCompiled.metadata);
verifyState(manifest.safe.expectedState, safeExecution.state);
verifyProtectedEffects(manifest.entryRecipe, manifest.safe.expectedProtectedEffects, safeAnalysis.patch.signatures);

const variants = [];
for (const variant of manifest.variants) {
  const source = fs.readFileSync(path.join(caseRoot, variant.file), 'utf8');
  const analysis = evaluateSecurityCase(source, { name: `${manifest.name}-${variant.id}` });
  verifyDecision(variant.id, variant, analysis);
  variants.push({
    ...variant,
    patchAccepted: analysis.patch.accepted,
    patchError: analysis.patch.error,
    coarseWriteAccepted: analysis.coarseTargetWrite.accepted,
    coarsePolicies: analysis.coarseTargetWrite.policies,
    differential: analysis.differential
  });
}

const report = {
  format: 'patch-realistic-extension-case-report',
  version: '0.1',
  scenario: manifest.name,
  entryRecipe: manifest.entryRecipe,
  generatedAt: new Date().toISOString(),
  baselineBoundary: 'internal coarse target-path write-authority ablation; not a named prior system',
  safe: {
    file: manifest.safe.file,
    patchAccepted: safeAnalysis.patch.accepted,
    coarseWriteAccepted: safeAnalysis.coarseTargetWrite.accepted,
    finalState: safeExecution.state,
    runtimeTrace: safeExecution.trace,
    protectedSignature: safeAnalysis.patch.signatures?.[manifest.entryRecipe] ?? null
  },
  variants,
  summary: {
    variants: variants.length,
    patchRejectedVariants: variants.filter(item => !item.patchAccepted).length,
    coarseAcceptedVariants: variants.filter(item => item.coarseWriteAccepted).length,
    semanticAuthorityDifferentialRejects: variants.filter(item => item.coarseWriteAccepted && !item.patchAccepted).length,
    bothReject: variants.filter(item => !item.coarseWriteAccepted && !item.patchAccepted).length
  }
};

const json = `${JSON.stringify(report, null, 2)}\n`;
if (options.out) write(options.out, json);
else process.stdout.write(json);
if (options.markdown) write(options.markdown, toMarkdown(report));
if (options.out) console.log(`wrote ${options.out}`);
if (options.markdown) console.log(`wrote ${options.markdown}`);

function verifyDecision(id, expected, analysis) {
  const expectedPatch = expected.patchExpected === 'accept';
  if (analysis.patch.accepted !== expectedPatch) {
    throw new Error(`${id}: expected Patch ${expected.patchExpected}, observed ${analysis.patch.accepted ? 'accept' : 'reject'}${analysis.patch.error ? ` (${analysis.patch.error.message})` : ''}.`);
  }
  if (analysis.coarseTargetWrite.accepted !== expected.coarseWriteExpected) {
    throw new Error(`${id}: expected coarse target-write=${expected.coarseWriteExpected}, observed ${analysis.coarseTargetWrite.accepted}.`);
  }
  if (expected.errorContains && !analysis.patch.error?.message.includes(expected.errorContains)) {
    throw new Error(`${id}: expected diagnostic '${expected.errorContains}', observed '${analysis.patch.error?.message ?? '<none>'}'.`);
  }
}

function verifyState(expected, actual) {
  for (const [name, value] of Object.entries(expected)) {
    if (!Object.is(actual[name], value)) throw new Error(`safe execution: expected ${name}=${value}, observed ${actual[name]}.`);
  }
}

function verifyProtectedEffects(recipe, expected, signatures) {
  const effects = signatures?.[recipe]?.changes ?? [];
  for (const wanted of expected) {
    const match = effects.find(effect =>
      effect.target === wanted.target &&
      effect.operation === wanted.operation &&
      effectMax(effect) === wanted.maxAmount &&
      String(effect.via ?? '').includes(wanted.viaContains)
    );
    if (!match) {
      throw new Error(`${recipe}: missing protected transitive effect ${wanted.target} ${wanted.operation} up to ${wanted.maxAmount} via ${wanted.viaContains}. Observed ${JSON.stringify(effects)}.`);
    }
  }
}

function effectMax(effect) {
  if (Number.isFinite(effect.amountRange?.max)) return effect.amountRange.max;
  if (Number.isFinite(effect.amount)) return Math.abs(effect.amount);
  return null;
}

function toMarkdown(report) {
  const lines = [
    '# Checkout loyalty extension case',
    '',
    `Safe execution: \`balance=${report.safe.finalState.balance}\`, \`points=${report.safe.finalState.points}\`, \`cashback=${report.safe.finalState.cashback}\`.`,
    '',
    '| Variant | Mutation | Patch | Coarse target-write | Result |',
    '|---|---|---:|---:|---|'
  ];
  for (const item of report.variants) {
    lines.push(`| \`${item.id}\` | ${item.mutation} | ${item.patchAccepted ? 'accept' : 'reject'} | ${item.coarseWriteAccepted ? 'accept' : 'reject'} | ${item.coarseWriteAccepted && !item.patchAccepted ? 'semantic authority adds rejection' : 'same decision'} |`);
  }
  lines.push('', '> The coarse target-write baseline is an internal ablation, not a model of a named prior system.');
  return `${lines.join('\n')}\n`;
}

function write(filename, content) {
  const target = path.resolve(filename);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content);
}

function parseArgs(args) {
  const result = { out: null, markdown: null };
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] === '--out') result.out = requireValue(args, ++index, '--out');
    else if (args[index] === '--markdown') result.markdown = requireValue(args, ++index, '--markdown');
    else if (args[index] === '--help' || args[index] === '-h') {
      console.log('Usage: node scripts/evaluate-checkout-extension.js [--out report.json] [--markdown report.md]');
      process.exit(0);
    } else throw new Error(`Unknown argument '${args[index]}'.`);
  }
  return result;
}

function requireValue(args, index, name) {
  if (index >= args.length) throw new Error(`${name} requires a value.`);
  return args[index];
}
