import { evaluateExpression, evaluateLoose } from './expression.js';

export const PATCH_RUNTIME_PATH_WITNESS_VERSION = '0.2';

const PURE_SOURCE_NODES = new Set(['create', 'createThing', 'show', 'why', 'watch', 'history', 'allow', 'uiControl', 'function']);

/**
 * Execute the production AST's direct numeric subset only to propose formal
 * control-flow witnesses and concrete protected-recipe parameter environments.
 * These values are untrusted: PatchGuarded.lean independently checks guard
 * evaluation/path selection and PatchRuntime.lean checks the effect trace.
 */
export function deriveRuntimePathWitnesses(ast, protectedNames = []) {
  const state = new Map();
  const functions = new Map();
  const protectedSet = new Set(protectedNames);
  const invocationCounts = new Map();
  const invocations = [];
  const active = [];

  for (const node of ast ?? []) if (node.kind === 'function') functions.set(node.name, node);

  const executeBlock = (nodes, locals = {}, scope = '$program', capturePath = false) => {
    const paths = [];
    let effectCount = 0;
    for (const node of nodes ?? []) {
      const result = executeNode(node, locals, scope, capturePath);
      if (capturePath) paths.push(result.path);
      effectCount += result.effectCount;
    }
    return { path: capturePath ? sequencePaths(paths) : null, effectCount };
  };

  const executeNode = (node, locals, scope, capturePath) => {
    if (PURE_SOURCE_NODES.has(node.kind)) {
      if (node.kind === 'create') createBinding(node, locals);
      else if (node.kind === 'createThing') throw unsupported(node, 'things are outside the direct runtime-certificate subset');
      return { path: capturePath ? leaf() : null, effectCount: 0 };
    }

    if (node.kind === 'change') {
      applyNumericChange(node, locals);
      return {
        path: capturePath ? sequencePaths((node.ops ?? []).map(() => leaf())) : null,
        effectCount: (node.ops ?? []).length
      };
    }

    if (node.kind === 'if') {
      const choice = Boolean(evaluateExpression(node.expr, env(locals)));
      const selected = choice ? node.thenBody : node.elseBody;
      const child = executeBlock(selected, { ...locals }, scope, capturePath);
      return {
        path: capturePath ? { kind: choice ? 'branchThen' : 'branchElse', path: child.path } : null,
        effectCount: child.effectCount
      };
    }

    if (node.kind === 'repeat') {
      const count = Number(evaluateExpression(node.expr, env(locals)));
      if (!Number.isInteger(count) || count < 0 || count > 100000) throw unsupported(node, 'repeat count is outside the direct runtime subset');
      const iterations = [];
      let effects = 0;
      for (let i = 1; i <= count; i += 1) {
        const child = executeBlock(node.body, { ...locals, count: i }, scope, capturePath);
        if (capturePath) iterations.push(child.path);
        effects += child.effectCount;
      }
      return {
        path: capturePath ? repeatPath(iterations) : null,
        effectCount: effects
      };
    }

    if (node.kind === 'call') {
      const fn = functions.get(node.name);
      if (!fn) throw unsupported(node, `unknown recipe '${node.name}'`);
      if (active.includes(node.name)) throw unsupported(node, `recursive recipe '${node.name}'`);
      if ((fn.params ?? []).length !== (node.args ?? []).length) throw unsupported(node, `recipe '${node.name}' arity mismatch`);
      const args = (node.args ?? []).map(arg => evaluateLoose(arg, env(locals)));
      const childLocals = {};
      (fn.params ?? []).forEach((param, index) => {
        const value = args[index];
        const range = fn.paramRanges?.[param];
        if (range && (typeof value !== 'number' || value < range.min || value > range.max)) {
          throw unsupported(node, `recipe parameter '${param}' is outside ${range.min}..${range.max}`);
        }
        childLocals[param] = value;
      });

      active.push(node.name);
      try {
        const shouldCapture = protectedSet.has(node.name);
        const child = executeBlock(fn.body, childLocals, node.name, shouldCapture);
        if (shouldCapture) {
          const index = (invocationCounts.get(node.name) ?? 0) + 1;
          invocationCounts.set(node.name, index);
          invocations.push({
            recipe: node.name,
            invocation: index,
            path: child.path,
            effectCount: child.effectCount,
            environment: Object.fromEntries((fn.params ?? []).map(param => [param, childLocals[param]]))
          });
        }
        // A recipe call is outside the current formal SourceStmt vocabulary of
        // its caller. Runtime certificates therefore capture only the called
        // protected recipe itself, never pretend the call is a SourceStmt node.
        return { path: capturePath ? leaf() : null, effectCount: child.effectCount };
      } finally {
        active.pop();
      }
    }

    if (node.kind === 'return') throw unsupported(node, 'return-valued recipes are outside the direct runtime-certificate subset');
    if (node.kind === 'preview' || node.kind === 'undo' || node.kind === 'redo' || node.kind === 'window' || node.kind === 'event') {
      throw unsupported(node, `${node.kind} is outside the direct runtime-certificate subset`);
    }
    throw unsupported(node, `AST node '${node.kind}' is outside the runtime-path witness subset`);
  };

  executeBlock(ast, {}, '$program', false);
  return {
    format: 'patch-runtime-path-witness',
    version: PATCH_RUNTIME_PATH_WITNESS_VERSION,
    invocations
  };

  function env(locals) { return { state, locals }; }

  function createBinding(node, locals) {
    if (node.valueType !== 'number') throw unsupported(node, `create ${node.valueType} is outside the direct runtime-certificate subset`);
    if (state.has(node.name)) throw unsupported(node, `duplicate persistent binding '${node.name}'`);
    const value = evaluateExpression(node.expr, env(locals));
    if (typeof value !== 'number' || !Number.isFinite(value)) throw unsupported(node, `initial value for '${node.name}' is not a finite number`);
    state.set(node.name, value);
  }

  function applyNumericChange(node, locals) {
    if (!state.has(node.target)) throw unsupported(node, `unknown numeric target '${node.target}'`);
    let current = state.get(node.target);
    for (const operation of node.ops ?? []) {
      if (operation.field) throw unsupported(operation, 'field changes are outside the direct runtime-certificate subset');
      const temporary = new Map(state);
      temporary.set(node.target, current);
      const localEnv = { state: temporary, locals };
      if (operation.op === 'clear') current = 0;
      else if (operation.op === 'set') current = Number(evaluateLoose(operation.expr, localEnv));
      else if (operation.op === 'add') current += Number(evaluateLoose(operation.expr, localEnv));
      else if (operation.op === 'remove') current -= Number(evaluateLoose(operation.expr, localEnv));
      else throw unsupported(operation, `change operation '${operation.op}' is outside the direct runtime-certificate subset`);
      if (!Number.isFinite(current)) throw unsupported(operation, `change result for '${node.target}' is not finite`);
    }
    state.set(node.target, current);
  }
}

export function sequencePaths(paths) {
  if (!paths.length) return leaf();
  return paths.reduce((left, right) => ({ kind: 'seq', first: left, second: right }));
}

export function repeatPath(iterations) {
  let rest = { kind: 'repeatZero' };
  for (let index = iterations.length - 1; index >= 0; index -= 1) {
    rest = { kind: 'repeatSucc', body: iterations[index], rest };
  }
  return rest;
}

function leaf() { return { kind: 'leaf' }; }
function unsupported(node, reason) { return new Error(`line ${node?.line ?? '?'}: ${reason}`); }
