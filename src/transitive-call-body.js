import { buildConcreteCallWitnesses } from './concrete-call-witness.js';
import { buildFormalRangeExpression } from './formal-range.js';
import { buildFormalGuardExpression } from './formal-guard.js';

export const PATCH_TRANSITIVE_CALL_BODY_VERSION = '0.1';

/**
 * Build proof-free exact finite transitive call-tree witnesses.
 *
 * Beta.30 recursively reconstructs nested recipe calls instead of flattening
 * their effects in JavaScript. Each call node preserves the formal argument
 * RangeExprs, positional parameter list, declared intervals, nested callee
 * signature and recursively reconstructed nested body. The exact trace claim is
 * useful evidence only; Lean re-evaluates every nested binding/body itself.
 */
export function buildTransitiveCallBodyWitnesses(ast, formalCalls) {
  const exactCalls = buildConcreteCallWitnesses(ast, formalCalls);
  const recipes = new Map();
  for (const node of ast ?? []) if (node.kind === 'function') recipes.set(node.name, node);

  const witnesses = [];
  for (const call of exactCalls.witnesses ?? []) {
    if (call.caller === '$program') continue;
    const callee = recipes.get(call.callee);
    const calleeEntry = formalCalls?.entries?.[call.callee];
    const callerEntry = formalCalls?.entries?.[call.caller];
    if (!callee || !calleeEntry?.supported || !callerEntry?.supported) {
      witnesses.push({ ...call, supported: false, reason: 'callee/caller is outside formalCalls support' });
      continue;
    }

    const built = buildRecipeTree(
      callee,
      calleeEntry,
      recipes,
      formalCalls,
      new Set([callee.name])
    );
    if (!built.supported) {
      witnesses.push({ ...call, supported: false, reason: built.reason });
      continue;
    }

    const exactEnv = Object.fromEntries((call.expectedCalleeEnv ?? []).map(item => [item.name, item.value]));
    let claimedTrace;
    try {
      claimedTrace = evalCallTreeClaim(built.stmt, exactEnv);
    } catch (err) {
      witnesses.push({ ...call, supported: false, reason: err.message });
      continue;
    }

    witnesses.push({
      ...call,
      supported: true,
      callTree: built.stmt,
      calleeSignature: calleeEntry.signature ?? [],
      callerSignature: callerEntry.signature ?? [],
      claimedTrace,
      nestedCallDepth: callTreeDepth(built.stmt)
    });
  }

  return {
    format: 'patch-transitive-call-body',
    version: PATCH_TRANSITIVE_CALL_BODY_VERSION,
    witnesses,
    summary: {
      total: witnesses.length,
      supported: witnesses.filter(item => item.supported).length,
      unsupported: witnesses.filter(item => !item.supported).length,
      maxNestedCallDepth: Math.max(0, ...witnesses.filter(item => item.supported).map(item => item.nestedCallDepth ?? 0))
    }
  };
}

function buildRecipeTree(recipe, entry, recipes, formalCalls, active) {
  const rangeBindings = rangeBindingsFor(entry);
  const allowedGuardVariables = new Set(Object.keys(rangeBindings));
  return buildBlock(
    recipe.body ?? [],
    recipe,
    entry,
    rangeBindings,
    allowedGuardVariables,
    recipes,
    formalCalls,
    active
  );
}

