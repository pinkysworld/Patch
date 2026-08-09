import crypto from 'node:crypto';
import { compileToDirectWasm, runDirectWasm } from './wasm-direct.js';
import { validateDirectSemanticEffects, PATCH_DIRECT_EFFECT_VALIDATION_VERSION } from './direct-effect-validator.js';
import { buildTransitiveCallBodyWitnesses } from './transitive-call-body.js';

export const PATCH_TRANSITIVE_RUNTIME_CORRESPONDENCE_VERSION = '0.2';

/**
 * Execute the direct-Wasm backend, validate the complete observed transition
 * trace against the independent Change-IR executor, then connect beta.30 exact
 * call-tree witnesses to independently reconstructed concrete invocation frames.
 *
 * Beta.32 no longer depends on a globally unique scoped-effect slice. The raw
 * Wasm trace still contains only target/before/after; the independent validator
 * reconstructs every concrete DO frame, exact parameter bindings, parent frame,
 * dynamic invocation ordinal and active frame stack. Effects are selected by
 * frame identity, so repeated identical invocations remain distinguishable.
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
    frameIds: [...(occurrence.frameIds ?? [])],
    transition: { ...occurrence.transition },
    effect: exactRuntimeEffect(occurrence.effect, occurrence.scope, occurrence.siteId)
  }));

  const frames = runtimeValidation.invocationFrames ?? [];
  const correspondences = [];
  for (const witness of transitive.witnesses ?? []) {
    if (!witness.supported || (witness.nestedCallDepth ?? 0) <= 0) continue;
    const expected = witness.claimedScopedTrace ?? [];
    const base = {
      caller: witness.caller,
      callee: witness.callee,
      invocation: witness.invocation,
      nestedCallDepth: witness.nestedCallDepth
    };
    if (!expected.length) {
      correspondences.push({
        ...base,
        supported: false,
        reason: 'beta.32 invocation-frame correspondence requires at least one concrete semantic effect'
      });
      continue;
    }

    const matchingFrames = frames.filter(frame =>
      frame.callerScope === witness.caller &&
      frame.callee === witness.callee &&
      frame.invocation === witness.invocation
    );
    if (matchingFrames.length !== 1) {
      correspondences.push({
        ...base,
        supported: false,
        reason: matchingFrames.length === 0
          ? 'no independently reconstructed concrete invocation frame matches the beta.30 call witness'
          : `concrete invocation-frame identity is ambiguous across ${matchingFrames.length} frames`
      });
      continue;
    }

    const frame = matchingFrames[0];
    if (!sameBindings(frame.bindings, witness.expectedCalleeEnv)) {
      correspondences.push({
        ...base,
        supported: false,
        frameId: frame.frameId,
        reason: 'independently reconstructed invocation-frame bindings do not match the beta.30 exact callee binding'
      });
      continue;
    }

    const selected = validatedScopedEffects.filter(item => item.frameIds.includes(frame.frameId));
    if (!sameScopedTrace(selected, expected)) {
      correspondences.push({
        ...base,
        supported: false,
        frameId: frame.frameId,
        reason: 'effects dominated by the independently reconstructed invocation frame do not equal the beta.30 exact scoped call-tree trace'
      });
      continue;
    }

    const occurrenceIds = selected.map(item => item.occurrence);
    correspondences.push({
      ...base,
      supported: true,
      witnessVersion: transitive.version,
      invocationFrameVersion: runtimeValidation.invocationFrameVersion,
      frame: normalizeFrame(frame),
      frameId: frame.frameId,
      occurrenceIds,
      occurrenceRange: occurrenceIds.length
        ? { start: occurrenceIds[0], endExclusive: occurrenceIds[occurrenceIds.length - 1] + 1 }
        : { start: 0, endExclusive: 0 },
      scopes: selected.map(item => item.scope),
      siteIds: selected.map(item => item.siteId),
      observedEffects: selected.map(item => item.effect),
      observedTransitions: selected.map(item => ({
        siteId: item.siteId,
        scope: item.scope,
        line: item.line,
        frameIds: [...item.frameIds],
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
    invocationFrameVersion: runtimeValidation.invocationFrameVersion,
    transitiveWitnessVersion: transitive.version,
    irVersion: compiled.ir.version,
    runtimeTrace: execution.trace,
    runtimeValidation,
    invocationFrames: frames.map(normalizeFrame),
    validatedScopedEffects,
    transitiveWitnesses: transitive,
    correspondences,
    summary: {
      runtimeTransitions: runtimeValidation.summary.transitions,
      runtimeEffects: runtimeValidation.summary.effects,
      invocationFrames: frames.length,
      candidates: correspondences.length,
      supported: correspondences.filter(item => item.supported).length,
      unsupported: correspondences.filter(item => !item.supported).length,
      maxCertifiedDepth: Math.max(0, ...correspondences.filter(item => item.supported).map(item => item.nestedCallDepth ?? 0))
    }
  };
}

function sameScopedTrace(observed, expected) {
  if (observed.length !== expected.length) return false;
  for (let index = 0; index < expected.length; index += 1) {
    if (observed[index]?.scope !== expected[index]?.scope) return false;
    if (!sameEffect(observed[index]?.effect, expected[index]?.effect)) return false;
  }
  return true;
}

function sameBindings(frameBindings, expectedBindings) {
  if (!Array.isArray(frameBindings) || !Array.isArray(expectedBindings)) return false;
  if (frameBindings.length !== expectedBindings.length) return false;
  for (let index = 0; index < frameBindings.length; index += 1) {
    if (frameBindings[index]?.name !== expectedBindings[index]?.name) return false;
    if (!Object.is(frameBindings[index]?.value, expectedBindings[index]?.value)) return false;
  }
  return true;
}

function sameEffect(left, right) {
  return left?.target === right?.target &&
    (left?.field ?? null) === (right?.field ?? null) &&
    left?.operation === right?.operation &&
    left?.amountRange?.min === right?.amountRange?.min &&
    left?.amountRange?.max === right?.amountRange?.max;
}

function normalizeFrame(frame) {
  return {
    frameId: frame.frameId,
    parentFrameId: frame.parentFrameId ?? null,
    callerScope: frame.callerScope,
    callee: frame.callee,
    invocation: frame.invocation,
    depth: frame.depth,
    line: frame.line ?? null,
    args: [...(frame.args ?? [])],
    bindings: (frame.bindings ?? []).map(item => ({ name: item.name, value: item.value })),
    transitionStart: frame.transitionStart,
    transitionEndExclusive: frame.transitionEndExclusive
  };
}

function exactRuntimeEffect(effect, scope, siteId) {
  if (!['increase', 'decrease'].includes(effect?.operation)) {
    throw new Error(`Validated runtime effect '${effect?.operation}' in '${scope}' at site ${siteId} is outside beta.32 quantitative correspondence.`);
  }
  if ((effect.field ?? null) !== null) {
    throw new Error(`Validated runtime field effect in '${scope}' at site ${siteId} is outside beta.32 numeric correspondence.`);
  }
  if (!Number.isSafeInteger(effect.amount) || effect.amount < 0) {
    throw new Error(`Validated runtime amount '${effect?.amount}' in '${scope}' at site ${siteId} is outside beta.32 safe-integer correspondence.`);
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
