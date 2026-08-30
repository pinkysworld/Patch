export const PATCH_DIAGNOSTIC_ASSIST_FORMAT = 'patch-diagnostic-assist';
export const PATCH_DIAGNOSTIC_ASSIST_VERSION = '0.1';

const PATCH_KEYWORDS = Object.freeze([
  'create', 'change', 'show', 'make', 'when', 'window', 'button', 'text', 'input',
  'checkbox', 'radio', 'combo', 'listbox', 'slider', 'table', 'tree', 'tabs', 'panel',
  'picture', 'paintbox', 'timer', 'statusbar', 'open', 'close', 'if', 'else', 'repeat'
]);

/**
 * Deterministic, compiler-guided help. This layer never decides whether a
 * program is correct; it only explains an already-produced Patch diagnostic
 * and offers a repair when the edit can be derived unambiguously.
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
    const platform = normalizePlatform(context.platform ?? context.buildTarget);
    return {
      ...base,
      title: 'TreeView needs a compatible native contract',
      what: platform
        ? `This ${platformLabel(platform)} GUI build reached a TreeView capability boundary.`
        : 'This GUI build reached a TreeView capability boundary.',
      why: '“Window” means Patch’s GUI project type, not Microsoft Windows. TreeView support is versioned per build path, so Patch fails closed instead of silently dropping the control.',
      recommendation: platform && ['macos', 'windows', 'linux'].includes(platform)
        ? `Use the current ${platformLabel(platform)} native build path. If it is already selected, this indicates a Studio/runtime contract mismatch rather than an error in your TreeView source.`
        : 'Choose a current Windows, macOS or Linux native target that advertises TreeView support.',
      fix: platform && ['macos', 'windows', 'linux'].includes(platform)
        ? { kind: 'select-build-target', value: `native-${platform}`, label: `Use current ${platformLabel(platform)} native target` }
        : null
    };
  }

  const missingForm = message.match(/Form '([^']+)' is not defined/i);
  if (missingForm) {
    const missing = missingForm[1];
    const candidate = uniqueNearest(missing, collectNamedForms(source), 2);
    return {
      ...base,
      title: 'Patch cannot find that Form',
      what: `The program refers to a Form named “${missing}”, but no Form with that name is declared.`,
      why: 'Form navigation uses exact source-backed names so Patch does not guess which window should open or close.',
      recommendation: candidate ? `Did you mean “${candidate}”?` : 'Use the exact name after `as` on one of your window declarations.',
      fix: candidate && location?.line
        ? { kind: 'replace-token-on-line', line: location.line, from: missing, to: candidate, label: `Change ${missing} to ${candidate}` }
        : null
    };
  }

  const missingControl = message.match(/event '([^'\s]+)\s+[^']+' refers to a control, menu item or result dialog that is not defined/i);
  if (missingControl) {
    const missing = missingControl[1];
    const candidate = uniqueNearest(missing, collectUiIds(source), 2);
    return {
      ...base,
      title: 'Patch cannot find that control',
      what: `The event handler refers to “${missing}”, but that UI name is not declared.`,
      why: 'Event handlers are bound by explicit source-backed control names.',
      recommendation: candidate ? `Did you mean “${candidate}”?` : 'Choose the exact name that follows `as` on the intended control.',
      fix: candidate && location?.line
        ? { kind: 'replace-token-on-line', line: location.line, from: missing, to: candidate, label: `Change ${missing} to ${candidate}` }
        : null
    };
  }

  const unknownStatement = message.match(/I do not understand\s+["']?([A-Za-z_][\w-]*)/i);
  if (unknownStatement && location?.line) {
    const found = unknownStatement[1];
    const candidate = uniqueNearest(found, PATCH_KEYWORDS, 2);
    if (candidate) {
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
      const inferred = inferLiteralType(missingType[3]);
      if (inferred) {
        return {
          ...base,
          title: 'Patch can make this declaration explicit',
          what: `The declaration for “${missingType[2]}” does not state its value type.`,
          why: `The initial value looks unambiguously like ${article(inferred)} ${inferred}.`,
          recommendation: `Add “${inferred}” after create.`,
          fix: {
            kind: 'replace-line',
            line: location.line,
            value: `${missingType[1]}create ${inferred} ${missingType[2]} = ${missingType[3]}`,
            label: `Declare ${missingType[2]} as ${inferred}`
          }
        };
      }
    }
  }

  return base;
}

export function applyDiagnosticFix(source, fix) {
  const text = String(source ?? '');
  if (!fix) return text;
  if (fix.kind !== 'replace-token-on-line' && fix.kind !== 'replace-line') return text;
  const lines = text.split(/\r?\n/);
  const index = Number(fix.line) - 1;
  if (!Number.isInteger(index) || index < 0 || index >= lines.length) return text;

  if (fix.kind === 'replace-line') {
    lines[index] = String(fix.value ?? lines[index]);
    return lines.join('\n');
  }

  const from = String(fix.from ?? '');
  const to = String(fix.to ?? '');
  if (!from || !to) return text;
  const pattern = new RegExp(`(^|[^A-Za-z0-9_])${escapeRegExp(from)}(?=$|[^A-Za-z0-9_])`);
  if (!pattern.test(lines[index])) return text;
  lines[index] = lines[index].replace(pattern, (_, prefix) => `${prefix}${to}`);
  return lines.join('\n');
}

function collectNamedForms(source) {
  const out = [];
  const pattern = /^\s*window\s+"(?:[^"\\]|\\.)*"\s+as\s+([A-Za-z_]\w*)/gm;
  let match;
  while ((match = pattern.exec(source))) out.push(match[1]);
  return out;
}

function collectUiIds(source) {
  const out = new Set(collectNamedForms(source));
  const pattern = /\bas\s+([A-Za-z_]\w*)/g;
  let match;
  while ((match = pattern.exec(source))) out.add(match[1]);
  return [...out];
}

function uniqueNearest(value, choices, maxDistance) {
  const target = String(value ?? '').toLowerCase();
  const ranked = [...new Set(choices)].map(choice => ({ choice, distance: levenshtein(target, String(choice).toLowerCase()) }))
    .sort((a, b) => a.distance - b.distance || a.choice.localeCompare(b.choice));
  if (!ranked.length || ranked[0].distance > maxDistance) return null;
  if (ranked[1] && ranked[1].distance === ranked[0].distance) return null;
  return ranked[0].choice;
}

function levenshtein(a, b) {
  const previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i += 1) {
    let diagonal = previous[0];
    previous[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const up = previous[j];
      previous[j] = Math.min(
        previous[j] + 1,
        previous[j - 1] + 1,
        diagonal + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
      diagonal = up;
    }
  }
  return previous[b.length];
}

function inferLiteralType(value) {
  const text = String(value ?? '').trim();
  if (/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(text)) return 'number';
  if (/^(?:true|false)$/.test(text)) return 'boolean';
  if (/^"(?:[^"\\]|\\.)*"$/.test(text)) return 'text';
  if (/^\[.*\]$/.test(text)) return 'list';
  return null;
}

function normalizePlatform(value) {
  const text = String(value ?? '').toLowerCase();
  if (text.includes('mac')) return 'macos';
  if (text.includes('win')) return 'windows';
  if (text.includes('linux')) return 'linux';
  if (text.includes('freebsd')) return 'freebsd';
  return '';
}

function platformLabel(platform) {
  return platform === 'macos' ? 'macOS' : platform === 'windows' ? 'Windows' : platform === 'linux' ? 'Linux' : 'FreeBSD';
}

function article(word) { return /^[aeiou]/i.test(word) ? `an` : `a`; }
function escapeRegExp(value) { return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