function buildBlock(nodes, recipe, entry, rangeBindings, allowedGuardVariables, recipes, formalCalls, active) {
  const statements = [];
  for (const node of nodes ?? []) {
    if (node.kind === 'change') {
      const changed = buildChangeBase(node, rangeBindings, entry.signature ?? []);
      if (!changed.supported) return changed;
      statements.push(changed.stmt);
      continue;
    }

    if (node.kind === 'repeat') {
      const count = parseStaticRepeat(node.expr);
      if (count === null) return unsupported(node, 'beta.30 transitive traces require a literal non-negative repeat count');
      const body = buildBlock(node.body ?? [], recipe, entry, rangeBindings, allowedGuardVariables, recipes, formalCalls, active);
      if (!body.supported) return body;
      statements.push({ kind: 'repeat', count, body: body.stmt });
      continue;
    }

    if (node.kind === 'if') {
      const guard = buildFormalGuardExpression(node.expr ?? '', allowedGuardVariables);
      if (!guard.supported) return unsupported(node, `branch guard is outside the exact formal GuardExpr fragment: ${guard.reason}`);
      const thenBranch = buildBlock(node.thenBody ?? [], recipe, entry, rangeBindings, allowedGuardVariables, recipes, formalCalls, active);
      if (!thenBranch.supported) return thenBranch;
      const elseBranch = buildBlock(node.elseBody ?? [], recipe, entry, rangeBindings, allowedGuardVariables, recipes, formalCalls, active);
      if (!elseBranch.supported) return elseBranch;
      statements.push({ kind: 'branch', guard: guard.expr, thenBranch: thenBranch.stmt, elseBranch: elseBranch.stmt });
      continue;
    }

    if (node.kind === 'call') {
      const nested = buildNestedCall(node, recipe, entry, rangeBindings, recipes, formalCalls, active);
      if (!nested.supported) return nested;
      statements.push(nested.stmt);
      continue;
    }

    return unsupported(node, `body construct '${node.kind}' is outside beta.30 finite transitive exact-call traces`);
  }
  return { supported: true, stmt: sequenceTree(statements) };
}

function buildNestedCall(node, recipe, entry, rangeBindings, recipes, formalCalls, active) {
  const callee = recipes.get(node.name);
  const calleeEntry = formalCalls?.entries?.[node.name];
  if (!callee || !calleeEntry?.supported) return unsupported(node, `nested callee '${node.name}' is outside formalCalls support`);
  if (active.has(callee.name)) return unsupported(node, `recursive/cyclic nested call '${callee.name}' is outside beta.30`);
  if (!Number.isInteger(entry.rank) || !Number.isInteger(calleeEntry.rank) || calleeEntry.rank >= entry.rank) {
    return unsupported(node, `nested call '${recipe.name}' -> '${callee.name}' is not rank-decreasing`);
  }

  const params = callee.params ?? [];
  if (new Set(params).size !== params.length) return unsupported(node, `nested callee '${callee.name}' has duplicate parameter names`);
  if ((node.args ?? []).length !== params.length) return unsupported(node, `nested call '${callee.name}' arity mismatch`);

  const declared = declaredRangesFor(calleeEntry, params);
  if (!declared) return unsupported(node, `nested callee '${callee.name}' lacks bounded safe-integer parameter intervals`);

  const argExprs = [];
  for (let index = 0; index < params.length; index += 1) {
    const arg = buildFormalRangeExpression(node.args[index] ?? '', rangeBindings);
    if (!arg.supported || !arg.range) {
      return unsupported(node, `nested argument ${index + 1} for '${callee.name}' is outside the formal integer RangeExpr fragment: ${arg.reason ?? 'missing range'}`);
    }
    const target = declared[index];
    if (arg.range.min < target.min || arg.range.max > target.max) {
      return unsupported(node, `nested argument ${index + 1} interval ${arg.range.min}..${arg.range.max} does not fit ${callee.name}.${params[index]} ${target.min}..${target.max}`);
    }
    argExprs.push(arg.expr);
  }

  const nextActive = new Set(active);
  nextActive.add(callee.name);
  const nestedBody = buildRecipeTree(callee, calleeEntry, recipes, formalCalls, nextActive);
  if (!nestedBody.supported) return nestedBody;

  return {
    supported: true,
    stmt: {
      kind: 'call',
      callee: callee.name,
      argExprs,
      params: [...params],
      declared,
      calleeSignature: calleeEntry.signature ?? [],
      body: nestedBody.stmt
    }
  };
}

