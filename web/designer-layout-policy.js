import {
  applyWindowResizePolicy,
  formatWindowLayoutPolicy,
  normalizeWindowLayoutPolicy,
  readWindowLayoutPolicy
} from '../src/window-layout-policy.js';

export const PATCH_DESIGNER_LAYOUT_POLICY_VERSION = '0.1';

const DIRECTIVE_RE = /^\s*#\s*@layout\s+(anchor\s+(?:left|right|top|bottom)(?:\s+(?:left|right|top|bottom))*|dock\s+(?:left|right|top|bottom|fill))\s*$/i;

export function readDesignerLayoutPolicy(source, sourceLine) {
  return readWindowLayoutPolicy(source, sourceLine);
}

export function setDesignerLayoutPolicy(source, sourceLine, policy) {
  const rows = String(source ?? '').replace(/\r\n/g, '\n').split('\n');
  const lineIndex = resolveControlLineIndex(rows, sourceLine);
  if (lineIndex < 0) throw new Error('Selected control line is outside the Patch source.');
  const previousIndex = lineIndex - 1;
  const hasDirective = previousIndex >= 0 && DIRECTIVE_RE.test(rows[previousIndex]);
  const normalized = normalizeDesignerLayoutPolicy(policy);
  if (normalized.kind === 'fixed') {
    if (hasDirective) rows.splice(previousIndex, 1);
    return rows.join('\n');
  }
  const indent = /^\s*/.exec(rows[lineIndex])?.[0] ?? '';
  const directive = `${indent}# @layout ${formatDesignerLayoutPolicy(normalized)}`;
  if (hasDirective) rows[previousIndex] = directive;
  else rows.splice(lineIndex, 0, directive);
  return rows.join('\n');
}

export function applyDesignerResizePolicy(layout, policy, resize) {
  return applyWindowResizePolicy(layout, policy, resize);
}

export function normalizeDesignerLayoutPolicy(policy) {
  return normalizeWindowLayoutPolicy(policy);
}

export function formatDesignerLayoutPolicy(policy) {
  return formatWindowLayoutPolicy(policy);
}

export function parseDesignerLayoutPreset(value) {
  const text = String(value ?? '').trim().toLowerCase();
  if (!text || text === 'fixed') return { kind: 'fixed' };
  if (text.startsWith('dock:')) return normalizeDesignerLayoutPolicy({ kind: 'dock', side: text.slice(5) });
  if (text.startsWith('anchor:')) return normalizeDesignerLayoutPolicy({ kind: 'anchor', edges: text.slice(7).split('+') });
  throw new Error(`Unknown Designer layout preset '${value}'.`);
}

export function designerLayoutPresetValue(policy) {
  const normalized = normalizeDesignerLayoutPolicy(policy);
  if (normalized.kind === 'fixed') return 'fixed';
  if (normalized.kind === 'dock') return `dock:${normalized.side}`;
  return `anchor:${normalized.edges.join('+')}`;
}

function resolveControlLineIndex(rows, sourceLine) {
  const raw = Number(sourceLine);
  if (!Number.isInteger(raw)) return -1;
  for (const candidate of [raw - 1, raw]) {
    if (candidate < 0 || candidate >= rows.length) continue;
    if (/^\s*(?:text|button|input|checkbox|radio|combo|listbox|slider|table|tree|tabs|panel|timer|picture|statusbar)\b/i.test(rows[candidate])) return candidate;
  }
  return raw >= 1 && raw <= rows.length ? raw - 1 : -1;
}
