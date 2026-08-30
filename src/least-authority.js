export const PATCH_LEAST_AUTHORITY_MODEL_VERSION = '0.1-research';

const QUANTITATIVE_OPERATIONS = new Set(['increase', 'decrease', 'add', 'remove']);
const UNKNOWN_TARGETS = new Set(['<unknown>', '<dynamic>', '<recursive>']);

/**
 * Infer the least rule set expressible in the current Patch capability grammar
 * from one existing Change Signature.
 *
 * This is a research helper, not yet a compiler contract. If an effect has an
 * unproved target, inference reports `complete: false` rather than inventing
 * authority. If magnitude is unknown, the least expressible current rule is
 * operation-scoped but unbounded and the result records that loss of precision.
 */
export function inferLeastAuthority(signature) {
  if (!signature || !Array.isArray(signature.changes)) {
    throw new Error('Least-authority inference needs a Patch Change Signature.');
  }

  const rules = new Map();
  const reasons = [];

  for (const effect of signature.changes) {
    if (effect.committed === false) continue;
    if (effect.unproven || UNKNOWN_TARGETS.has(effect.target)) {
      reasons.push(`Cannot infer trusted authority for ${effect.path ?? effect.target ?? '<unknown>'}.`);
      continue;
    }

    const target = effect.target;
    const field = effect.field ?? null;
    const operation = effect.operation;
    const maxAmount = inferredMaximum(effect);
    const key = JSON.stringify([target, field, operation]);
    const current = rules.get(key);

    if (!current) {
      rules.set(key, {
        target,
        field,
        operation,
        maxAmount,
        magnitudeKnown: !QUANTITATIVE_OPERATIONS.has(operation) || maxAmount !== null,
        paths: [effect.path ?? (field ? `${target}.${field}` : target)]
      });
      continue;
    }

    current.paths.push(effect.path ?? (field ? `${target}.${field}` : target));
    if (QUANTITATIVE_OPERATIONS.has(operation)) {
      if (current.maxAmount === null || maxAmount === null) {
        current.maxAmount = null;
        current.magnitudeKnown = false;
      } else {
        current.maxAmount = Math.max(current.maxAmount, maxAmount);
      }
    }
  }

  const ordered = [...rules.values()]
    .map(rule => ({ ...rule, paths: [...new Set(rule.paths)].sort() }))
    .sort(compareRules);

  return {
    format: 'patch-least-authority',
    version: PATCH_LEAST_AUTHORITY_MODEL_VERSION,
    name: signature.name ?? null,
    complete: reasons.length === 0,
    reasons,
    rules: ordered,
    hasUnboundedQuantitativeRule: ordered.some(rule => QUANTITATIVE_OPERATIONS.has(rule.operation) && rule.maxAmount === null)
  };
}

export function formatLeastAuthoritySuggestion(name, inference) {
  const recipe = name ?? inference?.name;
  if (!recipe) throw new Error('Capability suggestion needs a recipe name.');
  if (!inference || !Array.isArray(inference.rules)) throw new Error('Capability suggestion needs an inference result.');

  const lines = [`allow ${recipe}:`];
  if (!inference.rules.length) lines.push('  # no committed state-change authority inferred');
  for (const rule of inference.rules) {
    const path = rule.field ? `${rule.target}.${rule.field}` : rule.target;
    const bounded = rule.maxAmount !== null && QUANTITATIVE_OPERATIONS.has(rule.operation)
      ? ` up to ${formatNumber(rule.maxAmount)}`
      : '';
    lines.push(`  ${path} may ${rule.operation}${bounded}`);
  }
  return lines.join('\n');
}

/**
 * Compare a declared capability with an inferred requirement. This deliberately
 * reports only obvious excess in the current grammar; it does not claim a full
 * lattice proof yet.
 */
export function findObviousExcessAuthority(declaredRules, inference) {
  if (!Array.isArray(declaredRules)) throw new Error('Declared authority must be a list of rules.');
  if (!inference || !Array.isArray(inference.rules)) throw new Error('Excess-authority analysis needs an inference result.');

  const findings = [];
  for (const declared of declaredRules) {
    const required = inference.rules.find(rule => sameRuleShape(rule, declared));
    const path = declared.field ? `${declared.target}.${declared.field}` : declared.target;
    if (!required) {
      findings.push({ kind: 'unused-rule', path, operation: declared.operation, declaredMax: declared.maxAmount ?? null, requiredMax: null });
      continue;
    }
    if (QUANTITATIVE_OPERATIONS.has(declared.operation)) {
      const declaredMax = declared.maxAmount ?? null;
      const requiredMax = required.maxAmount ?? null;
      if (declaredMax === null && requiredMax !== null) {
        findings.push({ kind: 'unbounded-when-bounded-suffices', path, operation: declared.operation, declaredMax, requiredMax });
      } else if (declaredMax !== null && requiredMax !== null && declaredMax > requiredMax) {
        findings.push({ kind: 'excess-magnitude', path, operation: declared.operation, declaredMax, requiredMax });
      }
    }
  }
  return findings;
}

function inferredMaximum(effect) {
  if (!QUANTITATIVE_OPERATIONS.has(effect.operation)) return null;
  if (effect.staticAmount && Number.isFinite(effect.amount)) return Math.abs(effect.amount);
  if (effect.amountRange && effect.rangeProven !== false && Number.isFinite(effect.amountRange.max)) {
    return Math.max(Math.abs(effect.amountRange.min ?? 0), Math.abs(effect.amountRange.max));
  }
  return null;
}

function sameRuleShape(a, b) {
  return a.target === b.target &&
    (a.field ?? null) === (b.field ?? null) &&
    a.operation === b.operation;
}

function compareRules(a, b) {
  const pathA = a.field ? `${a.target}.${a.field}` : a.target;
  const pathB = b.field ? `${b.target}.${b.field}` : b.target;
  return pathA.localeCompare(pathB) || a.operation.localeCompare(b.operation);
}

function formatNumber(value) {
  return Number.isInteger(value) ? String(value) : String(Number(value));
}
