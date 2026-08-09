import { generateTransitiveCallBodyCertificate } from './transitive-call-body-certificate.js';
import { buildTransitiveRuntimeCorrespondence } from './transitive-runtime-correspondence.js';

export const PATCH_TRANSITIVE_RUNTIME_CERTIFICATE_VERSION = '0.1';

/**
 * Generate one self-contained Lean file containing the beta.30 exact call-tree
 * certificate followed by beta.31 observed direct-Wasm correspondence checks.
 *
 * JavaScript executes Wasm and performs whole-trace independent validation.
 * Lean never trusts the resulting scoped semantic effects as already matching
 * the call tree: it feeds the runtime-derived observed list directly through
 * `evalCallTreeStmtEqBool` and the beta.30 caller-signature theorem.
 */
export async function generateTransitiveRuntimeCertificate(source, options = {}) {
  const beta30 = generateTransitiveCallBodyCertificate(source, options);
  const runtime = await buildTransitiveRuntimeCorrespondence(source, options);
  const supported = runtime.correspondences.filter(item => item.supported);
  if (!supported.length) {
    const reasons = runtime.correspondences.map(item => item.reason).filter(Boolean);
    throw new Error(`No unambiguous beta.31 direct-Wasm/transitive-call correspondence is certifiable.${reasons.length ? ` ${reasons.join('; ')}` : ''}`);
  }

  const blocks = [];
  const certified = [];
  for (const item of supported) {
    const id = `${leanIdentifier(item.caller)}_${leanIdentifier(item.callee)}_${item.invocation}`;
    const runtimeId = `runtime_${id}`;
    const beta30Label = `${item.caller}->${item.callee}#${item.invocation}@depth${item.nestedCallDepth}`;
    if (!beta30.certified.includes(beta30Label)) {
      throw new Error(`Beta.31 correspondence ${beta30Label} has no matching beta.30 generated certificate theorem.`);
    }

    blocks.push(`def ${runtimeId}_observed : List Effect := ${leanList(item.observedEffects.map(leanEffect))}`);
    blocks.push(`def ${runtimeId}_scopes : List String := ${leanList(item.scopes.map(leanString))}`);
    blocks.push(`def ${runtimeId}_siteIds : List Nat := ${leanList(item.siteIds.map(value => String(value)))}`);
    blocks.push(`def ${runtimeId}_occurrenceStart : Nat := ${item.occurrenceRange.start}`);
    blocks.push(`def ${runtimeId}_occurrenceEndExclusive : Nat := ${item.occurrenceRange.endExclusive}`);
    blocks.push(`theorem ${runtimeId}_call_tree_checked :\n    evalCallTreeStmtEqBool ${id}_bindings ${id}_tree ${runtimeId}_observed = true := by\n  native_decide`);
    blocks.push(`theorem ${runtimeId}_direct_wasm_refines_caller :\n    ${id}_calleeRank < ${id}_callerRank ∧\n    ConcreteArgsFit ${id}_values ${id}_declared ∧\n    ConcreteCallBindingSpec ${id}_exprs ${id}_caller ${id}_params ${id}_declared ${id}_bindings ∧\n    TraceRefinesSignature ${runtimeId}_observed ${id}_callerSignature := by\n  constructor\n  · exact of_decide_eq_true ${id}_rank_checked\n  · constructor\n    · exact concreteThroughAbstractBool_sound ${id}_abstract_checked\n    · exact checkedObservedTransitiveRuntimeRefinesCallerSignature\n        ${id}_binding_checked\n        ${runtimeId}_call_tree_checked\n        ${id}_tree_covered_checked\n        ${id}_signature_import_checked`);
    certified.push(beta30Label);
  }

  const beta30Lean = beta30.lean.replace(/^import PatchCallTree/m, 'import PatchCallRuntime');
  if (beta30Lean === beta30.lean) {
    throw new Error('Could not upgrade beta.30 generated import to PatchCallRuntime for beta.31 certificate generation.');
  }
  const runtimeLean = `\n\nopen PatchFormal\n\nnamespace PatchGeneratedTransitiveRuntimeCertificate\n\nopen PatchGeneratedTransitiveCallBodyCertificate\n\n/-- Beta.31 evidence is generated only after the real direct-Wasm module has\n    executed and the entire raw target/before/after transition trace has matched\n    the independent Change-IR execution model. Operation identity and recipe\n    scope are reconstructed by that validator, not emitted by the backend.\n    A transitive witness is accepted only when its exact scoped effect sequence\n    has one unambiguous occurrence in the validated runtime effect stream. Lean\n    then re-evaluates the beta.30 call tree directly against that observed effect\n    list. Runtime capture, independent-validator correctness and scoped-slice\n    attribution remain explicit proof-free evidence boundaries. -/\ndef runtimeSourceSha256 : String := ${leanString(runtime.sourceSha256)}\ndef directWasmTraceSha256 : String := ${leanString(runtime.runtimeTraceSha256)}\ndef transitiveRuntimeCorrespondenceVersion : String := ${leanString(runtime.version)}\ndef transitiveRuntimeCertificateVersion : String := ${leanString(PATCH_TRANSITIVE_RUNTIME_CERTIFICATE_VERSION)}\ndef directEffectValidationVersion : String := ${leanString(runtime.directEffectValidationVersion)}\ndef runtimePatchIrVersion : String := ${leanString(runtime.irVersion)}\n\n${blocks.join('\n\n')}\n\nend PatchGeneratedTransitiveRuntimeCertificate\n`;

  return {
    lean: beta30Lean + runtimeLean,
    sourceSha256: runtime.sourceSha256,
    runtimeTraceSha256: runtime.runtimeTraceSha256,
    runtimeTrace: runtime.runtimeTrace,
    runtimeValidation: runtime.runtimeValidation,
    correspondences: runtime.correspondences,
    certified,
    beta30Certified: beta30.certified,
    irVersion: runtime.irVersion,
    correspondenceVersion: runtime.version,
    certificateVersion: PATCH_TRANSITIVE_RUNTIME_CERTIFICATE_VERSION,
    directEffectValidationVersion: runtime.directEffectValidationVersion
  };
}

