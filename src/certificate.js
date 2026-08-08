import crypto from 'node:crypto';
import { compile } from './compiler.js';

const CHECKER_KINDS = new Set(['increase', 'decrease', 'set', 'clear']);
const EVIDENCE_SCHEMA_VERSION = '0.1';

export function generateLeanCertificate(source, options = {}) {
  const { ir } = compile(source, options);
  const policies = ir.changeCapabilities ?? {};
  const bridge = ir.formalBridge?.entries ?? {};
  const protectedNames = Object.keys(policies).sort();

  if (!protectedNames.length) {
    throw new Error('No Change Capability policies were found. A verified certificate is only meaningful for protected recipes.');
  }

  const blocks = [];
  const certified = [];

  for (const name of protectedNames) {
    const entry = bridge[name];
    if (!entry) throw new Error(`No formal bridge entry exists for protected recipe '${name}'.`);
    if (!entry.supported || !entry.signatureMatchesProduction) {
      const why = entry.reasons?.length ? entry.reasons.join('; ') : 'formal bridge mismatch';
      throw new Error(`Protected recipe '${name}' is outside the verified-checker subset: ${why}`);
    }

    const rules = policies[name] ?? [];
    for (const rule of rules) {
      if (!CHECKER_KINDS.has(rule.operation)) {
        throw new Error(`Policy operation '${rule.operation}' for '${name}' is outside the current verified checker vocabulary.`);
      }
      if (rule.maxAmount !== null && (!Number.isSafeInteger(rule.maxAmount) || rule.maxAmount < 0)) {
        throw new Error(`Policy bound for '${name}' must be a non-negative safe integer for Lean certificate generation.`);
      }
    }

    const productionClaim = productionEvidenceClaim(ir.changeSignatures?.[name], name);
    const id = leanIdentifier(name);
    const evidenceName = `cert_${id}_evidence`;
    const claimName = `cert_${id}_production_signature`;
    const policyName = `cert_${id}_policy`;
    const signatureCheckName = `cert_${id}_signature_checked`;
    const policyCheckName = `cert_${id}_policy_checked`;

    blocks.push(`def ${evidenceName} : EvidenceStmt :=\n${indent(leanEvidenceCore(entry.core), 2)}`);
    blocks.push(`def ${claimName} : List EvidenceEffect :=\n${indent(leanList(productionClaim.map(leanEvidenceEffect)), 2)}`);
    blocks.push(`def ${policyName} : List Rule :=\n${indent(leanList(rules.map(leanRule)), 2)}`);
    blocks.push(`theorem ${signatureCheckName} :\n    checkEvidenceSignature ${evidenceName} ${claimName} = true := by\n  native_decide`);
    blocks.push(`theorem cert_${id}_signature_corresponds\n    {stmt : CoreStmt}\n    (hDecode : decodeEvidenceStmt ${evidenceName} = some stmt) :\n    encodeSignature (inferSignature stmt) = ${claimName} := by\n  exact checkedEvidenceSignatureCorresponds hDecode ${signatureCheckName}`);
    blocks.push(`theorem ${policyCheckName} :\n    checkEvidenceProtected ${evidenceName} ${policyName} = true := by\n  native_decide`);
    blocks.push(`theorem cert_${id}_runtime_safe\n    {stmt : CoreStmt} {runtime : List Effect}\n    (hDecode : decodeEvidenceStmt ${evidenceName} = some stmt)\n    (hExec : Executes stmt runtime) :\n    ∀ effect, effect ∈ runtime →\n      ∃ rule, rule ∈ ${policyName} ∧ Allows rule effect := by\n  exact checkedEvidenceExecutionCannotEscape hDecode hExec ${policyCheckName}`);
    certified.push(name);
  }

  const sourceSha256 = crypto.createHash('sha256').update(source, 'utf8').digest('hex');
  const lean = `import PatchEvidence\n\nopen PatchFormal\n\nnamespace PatchGeneratedCertificate\n\n/-- Generated from production Patch source. The hash binds this certificate to\n    the exact source bytes. Lean independently validates the proof-free evidence\n    schema, its decoded Change Signature, and the semantic policy. The remaining\n    trust boundary is the production source/AST-to-evidence translation. -/\ndef sourceSha256 : String := ${leanString(sourceSha256)}\n\ndef patchIrVersion : String := ${leanString(ir.version)}\n\ndef evidenceSchemaVersion : String := ${leanString(EVIDENCE_SCHEMA_VERSION)}\n\n${blocks.join('\n\n')}\n\nend PatchGeneratedCertificate\n`;

  return {
    lean,
    sourceSha256,
    irVersion: ir.version,
    evidenceSchemaVersion: EVIDENCE_SCHEMA_VERSION,
    certified,
    checker: 'PatchEvidence.checkEvidenceProtected_sound',
    correspondence: 'PatchEvidence.checkedEvidenceSignatureCorresponds',
    theorem: 'PatchEvidence.checkedEvidenceExecutionCannotEscape'
  };
}