function buildChangeBase(node, rangeBindings, signature) {
  const emits = [];
  for (const operation of node.ops ?? []) {
    if (!['add', 'remove'].includes(operation.op)) {
      return unsupported(operation, `change operation '${operation.op}' is outside beta.30 quantitative trace certification`);
    }
    const amount = buildFormalRangeExpression(operation.expr ?? '', rangeBindings);
    if (!amount.supported || !amount.range) {
      return unsupported(operation, `change amount is outside the formal integer RangeExpr fragment: ${amount.reason ?? 'missing range'}`);
    }
    if (amount.range.min < 0) return unsupported(operation, 'beta.30 quantitative trace certification requires a provably non-negative amount range');

    const candidate = {
      target: node.target,
      field: operation.field ?? null,
      operation: operation.op === 'add' ? 'increase' : 'decrease',
      amountRange: { min: amount.range.min, max: amount.range.max }
    };
    const expected = (signature ?? []).find(effect => sameEffect(effect, candidate));
    if (!expected) return unsupported(operation, `reconstructed semantic effect is not present in the production signature for '${node.target}'`);
    emits.push({ kind: 'emit', expected, amountExpr: amount.expr });
  }
  return { supported: true, stmt: { kind: 'base', body: sequenceBound(emits) } };
}

function sequenceBound(statements) {
  if (!statements.length) return { kind: 'skip' };
  let stmt = statements[0];
  for (let index = 1; index < statements.length; index += 1) stmt = { kind: 'seq', first: stmt, second: statements[index] };
  return stmt;
}

function sequenceTree(statements) {
  if (!statements.length) return { kind: 'base', body: { kind: 'skip' } };
  let stmt = statements[0];
  for (let index = 1; index < statements.length; index += 1) stmt = { kind: 'seq', first: stmt, second: statements[index] };
  return stmt;
}

function evalCallTreeClaim(stmt, env) {
  switch (stmt?.kind) {
    case 'base': return evalBoundClaim(stmt.body, env);
    case 'seq': return [...evalCallTreeClaim(stmt.first, env), ...evalCallTreeClaim(stmt.second, env)];
    case 'repeat': {
      const one = evalCallTreeClaim(stmt.body, env);
      const trace = [];
      for (let index = 0; index < stmt.count; index += 1) trace.push(...one);
      return trace;
    }
    case 'branch': return evalGuardExact(stmt.guard, env)
      ? evalCallTreeClaim(stmt.thenBranch, env)
      : evalCallTreeClaim(stmt.elseBranch, env);
    case 'call': {
      const values = stmt.argExprs.map(expr => evalRangeExprExact(expr, env));
      if (values.length !== stmt.params.length || values.length !== stmt.declared.length) throw new Error(`nested call '${stmt.callee}' binding arity mismatch`);
      const nestedEnv = {};
      for (let index = 0; index < values.length; index += 1) {
        const value = values[index];
        const range = stmt.declared[index];
        if (!Number.isSafeInteger(value) || value < range.min || value > range.max) {
          throw new Error(`nested call '${stmt.callee}' exact argument ${value} is outside ${range.min}..${range.max}`);
        }
        nestedEnv[stmt.params[index]] = value;
      }
      return evalCallTreeClaim(stmt.body, nestedEnv);
    }
    default: throw new Error(`cannot evaluate beta.30 CallTreeStmt kind '${stmt?.kind ?? 'missing'}'`);
  }
}

function evalBoundClaim(stmt, env) {
  switch (stmt?.kind) {
    case 'skip': return [];
    case 'emit': {
      const value = evalRangeExprExact(stmt.amountExpr, env);
      if (!Number.isSafeInteger(value) || value < 0) throw new Error('claimed transitive trace amount is outside the safe non-negative integer boundary');
      const permitted = stmt.expected?.amountRange;
      if (!permitted || value < permitted.min || value > permitted.max) throw new Error(`claimed transitive trace amount ${value} is outside the expected semantic interval`);
      return [{ target: stmt.expected.target, field: stmt.expected.field ?? null, operation: stmt.expected.operation, amountRange: { min: value, max: value } }];
    }
    case 'seq': return [...evalBoundClaim(stmt.first, env), ...evalBoundClaim(stmt.second, env)];
    case 'repeat': {
      const one = evalBoundClaim(stmt.body, env);
      const trace = [];
      for (let index = 0; index < stmt.count; index += 1) trace.push(...one);
      return trace;
    }
    case 'branch': return evalGuardExact(stmt.guard, env) ? evalBoundClaim(stmt.thenBranch, env) : evalBoundClaim(stmt.elseBranch, env);
    default: throw new Error(`cannot evaluate embedded beta.29 BoundStmt kind '${stmt?.kind ?? 'missing'}'`);
  }
}