function leanEffect(effect) {
  if (!['increase', 'decrease'].includes(effect?.operation)) {
    throw new Error(`Beta.31 runtime effect '${effect?.operation}' is outside exact quantitative correspondence.`);
  }
  const range = effect.amountRange;
  if (!range || !Number.isSafeInteger(range.min) || !Number.isSafeInteger(range.max) || range.min !== range.max || range.min < 0) {
    throw new Error('Beta.31 runtime quantitative effect must carry one exact non-negative safe-integer interval.');
  }
  return `({ target := ${leanString(effect.target)}, field := ${leanOptionString(effect.field)}, kind := .${effect.operation}, amount := some ${leanInterval(range.min, range.max)} } : Effect)`;
}

function leanInterval(lo, hi) {
  return `({ lo := ${leanInt(lo)}, hi := ${leanInt(hi)}, ordered := by decide } : Interval)`;
}
function leanOptionString(value) { return value === null || value === undefined ? 'none' : `some ${leanString(value)}`; }
function leanIdentifier(value) {
  const cleaned = String(value).replace(/[^A-Za-z0-9_]/g, '_');
  return (/^[A-Za-z_]/.test(cleaned) ? cleaned : `r_${cleaned}`) || 'call';
}
function leanString(value) { return JSON.stringify(String(value)); }
function leanInt(value) {
  if (!Number.isSafeInteger(Number(value))) throw new Error(`Non-safe integer ${value}.`);
  return Number(value) < 0 ? `(${value})` : String(value);
}
function leanList(items) { return items.length ? `[${items.join(', ')}]` : '[]'; }
