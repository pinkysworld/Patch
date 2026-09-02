import {
  applyWindowResizePolicy,
  formatWindowLayoutPolicy,
  normalizeWindowLayoutPolicy,
  readWindowLayoutPolicy
} from '../src/window-layout-policy.js';
import { isDesignerMetadataDirective } from '../src/window-tab-order.js';

export const PATCH_DESIGNER_LAYOUT_POLICY_VERSION = '0.1';

const DIRECTIVE_RE = /^\s*#\s*@layout\s+(anchor\s+(?:left|right|top|bottom)(?:\s+(?:left|right|top|bottom))*|dock\s+(?:left|right|top|bottom|fill))\s*$/i;

export function readDesignerLayoutPolicy(source, sourceLine) {
  return readWindowLayoutPolicy(source, sourceLine);
}

export function setDesignerLayoutPolicy(source, sourceLine, policy) {
  const original = String(source ?? '').replace(/\r\n/g, '\n');
  const rows = original.split('\n');
  const lineIndex = resolveControlLineIndex(rows, sourceLine);
  if (lineIndex < 0) throw new Error('Selected control line is outside the Patch source.');

  let existingIndex = -1;
  for (let index = lineIndex - 1; index >= 0 && isDesignerMetadataDirective(rows[index]); index -= 1) {
    if (DIRECTIVE_RE.test(rows[index])) existingIndex = index;
  }

  const normalized = normalizeDesignerLayoutPolicy(policy);
  if (normalized.kind === 'fixed') {
    if (existingIndex >= 0) rows.splice(existingIndex, 1);
    return preserveTrailingNewline(original, rows.join('\n'));
  }

  const indent = /^\s*/.exec(rows[lineIndex])?.[0] ?? '';
  const directive = `${indent}# @layout ${formatDesignerLayoutPolicy(normalized)}`;
  if (existingIndex >= 0) rows[existingIndex] = directive;
  else rows.splice(lineIndex, 0, directive);
  return preserveTrailingNewline(original, rows.join('\n'));
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
    if (/^\s*(?:text|button|input|checkbox|radio|combo|listbox|slider|table|tree|tabs|panel|timer|picture|paintbox|imagelist|statusbar|shape)\b/i.test(rows[candidate])) return candidate;
  }
  return raw >= 1 && raw <= rows.length ? raw - 1 : -1;
}

function preserveTrailingNewline(original, text) {
  const hasNewline = /\n$/.test(original);
  return text.replace(/\s+$/, '') + (hasNewline ? '\n' : '');
}
