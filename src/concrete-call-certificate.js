import crypto from 'node:crypto';
import { compile } from './compiler.js';
import { buildConcreteCallWitnesses } from './concrete-call-witness.js';
import { buildFormalRangeExpression } from './formal-range.js';

export const PATCH_CONCRETE_CALL_CERTIFICATE_VERSION = '0.2';

const EFFECT_KINDS = new Set(['increase', 'decrease', 'set', 'clear']);

/**
 * Generate Lean checks for concrete inter-recipe parameter binding. Beta.26's
 * first production-connected slice certifies variable pass-through call
 * arguments. For a still narrower direct-leaf subset, it also evaluates one
 * quantitative callee Change amount under the exact bound environment and
 * composes the resulting concrete effect with beta.25 signature containment.
 * Root-program calls, richer arithmetic substitution and production-Wasm call
 * equivalence remain explicit boundaries.
 */
export function generateConcreteCallCertificate(source, options = {}) {
  const compiled = compile(source, options);
  const witnessArtifact = buildConcreteCallWitnesses(compiled.ast, compiled.ir.formalCalls);
  const witnesses = witnessArtifact.witnesses.filter(item => item.caller !== '$program');
  if (!witnesses.length) throw new Error('No inter-recipe concrete call binding witnesses were found.');

  const recipes = new Map();
  for (const node of compiled.ast ?? []) if (node.kind === 'function') recipes.set(node.name, node);

  const blocks = [];
  const certified = [];
  const certifiedEffects = [];
  for (const witness of witnesses) {
    if (!witness.abstractArgRanges) {
      throw new Error(`Call ${witness.caller} -> ${witness.callee} has no beta.25 abstract argument intervals.`);
    }
    const id = `${leanIdentifier(witness.caller)}_${leanIdentifier(witness.callee)}_${witness.invocation}`;
    const exprs = witness.argExprs.map(leanConcreteRangeExpr);
    const callerBindings = witness.callerEnv.map(item => `(${leanString(item.name)}, ${leanInt(item.value)})`);
    const params = witness.params.map(leanString);
    const declared = witness.declared.map(item => leanInterval(item.range.min, item.range.max));
    const expectedBindings = witness.expectedCalleeEnv.map(item => `(${leanString(item.name)}, ${leanInt(item.value)})`);
    const values = witness.concreteValues.map(leanInt);
    const abstract = witness.abstractArgRanges.map(range => leanInterval(range.min, range.max));

    blocks.push(`def ${id}_exprs : List RangeExpr := ${leanList(exprs)}`);
    blocks.push(`def ${id}_callerBindings : BindingList := ${leanList(callerBindings)}`);
    blocks.push(`def ${id}_caller : IntEnv := envOfBindings ${id}_callerBindings`);
    blocks.push(`def ${id}_params : List Name := ${leanList(params)}`);
    blocks.push(`def ${id}_declared : List Interval := ${leanList(declared)}`);
    blocks.push(`def ${id}_expected : BindingList := ${leanList(expectedBindings)}`);
    blocks.push(`def ${id}_values : List Int := ${leanList(values)}`);
    blocks.push(`def ${id}_abstract : List Interval := ${leanList(abstract)}`);
    blocks.push(`theorem ${id}_binding_checked :\n    concreteCallBinding ${id}_exprs ${id}_caller ${id}_params ${id}_declared = some ${id}_expected := by\n  native_decide`);
    blocks.push(`theorem ${id}_binding_sound :\n    ConcreteCallBindingSpec ${id}_exprs ${id}_caller ${id}_params ${id}_declared ${id}_expected := by\n  exact concreteCallBinding_sound ${id}_binding_checked`);
    blocks.push(`theorem ${id}_abstract_checked :\n    concreteThroughAbstractBool ${id}_values ${id}_abstract ${id}_declared = true := by\n  native_decide`);
    blocks.push(`theorem ${id}_abstract_sound : ConcreteArgsFit ${id}_values ${id}_declared := by\n  exact concreteThroughAbstractBool_sound ${id}_abstract_checked`);
    certified.push(`${witness.caller}->${witness.callee}#${witness.invocation}`);

    const effect = directQuantitativeEffectEvidence(witness, compiled, recipes);
    if (effect) {
      blocks.push(`def ${id}_expectedEffect : Effect := ${leanEffect(effect.expected)}`);
      blocks.push(`def ${id}_amountExpr : RangeExpr := ${leanConcreteRangeExpr(effect.amountExpr)}`);
      blocks.push(`def ${id}_actualEffect : Effect := ${leanEffect(effect.actual)}`);
      blocks.push(`def ${id}_calleeSignature : List Effect := ${leanList(effect.calleeSignature.map(leanEffect))}`);
      blocks.push(`def ${id}_callerSignature : List Effect := ${leanList(effect.callerSignature.map(leanEffect))}`);
      blocks.push(`theorem ${id}_effect_equality_checked :\n    evalBoundQuantitativeEffectEqBool ${id}_expectedEffect ${id}_amountExpr ${id}_expected ${id}_actualEffect = true := by\n  native_decide`);
      blocks.push(`theorem ${id}_effect_checked :\n    evalBoundQuantitativeEffect ${id}_expectedEffect ${id}_amountExpr ${id}_expected = some ${id}_actualEffect := by\n  exact evalBoundQuantitativeEffectEqBool_sound ${id}_effect_equality_checked`);
      blocks.push(`theorem ${id}_callee_member_checked :\n    effectMemberBool ${id}_expectedEffect ${id}_calleeSignature = true := by\n  native_decide`);
      blocks.push(`theorem ${id}_signature_import_checked :\n    signatureCoversBool ${id}_calleeSignature ${id}_callerSignature = true := by\n  native_decide`);
      blocks.push(`theorem ${id}_effect_sound :\n    ConcreteCallBindingSpec ${id}_exprs ${id}_caller ${id}_params ${id}_declared ${id}_expected ∧\n    RefinesSignature ${id}_actualEffect ${id}_callerSignature := by\n  exact checkedConcreteBoundEffectRefinesCallerSignature\n    ${id}_binding_checked\n    ${id}_effect_checked\n    ${id}_callee_member_checked\n    ${id}_signature_import_checked`);
      certifiedEffects.push(`${witness.caller}->${witness.callee}#${witness.invocation}`);
    }
  }

  const sourceSha256 = crypto.createHash('sha256').update(source, 'utf8').digest('hex');
  const lean = `import PatchCallEffect\n\nopen PatchFormal\n\nnamespace PatchGeneratedConcreteCallCertificate\n\n/-- Proof-free production call witnesses checked against beta.26 exact argument\n    evaluation/binding and beta.25 abstract argument intervals. For direct leaf\n    quantitative Changes, Lean also evaluates the callee amount expression in\n    the exact bound environment, constructs the singleton concrete effect, and\n    checks that it refines an imported caller-signature effect. The source hash\n    binds this file to exact Patch source bytes. This is not yet arbitrary body\n    execution or production-Wasm call equivalence. -/\ndef sourceSha256 : String := ${leanString(sourceSha256)}\ndef patchIrVersion : String := ${leanString(compiled.ir.version)}\ndef concreteCallWitnessVersion : String := ${leanString(witnessArtifact.version)}\ndef concreteCallCertificateVersion : String := ${leanString(PATCH_CONCRETE_CALL_CERTIFICATE_VERSION)}\n\n${blocks.join('\n\n')}\n\nend PatchGeneratedConcreteCallCertificate\n`;

  return {
    lean,
    sourceSha256,
    certified,
    certifiedEffects,
    witnessArtifact,
    certificateVersion: PATCH_CONCRETE_CALL_CERTIFICATE_VERSION
  };
}

