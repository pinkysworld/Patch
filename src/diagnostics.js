import { inferBackendPatchLine } from './backend-diagnostic-context.js';
import { mapStudioProjectLine } from './studio-project.js';

export const PATCH_DIAGNOSTIC_FORMAT = 'patch-diagnostic';
export const PATCH_DIAGNOSTIC_VERSION = 1;
export const PATCH_DIAGNOSTIC_ASSIST_FORMAT = 'patch-diagnostic-assist';
export const PATCH_DIAGNOSTIC_ASSIST_VERSION = '0.1';

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

const PATCH_ASSIST_KEYWORDS = Object.freeze([
  'create', 'change', 'show', 'make', 'when', 'window', 'button', 'text', 'input',
  'checkbox', 'radio', 'combo', 'listbox', 'slider', 'table', 'tree', 'tabs', 'panel',
  'picture', 'paintbox', 'timer', 'statusbar', 'open', 'close', 'if', 'else', 'repeat'
]);

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

/**
 * Deterministic, compiler-guided help for an already-produced diagnostic.
 * This layer explains and proposes only local repairs that can be derived
 * unambiguously; it never decides whether the program is correct.
 */
export function buildDiagnosticAssist(diagnostic, context = {}) {
  const code = String(diagnostic?.code ?? 'PATCH0000');
  const message = String(diagnostic?.message ?? '').trim();
  const source = String(context.source ?? '');
  const location = diagnostic?.location ?? null;
  const base = {
    format: PATCH_DIAGNOSTIC_ASSIST_FORMAT,
    version: PATCH_DIAGNOSTIC_ASSIST_VERSION,
    code,
    title: 'Patch found something to fix',
    what: message || 'The compiler stopped before it could finish this action.',
    why: 'Patch stopped rather than guessing about program behavior.',
    recommendation: 'Review the highlighted source and try again.',
    confidence: 'certain',
    fix: null
  };

  if (/TreeView is not enabled for this Window target/i.test(message)) {
    const platform = normalizeAssistPlatform(context.platform ?? context.buildTarget);
    const recommendedTarget = platform && ['macos', 'windows', 'linux'].includes(platform) ? `native-${platform}` : '';
    const currentTarget = String(context.buildTarget ?? '');
    const alreadySelected = Boolean(recommendedTarget) && currentTarget === recommendedTarget;
    return {
      ...base,
      title: 'TreeView needs a compatible native contract',
      what: platform ? `This ${assistPlatformLabel(platform)} GUI build reached a TreeView capability boundary.` : 'This GUI build reached a TreeView capability boundary.',
      why: '“Window” means Patch’s GUI project type, not Microsoft Windows. TreeView support is versioned per build path, so Patch fails closed instead of silently dropping the control.',
      recommendation: alreadySelected
        ? `The current ${assistPlatformLabel(platform)} native target is already selected, so this points to a Studio/runtime contract mismatch rather than an error in your TreeView source.`
        : recommendedTarget
          ? `Use the current ${assistPlatformLabel(platform)} native build path.`
          : 'Choose a current Windows, macOS or Linux native target that advertises TreeView support.',
      fix: recommendedTarget && !alreadySelected
        ? { kind: 'select-build-target', value: recommendedTarget, label: `Use current ${assistPlatformLabel(platform)} native target` }
        : null
    };
  }

  const missingForm = message.match(/Form '([^']+)' is not defined/i);
  if (missingForm) {
    const missing = missingForm[1];
    const candidate = uniqueAssistNearest(missing, collectAssistNamedForms(source), 2);
    return {
      ...base,
      title: 'Patch cannot find that Form',
      what: `The program refers to a Form named “${missing}”, but no Form with that name is declared.`,
      why: 'Form navigation uses exact source-backed names so Patch does not guess which window should open or close.',
      recommendation: candidate ? `Did you mean “${candidate}”?` : 'Use the exact name after `as` on one of your window declarations.',
      fix: candidate && location?.line ? { kind: 'replace-token-on-line', line: location.line, from: missing, to: candidate, label: `Change ${missing} to ${candidate}` } : null
    };
  }

  const missingControl = message.match(/event '([^'\s]+)\s+[^']+' refers to a control, menu item or result dialog that is not defined/i);
  if (missingControl) {
    const missing = missingControl[1];
    const candidate = uniqueAssistNearest(missing, collectAssistUiIds(source), 2);
    return {
      ...base,
      title: 'Patch cannot find that control',
      what: `The event handler refers to “${missing}”, but that UI name is not declared.`,
      why: 'Event handlers are bound by explicit source-backed control names.',
      recommendation: candidate ? `Did you mean “${candidate}”?` : 'Choose the exact name that follows `as` on the intended control.',
      fix: candidate && location?.line ? { kind: 'replace-token-on-line', line: location.line, from: missing, to: candidate, label: `Change ${missing} to ${candidate}` } : null
    };
  }

  const eventMismatch = message.match(/^(Table|TreeView|Slider|Timer|PictureBox|PaintBox) '([^']+)' exposes only '([^']+)'[^,]*, not '([^']+)'\.?$/i);
  if (eventMismatch) {
    const [, controlType, control, expected, actual] = eventMismatch;
    return {
      ...base,
      title: `${controlType} uses “${expected}” here`,
      what: `The event handler for “${control}” uses “${actual}”, but this ${controlType} exposes “${expected}”.`,
      why: 'Patch keeps each GUI control’s event contract explicit so an unsupported event cannot be silently ignored.',
      recommendation: `Change the event from “${actual}” to “${expected}”.`,
      fix: location?.line
        ? { kind: 'replace-event-on-line', line: location.line, control, from: actual, to: expected, label: `Use ${expected}` }
        : null
    };
  }

  const unknownStatement = message.match(/I do not understand\s+["']?([A-Za-z_][\w-]*)/i);
  if (unknownStatement && location?.line) {
    const found = unknownStatement[1];
    const candidate = uniqueAssistNearest(found, PATCH_ASSIST_KEYWORDS, 2);
    if (candidate && candidate.toLowerCase() !== found.toLowerCase()) {
      return {
        ...base,
        title: 'This looks like a small spelling mistake',
        what: `Patch does not know the statement “${found}”.`,
        why: `“${candidate}” is a Patch keyword with a very similar spelling.`,
        recommendation: `Replace “${found}” with “${candidate}”.`,
        fix: { kind: 'replace-token-on-line', line: location.line, from: found, to: candidate, label: `Use ${candidate}` }
      };
    }
  }

  if (location?.line) {
    const line = source.split(/\r?\n/)[location.line - 1] ?? '';
    const missingType = line.match(/^(\s*)create\s+([A-Za-z_]\w*)\s*=\s*(.+?)\s*$/);
    if (missingType && /^PATCH1\d{3}$/.test(code)) {
      const inferred = inferAssistLiteralType(missingType[3]);
      if (inferred) {
        return {
          ...base,
          title: 'Patch can make this declaration explicit',
          what: `The declaration for “${missingType[2]}” does not state its value type.`,
          why: `The initial value looks unambiguously like ${/^[aeiou]/i.test(inferred) ? 'an' : 'a'} ${inferred}.`,
          recommendation: `Add “${inferred}” after create.`,
          fix: { kind: 'replace-line', line: location.line, value: `${missingType[1]}create ${inferred} ${missingType[2]} = ${missingType[3]}`, label: `Declare ${missingType[2]} as ${inferred}` }
        };
      }
    }
  }

  return base;
}

export function applyDiagnosticFix(source, fix) {
  const text = String(source ?? '');
  if (!fix || !['replace-token-on-line', 'replace-line', 'replace-event-on-line'].includes(fix.kind)) return text;
  const lines = text.split(/\r?\n/);
  const index = Number(fix.line) - 1;
  if (!Number.isInteger(index) || index < 0 || index >= lines.length) return text;
  if (fix.kind === 'replace-line') {
    lines[index] = String(fix.value ?? lines[index]);
    return lines.join('\n');
  }
  if (fix.kind === 'replace-event-on-line') {
    const control = String(fix.control ?? '');
    const from = String(fix.from ?? '');
    const to = String(fix.to ?? '');
    if (!control || !from || !to || from === to) return text;
    const pattern = new RegExp(`^(\\s*when\\s+${escapeAssistRegExp(control)}\\s+)${escapeAssistRegExp(from)}(\\s*:)`);
    if (!pattern.test(lines[index])) return text;
    lines[index] = lines[index].replace(pattern, `$1${to}$2`);
    return lines.join('\n');
  }
  const from = String(fix.from ?? '');
  const to = String(fix.to ?? '');
  if (!from || !to || from === to) return text;
  const pattern = new RegExp(`(^|[^A-Za-z0-9_])${escapeAssistRegExp(from)}(?=$|[^A-Za-z0-9_])`);
  if (!pattern.test(lines[index])) return text;
  lines[index] = lines[index].replace(pattern, (_, prefix) => `${prefix}${to}`);
  return lines.join('\n');
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

function collectAssistNamedForms(source) {
  const out = [];
  const pattern = /^\s*window\s+"(?:[^"\\]|\\.)*"\s+as\s+([A-Za-z_]\w*)/gm;
  let match;
  while ((match = pattern.exec(source))) out.push(match[1]);
  return out;
}

