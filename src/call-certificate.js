import crypto from 'node:crypto';
import { compile } from './compiler.js';

export const PATCH_CALL_CERTIFICATE_VERSION = '0.1';

const EFFECT_KINDS = new Set(['increase', 'decrease', 'set', 'clear']);

/**
 * Generate a proof-free Lean RecipeEnv from the production compiler's
 * `formalCalls` artifact. Lean, not this generator, decides whether the finite
 * environment satisfies rank, argument-range, direct-effect and imported
 * callee-signature composition obligations.
 */
export function generateLeanCallCertificate(source, options = {}) {
  const compiled = compile(source, options);
  const artifact = compiled.ir.formalCalls;
  const entries = Object.entries(artifact?.entries ?? {}).sort(([a], [b]) => a.localeCompare(b));

  if (!entries.length) {
    throw new Error('No recipes were found. Call-composition certification requires at least one recipe.');
  }

  const unsupported = entries.filter(([, entry]) => !entry.supported);
  if (unsupported.length) {
    const details = unsupported.map(([name, entry]) => `${name}: ${(entry.reasons ?? []).join('; ') || 'outside formal call subset'}`).join(' | ');
    throw new Error(`Formal call certification requires a fully supported finite recipe environment. ${details}`);
  }

  const recipeDefs = entries.map(([name, entry]) => leanRecipeDefinition(name, entry));
  const envEntries = recipeDefs.map(item => `(${leanString(item.name)}, ${item.defName})`);
  const certifiedRecipes = entries.map(([name]) => name);
  const sourceSha256 = crypto.createHash('sha256').update(source, 'utf8').digest('hex');
  const envName = 'callEnv';

  const lean = `import PatchCalls\n\nopen PatchFormal\n\nnamespace PatchGeneratedCallCertificate\n\n/-- Generated from the production compiler's proof-free formalCalls artifact.\n    The source hash binds this certificate to exact Patch source bytes. Lean\n    independently checks the finite recipe environment: direct semantic effects\n    must occur in each caller signature, every call must resolve to a lower-rank\n    recipe, argument intervals must fit declared parameter intervals, and each\n    imported callee signature must be contained by the caller signature. This\n    establishes abstract call-aware signature composition; it does not prove\n    concrete runtime argument-value substitution or compiler correctness. -/\ndef sourceSha256 : String := ${leanString(sourceSha256)}\ndef patchIrVersion : String := ${leanString(compiled.ir.version)}\ndef formalCallsVersion : String := ${leanString(artifact.version)}\ndef callCertificateVersion : String := ${leanString(PATCH_CALL_CERTIFICATE_VERSION)}\n\n${recipeDefs.map(item => item.code).join('\n\n')}\n\ndef ${envName} : RecipeEnv :=\n${indent(leanList(envEntries), 2)}\n\ntheorem callEnvChecked :\n    checkRecipeEnv ${envName} = true := by\n  native_decide\n\ntheorem callEnvironmentComposes : EnvironmentChecked ${envName} := by\n  exact checkRecipeEnv_sound callEnvChecked\n\nend PatchGeneratedCallCertificate\n`;

  return {
    lean,
    sourceSha256,
    irVersion: compiled.ir.version,
    formalCallsVersion: artifact.version,
    callCertificateVersion: PATCH_CALL_CERTIFICATE_VERSION,
    certifiedRecipes,
    environmentSize: entries.length,
    checker: 'PatchCalls.checkRecipeEnv',
    theorem: 'PatchCalls.checkRecipeEnv_sound',
    executionTheorem: 'PatchCalls.checkedRecipeExecutionCannotEscape',
    formalCalls: artifact
  };
}

