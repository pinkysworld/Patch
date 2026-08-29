import { buildConcreteCallWitnesses } from './concrete-call-witness.js?v=9ad29318e93c7c71';
import { buildFormalRangeExpression } from './formal-range.js?v=9ad29318e93c7c71';
import { buildFormalGuardExpression } from './formal-guard.js?v=9ad29318e93c7c71';

export const PATCH_CONCRETE_CALL_BODY_VERSION = '0.2';

/**
 * Build proof-free exact structured callee-body witnesses.
 *
 * Beta.28 supports:
 * - direct quantitative `change` blocks;
 * - statically counted `repeat` blocks;
 * - sequence over the same subset.
 *
 * Beta.29 additionally supports `if`/`else` when the guard belongs to the
 * already-mechanized integer/Boolean GuardExpr fragment and refers only to
 * exact callee recipe parameters. Both branch bodies must still reconstruct
 * effects from the production semantic signature. Nested calls, returns,
 * creation, dynamic repeat and state-dependent guards fail conservatively.
 */
export function buildConcreteCallBodyWitnesses(ast, formalCalls) {
  const callArtifact = buildConcreteCallWitnesses(ast, formalCalls);
  const recipes = new Map();
  for (const node of ast ?? []) if (node.kind === 'function') recipes.set(node.name, node);

  const witnesses = [];
  for (const call of callArtifact.witnesses ?? []) {
    if (call.caller === '$program') continue;
    const callee = recipes.get(call.callee);
    const calleeEntry = formalCalls?.entries?.[call.callee];
    const callerEntry = formalCalls?.entries?.[call.caller];
    if (!callee || !calleeEntry?.supported || !callerEntry?.supported) {
      witnesses.push({ ...call, supported: false, reason: 'callee/caller is outside formalCalls support' });
      continue;
    }

    const rangeBindings = {};
    for (const item of calleeEntry.paramRanges ?? []) rangeBindings[item.name] = item.range;
    const allowedGuardVariables = new Set(Object.keys(rangeBindings));
    const built = buildBlock(
      callee.body ?? [],
      rangeBindings,
      allowedGuardVariables,
      calleeEntry.signature ?? []
    );
    if (!built.supported) {
      witnesses.push({ ...call, supported: false, reason: built.reason });
      continue;
    }

    const exactEnv = Object.fromEntries((call.expectedCalleeEnv ?? []).map(item => [item.name, item.value]));
    let claimedTrace;
    try {
      claimedTrace = evalBoundBodyClaim(built.stmt, exactEnv);
    } catch (err) {
      witnesses.push({ ...call, supported: false, reason: err.message });
      continue;
    }

    witnesses.push({
      ...call,
      supported: true,
      body: built.stmt,
      calleeSignature: calleeEntry.signature ?? [],
      callerSignature: callerEntry.signature ?? [],
      claimedTrace
    });
  }

  return {
    format: 'patch-concrete-call-body',
    version: PATCH_CONCRETE_CALL_BODY_VERSION,
    witnesses,
    summary: {
      total: witnesses.length,
      supported: witnesses.filter(item => item.supported).length,
      unsupported: witnesses.filter(item => !item.supported).length
    }
  };
}

function buildBlock(nodes, rangeBindings, allowedGuardVariables, signature) {
  const statements = [];
  for (const node of nodes ?? []) {
    if (node.kind === 'change') {
      const changed = buildChange(node, rangeBindings, signature);
      if (!changed.supported) return changed;
      statements.push(changed.stmt);
      continue;
    }
    if (node.kind === 'repeat') {
      const count = parseStaticRepeat(node.expr);
      if (count === null) return unsupported(node, 'beta.29 structured call traces require a literal non-negative repeat count');
      const body = buildBlock(node.body ?? [], rangeBindings, allowedGuardVariables, signature);
      if (!body.supported) return body;
      statements.push({ kind: 'repeat', count, body: body.stmt });
      continue;
    }
    if (node.kind === 'if') {
      const guard = buildFormalGuardExpression(node.expr ?? '', allowedGuardVariables);
      if (!guard.supported) {
        return unsupported(node, `branch guard is outside the exact formal GuardExpr fragment: ${guard.reason}`);
      }
      const thenBranch = buildBlock(node.thenBody ?? [], rangeBindings, allowedGuardVariables, signature);
      if (!thenBranch.supported) return thenBranch;
      const elseBranch = buildBlock(node.elseBody ?? [], rangeBindings, allowedGuardVariables, signature);
      if (!elseBranch.supported) return elseBranch;
      statements.push({
        kind: 'branch',
        guard: guard.expr,
        thenBranch: thenBranch.stmt,
        elseBranch: elseBranch.stmt
      });
      continue;
    }
    return unsupported(node, `body construct '${node.kind}' is outside beta.29 structured exact-call traces`);
  }
  return { supported: true, stmt: sequence(statements) };
}