function collectAssistUiIds(source) {
  const out = new Set(collectAssistNamedForms(source));
  const pattern = /\bas\s+([A-Za-z_]\w*)/g;
  let match;
  while ((match = pattern.exec(source))) out.add(match[1]);
  return [...out];
}

function uniqueAssistNearest(value, choices, maxDistance) {
  const target = String(value ?? '').toLowerCase();
  const ranked = [...new Set(choices)].map(choice => ({ choice, distance: assistLevenshtein(target, String(choice).toLowerCase()) }))
    .sort((a, b) => a.distance - b.distance || a.choice.localeCompare(b.choice));
  if (!ranked.length || ranked[0].distance > maxDistance) return null;
  if (ranked[1] && ranked[1].distance === ranked[0].distance) return null;
  return ranked[0].choice;
}

function assistLevenshtein(a, b) {
  const previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i += 1) {
    let diagonal = previous[0];
    previous[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const up = previous[j];
      previous[j] = Math.min(previous[j] + 1, previous[j - 1] + 1, diagonal + (a[i - 1] === b[j - 1] ? 0 : 1));
      diagonal = up;
    }
  }
  return previous[b.length];
}

function inferAssistLiteralType(value) {
  const text = String(value ?? '').trim();
  if (/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(text)) return 'number';
  if (/^(?:true|false)$/.test(text)) return 'boolean';
  if (/^"(?:[^"\\]|\\.)*"$/.test(text)) return 'text';
  if (/^\[.*\]$/.test(text)) return 'list';
  return null;
}

function normalizeAssistPlatform(value) {
  const text = String(value ?? '').toLowerCase();
  if (text.includes('mac')) return 'macos';
  if (text.includes('win')) return 'windows';
  if (text.includes('linux')) return 'linux';
  if (text.includes('freebsd')) return 'freebsd';
  return '';
}

function assistPlatformLabel(platform) {
  return platform === 'macos' ? 'macOS' : platform === 'windows' ? 'Windows' : platform === 'linux' ? 'Linux' : 'FreeBSD';
}

function escapeAssistRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