function leanRecipeDefinition(name, entry) {
  const params = entry.params.map(param => {
    const found = entry.paramRanges.find(candidate => candidate.name === param);
    if (!found) throw new Error(`Recipe '${name}' is missing the certified range for parameter '${param}'.`);
    return leanInterval(found.range.min, found.range.max);
  });
  const signature = (entry.signature ?? []).map(leanEffect);
  const body = leanCallStmt(entry.body);
  if (!Number.isSafeInteger(entry.rank) || entry.rank < 0) throw new Error(`Recipe '${name}' has invalid formal rank '${entry.rank}'.`);

  const defName = `call_recipe_${leanIdentifier(name)}`;
  const code = `def ${defName} : RecipeDef := {\n  params := ${leanList(params)},\n  rank := ${entry.rank},\n  signature := ${leanList(signature)},\n  body :=\n${indent(body, 4)}\n}`;
  return { name, defName, code };
}

function leanCallStmt(stmt) {
  switch (stmt?.kind) {
    case 'skip': return 'CallStmt.skip';
    case 'emit': return `CallStmt.emit (${leanEffect(stmt.effect)})`;
    case 'seq': return `CallStmt.seq\n${indent(`(${leanCallStmt(stmt.first)})`, 2)}\n${indent(`(${leanCallStmt(stmt.second)})`, 2)}`;
    case 'branch': return `CallStmt.branch\n${indent(`(${leanCallStmt(stmt.then)})`, 2)}\n${indent(`(${leanCallStmt(stmt.else)})`, 2)}`;
    case 'repeat': {
      if (!Number.isSafeInteger(stmt.count) || stmt.count < 0) throw new Error(`Invalid formal repeat count '${stmt.count}'.`);
      return `CallStmt.repeat ${stmt.count}\n${indent(`(${leanCallStmt(stmt.body)})`, 2)}`;
    }
    case 'call': {
      const args = (stmt.args ?? []).map(arg => leanInterval(arg.range.min, arg.range.max));
      return `CallStmt.call ${leanString(stmt.name)} ${leanList(args)}`;
    }
    default: throw new Error(`Cannot encode formal call statement '${stmt?.kind ?? 'missing'}'.`);
  }
}

function leanEffect(effect) {
  if (!EFFECT_KINDS.has(effect?.operation)) throw new Error(`Unsupported formal call effect '${effect?.operation}'.`);
  let amount = 'none';
  if (effect.operation === 'increase' || effect.operation === 'decrease') {
    if (!effect.amountRange) throw new Error(`Quantitative formal call effect '${effect.operation}' is missing an interval.`);
    amount = `some ${leanInterval(effect.amountRange.min, effect.amountRange.max)}`;
  } else if (effect.amountRange) {
    throw new Error(`Non-quantitative formal call effect '${effect.operation}' unexpectedly has an interval.`);
  }
  return `({ target := ${leanString(effect.target)}, field := ${leanOptionString(effect.field)}, kind := .${effect.operation}, amount := ${amount} } : Effect)`;
}

function leanInterval(lo, hi) {
  if (!Number.isSafeInteger(lo) || !Number.isSafeInteger(hi) || lo > hi) {
    throw new Error(`Invalid interval ${lo}..${hi} for Lean call certificate generation.`);
  }
  return `({ lo := ${leanInt(lo)}, hi := ${leanInt(hi)}, ordered := by decide } : Interval)`;
}

function leanOptionString(value) {
  return value === null || value === undefined ? 'none' : `some ${leanString(value)}`;
}

function leanIdentifier(value) {
  const cleaned = String(value).replace(/[^A-Za-z0-9_]/g, '_');
  return (/^[A-Za-z_]/.test(cleaned) ? cleaned : `r_${cleaned}`) || 'recipe';
}

function leanString(value) { return JSON.stringify(String(value)); }
function leanInt(value) { return value < 0 ? `(${value})` : String(value); }

function leanList(items) {
  if (!items.length) return '[]';
  return `[\n${items.map(item => indent(item, 2)).join(',\n')}\n]`;
}

function indent(text, spaces) {
  const prefix = ' '.repeat(spaces);
  return String(text).split('\n').map(line => `${prefix}${line}`).join('\n');
}