function evalGuardExact(expr, env) {
  switch (expr?.kind) {
    case 'bool': return Boolean(expr.value);
    case 'eq': return evalRangeExprExact(expr.left, env) === evalRangeExprExact(expr.right, env);
    case 'lt': return evalRangeExprExact(expr.left, env) < evalRangeExprExact(expr.right, env);
    case 'le': return evalRangeExprExact(expr.left, env) <= evalRangeExprExact(expr.right, env);
    case 'and': return evalGuardExact(expr.left, env) && evalGuardExact(expr.right, env);
    case 'or': return evalGuardExact(expr.left, env) || evalGuardExact(expr.right, env);
    case 'not': return !evalGuardExact(expr.expr, env);
    default: throw new Error(`unsupported exact GuardExpr '${expr?.kind ?? 'missing'}' in beta.30 trace claim`);
  }
}

function evalRangeExprExact(expr, env) {
  let value;
  switch (expr?.kind) {
    case 'lit': value = expr.value; break;
    case 'var':
      if (!Object.hasOwn(env, expr.name)) throw new Error(`exact environment has no binding for '${expr.name}'`);
      value = env[expr.name];
      break;
    case 'add': value = evalRangeExprExact(expr.left, env) + evalRangeExprExact(expr.right, env); break;
    case 'sub': value = evalRangeExprExact(expr.left, env) - evalRangeExprExact(expr.right, env); break;
    case 'neg': value = -evalRangeExprExact(expr.expr, env); break;
    case 'scale': value = expr.factor * evalRangeExprExact(expr.expr, env); break;
    default: throw new Error(`unsupported exact RangeExpr '${expr?.kind ?? 'missing'}' in beta.30 trace claim`);
  }
  if (!Number.isSafeInteger(value)) throw new Error('transitive trace RangeExpr evaluation exceeds the JavaScript safe-integer boundary');
  return value;
}

function rangeBindingsFor(entry) {
  return Object.fromEntries((entry?.paramRanges ?? []).map(item => [item.name, item.range]));
}

function declaredRangesFor(entry, params) {
  const byName = new Map((entry?.paramRanges ?? []).map(item => [item.name, item.range]));
  const out = [];
  for (const name of params) {
    const range = byName.get(name);
    if (!range || !Number.isSafeInteger(range.min) || !Number.isSafeInteger(range.max) || range.min > range.max) return null;
    out.push({ min: range.min, max: range.max });
  }
  return out;
}

function parseStaticRepeat(expr) {
  const text = String(expr ?? '').trim();
  if (!/^(0|[1-9][0-9]*)$/.test(text)) return null;
  const value = Number(text);
  return Number.isSafeInteger(value) && value <= 10000 ? value : null;
}

function callTreeDepth(stmt) {
  switch (stmt?.kind) {
    case 'base': return 0;
    case 'seq': return Math.max(callTreeDepth(stmt.first), callTreeDepth(stmt.second));
    case 'repeat': return callTreeDepth(stmt.body);
    case 'branch': return Math.max(callTreeDepth(stmt.thenBranch), callTreeDepth(stmt.elseBranch));
    case 'call': return 1 + callTreeDepth(stmt.body);
    default: return 0;
  }
}

function sameEffect(left, right) {
  return left?.target === right?.target &&
    (left?.field ?? null) === (right?.field ?? null) &&
    left?.operation === right?.operation &&
    left?.amountRange?.min === right?.amountRange?.min &&
    left?.amountRange?.max === right?.amountRange?.max;
}

function unsupported(node, reason) {
  return { supported: false, reason: `line ${node?.line ?? '?'}: ${reason}` };
}