function productionEvidenceClaim(signature, name) {
  const out = [];
  const seen = new Set();
  for (const effect of signature?.changes ?? []) {
    if (effect.committed === false) continue;
    if (effect.unproven || effect.via) {
      throw new Error(`Production signature for '${name}' contains an effect outside the verified evidence subset.`);
    }
    if (!CHECKER_KINDS.has(effect.operation)) {
      throw new Error(`Production effect '${effect.operation}' for '${name}' is outside the verified evidence vocabulary.`);
    }
    const normalized = {
      target: effect.target,
      field: effect.field ?? null,
      operation: effect.operation,
      amountRange: effect.amountRange
        ? { min: effect.amountRange.min, max: effect.amountRange.max }
        : null
    };
    const key = JSON.stringify(normalized);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(normalized);
  }
  return out;
}

function leanEvidenceCore(core) {
  switch (core.kind) {
    case 'skip': return 'EvidenceStmt.skip';
    case 'emit': return `EvidenceStmt.emit ${leanEvidenceEffect(core.effect)}`;
    case 'seq': return `EvidenceStmt.seq\n${indent(`(${leanEvidenceCore(core.first)})`, 2)}\n${indent(`(${leanEvidenceCore(core.second)})`, 2)}`;
    case 'branch': return `EvidenceStmt.branch\n${indent(`(${leanEvidenceCore(core.then)})`, 2)}\n${indent(`(${leanEvidenceCore(core.else)})`, 2)}`;
    case 'repeat': return `EvidenceStmt.repeat ${core.count}\n${indent(`(${leanEvidenceCore(core.body)})`, 2)}`;
    default: throw new Error(`Cannot encode formal bridge node '${core.kind}' in a Lean evidence certificate.`);
  }
}

function leanEvidenceEffect(effect) {
  if (!CHECKER_KINDS.has(effect.operation)) throw new Error(`Unsupported formal evidence effect '${effect.operation}'.`);
  return `{ target := ${leanString(effect.target)}, field := ${leanOptionString(effect.field)}, kind := .${effect.operation}, amount := ${leanEvidenceAmount(effect.amountRange)} }`;
}

function leanRule(rule) {
  const amount = rule.maxAmount === null ? 'none' : `some ${leanInterval(0, rule.maxAmount)}`;
  return `{ target := ${leanString(rule.target)}, field := ${leanOptionString(rule.field)}, kind := .${rule.operation}, amount := ${amount} }`;
}

function leanEvidenceAmount(range) {
  if (!range) return 'none';
  if (!Number.isSafeInteger(range.min) || !Number.isSafeInteger(range.max)) {
    throw new Error(`Invalid production evidence interval ${range.min}..${range.max}.`);
  }
  return `some ({ lo := ${leanInt(range.min)}, hi := ${leanInt(range.max)} } : EvidenceAmount)`;
}

function leanInterval(lo, hi) {
  if (!Number.isSafeInteger(lo) || !Number.isSafeInteger(hi) || lo > hi) {
    throw new Error(`Invalid interval ${lo}..${hi} for Lean certificate generation.`);
  }
  return `({ lo := ${leanInt(lo)}, hi := ${leanInt(hi)}, ordered := by decide } : Interval)`;
}

function leanInt(value) {
  return value < 0 ? `(${value})` : String(value);
}

function leanOptionString(value) {
  return value === null || value === undefined ? 'none' : `some ${leanString(value)}`;
}

function leanString(value) {
  return JSON.stringify(String(value));
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
