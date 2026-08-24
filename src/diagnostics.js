import { inferBackendPatchLine } from './backend-diagnostic-context.js';
import { mapStudioProjectLine } from './studio-project.js';

export const PATCH_DIAGNOSTIC_FORMAT = 'patch-diagnostic';
export const PATCH_DIAGNOSTIC_VERSION = 1;

export const PATCH_DIAGNOSTIC_CODES = Object.freeze({
  SYNTAX: 'PATCH1000',
  UNKNOWN_STATEMENT: 'PATCH1001',
  INDENTATION: 'PATCH1002',
  EXPECTED_BLOCK: 'PATCH1003',
  INVALID_STRUCTURE: 'PATCH1004',
  INVALID_LAYOUT: 'PATCH1005',
  SEMANTIC: 'PATCH1100',
  COMPILER: 'PATCH1900',
  UNKNOWN_BUILD_TARGET: 'PATCH2001',
  UNSUPPORTED_TARGET_KIND: 'PATCH2002',
  UNSUPPORTED_NUMERIC_SUBSET: 'PATCH2003',
  BUILD: 'PATCH2900',
  RUNTIME: 'PATCH3000',
  INTERNAL: 'PATCH9000'
});

export function diagnosticFromError(error, options = {}) {
  const item = error && typeof error === 'object' ? error : { message: String(error ?? 'Unknown error') };
  const phase = normalizePhase(options.phase);
  const rawMessage = String(item.message ?? item);
  const code = validPatchCode(item.code) ? item.code : classifyDiagnosticCode(item, phase, rawMessage);
  const composedLine = normalizePositiveInteger(item.line)
    ?? patchSourceLineFromMessage(rawMessage)
    ?? inferBackendPatchLine(rawMessage, options.source);
  const mapped = mapStudioProjectLine(options.composition, composedLine);
  const line = mapped?.line ?? composedLine;
  const column = normalizePositiveInteger(item.column) ?? sourceColumn(options.source, composedLine);
  const entry = normalizeEntry(options.entry ?? item.entry ?? options.composition?.entry ?? 'main.patch');
  const file = mapped?.path ? normalizeProjectFile(mapped.path) : null;

  return {
    format: PATCH_DIAGNOSTIC_FORMAT,
    version: PATCH_DIAGNOSTIC_VERSION,
    code,
    severity: 'error',
    phase,
    message: stripParserLinePrefix(rawMessage),
    location: composedLine === null ? null : {
      entry,
      ...(file ? { file } : {}),
      line,
      column: column ?? 1
    }
  };
}

export function formatDiagnosticLocation(location) {
  if (!location) return '';
  const path = location.file || location.entry;
  return `${path}:${location.line}:${location.column}`;
}

export function formatPatchDiagnostic(diagnostic) {
  validatePatchDiagnostic(diagnostic);
  const where = diagnostic.location ? ` ${formatDiagnosticLocation(diagnostic.location)}` : '';
  return `${diagnostic.code}${where} ${diagnostic.message}`;
}

export function serializePatchDiagnostic(diagnostic) {
  validatePatchDiagnostic(diagnostic);
  return JSON.stringify(diagnostic);
}

export function validatePatchDiagnostic(diagnostic) {
  if (!diagnostic || diagnostic.format !== PATCH_DIAGNOSTIC_FORMAT || diagnostic.version !== PATCH_DIAGNOSTIC_VERSION) {
    throw new Error('Patch diagnostic format/version is unsupported.');
  }
  if (!validPatchCode(diagnostic.code)) throw new Error('Patch diagnostic code is invalid.');
  if (diagnostic.severity !== 'error') throw new Error('Patch diagnostic severity is invalid.');
  if (typeof diagnostic.phase !== 'string' || !diagnostic.phase) throw new Error('Patch diagnostic phase is invalid.');
  if (typeof diagnostic.message !== 'string' || !diagnostic.message) throw new Error('Patch diagnostic message is invalid.');
  if (diagnostic.location !== null) {
    if (!diagnostic.location || typeof diagnostic.location.entry !== 'string' || !diagnostic.location.entry) throw new Error('Patch diagnostic entry is invalid.');
    if (!normalizePositiveInteger(diagnostic.location.line) || !normalizePositiveInteger(diagnostic.location.column)) throw new Error('Patch diagnostic source location is invalid.');
    if (diagnostic.location.file != null && !normalizeProjectFile(diagnostic.location.file)) {
      throw new Error('Patch diagnostic file is invalid.');
    }
  }
  return diagnostic;
}

