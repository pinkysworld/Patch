import crypto from 'node:crypto';
import { compile } from './compiler.js';

const CHECKER_KINDS = new Set(['increase', 'decrease', 'set', 'clear']);

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

    const id = leanIdentifier(name);
    const stmtName = `cert_${id}_stmt`;
    const policyName = `cert_${id}_policy`;
    const checkName = `cert_${id}_checked`;

    blocks.push(`def ${stmtName} : CoreStmt :=\n${indent(leanCore(entry.core), 2)}`);
    blocks.push(`def ${policyName} : List Rule :=\n${indent(leanList(rules.map(leanRule)), 2)}`);
    blocks.push(`theorem ${checkName} :\n    checkProtected ${stmtName} ${policyName} = true := by\n  native_decide`);
    blocks.push(`theorem cert_${id}_runtime_safe\n    {runtime : List Effect}\n    (hExec : Executes ${stmtName} runtime) :\n    ∀ effect, effect ∈ runtime →\n      ∃ rule, rule ∈ ${policyName} ∧ Allows rule effect := by\n  exact checkedExecutionCannotEscape hExec ${checkName}`);
    certified.push(name);
  }

  const sourceSha256 = crypto.createHash('sha256').update(source, 'utf8').digest('hex');
  const lean = `import PatchChecker\n\nopen PatchFormal\n\nnamespace PatchGeneratedCertificate\n\n/-- Generated from production Patch source. This hash binds the certificate\n    artifact to the exact source bytes, while the formal bridge remains the\n    translation-validation boundary. -/\ndef sourceSha256 : String := ${leanString(sourceSha256)}\n\ndef patchIrVersion : String := ${leanString(ir.version)}\n\n${blocks.join('\n\n')}\n\nend PatchGeneratedCertificate\n`;

  return {
    lean,
    sourceSha256,
    irVersion: ir.version,
    certified,
    checker: 'PatchChecker.policyAllowsBool_sound',
    theorem: 'PatchChecker.checkedExecutionCannotEscape'
  };
}

function leanCore(core) {
  switch (core.kind) {
    case 'skip': return 'CoreStmt.skip';
    case 'emit': return `CoreStmt.emit ${leanEffect(core.effect)}`;
    case 'seq': return `CoreStmt.seq\n${indent(`(${leanCore(core.first)})`, 2)}\n${indent(`(${leanCore(core.second)})`, 2)}`;
    case 'branch': return `CoreStmt.branch\n${indent(`(${leanCore(core.then)})`, 2)}\n${indent(`(${leanCore(core.else)})`, 2)}`;
    case 'repeat': return `CoreStmt.repeat ${core.count}\n${indent(`(${leanCore(core.body)})`, 2)}`;
    default: throw new Error(`Cannot encode formal bridge node '${core.kind}' in a Lean certificate.`);
  }
}

function leanEffect(effect) {
  if (!CHECKER_KINDS.has(effect.operation)) throw new Error(`Unsupported formal effect '${effect.operation}'.`);
  return `{ target := ${leanString(effect.target)}, field := ${leanOptionString(effect.field)}, kind := .${effect.operation}, amount := ${leanAmount(effect.amountRange)} }`;
}

function leanRule(rule) {
  const amount = rule.maxAmount === null ? 'none' : `some ${leanInterval(0, rule.maxAmount)}`;
  return `{ target := ${leanString(rule.target)}, field := ${leanOptionString(rule.field)}, kind := .${rule.operation}, amount := ${amount} }`;
}

function leanAmount(range) {
  return range ? `some ${leanInterval(range.min, range.max)}` : 'none';
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
