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
  BUILD: 'PATCH2900',
  RUNTIME: 'PATCH3000',
  INTERNAL: 'PATCH9000'
});

export function diagnosticFromError(error, options = {}) {
  const item = error && typeof error === 'object' ? error : { message: String(error ?? 'Unknown error') };
  const phase = normalizePhase(options.phase);
  const rawMessage = String(item.message ?? item);
  const code = validPatchCode(item.code) ? item.code : classifyDiagnosticCode(item, phase, rawMessage);
  const line = normalizePositiveInteger(item.line) ?? patchSourceLineFromMessage(rawMessage);
  const column = normalizePositiveInteger(item.column) ?? sourceColumn(options.source, line);
  const entry = normalizeEntry(options.entry ?? item.entry ?? 'main.patch');

  return {
    format: PATCH_DIAGNOSTIC_FORMAT,
    version: PATCH_DIAGNOSTIC_VERSION,
    code,
    severity: 'error',
    phase,
    message: stripParserLinePrefix(rawMessage),
    location: line === null ? null : { entry, line, column: column ?? 1 }
  };
}

export function formatPatchDiagnostic(diagnostic) {
  validatePatchDiagnostic(diagnostic);
  const where = diagnostic.location
    ? ` ${diagnostic.location.entry}:${diagnostic.location.line}:${diagnostic.location.column}`
    : '';
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
  if (phase === 'build') return PATCH_DIAGNOSTIC_CODES.BUILD;
  if (phase === 'runtime' || phase === 'run') return PATCH_DIAGNOSTIC_CODES.RUNTIME;
  if (phase === 'compile' || phase === 'compiler' || phase === 'check') return PATCH_DIAGNOSTIC_CODES.COMPILER;
  return PATCH_DIAGNOSTIC_CODES.INTERNAL;
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

function validPatchCode(value) {
  return /^PATCH\d{4}$/.test(String(value ?? ''));
}
