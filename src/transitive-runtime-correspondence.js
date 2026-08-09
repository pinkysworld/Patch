import crypto from 'node:crypto';
import { compileToDirectWasm, runDirectWasm } from './wasm-direct.js';
import { validateDirectSemanticEffects, PATCH_DIRECT_EFFECT_VALIDATION_VERSION } from './direct-effect-validator.js';
import { buildTransitiveCallBodyWitnesses } from './transitive-call-body.js';

export const PATCH_TRANSITIVE_RUNTIME_CORRESPONDENCE_VERSION = '0.1';

/**
 * Execute the direct-Wasm backend, validate the complete observed transition
 * trace against the independent Change-IR executor, and conservatively connect
 * contiguous validated semantic-effect occurrences to beta.31 scoped exact
 * call-tree witnesses.
 *
 * The raw Wasm trace contains only target/before/after. Scope and operation
 * identity come from the independent direct trace/effect validators after the
 * whole runtime trace has matched. The beta.31 bridge additionally requires the
 * exact scoped effect sequence for a transitive witness to have exactly one
 * occurrence in that validated runtime-effect sequence. Ambiguous attribution
 * fails closed.
 */
export async function buildTransitiveRuntimeCorrespondence(source, options = {}) {
  const name = options.name ?? 'PatchTransitiveRuntime';
  const { module, metadata, compiled } = compileToDirectWasm(source, {
    ...options,
    name,
    kind: 'console'
  });
  const execution = await runDirectWasm(module, metadata);
  const runtimeValidation = validateDirectSemanticEffects(compiled.ir, execution.trace);
  const transitive = buildTransitiveCallBodyWitnesses(compiled.ast, compiled.ir.formalCalls);
  const validatedScopedEffects = runtimeValidation.occurrences.map((occurrence, index) => ({
    occurrence: index,
    siteId: occurrence.siteId,
    scope: occurrence.scope,
    line: occurrence.line ?? null,
    transition: { ...occurrence.transition },
    effect: exactRuntimeEffect(occurrence.effect, occurrence.scope, occurrence.siteId)
  }));

  const correspondences = [];
  for (const witness of transitive.witnesses ?? []) {
    if (!witness.supported || (witness.nestedCallDepth ?? 0) <= 0) continue;
    const expected = witness.claimedScopedTrace ?? [];
    if (!expected.length) {
      correspondences.push({
        caller: witness.caller,
        callee: witness.callee,
        invocation: witness.invocation,
        nestedCallDepth: witness.nestedCallDepth,
        supported: false,
        reason: 'beta.31 runtime correspondence requires at least one concrete semantic effect'
      });
      continue;
    }

    const matches = findScopedMatches(validatedScopedEffects, expected);
    if (matches.length !== 1) {
      correspondences.push({
        caller: witness.caller,
        callee: witness.callee,
        invocation: witness.invocation,
        nestedCallDepth: witness.nestedCallDepth,
        supported: false,
        reason: matches.length === 0
          ? 'no independently validated direct-Wasm effect slice matches the exact scoped call-tree trace'
          : `exact scoped call-tree trace is ambiguous across ${matches.length} validated runtime slices`
      });
      continue;
    }

    const start = matches[0];
    const slice = validatedScopedEffects.slice(start, start + expected.length);
    correspondences.push({
      caller: witness.caller,
      callee: witness.callee,
      invocation: witness.invocation,
      nestedCallDepth: witness.nestedCallDepth,
      supported: true,
      witnessVersion: transitive.version,
      occurrenceRange: { start, endExclusive: start + slice.length },
      scopes: slice.map(item => item.scope),
      siteIds: slice.map(item => item.siteId),
      observedEffects: slice.map(item => item.effect),
      observedTransitions: slice.map(item => ({
        siteId: item.siteId,
        scope: item.scope,
        line: item.line,
        before: item.transition.before,
        after: item.transition.after
      })),
      expectedScopedTrace: expected,
      beta30Trace: witness.claimedTrace,
      beta30Witness: {
        caller: witness.caller,
        callee: witness.callee,
        invocation: witness.invocation,
        expectedCalleeEnv: witness.expectedCalleeEnv,
        nestedCallDepth: witness.nestedCallDepth
      }
    });
  }

  const sourceSha256 = sha256(source);
  const runtimeTraceJson = JSON.stringify(execution.trace);
  const runtimeTraceSha256 = sha256(runtimeTraceJson);
  return {
    format: 'patch-transitive-runtime-correspondence',
    version: PATCH_TRANSITIVE_RUNTIME_CORRESPONDENCE_VERSION,
    sourceSha256,
    runtimeTraceSha256,
    directEffectValidationVersion: PATCH_DIRECT_EFFECT_VALIDATION_VERSION,
    transitiveWitnessVersion: transitive.version,
    irVersion: compiled.ir.version,
    runtimeTrace: execution.trace,
    runtimeValidation,
    validatedScopedEffects,
    transitiveWitnesses: transitive,
    correspondences,
    summary: {
      runtimeTransitions: runtimeValidation.summary.transitions,
      runtimeEffects: runtimeValidation.summary.effects,
      candidates: correspondences.length,
      supported: correspondences.filter(item => item.supported).length,
      unsupported: correspondences.filter(item => !item.supported).length,
      maxCertifiedDepth: Math.max(0, ...correspondences.filter(item => item.supported).map(item => item.nestedCallDepth ?? 0))
    }
  };
}

function findScopedMatches(observed, expected) {
  if (expected.length > observed.length) return [];
  const matches = [];
  for (let start = 0; start <= observed.length - expected.length; start += 1) {
    let ok = true;
    for (let offset = 0; offset < expected.length; offset += 1) {
      if (!sameScopedEffect(observed[start + offset], expected[offset])) {
        ok = false;
        break;
      }
    }
    if (ok) matches.push(start);
  }
  return matches;
}

function sameScopedEffect(observed, expected) {
  return observed?.scope === expected?.scope && sameEffect(observed?.effect, expected?.effect);
}

function sameEffect(left, right) {
  return left?.target === right?.target &&
    (left?.field ?? null) === (right?.field ?? null) &&
    left?.operation === right?.operation &&
    left?.amountRange?.min === right?.amountRange?.min &&
    left?.amountRange?.max === right?.amountRange?.max;
}

function exactRuntimeEffect(effect, scope, siteId) {
  if (!['increase', 'decrease'].includes(effect?.operation)) {
    throw new Error(`Validated runtime effect '${effect?.operation}' in '${scope}' at site ${siteId} is outside beta.31 quantitative correspondence.`);
  }
  if ((effect.field ?? null) !== null) {
    throw new Error(`Validated runtime field effect in '${scope}' at site ${siteId} is outside beta.31 numeric correspondence.`);
  }
  if (!Number.isSafeInteger(effect.amount) || effect.amount < 0) {
    throw new Error(`Validated runtime amount '${effect?.amount}' in '${scope}' at site ${siteId} is outside beta.31 safe-integer correspondence.`);
  }
  return {
    target: effect.target,
    field: null,
    operation: effect.operation,
    amountRange: { min: effect.amount, max: effect.amount }
  };
}

function sha256(value) {
  return crypto.createHash('sha256').update(value, 'utf8').digest('hex');
}