function classifyDiagnosticCode(error, phase, message) {
  if (error?.name === 'PatchSyntaxError' || /^line\s+\d+:/i.test(message)) {
    if (/indented too far/i.test(message)) return PATCH_DIAGNOSTIC_CODES.INDENTATION;
    if (/Expected an indented block/i.test(message)) return PATCH_DIAGNOSTIC_CODES.EXPECTED_BLOCK;
    if (/I do not understand/i.test(message)) return PATCH_DIAGNOSTIC_CODES.UNKNOWN_STATEMENT;
    if (/(?:window size|flow layout|at\/size|needs at least|can only contain|exactly a title and message|only meaningful)/i.test(message)) return PATCH_DIAGNOSTIC_CODES.INVALID_STRUCTURE;
    if (/(?:layout|position|size)/i.test(message)) return PATCH_DIAGNOSTIC_CODES.INVALID_LAYOUT;
    return PATCH_DIAGNOSTIC_CODES.SYNTAX;
  }
  if (/Unknown build target/i.test(message)) return PATCH_DIAGNOSTIC_CODES.UNKNOWN_BUILD_TARGET;
  if (/(?:supports Console projects only|Window packaging currently|For a Window project use|Choose a Windows\/macOS\/Linux App)/i.test(message)) return PATCH_DIAGNOSTIC_CODES.UNSUPPORTED_TARGET_KIND;
  if (isUnsupportedNumericSubset(message)) return PATCH_DIAGNOSTIC_CODES.UNSUPPORTED_NUMERIC_SUBSET;
  if (phase === 'build') return PATCH_DIAGNOSTIC_CODES.BUILD;
  if (phase === 'runtime' || phase === 'run') return PATCH_DIAGNOSTIC_CODES.RUNTIME;
  if (phase === 'compile' || phase === 'compiler' || phase === 'check') return PATCH_DIAGNOSTIC_CODES.COMPILER;
  return PATCH_DIAGNOSTIC_CODES.INTERNAL;
}

function isUnsupportedNumericSubset(message) {
  const text = String(message);
  if (/Direct Wasm:/i.test(text) && !/supports console projects only/i.test(text)) return true;
  if (/C99 backend:/i.test(text) && !/supports console projects only/i.test(text)) return true;
  return /outside the (?:direct )?(?:numeric Wasm |direct Wasm |numeric |portable numeric |portable )?subset/i.test(text);
}

function sourceColumn(source, line) {
  if (!line) return null;
  const row = String(source ?? '').split(/\r?\n/)[line - 1];
  if (row === undefined) return 1;
  const match = row.match(/\S/);
  return match ? match.index + 1 : 1;
}

function patchSourceLineFromMessage(message) {
  const text = String(message);
  const parserPrefix = text.match(/^line\s+(\d+):/i);
  if (parserPrefix) return Number(parserPrefix[1]);

  // Backend lowerers already report the original Patch line in this form.
  // Keep the pattern deliberately narrow so generated C/C++/Rust compiler line
  // numbers cannot accidentally be mistaken for Patch source locations.
  const backendHint = text.match(/\bat\s+(?:Patch\s+|source\s+)?line\s+(\d+)\b/i);
  return backendHint ? Number(backendHint[1]) : null;
}

function stripParserLinePrefix(message) {
  return String(message).replace(/^line\s+\d+:\s*/i, '').trim() || 'Unknown error';
}

function normalizePositiveInteger(value) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : null;
}

function normalizePhase(value) {
  const phase = String(value ?? 'studio').trim().toLowerCase();
  return phase || 'studio';
}

function normalizeEntry(value) {
  const text = String(value ?? 'main.patch').replace(/\\/g, '/');
  const leaf = text.split('/').filter(Boolean).pop();
  return leaf || 'main.patch';
}

function normalizeProjectFile(value) {
  const text = String(value ?? '').trim().replace(/\\/g, '/');
  if (!text) return null;
  if (text.startsWith('/') || text === '..' || text.startsWith('../') || text.includes('/../') || text.endsWith('/..')) return null;
  if (/^[A-Za-z]:/.test(text)) return null;
  return text;
}

function validPatchCode(value) {
  return /^PATCH\d{4}$/.test(String(value ?? ''));
}