function buildChange(node, rangeBindings, signature) {
  const emits = [];
  for (const operation of node.ops ?? []) {
    if (!['add', 'remove'].includes(operation.op)) {
      return unsupported(operation, `change operation '${operation.op}' is outside beta.29 quantitative trace certification`);
    }
    const amount = buildFormalRangeExpression(operation.expr ?? '', rangeBindings);
    if (!amount.supported) {
      return unsupported(operation, `change amount is outside the formal integer RangeExpr fragment: ${amount.reason}`);
    }
    if (!amount.range || amount.range.min < 0) {
      return unsupported(operation, 'beta.29 quantitative trace certification requires a provably non-negative amount range');
    }

    const candidate = {
      target: node.target,
      field: operation.field ?? null,
      operation: operation.op === 'add' ? 'increase' : 'decrease',
      amountRange: { min: amount.range.min, max: amount.range.max }
    };
    const expected = (signature ?? []).find(effect => sameEffect(effect, candidate));
    if (!expected) {
      return unsupported(operation, `reconstructed semantic effect is not present in the production signature for '${node.target}'`);
    }
    emits.push({ kind: 'emit', expected, amountExpr: amount.expr });
  }
  return { supported: true, stmt: sequence(emits) };
}

function sequence(statements) {
  if (!statements.length) return { kind: 'skip' };
  let stmt = statements[0];
  for (let index = 1; index < statements.length; index += 1) {
    stmt = { kind: 'seq', first: stmt, second: statements[index] };
  }
  return stmt;
}

function evalBoundBodyClaim(stmt, env) {
  switch (stmt?.kind) {
    case 'skip': return [];
    case 'emit': {
      const value = evalRangeExprExact(stmt.amountExpr, env);
      if (!Number.isSafeInteger(value) || value < 0) throw new Error('claimed structured trace amount is outside the safe non-negative integer boundary');
      const permitted = stmt.expected?.amountRange;
      if (!permitted || value < permitted.min || value > permitted.max) {
        throw new Error(`claimed structured trace amount ${value} is outside the expected semantic interval`);
      }
      return [{
        target: stmt.expected.target,
        field: stmt.expected.field ?? null,
        operation: stmt.expected.operation,
        amountRange: { min: value, max: value }
      }];
    }
    case 'seq':
      return [...evalBoundBodyClaim(stmt.first, env), ...evalBoundBodyClaim(stmt.second, env)];
    case 'repeat': {
      const one = evalBoundBodyClaim(stmt.body, env);
      const trace = [];
      for (let index = 0; index < stmt.count; index += 1) trace.push(...one);
      return trace;
    }
    case 'branch':
      return evalGuardExact(stmt.guard, env)
        ? evalBoundBodyClaim(stmt.thenBranch, env)
        : evalBoundBodyClaim(stmt.elseBranch, env);
    default:
      throw new Error(`cannot evaluate beta.29 BoundStmt kind '${stmt?.kind ?? 'missing'}'`);
  }
}

function evalGuardExact(expr, env) {
  switch (expr?.kind) {
    case 'bool': return Boolean(expr.value);
    case 'eq': return evalRangeExprExact(expr.left, env) === evalRangeExprExact(expr.right, env);
    case 'lt': return evalRangeExprExact(expr.left, env) < evalRangeExprExact(expr.right, env);
    case 'le': return evalRangeExprExact(expr.left, env) <= evalRangeExprExact(expr.right, env);
    case 'and': {
      const left = evalGuardExact(expr.left, env);
      const right = evalGuardExact(expr.right, env);
      return left && right;
    }
    case 'or': {
      const left = evalGuardExact(expr.left, env);
      const right = evalGuardExact(expr.right, env);
      return left || right;
    }
    case 'not': return !evalGuardExact(expr.expr, env);
    default: throw new Error(`unsupported exact GuardExpr '${expr?.kind ?? 'missing'}' in beta.29 trace claim`);
  }
}

function evalRangeExprExact(expr, env) {
  let value;
  switch (expr?.kind) {
    case 'lit': value = expr.value; break;
    case 'var':
      if (!Object.hasOwn(env, expr.name)) throw new Error(`exact callee environment has no binding for '${expr.name}'`);
      value = env[expr.name];
      break;
    case 'add': value = evalRangeExprExact(expr.left, env) + evalRangeExprExact(expr.right, env); break;
    case 'sub': value = evalRangeExprExact(expr.left, env) - evalRangeExprExact(expr.right, env); break;
    case 'neg': value = -evalRangeExprExact(expr.expr, env); break;
    case 'scale': value = expr.factor * evalRangeExprExact(expr.expr, env); break;
    default: throw new Error(`unsupported exact RangeExpr '${expr?.kind ?? 'missing'}' in beta.29 trace claim`);
  }
  if (!Number.isSafeInteger(value)) throw new Error('structured trace RangeExpr evaluation exceeds the JavaScript safe-integer boundary');
  return value;
}

function parseStaticRepeat(expr) {
  const text = String(expr ?? '').trim();
  if (!/^(0|[1-9][0-9]*)$/.test(text)) return null;
  const value = Number(text);
  return Number.isSafeInteger(value) && value <= 10000 ? value : null;
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
