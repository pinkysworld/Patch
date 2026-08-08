import crypto from 'node:crypto';
import { compileToDirectWasm, runDirectWasm } from './wasm-direct.js';
import { validateDirectSemanticEffects } from './direct-effect-validator.js';
import { deriveRuntimePathWitnesses, PATCH_RUNTIME_PATH_WITNESS_VERSION } from './runtime-path-witness.js';

export const PATCH_RUNTIME_CERTIFICATE_VERSION = '0.4';
const RUNTIME_SCHEMA_VERSION = '0.4';
const CHECKER_KINDS = new Set(['increase', 'decrease', 'set', 'clear']);
const SOURCE_KINDS = new Set(['add', 'remove', 'set', 'clear']);

/**
 * Execute direct Wasm, independently reconstruct concrete semantic effects and
 * raw control-flow witnesses, then emit a Lean certificate that checks:
 *
 * 1. source/guard tree shape,
 * 2. branch choice against concrete recipe-parameter guard evaluation,
 * 3. concrete-to-formal runtime effect refinement, and
 * 4. concrete runtime containment in the declared Change Capability.
 *
 * All occurrence/path/environment data remains proof-free certificate input.
 */
export async function generateLeanRuntimeCertificate(source, options = {}) {
  const name = options.name ?? 'PatchRuntimeApp';
  const { module, metadata, compiled } = compileToDirectWasm(source, {
    ...options,
    name,
    kind: 'console'
  });
  const execution = await runDirectWasm(module, metadata);
  const validation = validateDirectSemanticEffects(compiled.ir, execution.trace);
  const policies = compiled.ir.changeCapabilities ?? {};
  const protectedNames = Object.keys(policies).sort();

  if (!protectedNames.length) {
    throw new Error('No Change Capability policies were found. Runtime correspondence certification targets protected recipes.');
  }

  const pathWitnesses = deriveRuntimePathWitnesses(compiled.ast, protectedNames);
  const blocks = [];
  const certified = [];
  let observedEffects = 0;
  let checkedGuardClaims = 0;

  for (const recipeName of protectedNames) {
    const sourceEntry = compiled.ir.formalSource?.entries?.[recipeName];
    const sourceValidation = compiled.ir.sourceValidation?.entries?.[recipeName];
    const guardValidation = compiled.ir.guardValidation?.entries?.[recipeName];

    if (!sourceEntry?.supported) {
      throw new Error(`Protected recipe '${recipeName}' is outside the formal SourceStmt subset.`);
    }
    if (!sourceValidation?.validated) {
      const why = sourceValidation?.reasons?.length ? sourceValidation.reasons.join('; ') : 'raw-source extraction did not validate';
      throw new Error(`Protected recipe '${recipeName}' is not source-validated: ${why}`);
    }
    if (!sourceEntry.guardSupported) {
      const why = sourceEntry.guardReasons?.length ? sourceEntry.guardReasons.join('; ') : 'guard extraction is outside the beta.23 formal fragment';
      throw new Error(`Protected recipe '${recipeName}' is outside the beta.23 guard-aware fragment: ${why}`);
    }
    if (!guardValidation?.validated) {
      const why = guardValidation?.reasons?.length ? guardValidation.reasons.join('; ') : 'independent raw guard extraction did not validate';
      throw new Error(`Protected recipe '${recipeName}' is not guard-validated: ${why}`);
    }

    const guardVariables = usedGuardVariables(sourceEntry);
    const rules = policies[recipeName] ?? [];
    for (const rule of rules) {
      if (!CHECKER_KINDS.has(rule.operation)) {
        throw new Error(`Policy operation '${rule.operation}' for '${recipeName}' is outside the current Lean runtime capability vocabulary.`);
      }
      if (rule.maxAmount !== null && (!Number.isSafeInteger(rule.maxAmount) || rule.maxAmount < 0)) {
        throw new Error(`Policy bound for '${recipeName}' must be a non-negative safe integer for Lean runtime certificate generation.`);
      }
    }

    const invocations = pathWitnesses.invocations.filter(item => item.recipe === recipeName);
    const occurrences = validation.occurrences.filter(item => item.scope === recipeName);
    let offset = 0;

    for (const invocation of invocations) {
      const slice = occurrences.slice(offset, offset + invocation.effectCount);
      if (slice.length !== invocation.effectCount) {
        throw new Error(
          `Protected recipe '${recipeName}' invocation ${invocation.invocation} needs ${invocation.effectCount} runtime effect occurrence(s), ` +
          `but only ${slice.length} remain after independent direct-runtime validation.`
        );
      }
      offset += invocation.effectCount;

      const concreteEnvironment = guardEnvironment(invocation.environment ?? {}, guardVariables, recipeName, invocation.invocation);
      const observed = slice.map(item => runtimeEvidenceEffect(item.effect, recipeName));
      const id = `${leanIdentifier(recipeName)}_${invocation.invocation}`;
      const sourceDef = `runtime_${id}_source`;
      const guardDef = `runtime_${id}_guard`;
      const envDef = `runtime_${id}_env`;
      const observedDef = `runtime_${id}_observed`;
      const pathDef = `runtime_${id}_path`;
      const policyDef = `runtime_${id}_policy`;
      const checkTheorem = `runtime_${id}_guarded_checked`;
      const policyCheckTheorem = `runtime_${id}_policy_checked`;

      blocks.push(`def ${sourceDef} : SourceStmt :=\n${indent(leanSourceCore(sourceEntry.source), 2)}`);
      blocks.push(`def ${guardDef} : GuardTree :=\n${indent(leanGuardTree(sourceEntry.guardTree), 2)}`);
      blocks.push(`def ${envDef} : IntEnv :=\n${indent(leanIntEnv(concreteEnvironment), 2)}`);
      blocks.push(`def ${observedDef} : List EvidenceEffect :=\n${indent(leanList(observed.map(leanEvidenceEffect)), 2)}`);
      blocks.push(`def ${pathDef} : RuntimePath :=\n${indent(leanRuntimePath(invocation.path), 2)}`);
      blocks.push(`def ${policyDef} : List Rule :=\n${indent(leanList(rules.map(leanRule)), 2)}`);
      blocks.push(`theorem ${checkTheorem} :\n    checkGuardedSourceRuntimeEvidence ${sourceDef} ${guardDef} ${envDef} ${observedDef} ${pathDef} = true := by\n  native_decide`);
      blocks.push(`theorem ${policyCheckTheorem} :\n    checkSourceProtected ${sourceDef} ${policyDef} = true := by\n  native_decide`);
      blocks.push(`theorem runtime_${id}_guarded_corresponds :\n    ∃ formalTrace actualTrace,\n      SourceExecutes ${sourceDef} formalTrace ∧\n      decodeRuntimeTrace ${observedDef} = some actualTrace ∧\n      TraceRefines actualTrace formalTrace ∧\n      GuardShape ${sourceDef} ${guardDef} ∧\n      GuardPathValid ${envDef} ${guardDef} ${pathDef} := by\n  exact checkGuardedSourceRuntimeEvidence_sound ${checkTheorem}`);
      blocks.push(`theorem runtime_${id}_guarded_concrete_policy_safe :\n    ∃ actualTrace,\n      decodeRuntimeTrace ${observedDef} = some actualTrace ∧\n      (∀ effect, effect ∈ actualTrace →\n        ∃ rule, rule ∈ ${policyDef} ∧ Allows rule effect) ∧\n      GuardShape ${sourceDef} ${guardDef} ∧\n      GuardPathValid ${envDef} ${guardDef} ${pathDef} := by\n  exact checkedGuardedConcreteRuntimeCannotEscape ${checkTheorem} ${policyCheckTheorem}`);

      observedEffects += observed.length;
      checkedGuardClaims += sourceEntry.guardClaims?.length ?? 0;
      certified.push(`${recipeName}#${invocation.invocation}`);
    }

    if (offset !== occurrences.length) {
      throw new Error(
        `Protected recipe '${recipeName}' has ${occurrences.length - offset} unsegmented runtime effect occurrence(s) after path-witness reconstruction.`
      );
    }
  }

  if (!certified.length) {
    throw new Error('No protected recipe invocation was observed in this direct-Wasm execution.');
  }

  const sourceSha256 = sha256(source);
  const runtimeTraceJson = JSON.stringify(execution.trace);
  const runtimeTraceSha256 = sha256(runtimeTraceJson);
  const lean = `import PatchGuarded\n\nopen PatchFormal\n\nnamespace PatchGeneratedRuntimeCertificate\n\n/-- Generated after executing the direct-Wasm backend. Source/trace hashes bind\n    this artifact to exact input bytes and the observed target/before/after trace.\n    Concrete semantic occurrences, RuntimePath and invocation environments remain\n    proof-free data: Lean validates source/guard shape, branch truth for the\n    guard-aware integer/Boolean fragment, runtime-effect refinement and concrete\n    Change Capability containment. -/\ndef sourceSha256 : String := ${leanString(sourceSha256)}\ndef runtimeTraceSha256 : String := ${leanString(runtimeTraceSha256)}\ndef runtimeCertificateVersion : String := ${leanString(PATCH_RUNTIME_CERTIFICATE_VERSION)}\ndef runtimeSchemaVersion : String := ${leanString(RUNTIME_SCHEMA_VERSION)}\ndef runtimePathWitnessVersion : String := ${leanString(PATCH_RUNTIME_PATH_WITNESS_VERSION)}\ndef guardValidationVersion : String := ${leanString(compiled.ir.guardValidation?.version ?? 'unknown')}\ndef patchIrVersion : String := ${leanString(compiled.ir.version)}\n\n${blocks.join('\n\n')}\n\nend PatchGeneratedRuntimeCertificate\n`;

  return {
    lean,
    sourceSha256,
    runtimeTraceSha256,
    runtimeTrace: execution.trace,
    runtimeValidation: validation,
    runtimePathWitnesses: pathWitnesses,
    guardValidation: compiled.ir.guardValidation,
    certified,
    observedEffects,
    checkedGuardClaims,
    certifiedInvocations: certified.length,
    irVersion: compiled.ir.version,
    runtimeCertificateVersion: PATCH_RUNTIME_CERTIFICATE_VERSION,
    runtimeSchemaVersion: RUNTIME_SCHEMA_VERSION,
    runtimePathWitnessVersion: PATCH_RUNTIME_PATH_WITNESS_VERSION,
    guardValidationVersion: compiled.ir.guardValidation?.version ?? null,
    checker: 'PatchGuarded.checkGuardedSourceRuntimeEvidence',
    theorem: 'PatchGuarded.checkedGuardedConcreteRuntimeCannotEscape'
  };
}

