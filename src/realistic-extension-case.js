import fs from 'node:fs';
import path from 'node:path';
import { evaluateSecurityCase } from './security-case-study.js';
import { compileToDirectWasm, runDirectWasm } from './wasm-direct.js';

export async function evaluateRealisticExtensionCase(caseRoot, options = {}) {
  const root = path.resolve(caseRoot);
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'scenario.json'), 'utf8'));
  if (manifest.format !== 'patch-realistic-extension-case') throw new Error(`${root}: unsupported scenario format '${manifest.format}'.`);
  if (manifest.version !== '0.1') throw new Error(`${root}: unsupported scenario version '${manifest.version}'.`);
  if (!manifest.name || !manifest.entryRecipe || !manifest.safe?.file || !Array.isArray(manifest.variants)) {
    throw new Error(`${root}: incomplete realistic extension scenario manifest.`);
  }

  const safeSource = fs.readFileSync(path.join(root, manifest.safe.file), 'utf8');
  const safeAnalysis = evaluateSecurityCase(safeSource, { name: `${manifest.name}-safe` });
  verifyDecision('safe', manifest.safe, safeAnalysis);
  const safeCompiled = compileToDirectWasm(safeSource, {
    name: options.wasmName ?? manifest.wasmName ?? toWasmName(manifest.name),
    kind: 'console'
  });
  const safeExecution = await runDirectWasm(safeCompiled.module, safeCompiled.metadata);
  verifyState(manifest.safe.expectedState ?? {}, safeExecution.state);
  verifyProtectedEffects(manifest.entryRecipe, manifest.safe.expectedProtectedEffects ?? [], safeAnalysis.patch.signatures);

  const variants = [];
  for (const variant of manifest.variants) {
    const source = fs.readFileSync(path.join(root, variant.file), 'utf8');
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

  return {
    format: 'patch-realistic-extension-case-report',
    version: '0.2',
    scenario: manifest.name,
    title: manifest.title ?? manifest.name,
    motivation: manifest.motivation ?? null,
    entryRecipe: manifest.entryRecipe,
    generatedAt: reproducibleGeneratedAt(),
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
}

export function realisticExtensionReportMarkdown(report) {
  const state = Object.entries(report.safe.finalState).map(([name, value]) => `\`${name}=${value}\``).join(', ');
  const lines = [
    `# ${report.title}`,
    '',
    ...(report.motivation ? [report.motivation, ''] : []),
    `Safe execution: ${state}.`,
    '',
    '| Variant | Dimension | Mutation | Patch | Coarse target-write | Result |',
    '|---|---|---|---:|---:|---|'
  ];
  for (const item of report.variants) {
    lines.push(`| \`${item.id}\` | ${item.dimension ?? ''} | ${item.mutation ?? ''} | ${item.patchAccepted ? 'accept' : 'reject'} | ${item.coarseWriteAccepted ? 'accept' : 'reject'} | ${item.coarseWriteAccepted && !item.patchAccepted ? 'semantic authority adds rejection' : 'same decision'} |`);
  }
  lines.push('', '> The coarse target-write baseline is an internal ablation, not a model of a named prior system.');
  return `${lines.join('\n')}\n`;
}

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

function reproducibleGeneratedAt() {
  const raw = process.env.SOURCE_DATE_EPOCH;
  if (raw === undefined || raw === '') return new Date().toISOString();
  if (!/^\d+$/.test(raw)) throw new Error(`SOURCE_DATE_EPOCH must be a non-negative integer, got '${raw}'.`);
  const milliseconds = Number(raw) * 1000;
  if (!Number.isSafeInteger(milliseconds)) throw new Error('SOURCE_DATE_EPOCH is outside the supported safe integer range.');
  const value = new Date(milliseconds);
  if (!Number.isFinite(value.getTime())) throw new Error('SOURCE_DATE_EPOCH is outside the supported date range.');
  return value.toISOString();
}

function toWasmName(name) {
  const compact = String(name).replace(/[^A-Za-z0-9]+/g, ' ').trim().split(/\s+/).map(part => part[0]?.toUpperCase() + part.slice(1)).join('');
  return `${compact || 'PatchExtension'}Safe`;
}