function directQuantitativeEffectEvidence(witness, compiled, recipes) {
  const calleeNode = recipes.get(witness.callee);
  const calleeEntry = compiled.ir.formalCalls?.entries?.[witness.callee];
  const callerEntry = compiled.ir.formalCalls?.entries?.[witness.caller];
  if (!calleeNode || !calleeEntry?.supported || !callerEntry?.supported) return null;

  const body = calleeNode.body ?? [];
  if (body.length !== 1 || body[0]?.kind !== 'change' || (body[0].ops ?? []).length !== 1) return null;
  const operation = body[0].ops[0];
  if (!operation || !['add', 'remove'].includes(operation.op)) return null;
  if (calleeEntry.body?.kind !== 'emit') return null;

  const expected = calleeEntry.body.effect;
  const requiredOperation = operation.op === 'add' ? 'increase' : 'decrease';
  if (expected?.operation !== requiredOperation || !expected.amountRange) return null;

  const bindings = {};
  for (const item of calleeEntry.paramRanges ?? []) bindings[item.name] = item.range;
  const formalAmount = buildFormalRangeExpression(operation.expr ?? '', bindings);
  if (!formalAmount.supported || formalAmount.expr?.kind !== 'var' || formalAmount.range?.min < 0) return null;

  const boundValues = Object.fromEntries((witness.expectedCalleeEnv ?? []).map(item => [item.name, item.value]));
  const concreteValue = boundValues[formalAmount.expr.name];
  if (!Number.isSafeInteger(concreteValue) || concreteValue < 0) return null;

  const actual = {
    target: expected.target,
    field: expected.field ?? null,
    operation: expected.operation,
    amountRange: { min: concreteValue, max: concreteValue }
  };

  return {
    expected,
    actual,
    amountExpr: formalAmount.expr,
    calleeSignature: calleeEntry.signature ?? [],
    callerSignature: callerEntry.signature ?? []
  };
}

