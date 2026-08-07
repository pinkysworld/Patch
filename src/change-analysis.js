const SIMPLE_NAME = /^[A-Za-z_]\w*$/;
const NUMBER_LITERAL = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/;

export class ChangeCapabilityError extends Error {
  constructor(message, line = null) {
    super(line ? `line ${line}: ${message}` : message);
    this.line = line;
  }
}

export function analyzeChangeSemantics(ast) {
  const functions = collectFunctions(ast);
  const policies = collectPolicies(ast);
  const signatures = {};
  const memo = new Map();

  for (const [name, fn] of functions) {
    signatures[name] = inferFunctionSignature(name, functions, memo, []);
  }

  signatures.$program = {
    name: '$program',
    params: [],
    changes: inferBlockEffects(ast, functions, memo, new Map(), [], { includeDeclarations: false }),
    calls: collectCalls(ast).map(call => ({ name: call.name, args: [...call.args], line: call.line }))
  };

  validatePolicies(policies, functions, signatures);

  return {
    signatures,
    capabilities: Object.fromEntries([...policies].map(([name, policy]) => [name, policy.rules]))
  };
}

function collectFunctions(ast) {
  const functions = new Map();
  walk(ast, node => {
    if (node.kind === 'function') functions.set(node.name, node);
  });
  return functions;
}

function collectPolicies(ast) {
  const policies = new Map();
  walk(ast, node => {
    if (node.kind !== 'allow') return;
    if (policies.has(node.name)) throw new ChangeCapabilityError(`Change capabilities for '${node.name}' are declared more than once.`, node.line);
    policies.set(node.name, node);
  });
  return policies;
}

function inferFunctionSignature(name, functions, memo, stack) {
  if (memo.has(name)) return clone(memo.get(name));
  const fn = functions.get(name);
  if (!fn) return { name, params: [], changes: [], calls: [], unresolved: true };
  if (stack.includes(name)) {
    return { name, params: [...fn.params], changes: directEffects(fn.body), calls: [], recursive: true };
  }

  const nextStack = [...stack, name];
  const paramMap = new Map(fn.params.map(param => [param, param]));
  const changes = inferBlockEffects(fn.body, functions, memo, paramMap, nextStack, { includeDeclarations: true });
  const signature = {
    name,
    params: [...fn.params],
    changes: dedupeEffects(changes),
    calls: collectCalls(fn.body).map(call => ({ name: call.name, args: [...call.args], line: call.line }))
  };
  memo.set(name, signature);
  return clone(signature);
}

function inferBlockEffects(nodes, functions, memo, substitutions, stack, options) {
  const effects = [];
  for (const node of nodes) {
    if (node.kind === 'function' || node.kind === 'allow') {
      if (options.includeDeclarations) continue;
      continue;
    }
    if (node.kind === 'change') {
      effects.push(...changeEffects(node, substitutions, false));
      continue;
    }
    if (node.kind === 'preview') {
      effects.push(...previewEffects(node.body, substitutions));
      continue;
    }
    if (node.kind === 'call') {
      const callee = functions.get(node.name);
      if (!callee) {
        effects.push({ target: '<unknown>', field: null, path: '<unknown>', operation: 'unknown', sourceOperation: 'call', amount: null, staticAmount: false, committed: true, via: node.name, line: node.line, unproven: true });
        continue;
      }
      if (stack.includes(node.name)) {
        effects.push({ target: '<recursive>', field: null, path: '<recursive>', operation: 'unknown', sourceOperation: 'call', amount: null, staticAmount: false, committed: true, via: node.name, line: node.line, unproven: true });
        continue;
      }
      const signature = inferFunctionSignature(node.name, functions, memo, stack);
      const callMap = new Map();
      callee.params.forEach((param, index) => {
        const arg = node.args[index] ?? '';
        callMap.set(param, substituteSimpleName(arg, substitutions));
      });
      for (const effect of signature.changes) {
        effects.push(substituteEffect(effect, callMap, node.name, node.line));
      }
      continue;
    }
    if (node.body) effects.push(...inferBlockEffects(node.body, functions, memo, substitutions, stack, options));
    if (node.thenBody) effects.push(...inferBlockEffects(node.thenBody, functions, memo, substitutions, stack, options));
    if (node.elseBody) effects.push(...inferBlockEffects(node.elseBody, functions, memo, substitutions, stack, options));
  }
  return effects;
}

function previewEffects(nodes, substitutions) {
  const out = [];
  walk(nodes, node => {
    if (node.kind === 'change') out.push(...changeEffects(node, substitutions, true));
  });
  return out;
}

function directEffects(nodes) {
  const out = [];
  walk(nodes, node => {
    if (node.kind === 'change') out.push(...changeEffects(node, new Map(), false));
  });
  return dedupeEffects(out);
}