function usedGuardVariables(sourceEntry) {
  const variables = new Set();
  for (const claim of sourceEntry.guardClaims ?? []) for (const name of claim.variables ?? []) variables.add(name);
  return [...variables].sort();
}

function guardEnvironment(environment, variables, recipeName, invocation) {
  const result = {};
  for (const name of variables) {
    if (!Object.prototype.hasOwnProperty.call(environment, name)) {
      throw new Error(`Protected recipe '${recipeName}' invocation ${invocation} has no concrete value for guard variable '${name}'.`);
    }
    const value = environment[name];
    if (!Number.isSafeInteger(value)) {
      throw new Error(`Guard variable '${name}' for protected recipe '${recipeName}' invocation ${invocation} must be a safe integer, got ${String(value)}.`);
    }
    result[name] = value;
  }
  return result;
}

function runtimeEvidenceEffect(effect, recipeName) {
  if (!CHECKER_KINDS.has(effect.operation)) {
    throw new Error(`Observed runtime effect '${effect.operation}' for '${recipeName}' is outside the beta.23 formal runtime vocabulary.`);
  }
  const hasAmount = effect.operation === 'increase' || effect.operation === 'decrease';
  let amountRange = null;
  if (hasAmount) {
    if (!Number.isSafeInteger(effect.amount) || effect.amount < 0) {
      throw new Error(
        `Observed runtime amount '${effect.amount}' for '${recipeName}' is outside the formal integer runtime fragment.`
      );
    }
    amountRange = { min: effect.amount, max: effect.amount };
  } else if (effect.amount !== null && effect.amount !== undefined) {
    throw new Error(`Observed ${effect.operation} effect for '${recipeName}' unexpectedly carries a numeric amount.`);
  }
  return {
    target: effect.target,
    field: effect.field ?? null,
    operation: effect.operation,
    amountRange
  };
}

