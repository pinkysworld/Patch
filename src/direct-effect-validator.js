import { validateDirectTrace } from './direct-trace-validator.js';

export const PATCH_DIRECT_EFFECT_VALIDATION_VERSION = '0.1';

export class DirectEffectValidationError extends Error {}

/**
 * Validate a concrete direct-Wasm transition trace and independently reconstructed
 * semantic effects against the production Change Signatures and optional Change
 * Capabilities embedded in Change IR.
 *
 * The observed Wasm trace contains only target/before/after. Semantic operation
 * identity, recipe scope and beta.32 concrete invocation-frame membership are
 * reconstructed by direct-trace-validator from IR execution rather than accepted
 * as labels from the lowerer.
 */
export function validateDirectSemanticEffects(ir, observedTrace) {
  const traceValidation = validateDirectTrace(ir, observedTrace);
  const occurrences = [];

  for (const transition of traceValidation.expectedTrace) {
    const signature = ir.changeSignatures?.[transition.scope];
    if (!signature) {
      throw new DirectEffectValidationError(
        `No production Change Signature exists for direct trace scope '${transition.scope}' at site ${transition.siteId}.`
      );
    }

    const signatureEffects = (signature.changes ?? []).filter(effect => effect.committed !== false);
    const policy = ir.changeCapabilities?.[transition.scope] ?? null;

    for (const effect of transition.effects ?? []) {
      const signatureMatch = signatureEffects.find(candidate => signatureCoversRuntimeEffect(candidate, effect));
      if (!signatureMatch) {
        throw new DirectEffectValidationError(
          `Runtime effect ${describeEffect(effect)} at site ${transition.siteId} is not covered by Change Signature '${transition.scope}'.`
        );
      }

      let capabilityMatch = null;
      if (policy) {
        capabilityMatch = policy.find(rule => capabilityAllowsRuntimeEffect(rule, effect));
        if (!capabilityMatch) {
          throw new DirectEffectValidationError(
            `Runtime effect ${describeEffect(effect)} at site ${transition.siteId} escapes Change Capability '${transition.scope}'.`
          );
        }
      }

      occurrences.push({
        siteId: transition.siteId,
        scope: transition.scope,
        line: transition.line,
        target: transition.target,
        frameIds: [...(transition.frameIds ?? [])],
        transition: {
          before: transition.before,
          after: transition.after
        },
        effect,
        signatureMatch: summarizeSignatureEffect(signatureMatch),
        capabilityMatch: capabilityMatch ? summarizeCapabilityRule(capabilityMatch) : null,
        protected: Boolean(policy)
      });
    }
  }

  return {
    ok: true,
    format: 'patch-direct-effect-validation',
    version: PATCH_DIRECT_EFFECT_VALIDATION_VERSION,
    traceValidation,
    invocationFrameVersion: traceValidation.invocationFrameVersion ?? null,
    invocationFrames: traceValidation.invocationFrames ?? [],
    occurrences,
    summary: {
      transitions: traceValidation.expectedTrace.length,
      effects: occurrences.length,
      invocationFrames: traceValidation.invocationFrames?.length ?? 0,
      protectedEffects: occurrences.filter(item => item.protected).length,
      unprotectedEffects: occurrences.filter(item => !item.protected).length
    }
  };
}

export function signatureCoversRuntimeEffect(candidate, effect) {
  if (!candidate || candidate.committed === false) return false;
  if (candidate.target !== effect.target) return false;
  if ((candidate.field ?? null) !== (effect.field ?? null)) return false;
  if (candidate.operation !== effect.operation) return false;

  if (effect.amount === null || effect.amount === undefined) return true;
  if (!Number.isFinite(effect.amount) || effect.amount < 0) return false;

  if (candidate.amountRange && Number.isFinite(candidate.amountRange.min) && Number.isFinite(candidate.amountRange.max)) {
    return candidate.amountRange.min <= effect.amount && effect.amount <= candidate.amountRange.max;
  }

  if (candidate.staticAmount && Number.isFinite(candidate.amount)) {
    return Object.is(Math.abs(candidate.amount), effect.amount);
  }

  if (!candidate.unproven && Number.isFinite(candidate.amount)) {
    return Object.is(Math.abs(candidate.amount), effect.amount);
  }

  return false;
}

export function capabilityAllowsRuntimeEffect(rule, effect) {
  if (!rule) return false;
  if (rule.target !== effect.target) return false;
  if ((rule.field ?? null) !== (effect.field ?? null)) return false;
  if (rule.operation !== effect.operation) return false;

  if (effect.amount === null || effect.amount === undefined) return true;
  if (!Number.isFinite(effect.amount) || effect.amount < 0) return false;
  if (rule.maxAmount === null || rule.maxAmount === undefined) return true;
  return Number.isFinite(rule.maxAmount) && effect.amount <= rule.maxAmount;
}

function summarizeSignatureEffect(effect) {
  return {
    target: effect.target,
    field: effect.field ?? null,
    operation: effect.operation,
    amount: Number.isFinite(effect.amount) ? effect.amount : null,
    staticAmount: Boolean(effect.staticAmount),
    amountRange: effect.amountRange
      ? { min: effect.amountRange.min, max: effect.amountRange.max }
      : null,
    unproven: Boolean(effect.unproven),
    via: effect.via ?? null,
    sourceLine: effect.sourceLine ?? null
  };
}

function summarizeCapabilityRule(rule) {
  return {
    target: rule.target,
    field: rule.field ?? null,
    operation: rule.operation,
    maxAmount: rule.maxAmount ?? null,
    line: rule.line ?? null
  };
}

function describeEffect(effect) {
  const path = effect.field ? `${effect.target}.${effect.field}` : effect.target;
  const amount = effect.amount === null || effect.amount === undefined ? '' : ` by ${effect.amount}`;
  return `${path} ${effect.operation}${amount}`;
}
