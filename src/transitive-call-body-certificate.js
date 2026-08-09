import crypto from 'node:crypto';
import { compile } from './compiler.js';
import { buildTransitiveCallBodyWitnesses } from './transitive-call-body.js';

export const PATCH_TRANSITIVE_CALL_BODY_CERTIFICATE_VERSION = '0.1';
const EFFECT_KINDS = new Set(['increase', 'decrease', 'set', 'clear']);

export function generateTransitiveCallBodyCertificate(source, options = {}) {
  const compiled = compile(source, options);
  const artifact = buildTransitiveCallBodyWitnesses(compiled.ast, compiled.ir.formalCalls);
  const supported = artifact.witnesses.filter(item => item.supported && (item.nestedCallDepth ?? 0) > 0);
  if (!supported.length) throw new Error('No beta.30 nested/transitive exact call-tree witnesses are certifiable.');

  const blocks = [];
  const certified = [];
  for (const witness of supported) {
    if (!witness.abstractArgRanges) throw new Error(`Call ${witness.caller} -> ${witness.callee} has no beta.25 abstract argument intervals.`);
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
    blocks.push(`def ${id}_tree : CallTreeStmt := ${leanCallTree(witness.callTree)}`);
    blocks.push(`def ${id}_calleeSignature : List Effect := ${leanList(witness.calleeSignature.map(leanEffect))}`);
    blocks.push(`def ${id}_callerSignature : List Effect := ${leanList(witness.callerSignature.map(leanEffect))}`);
    blocks.push(`def ${id}_trace : List Effect := ${leanList(witness.claimedTrace.map(leanEffect))}`);

    blocks.push(`theorem ${id}_binding_checked :\n    concreteCallBinding ${id}_exprs ${id}_caller ${id}_params ${id}_declared = some ${id}_bindings := by\n  native_decide`);
    blocks.push(`theorem ${id}_abstract_checked :\n    concreteThroughAbstractBool ${id}_values ${id}_abstract ${id}_declared = true := by\n  native_decide`);
    blocks.push(`theorem ${id}_trace_equality_checked :\n    evalCallTreeStmtEqBool ${id}_bindings ${id}_tree ${id}_trace = true := by\n  native_decide`);
    blocks.push(`theorem ${id}_trace_checked :\n    evalCallTreeStmt ${id}_bindings ${id}_tree = some ${id}_trace := by\n  exact evalCallTreeStmtEqBool_sound ${id}_trace_equality_checked`);
    blocks.push(`theorem ${id}_tree_covered_checked :\n    callTreeCoveredBool ${id}_calleeSignature ${id}_tree = true := by\n  native_decide`);
    blocks.push(`theorem ${id}_signature_import_checked :\n    signatureCoversBool ${id}_calleeSignature ${id}_callerSignature = true := by\n  native_decide`);
    blocks.push(`theorem ${id}_transitive_trace_sound :\n    ConcreteArgsFit ${id}_values ${id}_declared ∧\n    ConcreteCallBindingSpec ${id}_exprs ${id}_caller ${id}_params ${id}_declared ${id}_bindings ∧\n    TraceRefinesSignature ${id}_trace ${id}_callerSignature := by\n  constructor\n  · exact concreteThroughAbstractBool_sound ${id}_abstract_checked\n  · exact checkedConcreteTransitiveCallTreeRefinesCallerSignature\n      ${id}_binding_checked\n      ${id}_trace_checked\n      ${id}_tree_covered_checked\n      ${id}_signature_import_checked`);
    certified.push(`${witness.caller}->${witness.callee}#${witness.invocation}@depth${witness.nestedCallDepth}`);
  }

  const sourceSha256 = crypto.createHash('sha256').update(source, 'utf8').digest('hex');
  const lean = `import PatchCallTree\n\nopen PatchFormal\n\nnamespace PatchGeneratedTransitiveCallBodyCertificate\n\n/-- Proof-free beta.30 transitive call-tree evidence. Lean recursively\n    re-evaluates every nested RangeExpr argument, positional BindingList,\n    GuardExpr branch, static repeat and direct quantitative effect. Nested\n    traces are checked against each callee signature and imported one\n    signature edge at a time. The exported theorem also connects concrete\n    outer values through beta.25 abstract call intervals into declarations.\n    Recursion, dynamic repeat, state-dependent exact guards and production-Wasm\n    call equivalence remain outside this layer. -/\ndef sourceSha256 : String := ${leanString(sourceSha256)}\ndef patchIrVersion : String := ${leanString(compiled.ir.version)}\ndef transitiveWitnessVersion : String := ${leanString(artifact.version)}\ndef transitiveCertificateVersion : String := ${leanString(PATCH_TRANSITIVE_CALL_BODY_CERTIFICATE_VERSION)}\n\n${blocks.join('\n\n')}\n\nend PatchGeneratedTransitiveCallBodyCertificate\n`;

  return { lean, sourceSha256, certified, artifact, certificateVersion: PATCH_TRANSITIVE_CALL_BODY_CERTIFICATE_VERSION };
}