function changeEffects(node, substitutions, preview) {
  const target = substituteSimpleName(node.target, substitutions);
  return node.ops.map(change => {
    const classified = classifyOperation(change);
    const field = change.field ?? null;
    return {
      target,
      field,
      path: field ? `${target}.${field}` : target,
      operation: classified.operation,
      sourceOperation: change.op,
      amount: classified.amount,
      staticAmount: classified.staticAmount,
      committed: !preview,
      line: change.line,
      changeLine: node.line,
      changeName: node.name ?? null
    };
  });
}

function classifyOperation(change) {
  if (change.op === 'set') return { operation: 'set', amount: null, staticAmount: false };
  if (change.op === 'clear') return { operation: 'clear', amount: null, staticAmount: false };

  const numeric = parseNumberLiteral(change.expr);
  if (numeric !== null) {
    if (change.op === 'add') {
      return numeric >= 0
        ? { operation: 'increase', amount: Math.abs(numeric), staticAmount: true }
        : { operation: 'decrease', amount: Math.abs(numeric), staticAmount: true };
    }
    if (change.op === 'remove') {
      return numeric >= 0
        ? { operation: 'decrease', amount: Math.abs(numeric), staticAmount: true }
        : { operation: 'increase', amount: Math.abs(numeric), staticAmount: true };
    }
  }

  return { operation: change.op, amount: null, staticAmount: false };
}

function parseNumberLiteral(expr) {
  if (typeof expr !== 'string') return null;
  const text = expr.trim();
  if (!NUMBER_LITERAL.test(text)) return null;
  const value = Number(text);
  return Number.isFinite(value) ? value : null;
}

function substituteSimpleName(text, substitutions) {
  const value = String(text ?? '').trim();
  if (!SIMPLE_NAME.test(value)) return '<dynamic>';
  return substitutions.get(value) ?? value;
}

function substituteEffect(effect, callMap, via, callLine) {
  let target = effect.target;
  if (callMap.has(target)) target = callMap.get(target);
  const path = effect.field ? `${target}.${effect.field}` : target;
  return {
    ...clone(effect),
    target,
    path,
    via: effect.via ? `${via} -> ${effect.via}` : via,
    callLine,
    unproven: Boolean(effect.unproven || target === '<dynamic>' || target === '<unknown>' || target === '<recursive>')
  };
}

function validatePolicies(policies, functions, signatures) {
  for (const [name, policy] of policies) {
    if (!functions.has(name)) throw new ChangeCapabilityError(`'allow ${name}' has no matching recipe declared with 'make ${name}(...)'.`, policy.line);
    const signature = signatures[name];
    for (const effect of signature.changes.filter(change => change.committed !== false)) {
      if (effect.unproven) {
        throw new ChangeCapabilityError(`Patch cannot prove the allowed changes for '${name}' because a called recipe has a dynamic, recursive, or unknown target.`, effect.callLine ?? effect.line ?? policy.line);
      }
      const rule = policy.rules.find(candidate => matchesRule(candidate, effect));
      if (!rule) {
        throw new ChangeCapabilityError(`Recipe '${name}' may ${describeEffect(effect)}, but its allow block does not permit that change.`, effect.line ?? policy.line);
      }
      if (rule.maxAmount !== null) {
        if (!effect.staticAmount) {
          throw new ChangeCapabilityError(`Recipe '${name}' uses a dynamic amount for ${effect.path}. Patch cannot prove it stays within the allowed maximum of ${rule.maxAmount}.`, effect.line ?? policy.line);
        }
        if (effect.amount > rule.maxAmount) {
          throw new ChangeCapabilityError(`Recipe '${name}' may change ${effect.path} by ${effect.amount}, above the allowed maximum of ${rule.maxAmount}.`, effect.line ?? policy.line);
        }
      }
    }
  }
}

function matchesRule(rule, effect) {
  if (rule.target !== effect.target) return false;
  if ((rule.field ?? null) !== (effect.field ?? null)) return false;
  if (rule.operation === effect.operation) return true;
  if (rule.operation === 'add' && (effect.sourceOperation === 'add' || effect.operation === 'increase')) return true;
  if (rule.operation === 'remove' && (effect.sourceOperation === 'remove' || effect.operation === 'decrease')) return true;
  return false;
}

function describeEffect(effect) {
  const amount = effect.staticAmount ? ` ${effect.operation} ${effect.path} by ${effect.amount}` : ` ${effect.operation} ${effect.path}`;
  return amount.trim();
}

function collectCalls(nodes) {
  const calls = [];
  walk(nodes, node => { if (node.kind === 'call') calls.push(node); });
  return calls;
}

function dedupeEffects(effects) {
  const seen = new Set();
  return effects.filter(effect => {
    const key = JSON.stringify([effect.target, effect.field, effect.operation, effect.sourceOperation, effect.amount, effect.staticAmount, effect.committed, effect.via ?? null, effect.unproven ?? false]);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function walk(nodes, visit) {
  for (const node of nodes) {
    visit(node);
    if (node.body) walk(node.body, visit);
    if (node.thenBody) walk(node.thenBody, visit);
    if (node.elseBody) walk(node.elseBody, visit);
  }
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}
