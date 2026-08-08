import crypto from 'node:crypto';
import { compileToDirectWasm, runDirectWasm } from './wasm-direct.js';
import { validateDirectSemanticEffects } from './direct-effect-validator.js';
import { deriveRuntimePathWitnesses, PATCH_RUNTIME_PATH_WITNESS_VERSION } from './runtime-path-witness.js';

export const PATCH_RUNTIME_CERTIFICATE_VERSION = '0.2';
const RUNTIME_SCHEMA_VERSION = '0.2';
const CHECKER_KINDS = new Set(['increase', 'decrease', 'set', 'clear']);
const SOURCE_KINDS = new Set(['add', 'remove', 'set', 'clear']);

/**
 * Execute direct Wasm, independently reconstruct concrete semantic effect
 * occurrences, derive untrusted control-flow witnesses, and emit Lean checks
 * tying each observed protected-recipe invocation to SourceExecutes.
 *
 * Beta.21 accepts branch/repeat witnesses and multiple invocations. The witness
 * producer itself is not trusted: PatchRuntime.lean validates its shape and
 * repeat count against the decoded formal CoreStmt before accepting it.
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

  for (const recipeName of protectedNames) {
    const sourceEntry = compiled.ir.formalSource?.entries?.[recipeName];
    const sourceValidation = compiled.ir.sourceValidation?.entries?.[recipeName];
    if (!sourceEntry?.supported) {
      throw new Error(`Protected recipe '${recipeName}' is outside the formal SourceStmt subset.`);
    }
    if (!sourceValidation?.validated) {
      const why = sourceValidation?.reasons?.length ? sourceValidation.reasons.join('; ') : 'raw-source extraction did not validate';
      throw new Error(`Protected recipe '${recipeName}' is not source-validated: ${why}`);
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

      const observed = slice.map(item => runtimeEvidenceEffect(item.effect, recipeName));
      const id = `${leanIdentifier(recipeName)}_${invocation.invocation}`;
      const sourceDef = `runtime_${id}_source`;
      const observedDef = `runtime_${id}_observed`;
      const pathDef = `runtime_${id}_path`;
      const checkTheorem = `runtime_${id}_checked`;

      blocks.push(`def ${sourceDef} : SourceStmt :=\n${indent(leanSourceCore(sourceEntry.source), 2)}`);
      blocks.push(`def ${observedDef} : List EvidenceEffect :=\n${indent(leanList(observed.map(leanEvidenceEffect)), 2)}`);
      blocks.push(`def ${pathDef} : RuntimePath :=\n${indent(leanRuntimePath(invocation.path), 2)}`);
      blocks.push(`theorem ${checkTheorem} :\n    checkSourceRuntimeEvidence ${sourceDef} ${observedDef} ${pathDef} = true := by\n  native_decide`);
      blocks.push(`theorem runtime_${id}_corresponds :\n    ∃ formalTrace actualTrace,\n      SourceExecutes ${sourceDef} formalTrace ∧\n      decodeRuntimeTrace ${observedDef} = some actualTrace ∧\n      TraceRefines actualTrace formalTrace := by\n  exact checkSourceRuntimeEvidence_sound ${checkTheorem}`);

      observedEffects += observed.length;
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
  const lean = `import PatchRuntime\n\nopen PatchFormal\n\nnamespace PatchGeneratedRuntimeCertificate\n\n/-- Generated after executing the direct-Wasm backend. The source hash binds\n    the certificate to exact Patch source bytes; the runtime hash binds it to\n    the observed target/before/after transition trace that was independently\n    reinterpreted into semantic effect occurrences. Control-flow witnesses are\n    untrusted certificate data: Lean validates branch choice, repeat shape/count,\n    formal execution and concrete-to-formal effect refinement. -/\ndef sourceSha256 : String := ${leanString(sourceSha256)}\ndef runtimeTraceSha256 : String := ${leanString(runtimeTraceSha256)}\ndef runtimeCertificateVersion : String := ${leanString(PATCH_RUNTIME_CERTIFICATE_VERSION)}\ndef runtimeSchemaVersion : String := ${leanString(RUNTIME_SCHEMA_VERSION)}\ndef runtimePathWitnessVersion : String := ${leanString(PATCH_RUNTIME_PATH_WITNESS_VERSION)}\ndef patchIrVersion : String := ${leanString(compiled.ir.version)}\n\n${blocks.join('\n\n')}\n\nend PatchGeneratedRuntimeCertificate\n`;

  return {
    lean,
    sourceSha256,
    runtimeTraceSha256,
    runtimeTrace: execution.trace,
    runtimeValidation: validation,
    runtimePathWitnesses: pathWitnesses,
    certified,
    observedEffects,
    certifiedInvocations: certified.length,
    irVersion: compiled.ir.version,
    runtimeCertificateVersion: PATCH_RUNTIME_CERTIFICATE_VERSION,
    runtimeSchemaVersion: RUNTIME_SCHEMA_VERSION,
    runtimePathWitnessVersion: PATCH_RUNTIME_PATH_WITNESS_VERSION,
    checker: 'PatchRuntime.checkSourceRuntimeEvidence',
    theorem: 'PatchRuntime.checkSourceRuntimeEvidence_sound'
  };
}

function runtimeEvidenceEffect(effect, recipeName) {
  if (!CHECKER_KINDS.has(effect.operation)) {
    throw new Error(`Observed runtime effect '${effect.operation}' for '${recipeName}' is outside the beta.21 formal runtime vocabulary.`);
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

function leanEvidenceAmount(range) {
  if (!range) return 'none';
  if (!Number.isSafeInteger(range.min) || !Number.isSafeInteger(range.max) || range.min > range.max) {
    throw new Error(`Invalid runtime evidence interval ${range.min}..${range.max}.`);
  }
  return `some ({ lo := ${leanInt(range.min)}, hi := ${leanInt(range.max)} } : EvidenceAmount)`;
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