function leanRuntimePath(path) {
  switch (path?.kind) {
    case 'leaf': return 'RuntimePath.leaf';
    case 'seq': return `RuntimePath.seq\n${indent(`(${leanRuntimePath(path.first)})`, 2)}\n${indent(`(${leanRuntimePath(path.second)})`, 2)}`;
    case 'branchThen': return `RuntimePath.branchThen\n${indent(`(${leanRuntimePath(path.path)})`, 2)}`;
    case 'branchElse': return `RuntimePath.branchElse\n${indent(`(${leanRuntimePath(path.path)})`, 2)}`;
    case 'repeatZero': return 'RuntimePath.repeatZero';
    case 'repeatSucc': return `RuntimePath.repeatSucc\n${indent(`(${leanRuntimePath(path.body)})`, 2)}\n${indent(`(${leanRuntimePath(path.rest)})`, 2)}`;
    default: throw new Error(`Cannot encode runtime path '${path?.kind ?? 'missing'}'.`);
  }
}

function leanGuardTree(tree) {
  switch (tree?.kind) {
    case 'leaf': return 'GuardTree.leaf';
    case 'seq': return `GuardTree.seq\n${indent(`(${leanGuardTree(tree.first)})`, 2)}\n${indent(`(${leanGuardTree(tree.second)})`, 2)}`;
    case 'branch':
      if (!tree.guard) throw new Error('Cannot encode an unsupported/null formal guard into a runtime certificate.');
      return `GuardTree.branch\n${indent(`(${leanGuardExpr(tree.guard)})`, 2)}\n${indent(`(${leanGuardTree(tree.then)})`, 2)}\n${indent(`(${leanGuardTree(tree.else)})`, 2)}`;
    case 'repeat': return `GuardTree.repeat ${tree.count}\n${indent(`(${leanGuardTree(tree.body)})`, 2)}`;
    default: throw new Error(`Cannot encode guard-tree node '${tree?.kind ?? 'missing'}'.`);
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
    default: throw new Error(`Cannot encode formal guard node '${expr?.kind ?? 'missing'}'.`);
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
    default: throw new Error(`Cannot encode formal integer guard expression '${expr?.kind ?? 'missing'}'.`);
  }
}

