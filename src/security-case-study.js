import { parse } from './parser.js';
import { compile } from './compiler.js';

export const PATCH_SECURITY_CASE_STUDY_VERSION = '0.1';

/**
 * Evaluate one security/extension-style case against Patch's real semantic
 * Change Capability analysis and a deliberately coarse target-write ablation.
 *
 * The coarse baseline is NOT a model of any named prior system. It asks only
 * whether every state path reachable from an `allow`-protected recipe is among
 * the target paths named by that allow block. It intentionally ignores semantic
 * operation, magnitude and proof obligations so the value of those dimensions
 * can be isolated without making an external firstness/comparison claim.
 */
export function evaluateSecurityCase(source, options = {}) {
  const coarse = evaluateCoarseTargetWrite(source);
  let patch;
  try {
    const compiled = compile(source, { name: options.name ?? 'SecurityCase', kind: 'console' });
    patch = {
      accepted: true,
      error: null,
      capabilities: compiled.changeAnalysis.capabilities,
      signatures: summarizeProtectedSignatures(compiled.changeAnalysis)
    };
  } catch (error) {
    patch = {
      accepted: false,
      error: {
        name: error?.name ?? 'Error',
        message: error?.message ?? String(error),
        line: error?.line ?? null
      },
      capabilities: null,
      signatures: null
    };
  }

  return {
    format: 'patch-security-case-evaluation',
    version: PATCH_SECURITY_CASE_STUDY_VERSION,
    patch,
    coarseTargetWrite: coarse,
    differential: coarse.accepted && !patch.accepted
      ? 'patch-rejects-additional-semantic-authority-escape'
      : coarse.accepted === patch.accepted
        ? 'same-decision'
        : 'different-decision'
  };
}

export function evaluateCoarseTargetWrite(source) {
  const ast = parse(source);
  const functions = new Map();
  const policies = [];
  walk(ast, node => {
    if (node.kind === 'function') functions.set(node.name, node);
    if (node.kind === 'allow') policies.push(node);
  });

  const policyResults = [];
  for (const policy of policies) {
    const allowed = new Set(policy.rules.map(rule => pathOf(rule.target, rule.field)));
    const fn = functions.get(policy.name);
    if (!fn) {
      policyResults.push({
        recipe: policy.name,
        accepted: false,
        allowedTargets: [...allowed].sort(),
        reachableTargets: ['<missing-recipe>'],
        escapedTargets: ['<missing-recipe>']
      });
      continue;
    }

    const reachable = collectReachableTargets(fn.body, functions, [policy.name]);
    const escaped = [...reachable].filter(path => !allowed.has(path));
    policyResults.push({
      recipe: policy.name,
      accepted: escaped.length === 0,
      allowedTargets: [...allowed].sort(),
      reachableTargets: [...reachable].sort(),
      escapedTargets: escaped.sort()
    });
  }

  return {
    accepted: policyResults.length > 0 && policyResults.every(item => item.accepted),
    semantics: 'target-path-only; operation/magnitude/provability intentionally ignored',
    policies: policyResults
  };
}

function collectReachableTargets(nodes, functions, stack) {
  const targets = new Set();
  for (const node of nodes ?? []) {
    if (node.kind === 'function' || node.kind === 'allow') continue;
    if (node.kind === 'change') {
      for (const operation of node.ops ?? []) targets.add(pathOf(node.target, operation.field));
      continue;
    }
    if (node.kind === 'call') {
      if (stack.includes(node.name)) {
        targets.add('<recursive>');
        continue;
      }
      const callee = functions.get(node.name);
      if (!callee) {
        targets.add('<unknown-call>');
        continue;
      }
      for (const path of collectReachableTargets(callee.body, functions, [...stack, node.name])) targets.add(path);
      continue;
    }
    if (node.body) for (const path of collectReachableTargets(node.body, functions, stack)) targets.add(path);
    if (node.thenBody) for (const path of collectReachableTargets(node.thenBody, functions, stack)) targets.add(path);
    if (node.elseBody) for (const path of collectReachableTargets(node.elseBody, functions, stack)) targets.add(path);
  }
  return targets;
}

function summarizeProtectedSignatures(changeAnalysis) {
  const protectedNames = Object.keys(changeAnalysis.capabilities ?? {});
  return Object.fromEntries(protectedNames.map(name => [name, {
    changes: (changeAnalysis.signatures?.[name]?.changes ?? []).map(effect => ({
      target: effect.target,
      field: effect.field ?? null,
      operation: effect.operation,
      amount: effect.amount ?? null,
      amountRange: effect.amountRange ?? null,
      rangeProven: effect.rangeProven ?? null,
      via: effect.via ?? null
    }))
  }]));
}

function pathOf(target, field) {
  return field ? `${target}.${field}` : target;
}

function walk(nodes, fn) {
  for (const node of nodes ?? []) {
    fn(node);
    if (node.body) walk(node.body, fn);
    if (node.thenBody) walk(node.thenBody, fn);
    if (node.elseBody) walk(node.elseBody, fn);
  }
}
