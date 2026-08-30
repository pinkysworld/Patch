import crypto from 'node:crypto';
import { compile } from './compiler.js?v=868f0784ca7f3972';
import { buildConcreteCallBodyWitnesses } from './concrete-call-body.js?v=868f0784ca7f3972';

export const PATCH_CONCRETE_CALL_BODY_CERTIFICATE_VERSION = '0.2';

const EFFECT_KINDS = new Set(['increase', 'decrease', 'set', 'clear']);

/** Generate Lean evidence for beta.29 exact guard-aware callee semantic traces. */
export function generateConcreteCallBodyCertificate(source, options = {}) {
  const compiled = compile(source, options);
  const artifact = buildConcreteCallBodyWitnesses(compiled.ast, compiled.ir.formalCalls);
  const supported = artifact.witnesses.filter(item => item.supported);
  if (!supported.length) throw new Error('No beta.29 structured concrete callee-body witnesses are certifiable.');

  const blocks = [];
  const certified = [];
  for (const witness of supported) {
    if (!witness.abstractArgRanges) {
      throw new Error(`Call ${witness.caller} -> ${witness.callee} has no beta.25 abstract argument intervals.`);
    }
    const id = `${leanIdentifier(witness.caller)}_${leanIdentifier(witness.callee)}_${witness.invocation}`;
    const exprs = witness.argExprs.map(leanRangeExpr);
    const callerBindings = witness.callerEnv.map(item => `(${leanString(item.name)}, ${leanInt(item.value)})`);
    const params = witness.params.map(leanString);
    const declared = witness.declared.map(item => leanInterval(item.range.min, item.range.max));
    const exactBindings = witness.expectedCalleeEnv.map(item => `(${leanString(item.name)}, ${leanInt(item.value)})`);
    const values = witness.concreteValues.map(leanInt);
    const abstract = witness.abstractArgRanges.map(range => leanInterval(range.min, range.max));

    blocks.push(`def ${id}_exprs : List RangeExpr := ${leanList(exprs)}`);
    blocks.push(`def ${id}_callerBindings : BindingList := ${leanList(callerBindings)}`);
    blocks.push(`def ${id}_caller : IntEnv := envOfBindings ${id}_callerBindings`);
    blocks.push(`def ${id}_params : List Name := ${leanList(params)}`);
    blocks.push(`def ${id}_declared : List Interval := ${leanList(declared)}`);
    blocks.push(`def ${id}_bindings : BindingList := ${leanList(exactBindings)}`);
    blocks.push(`def ${id}_values : List Int := ${leanList(values)}`);
    blocks.push(`def ${id}_abstract : List Interval := ${leanList(abstract)}`);
    blocks.push(`def ${id}_body : BoundStmt := ${leanBoundStmt(witness.body)}`);
    blocks.push(`def ${id}_calleeSignature : List Effect := ${leanList(witness.calleeSignature.map(leanEffect))}`);
    blocks.push(`def ${id}_callerSignature : List Effect := ${leanList(witness.callerSignature.map(leanEffect))}`);
    blocks.push(`def ${id}_trace : List Effect := ${leanList(witness.claimedTrace.map(leanEffect))}`);

    blocks.push(`theorem ${id}_binding_checked :\n    concreteCallBinding ${id}_exprs ${id}_caller ${id}_params ${id}_declared = some ${id}_bindings := by\n  native_decide`);
    blocks.push(`theorem ${id}_abstract_checked :\n    concreteThroughAbstractBool ${id}_values ${id}_abstract ${id}_declared = true := by\n  native_decide`);
    blocks.push(`theorem ${id}_trace_equality_checked :\n    evalBoundStmtEqBool ${id}_bindings ${id}_body ${id}_trace = true := by\n  native_decide`);
    blocks.push(`theorem ${id}_trace_checked :\n    evalBoundStmt ${id}_bindings ${id}_body = some ${id}_trace := by\n  exact evalBoundStmtEqBool_sound ${id}_trace_equality_checked`);
    blocks.push(`theorem ${id}_body_covered_checked :\n    boundBodyCoveredBool ${id}_calleeSignature ${id}_body = true := by\n  native_decide`);
    blocks.push(`theorem ${id}_signature_import_checked :\n    signatureCoversBool ${id}_calleeSignature ${id}_callerSignature = true := by\n  native_decide`);
    blocks.push(`theorem ${id}_structured_trace_sound :\n    ConcreteCallBindingSpec ${id}_exprs ${id}_caller ${id}_params ${id}_declared ${id}_bindings ∧\n    TraceRefinesSignature ${id}_trace ${id}_callerSignature := by\n  exact checkedConcreteCallBodyRefinesCallerSignature\n    ${id}_binding_checked\n    ${id}_trace_checked\n    ${id}_body_covered_checked\n    ${id}_signature_import_checked`);
    certified.push(`${witness.caller}->${witness.callee}#${witness.invocation}`);
  }

  const sourceSha256 = crypto.createHash('sha256').update(source, 'utf8').digest('hex');
  const lean = `import PatchCallBodyImport\n\nopen PatchFormal\n\nnamespace PatchGeneratedConcreteCallBodyCertificate\n\n/-- Proof-free production structured-call evidence. Lean re-evaluates exact\n    argument binding and the complete supported callee semantic-effect body\n    (direct emits, sequence, static repeat and exact GuardExpr branches), checks\n    exact claimed trace equality, checks both branch arms against the callee\n    signature and imports the selected concrete trace into the caller signature.\n    Nested calls, dynamic repeat and production-Wasm call equivalence remain\n    outside beta.29. -/\ndef sourceSha256 : String := ${leanString(sourceSha256)}\ndef patchIrVersion : String := ${leanString(compiled.ir.version)}\ndef callBodyWitnessVersion : String := ${leanString(artifact.version)}\ndef callBodyCertificateVersion : String := ${leanString(PATCH_CONCRETE_CALL_BODY_CERTIFICATE_VERSION)}\n\n${blocks.join('\n\n')}\n\nend PatchGeneratedConcreteCallBodyCertificate\n`;

  return { lean, sourceSha256, certified, artifact, certificateVersion: PATCH_CONCRETE_CALL_BODY_CERTIFICATE_VERSION };
}