function leanIntEnv(environment) {
  const entries = Object.entries(environment).sort(([a], [b]) => a.localeCompare(b));
  if (!entries.length) return 'fun _ => none';
  const lines = ['fun name =>'];
  for (const [name, value] of entries) lines.push(`  if name = ${leanString(name)} then some ${leanInt(value)} else`);
  lines.push('    none');
  return lines.join('\n');
}

function leanSourceCore(core) {
  switch (core.kind) {
    case 'skip': return 'SourceStmt.skip';
    case 'change': return `SourceStmt.change ${leanSourceChange(core.change)}`;
    case 'seq': return `SourceStmt.seq\n${indent(`(${leanSourceCore(core.first)})`, 2)}\n${indent(`(${leanSourceCore(core.second)})`, 2)}`;
    case 'branch': return `SourceStmt.branch\n${indent(`(${leanSourceCore(core.then)})`, 2)}\n${indent(`(${leanSourceCore(core.else)})`, 2)}`;
    case 'repeat': return `SourceStmt.repeat ${core.count}\n${indent(`(${leanSourceCore(core.body)})`, 2)}`;
    default: throw new Error(`Cannot encode formal source-core node '${core.kind}' in a runtime certificate.`);
  }
}

function leanSourceChange(change) {
  if (!SOURCE_KINDS.has(change.operation)) throw new Error(`Unsupported formal source change '${change.operation}'.`);
  const needsAmount = change.operation === 'add' || change.operation === 'remove';
  if (needsAmount && !change.amountRange) throw new Error(`Source change '${change.operation}' requires a proven amount range.`);
  if (!needsAmount && change.amountRange) throw new Error(`Source change '${change.operation}' must not carry a numeric amount range.`);
  return `({ target := ${leanString(change.target)}, field := ${leanOptionString(change.field)}, kind := .${change.operation}, amount := ${leanEvidenceAmount(change.amountRange)} } : SourceChange)`;
}

function leanEvidenceEffect(effect) {
  if (!CHECKER_KINDS.has(effect.operation)) throw new Error(`Unsupported runtime evidence effect '${effect.operation}'.`);
  return `{ target := ${leanString(effect.target)}, field := ${leanOptionString(effect.field)}, kind := .${effect.operation}, amount := ${leanEvidenceAmount(effect.amountRange)} }`;
}

function leanRule(rule) {
  const amount = rule.maxAmount === null ? 'none' : `some ${leanInterval(0, rule.maxAmount)}`;
  return `{ target := ${leanString(rule.target)}, field := ${leanOptionString(rule.field)}, kind := .${rule.operation}, amount := ${amount} }`;
}

function leanEvidenceAmount(range) {
  if (!range) return 'none';
  if (!Number.isSafeInteger(range.min) || !Number.isSafeInteger(range.max) || range.min > range.max) {
    throw new Error(`Invalid runtime evidence interval ${range.min}..${range.max}.`);
  }
  return `some ({ lo := ${leanInt(range.min)}, hi := ${leanInt(range.max)} } : EvidenceAmount)`;
}

function leanInterval(lo, hi) {
  if (!Number.isSafeInteger(lo) || !Number.isSafeInteger(hi) || lo > hi) {
    throw new Error(`Invalid interval ${lo}..${hi} for Lean runtime certificate generation.`);
  }
  return `({ lo := ${leanInt(lo)}, hi := ${leanInt(hi)}, ordered := by decide } : Interval)`;
}

function leanOptionString(value) {
  return value === null || value === undefined ? 'none' : `some ${leanString(value)}`;
}

function leanString(value) {
  return JSON.stringify(String(value));
}

function leanInt(value) {
  return value < 0 ? `(${value})` : String(value);
}

function leanIdentifier(value) {
  const cleaned = String(value).replace(/[^A-Za-z0-9_]/g, '_');
  const safe = /^[A-Za-z_]/.test(cleaned) ? cleaned : `r_${cleaned}`;
  return safe || 'recipe';
}

function leanList(items) {
  if (!items.length) return '[]';
  return `[\n${items.map(item => indent(item, 2)).join(',\n')}\n]`;
}

function indent(text, spaces) {
  const prefix = ' '.repeat(spaces);
  return String(text).split('\n').map(line => `${prefix}${line}`).join('\n');
}

function sha256(text) {
  return crypto.createHash('sha256').update(text, 'utf8').digest('hex');
}
