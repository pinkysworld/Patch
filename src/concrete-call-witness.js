import { buildFormalRangeExpression } from './formal-range.js';
import { evaluateLoose } from './expression.js';

export const PATCH_CONCRETE_CALL_WITNESS_VERSION = '0.1';

/**
 * Produce proof-free concrete call-binding witnesses for a conservative linear
 * integer recipe subset. Lean is responsible for checking expression evaluation
 * and exact positional binding; this producer is deliberately outside the TCB.
 */
export function buildConcreteCallWitnesses(ast, formalCalls) {
  const recipes = new Map();
  for (const node of ast ?? []) if (node.kind === 'function') recipes.set(node.name, node);
  const formalCallSites = indexFormalCallSites(formalCalls);
  const witnesses = [];
  const invocationCounts = new Map();
  const active = [];

  for (const node of ast ?? []) {
    if (node.kind !== 'call') continue;
    visitCall('$program', {}, node, null);
  }

  return {
    format: 'patch-concrete-call-witness',
    version: PATCH_CONCRETE_CALL_WITNESS_VERSION,
    witnesses,
    summary: { calls: witnesses.length }
  };

  function visitCall(callerName, callerLocals, callNode, formalSite) {
    const callee = recipes.get(callNode.name);
    if (!callee) throw unsupported(callNode, `unknown recipe '${callNode.name}'`);
    if (active.includes(callNode.name)) throw unsupported(callNode, `recursive recipe '${callNode.name}'`);
    if ((callee.params ?? []).length !== (callNode.args ?? []).length) {
      throw unsupported(callNode, `recipe '${callNode.name}' arity mismatch`);
    }

    const callerBindings = singletonBindings(callerLocals);
    const argExprs = [];
    const values = [];
    const declared = [];
    const calleeLocals = {};

    (callee.params ?? []).forEach((param, index) => {
      const declaredRange = callee.paramRanges?.[param];
      if (!safeRange(declaredRange)) {
        throw unsupported(callNode, `callee parameter '${callNode.name}.${param}' lacks a safe integer range`);
      }
      const expressionText = callNode.args?.[index] ?? '';
      const formalExpr = buildFormalRangeExpression(expressionText, callerBindings);
      if (!formalExpr.supported) {
        throw unsupported(callNode, `argument ${index + 1} for '${callNode.name}' is outside the formal integer expression fragment: ${formalExpr.reason}`);
      }
      const value = evaluateLoose(expressionText, { state: new Map(), locals: callerLocals });
      if (!Number.isSafeInteger(value)) {
        throw unsupported(callNode, `argument ${index + 1} for '${callNode.name}' did not evaluate to a safe integer`);
      }
      if (value < declaredRange.min || value > declaredRange.max) {
        throw unsupported(callNode, `argument ${index + 1} value ${value} is outside '${callNode.name}.${param}' range ${declaredRange.min}..${declaredRange.max}`);
      }
      argExprs.push(formalExpr.expr);
      values.push(value);
      declared.push({ name: param, range: { min: declaredRange.min, max: declaredRange.max } });
      calleeLocals[param] = value;
    });

    const invocation = (invocationCounts.get(callNode.name) ?? 0) + 1;
    invocationCounts.set(callNode.name, invocation);
    const matchedSite = formalSite ?? formalCallSites.get(`${callerName}:${callNode.line ?? '?'}`) ?? null;
    witnesses.push({
      caller: callerName,
      callee: callNode.name,
      line: callNode.line ?? null,
      invocation,
      callerEnv: envEntries(callerLocals),
      argExprs,
      concreteValues: values,
      params: [...(callee.params ?? [])],
      declared,
      expectedCalleeEnv: envEntries(calleeLocals),
      abstractArgRanges: matchedSite?.args?.map(arg => ({ min: arg.range.min, max: arg.range.max })) ?? null
    });

    active.push(callNode.name);
    try {
      visitBody(callNode.name, callee.body ?? [], calleeLocals);
    } finally {
      active.pop();
    }
  }

  function visitBody(callerName, nodes, locals) {
    for (const node of nodes ?? []) {
      if (node.kind === 'call') {
        visitCall(callerName, locals, node, formalCallSites.get(`${callerName}:${node.line ?? '?'}`) ?? null);
        continue;
      }
      if (node.kind === 'if') {
        const choice = evaluateLoose(node.expr, { state: new Map(), locals });
        if (typeof choice !== 'boolean') throw unsupported(node, 'concrete call witness condition is not boolean');
        visitBody(callerName, choice ? node.thenBody : node.elseBody, locals);
        continue;
      }
      if (node.kind === 'repeat') {
        const count = evaluateLoose(node.expr, { state: new Map(), locals });
        if (!Number.isSafeInteger(count) || count < 0 || count > 10000) {
          throw unsupported(node, 'concrete call witness repeat count is outside 0..10000');
        }
        for (let i = 1; i <= count; i += 1) visitBody(callerName, node.body, { ...locals, count: i });
        continue;
      }
      if (node.kind === 'function') throw unsupported(node, 'nested recipe declarations are outside concrete call witness generation');
      if (node.kind === 'return') throw unsupported(node, 'return is outside concrete call witness generation');
      // Direct changes/show/allow/etc. do not create a call-binding witness.
    }
  }
}

function indexFormalCallSites(formalCalls) {
  const map = new Map();
  for (const [recipeName, entry] of Object.entries(formalCalls?.entries ?? {})) {
    walk(entry.body, call => {
      if (call.line !== null && call.line !== undefined) map.set(`${recipeName}:${call.line}`, call);
    });
  }
  return map;
}

function walk(stmt, onCall) {
  if (!stmt) return;
  if (stmt.kind === 'call') { onCall(stmt); return; }
  if (stmt.kind === 'seq') { walk(stmt.first, onCall); walk(stmt.second, onCall); return; }
  if (stmt.kind === 'branch') { walk(stmt.then, onCall); walk(stmt.else, onCall); return; }
  if (stmt.kind === 'repeat') walk(stmt.body, onCall);
}

function singletonBindings(locals) {
  const out = {};
  for (const [name, value] of Object.entries(locals ?? {})) {
    if (Number.isSafeInteger(value)) out[name] = { min: value, max: value };
  }
  return out;
}

function envEntries(locals) {
  return Object.entries(locals ?? {}).map(([name, value]) => ({ name, value }));
}
function safeRange(range) { return Boolean(range && Number.isSafeInteger(range.min) && Number.isSafeInteger(range.max) && range.min <= range.max); }
function unsupported(node, reason) { return new Error(`line ${node?.line ?? '?'}: ${reason}`); }