function leanCallTree(stmt) {
  switch (stmt?.kind) {
    case 'base': return `CallTreeStmt.base (${leanBoundStmt(stmt.body)})`;
    case 'seq': return `CallTreeStmt.seq (${leanCallTree(stmt.first)}) (${leanCallTree(stmt.second)})`;
    case 'repeat': return `CallTreeStmt.repeat ${stmt.count} (${leanCallTree(stmt.body)})`;
    case 'branch': return `CallTreeStmt.branch (${leanGuardExpr(stmt.guard)}) (${leanCallTree(stmt.thenBranch)}) (${leanCallTree(stmt.elseBranch)})`;
    case 'call': return `CallTreeStmt.call ${leanList(stmt.argExprs.map(leanRangeExpr))} ${leanList(stmt.params.map(leanString))} ${leanList(stmt.declared.map(range => leanInterval(range.min, range.max)))} ${leanList(stmt.calleeSignature.map(leanEffect))} (${leanCallTree(stmt.body)})`;
    default: throw new Error(`Cannot encode beta.30 CallTreeStmt '${stmt?.kind ?? 'missing'}'.`);
  }
}
function leanBoundStmt(stmt) {
  switch (stmt?.kind) {
    case 'skip': return 'BoundStmt.skip';
    case 'emit': return `BoundStmt.emit (${leanEffect(stmt.expected)}) (${leanRangeExpr(stmt.amountExpr)})`;
    case 'seq': return `BoundStmt.seq (${leanBoundStmt(stmt.first)}) (${leanBoundStmt(stmt.second)})`;
    case 'repeat': return `BoundStmt.repeat ${stmt.count} (${leanBoundStmt(stmt.body)})`;
    case 'branch': return `BoundStmt.branch (${leanGuardExpr(stmt.guard)}) (${leanBoundStmt(stmt.thenBranch)}) (${leanBoundStmt(stmt.elseBranch)})`;
    default: throw new Error(`Cannot encode embedded beta.29 BoundStmt '${stmt?.kind ?? 'missing'}'.`);
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
    default: throw new Error(`Cannot encode beta.30 GuardExpr '${expr?.kind ?? 'missing'}'.`);
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
    default: throw new Error(`Cannot encode beta.30 RangeExpr '${expr?.kind ?? 'missing'}'.`);
  }
}
function leanEffect(effect) {
  if (!EFFECT_KINDS.has(effect?.operation)) throw new Error(`Unsupported beta.30 effect '${effect?.operation}'.`);
  let amount = 'none';
  if (effect.operation === 'increase' || effect.operation === 'decrease') {
    if (!effect.amountRange) throw new Error(`Quantitative beta.30 effect '${effect.operation}' has no interval.`);
    amount = `some ${leanInterval(effect.amountRange.min, effect.amountRange.max)}`;
  }
  return `({ target := ${leanString(effect.target)}, field := ${leanOptionString(effect.field)}, kind := .${effect.operation}, amount := ${amount} } : Effect)`;
}
function leanInterval(lo, hi) {
  if (!Number.isSafeInteger(lo) || !Number.isSafeInteger(hi) || lo > hi) throw new Error(`Invalid beta.30 interval ${lo}..${hi}.`);
  return `({ lo := ${leanInt(lo)}, hi := ${leanInt(hi)}, ordered := by decide } : Interval)`;
}
function leanOptionString(value) { return value === null || value === undefined ? 'none' : `some ${leanString(value)}`; }
function leanIdentifier(value) { const cleaned=String(value).replace(/[^A-Za-z0-9_]/g,'_'); return (/^[A-Za-z_]/.test(cleaned)?cleaned:`r_${cleaned}`)||'call'; }
function leanString(value) { return JSON.stringify(String(value)); }
function leanInt(value) { if (!Number.isSafeInteger(Number(value))) throw new Error(`Non-safe integer ${value}.`); return Number(value) < 0 ? `(${value})` : String(value); }
function leanList(items) { return items.length ? `[${items.join(', ')}]` : '[]'; }
