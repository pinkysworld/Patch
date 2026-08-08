import crypto from 'node:crypto';
import { compile } from './compiler.js';
import { buildConcreteCallWitnesses } from './concrete-call-witness.js';

export const PATCH_CONCRETE_CALL_CERTIFICATE_VERSION = '0.1';

/**
 * Generate Lean checks for concrete inter-recipe parameter binding. The first
 * production-connected slice deliberately certifies variable pass-through
 * arguments only (e.g. `do add_points(bonus)`). Root program calls and richer
 * arithmetic are left outside this certificate until their expression encoding
 * is added explicitly.
 */
export function generateConcreteCallCertificate(source, options = {}) {
  const compiled = compile(source, options);
  const witnessArtifact = buildConcreteCallWitnesses(compiled.ast, compiled.ir.formalCalls);
  const witnesses = witnessArtifact.witnesses.filter(item => item.caller !== '$program');
  if (!witnesses.length) throw new Error('No inter-recipe concrete call binding witnesses were found.');

  const blocks = [];
  const certified = [];
  for (const witness of witnesses) {
    if (!witness.abstractArgRanges) {
      throw new Error(`Call ${witness.caller} -> ${witness.callee} has no beta.25 abstract argument intervals.`);
    }
    const id = `${leanIdentifier(witness.caller)}_${leanIdentifier(witness.callee)}_${witness.invocation}`;
    const exprs = witness.argExprs.map(leanConcreteRangeExpr);
    const callerEnv = witness.callerEnv.map(item => `(${leanString(item.name)}, ${leanInt(item.value)})`);
    const params = witness.params.map(leanString);
    const declared = witness.declared.map(item => leanInterval(item.range.min, item.range.max));
    const expectedEnv = witness.expectedCalleeEnv.map(item => `(${leanString(item.name)}, ${leanInt(item.value)})`);
    const values = witness.concreteValues.map(leanInt);
    const abstract = witness.abstractArgRanges.map(range => leanInterval(range.min, range.max));

    blocks.push(`def ${id}_exprs : List RangeExpr := ${leanList(exprs)}`);
    blocks.push(`def ${id}_caller : IntEnv := ${leanList(callerEnv)}`);
    blocks.push(`def ${id}_params : List Name := ${leanList(params)}`);
    blocks.push(`def ${id}_declared : List Interval := ${leanList(declared)}`);
    blocks.push(`def ${id}_expected : IntEnv := ${leanList(expectedEnv)}`);
    blocks.push(`def ${id}_values : List Int := ${leanList(values)}`);
    blocks.push(`def ${id}_abstract : List Interval := ${leanList(abstract)}`);
    blocks.push(`theorem ${id}_binding_checked :\n    concreteCallBinding ${id}_exprs ${id}_caller ${id}_params ${id}_declared = some ${id}_expected := by\n  native_decide`);
    blocks.push(`theorem ${id}_binding_sound :\n    ConcreteCallBindingSpec ${id}_exprs ${id}_caller ${id}_params ${id}_declared ${id}_expected := by\n  exact concreteCallBinding_sound ${id}_binding_checked`);
    blocks.push(`theorem ${id}_abstract_checked :\n    concreteThroughAbstractBool ${id}_values ${id}_abstract ${id}_declared = true := by\n  native_decide`);
    blocks.push(`theorem ${id}_abstract_sound : ConcreteArgsFit ${id}_values ${id}_declared := by\n  exact concreteThroughAbstractBool_sound ${id}_abstract_checked`);
    certified.push(`${witness.caller}->${witness.callee}#${witness.invocation}`);
  }

  const sourceSha256 = crypto.createHash('sha256').update(source, 'utf8').digest('hex');
  const lean = `import PatchCallRefinement\n\nopen PatchFormal\n\nnamespace PatchGeneratedConcreteCallCertificate\n\n/-- Proof-free production call witnesses checked against the beta.26 concrete\n    argument evaluator/binder and beta.25 abstract argument intervals. The\n    source hash binds this file to exact Patch source bytes. This first slice\n    certifies inter-recipe variable pass-through; it is not yet complete\n    arithmetic substitution or production-Wasm call equivalence. -/\ndef sourceSha256 : String := ${leanString(sourceSha256)}\ndef patchIrVersion : String := ${leanString(compiled.ir.version)}\ndef concreteCallWitnessVersion : String := ${leanString(witnessArtifact.version)}\ndef concreteCallCertificateVersion : String := ${leanString(PATCH_CONCRETE_CALL_CERTIFICATE_VERSION)}\n\n${blocks.join('\n\n')}\n\nend PatchGeneratedConcreteCallCertificate\n`;

  return {
    lean,
    sourceSha256,
    certified,
    witnessArtifact,
    certificateVersion: PATCH_CONCRETE_CALL_CERTIFICATE_VERSION
  };
}

function leanConcreteRangeExpr(expr) {
  if (expr?.kind === 'var') return `RangeExpr.var ${leanString(expr.name)}`;
  throw new Error(`Concrete beta.26 certificate currently supports variable pass-through arguments only; got '${expr?.kind ?? 'missing'}'.`);
}

function leanInterval(lo, hi) {
  if (!Number.isSafeInteger(lo) || !Number.isSafeInteger(hi) || lo > hi) throw new Error(`Invalid interval ${lo}..${hi}.`);
  return `({ lo := ${leanInt(lo)}, hi := ${leanInt(hi)}, ordered := by decide } : Interval)`;
}
function leanIdentifier(value) { const cleaned=String(value).replace(/[^A-Za-z0-9_]/g,'_'); return (/^[A-Za-z_]/.test(cleaned)?cleaned:`r_${cleaned}`)||'call'; }
function leanString(value) { return JSON.stringify(String(value)); }
function leanInt(value) { return Number(value) < 0 ? `(${value})` : String(value); }
function leanList(items) { return items.length ? `[${items.join(', ')}]` : '[]'; }