function leanConcreteRangeExpr(expr) {
  if (expr?.kind === 'var') return `RangeExpr.var ${leanString(expr.name)}`;
  throw new Error(`Concrete beta.26 certificate currently supports variable pass-through arguments only; got '${expr?.kind ?? 'missing'}'.`);
}

function leanEffect(effect) {
  if (!EFFECT_KINDS.has(effect?.operation)) throw new Error(`Unsupported beta.26 semantic effect '${effect?.operation}'.`);
  let amount = 'none';
  if (effect.operation === 'increase' || effect.operation === 'decrease') {
    if (!effect.amountRange) throw new Error(`Quantitative beta.26 effect '${effect.operation}' is missing an interval.`);
    amount = `some ${leanInterval(effect.amountRange.min, effect.amountRange.max)}`;
  } else if (effect.amountRange) {
    throw new Error(`Non-quantitative beta.26 effect '${effect.operation}' unexpectedly has an interval.`);
  }
  return `({ target := ${leanString(effect.target)}, field := ${leanOptionString(effect.field)}, kind := .${effect.operation}, amount := ${amount} } : Effect)`;
}

function leanInterval(lo, hi) {
  if (!Number.isSafeInteger(lo) || !Number.isSafeInteger(hi) || lo > hi) throw new Error(`Invalid interval ${lo}..${hi}.`);
  return `({ lo := ${leanInt(lo)}, hi := ${leanInt(hi)}, ordered := by decide } : Interval)`;
}
function leanOptionString(value) { return value === null || value === undefined ? 'none' : `some ${leanString(value)}`; }
function leanIdentifier(value) { const cleaned=String(value).replace(/[^A-Za-z0-9_]/g,'_'); return (/^[A-Za-z_]/.test(cleaned)?cleaned:`r_${cleaned}`)||'call'; }
function leanString(value) { return JSON.stringify(String(value)); }
function leanInt(value) { return Number(value) < 0 ? `(${value})` : String(value); }
function leanList(items) { return items.length ? `[${items.join(', ')}]` : '[]'; }