function leanBoundStmt(stmt) {
  switch (stmt?.kind) {
    case 'skip': return 'BoundStmt.skip';
    case 'emit': return `BoundStmt.emit (${leanEffect(stmt.expected)}) (${leanRangeExpr(stmt.amountExpr)})`;
    case 'seq': return `BoundStmt.seq (${leanBoundStmt(stmt.first)}) (${leanBoundStmt(stmt.second)})`;
    case 'repeat': return `BoundStmt.repeat ${stmt.count} (${leanBoundStmt(stmt.body)})`;
    case 'branch': return `BoundStmt.branch (${leanGuardExpr(stmt.guard)}) (${leanBoundStmt(stmt.thenBranch)}) (${leanBoundStmt(stmt.elseBranch)})`;
    default: throw new Error(`Cannot encode beta.29 BoundStmt '${stmt?.kind ?? 'missing'}'.`);
  }
}

function leanGuardExpr(expr) {
  switch (expr?.kind) {
    case 'bool': return `GuardExpr.bool ${expr.value ? 'true' : 'false'}`;
    case 'eq': return `GuardExpr.eq (${leanRangeExpr(expr.left)}) (${leanRangeExpr(expr.right)})`;
    case 'lt': return `GuardExpr.lt (${leanRangeExpr(expr.left)}) (${leanRangeExpr(expr.right)})`;
    case 'le': return `GuardExpr.le (${leanRangeExpr(expr.left)}) (${leanRangeExpr(expr.right)})`;
    case 'and': return `GuardExpr.and (${leanGuardExpr(expr.left)}) (${leanGuardExpr(expr.right)})`;
    case 'or': return `GuardExpr.or (${leanGuardExpr(expr.left)}) (${leanGuardExpr(expr.right)})`;
    case 'not': return `GuardExpr.not (${leanGuardExpr(expr.expr)})`;
    default: throw new Error(`Cannot encode beta.29 GuardExpr '${expr?.kind ?? 'missing'}'.`);
  }
}

function leanRangeExpr(expr) {
  switch (expr?.kind) {
    case 'lit': return `RangeExpr.lit ${leanInt(expr.value)}`;
    case 'var': return `RangeExpr.var ${leanString(expr.name)}`;
    case 'add': return `RangeExpr.add (${leanRangeExpr(expr.left)}) (${leanRangeExpr(expr.right)})`;
    case 'sub': return `RangeExpr.sub (${leanRangeExpr(expr.left)}) (${leanRangeExpr(expr.right)})`;
    case 'neg': return `RangeExpr.neg (${leanRangeExpr(expr.expr)})`;
    case 'scale': return `RangeExpr.scale ${expr.factor} (${leanRangeExpr(expr.expr)})`;
    default: throw new Error(`Cannot encode beta.29 RangeExpr '${expr?.kind ?? 'missing'}'.`);
  }
}

function leanEffect(effect) {
  if (!EFFECT_KINDS.has(effect?.operation)) throw new Error(`Unsupported beta.29 effect '${effect?.operation}'.`);
  let amount = 'none';
  if (effect.operation === 'increase' || effect.operation === 'decrease') {
    if (!effect.amountRange) throw new Error(`Quantitative beta.29 effect '${effect.operation}' has no interval.`);
    amount = `some ${leanInterval(effect.amountRange.min, effect.amountRange.max)}`;
  }
  return `({ target := ${leanString(effect.target)}, field := ${leanOptionString(effect.field)}, kind := .${effect.operation}, amount := ${amount} } : Effect)`;
}

function leanInterval(lo, hi) {
  if (!Number.isSafeInteger(lo) || !Number.isSafeInteger(hi) || lo > hi) throw new Error(`Invalid beta.29 interval ${lo}..${hi}.`);
  return `({ lo := ${leanInt(lo)}, hi := ${leanInt(hi)}, ordered := by decide } : Interval)`;
}
function leanOptionString(value) { return value === null || value === undefined ? 'none' : `some ${leanString(value)}`; }
function leanIdentifier(value) { const cleaned=String(value).replace(/[^A-Za-z0-9_]/g,'_'); return (/^[A-Za-z_]/.test(cleaned)?cleaned:`r_${cleaned}`)||'call'; }
function leanString(value) { return JSON.stringify(String(value)); }
function leanInt(value) { if (!Number.isSafeInteger(Number(value))) throw new Error(`Non-safe integer ${value}.`); return Number(value) < 0 ? `(${value})` : String(value); }
function leanList(items) { return items.length ? `[${items.join(', ')}]` : '[]'; }
