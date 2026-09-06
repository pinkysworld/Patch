import { parse } from '../src/parser.js';
import {
  listDesignerControls,
  listDesignerWindows,
  updateDesignerControl
} from '../src/designer.js';
import {
  PATCH_WINDOW_TAB_ORDER_MAX,
  buildWindowTabOrderManifest
} from '../src/window-layout-policy.js';
import { listDesignerUiNamespace } from './designer-ui-namespace.js';

export const DESIGNER_CONTROL_CLIPBOARD_FORMAT = 'patch-designer-control-clipboard';
export const DESIGNER_CONTROL_CLIPBOARD_VERSION = 2;

const METADATA_RE = /^\s*#\s*@(layout|taborder|locked|input-mode|input-mask|listbox-mode|slider-mode)\b/i;
const TAB_ORDER_RE = /^(\s*#\s*@taborder\s+)(\d+)(\s*)$/i;
const CHECKED_LISTBOX_RE = /^\s*#\s*@listbox-mode\s+checked\s*$/i;
const PROGRESSBAR_RE = /^\s*#\s*@slider-mode\s+progress\s*$/i;
const ID_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;
const MAX_LINES = 4096;
const MAX_LINE_LENGTH = 16384;
const MAX_IDS = 512;
const MAX_HANDLERS = 512;
const MAX_BACKING_STATES = 512;

export function copyDesignerControlClipboard(source, selector, options = {}) {
  const text = String(source ?? '');
  const controls = listDesignerControls(text);
  const control = requireControl(controls, selector);
  const windows = listDesignerWindows(text);
  const window = windows.find(item => item.windowIndex === control.windowIndex);
  if (!window) throw new Error('Designer Form selection no longer exists in Patch source.');

  const ast = parse(text);
  const astControl = requireAstControl(ast, control.windowIndex, control.controlIndex);
  const rows = normalizeLines(text);
  const windowControls = controls.filter(item => item.windowIndex === control.windowIndex);
  const localIndex = windowControls.findIndex(item => item.controlIndex === control.controlIndex);
  const start = metadataStartBefore(rows, control.line - 1);
  const nextControl = windowControls[localIndex + 1] ?? null;
  const end = nextControl
    ? metadataStartBefore(rows, nextControl.line - 1)
    : blockEnd(rows, window.line - 1);
  const copied = deindentBlock(trimTrailingBlankLines(rows.slice(start, end)));
  if (!copied.length) throw new Error('Designer control source could not be copied safely.');

  const absoluteIdRecords = collectControlIdRecords(astControl);
  const ids = absoluteIdRecords.map(record => Object.freeze({
    id: record.id,
    type: record.type,
    line: record.line - 1 - start
  }));
  const backingStates = collectPresentationBackingStates(ast, absoluteIdRecords, rows);
  const handlers = [];
  if (options.includeHandlers !== false) {
    for (const record of ids) {
      for (const event of eventBlocksForId(rows, record.id)) {
        handlers.push(Object.freeze({
          targetId: record.id,
          lines: Object.freeze(deindentBlock(trimTrailingBlankLines(event.lines)))
        }));
      }
    }
  }

  return freezeClipboard({
    format: DESIGNER_CONTROL_CLIPBOARD_FORMAT,
    version: DESIGNER_CONTROL_CLIPBOARD_VERSION,
    kind: 'control',
    controlType: control.type,
    lines: copied,
    ids,
    backingStates,
    handlers
  });
}

export function serializeDesignerControlClipboard(value) {
  return JSON.stringify(normalizeDesignerControlClipboard(value));
}

export function parseDesignerControlClipboard(text) {
  let parsed;
  try {
    parsed = JSON.parse(String(text ?? ''));
  } catch {
    throw new Error('Designer clipboard does not contain valid Patch control JSON.');
  }
  return normalizeDesignerControlClipboard(parsed);
}

export function normalizeDesignerControlClipboard(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Designer clipboard must be an object.');
  const allowed = new Set(['format', 'version', 'kind', 'controlType', 'lines', 'ids', 'backingStates', 'handlers']);
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) throw new Error(`Designer clipboard field '${key}' is not supported.`);
  }
  if (
    value.format !== DESIGNER_CONTROL_CLIPBOARD_FORMAT ||
    ![1, DESIGNER_CONTROL_CLIPBOARD_VERSION].includes(value.version) ||
    value.kind !== 'control'
  ) {
    throw new Error('Designer clipboard format/version is unsupported.');
  }
  const controlType = String(value.controlType ?? '').trim();
  if (!controlType || controlType.length > 64) throw new Error('Designer clipboard control type is invalid.');
  const lines = normalizeClipboardLines(value.lines, 'control');
  if (!lines.some(line => line.trim())) throw new Error('Designer clipboard control source is empty.');

  if (!Array.isArray(value.ids) || value.ids.length > MAX_IDS) throw new Error('Designer clipboard id records are invalid.');
  const seenIds = new Set();
  const ids = value.ids.map(record => {
    if (!record || typeof record !== 'object' || Array.isArray(record)) throw new Error('Designer clipboard id record is invalid.');
    const keys = Object.keys(record);
    if (keys.some(key => !['id', 'type', 'line'].includes(key))) throw new Error('Designer clipboard id record has unsupported fields.');
    const id = String(record.id ?? '');
    const type = String(record.type ?? '').trim();
    const line = Number(record.line);
    if (!ID_RE.test(id) || seenIds.has(id)) throw new Error('Designer clipboard id record is invalid or duplicated.');
    if (!type || type.length > 64) throw new Error('Designer clipboard id type is invalid.');
    if (!Number.isInteger(line) || line < 0 || line >= lines.length) throw new Error('Designer clipboard id line is outside the copied control.');
    seenIds.add(id);
    return Object.freeze({ id, type, line });
  });

  const rawBackingStates = value.version === 1 ? [] : (value.backingStates ?? []);
  if (!Array.isArray(rawBackingStates) || rawBackingStates.length > MAX_BACKING_STATES) {
    throw new Error('Designer clipboard backing-state records are invalid.');
  }
  const seenBackingIds = new Set();
  const backingStates = rawBackingStates.map(record => {
    if (!record || typeof record !== 'object' || Array.isArray(record)) throw new Error('Designer clipboard backing-state record is invalid.');
    if (Object.keys(record).some(key => !['id', 'valueType', 'source'].includes(key))) {
      throw new Error('Designer clipboard backing-state record has unsupported fields.');
    }
    const id = String(record.id ?? '');
    const valueType = String(record.valueType ?? '');
    const source = String(record.source ?? '').replace(/\r$/, '');
    if (!seenIds.has(id) || seenBackingIds.has(id)) throw new Error('Designer clipboard backing-state id is invalid or duplicated.');
    if (!['number', 'list'].includes(valueType)) throw new Error('Designer clipboard backing-state type is unsupported.');
    if (!source || source.length > MAX_LINE_LENGTH || source.includes('\0') || source.includes('\n')) {
      throw new Error('Designer clipboard backing-state source is invalid.');
    }
    const pattern = new RegExp(`^\\s*create\\s+${valueType}\\s+${escapeRegExp(id)}\\s*=.+$`, 'i');
    if (!pattern.test(source)) throw new Error(`Designer clipboard backing ${valueType} state '${id}' is not canonical Patch source.`);
    seenBackingIds.add(id);
    return Object.freeze({ id, valueType, source });
  });

  if (!Array.isArray(value.handlers) || value.handlers.length > MAX_HANDLERS) throw new Error('Designer clipboard event handlers are invalid.');
  const handlers = value.handlers.map(record => {
    if (!record || typeof record !== 'object' || Array.isArray(record)) throw new Error('Designer clipboard event handler is invalid.');
    const keys = Object.keys(record);
    if (keys.some(key => !['targetId', 'lines'].includes(key))) throw new Error('Designer clipboard event handler has unsupported fields.');
    const targetId = String(record.targetId ?? '');
    if (!seenIds.has(targetId)) throw new Error('Designer clipboard event handler target is not part of the copied control.');
    const handlerLines = normalizeClipboardLines(record.lines, 'event handler');
    if (!handlerLines.length || !handlerLines[0].trim()) throw new Error('Designer clipboard event handler source is empty.');
    return Object.freeze({ targetId, lines: Object.freeze(handlerLines) });
  });

  return freezeClipboard({
    format: DESIGNER_CONTROL_CLIPBOARD_FORMAT,
    version: DESIGNER_CONTROL_CLIPBOARD_VERSION,
    kind: 'control',
    controlType,
    lines,
    ids,
    backingStates,
    handlers
  });
}

export function pasteDesignerControlClipboard(source, clipboard, options = {}) {
  const text = String(source ?? '');
  const payload = normalizeDesignerControlClipboard(clipboard);
  const windows = listDesignerWindows(text);
  const windowIndex = Number.isInteger(options.windowIndex) ? options.windowIndex : 0;
  const window = windows.find(item => item.windowIndex === windowIndex);
  if (!window) throw new Error('Designer paste target Form does not exist.');

  const ast = parse(text);
  const controls = listDesignerControls(text);
  const targetControls = controls.filter(item => item.windowIndex === windowIndex);
  const rows = normalizeLines(text);
  const insertAt = blockEnd(rows, window.line - 1);
  const targetIndent = inferControlIndent(rows, window, targetControls);
  const copied = payload.lines.map(line => line ? `${targetIndent}${line}` : '');
  remapTopLevelTabOrder(copied, text, ast, windowIndex);

  const usedIds = new Set(listDesignerUiNamespace(text).map(record => record.id));
  const targetStates = collectTargetStateRecords(ast, rows);
  const backingById = new Map(payload.backingStates.map(record => [record.id, record]));
  const idMap = new Map();
  for (const record of payload.ids) {
    const backingState = backingById.get(record.id) ?? null;
    const nextId = allocatePastedId(record.id, record.type, usedIds, backingState, targetStates);
    idMap.set(record.id, nextId);
    rewriteControlIdAt(copied, record.line, record, nextId);
  }

  rows.splice(insertAt, 0, ...copied);
  insertPastedBackingStates(rows, payload.backingStates, idMap, targetStates);
  if (payload.handlers.length) {
    const rewritten = payload.handlers.map(handler =>
      rewriteEventTarget(handler.lines, handler.targetId, idMap.get(handler.targetId) ?? handler.targetId)
    );
    appendEventBlocks(rows, rewritten);
  }

  let next = validateAndPreserve(text, rows);
  let pasted = listDesignerControls(next).find(item =>
    item.windowIndex === windowIndex && item.controlIndex === targetControls.length
  );
  if (!pasted) throw new Error('Pasted Designer control could not be resolved after source rewrite.');

  if (options.offset !== false && Number.isInteger(pasted.x) && Number.isInteger(pasted.y) && !hasResponsiveTopLevelLayout(copied)) {
    const offset = Number(options.offsetPixels) || 16;
    const x = offsetAxis(pasted.x, pasted.width, window.width ?? 640, offset);
    const y = offsetAxis(pasted.y, pasted.height, window.height ?? 420, offset);
    if (x !== pasted.x || y !== pasted.y) {
      next = updateDesignerControl(next, pasted, { x, y });
      pasted = listDesignerControls(next).find(item =>
        item.windowIndex === windowIndex && item.controlIndex === targetControls.length
      ) ?? pasted;
    }
  }

  return Object.freeze({
    source: next,
    control: pasted,
    windowIndex,
    idMap: Object.freeze(Object.fromEntries(idMap))
  });
}

function requireControl(controls, selector) {
  if (!selector || !Number.isInteger(selector.windowIndex) || !Number.isInteger(selector.controlIndex)) {
    throw new Error('Designer selection is invalid.');
  }
  const control = controls.find(item =>
    item.windowIndex === selector.windowIndex && item.controlIndex === selector.controlIndex
  );
  if (!control) throw new Error('Designer control selection no longer exists in Patch source.');
  return control;
}

function requireAstControl(ast, windowIndex, controlIndex) {
  let currentWindow = 0;
  for (const node of ast ?? []) {
    if (node.kind !== 'window') continue;
    if (currentWindow === windowIndex) {
      let currentControl = 0;
      for (const child of node.body ?? []) {
        if (child.kind !== 'uiControl' && child.kind !== 'tabs') continue;
        if (currentControl === controlIndex) return child;
        currentControl += 1;
      }
    }
    currentWindow += 1;
  }
  throw new Error('Designer control selection no longer matches Patch AST.');
}

function collectControlIdRecords(node, out = []) {
  if (!node || typeof node !== 'object') return out;
  if ((node.kind === 'uiControl' || node.kind === 'tabs') && node.id) {
    out.push({
      id: node.id,
      line: node.line,
      type: node.kind === 'tabs' ? 'tabs' : node.control
    });
  }
  if (node.kind === 'tabs') {
    for (const page of node.body ?? []) {
      for (const child of page.body ?? []) collectControlIdRecords(child, out);
    }
  }
  if (node.kind === 'uiControl' && node.control === 'panel') {
    for (const child of node.body ?? []) collectControlIdRecords(child, out);
  }
  return out;
}

function collectPresentationBackingStates(ast, records, rows) {
  const creates = new Map((ast ?? [])
    .filter(node => node.kind === 'create' && node.name)
    .map(node => [node.name, node]));
  const states = [];
  for (const record of records) {
    const requirement = presentationBackingRequirement(rows, record);
    if (!requirement) continue;
    const state = creates.get(record.id);
    if (!state || state.valueType !== requirement.valueType || !Number.isInteger(state.line)) {
      throw new Error(`${requirement.label} '${record.id}' cannot be copied without its source-backed create ${requirement.valueType} state.`);
    }
    const source = rows[state.line - 1];
    if (typeof source !== 'string') throw new Error(`${requirement.label} backing state '${record.id}' could not be located safely.`);
    states.push(Object.freeze({ id: record.id, valueType: requirement.valueType, source: source.trim() }));
  }
  return Object.freeze(states);
}

function presentationBackingRequirement(rows, record) {
  if (!Number.isInteger(record.line)) return null;
  const declarationIndex = record.line - 1;
  for (let index = declarationIndex - 1; index >= 0 && METADATA_RE.test(rows[index] ?? ''); index -= 1) {
    if (record.type === 'listbox' && CHECKED_LISTBOX_RE.test(rows[index])) return { valueType: 'list', label: 'CheckedListBox' };
    if (record.type === 'slider' && PROGRESSBAR_RE.test(rows[index])) return { valueType: 'number', label: 'ProgressBar' };
  }
  return null;
}

function collectTargetStateRecords(ast, rows) {
  const states = new Map();
  for (const node of ast ?? []) {
    if (node.kind !== 'create' || !node.name || !Number.isInteger(node.line)) continue;
    states.set(node.name, Object.freeze({
      id: node.name,
      valueType: node.valueType,
      source: String(rows[node.line - 1] ?? '').trim()
    }));
  }
  return states;
}

function metadataStartBefore(rows, declarationIndex) {
  let start = declarationIndex;
  while (start > 0 && METADATA_RE.test(rows[start - 1] ?? '')) start -= 1;
  return start;
}

function inferControlIndent(rows, window, controls) {
  if (controls.length) return indentOf(rows[controls[0].line - 1]);
  return `${indentOf(rows[window.line - 1])}  `;
}

function remapTopLevelTabOrder(copied, source, ast, windowIndex) {
  let directiveIndex = -1;
  let requested = null;
  for (let index = 0; index < copied.length; index += 1) {
    const line = copied[index];
    if (!line.trim()) continue;
    if (!METADATA_RE.test(line)) break;
    const match = line.match(TAB_ORDER_RE);
    if (match) {
      directiveIndex = index;
      requested = Number(match[2]);
      break;
    }
  }
  if (directiveIndex < 0 || !Number.isInteger(requested)) return;
  const manifest = buildWindowTabOrderManifest(source, ast);
  const used = new Set((manifest.windows[windowIndex]?.controls ?? [])
    .map(control => control.tabOrder)
    .filter(value => Number.isInteger(value)));
  if (!used.has(requested)) return;
  let replacement = 0;
  while (used.has(replacement) && replacement <= PATCH_WINDOW_TAB_ORDER_MAX) replacement += 1;
  if (replacement > PATCH_WINDOW_TAB_ORDER_MAX) throw new Error('Designer paste cannot allocate a free TabOrder in the target Form.');
  copied[directiveIndex] = copied[directiveIndex].replace(TAB_ORDER_RE, `$1${replacement}$3`);
}

function hasResponsiveTopLevelLayout(copied) {
  for (const line of copied) {
    if (!line.trim()) continue;
    if (!METADATA_RE.test(line)) break;
    if (/^\s*#\s*@layout\s+(?:anchor|dock)\b/i.test(line)) return true;
  }
  return false;
}

function rewriteControlIdAt(lines, index, record, newId) {
  const line = lines[index];
  if (typeof line !== 'string') throw new Error('Clipboard control source line could not be located safely.');
  const oldId = escapeRegExp(record.id);
  if (record.type === 'input') {
    const pattern = new RegExp(`^(\\s*input\\s+)${oldId}(\\b)`);
    if (!pattern.test(line)) throw new Error('Clipboard Input id could not be rewritten safely.');
    lines[index] = line.replace(pattern, `$1${newId}$2`);
    return;
  }
  const pattern = new RegExp(`\\bas\\s+${oldId}\\b`);
  if (!pattern.test(line)) throw new Error('Clipboard control id could not be rewritten safely.');
  lines[index] = line.replace(pattern, `as ${newId}`);
}

function eventBlocksForId(lines, id) {
  const escaped = escapeRegExp(id);
  const header = new RegExp(`^(\\s*)when\\s+${escaped}\\s+([^:\\s]+)\\s*:\\s*$`);
  const out = [];
  for (let index = 0; index < lines.length;) {
    const match = lines[index].match(header);
    if (!match) { index += 1; continue; }
    const baseIndent = match[1].length;
    let end = index + 1;
    while (end < lines.length) {
      if (!lines[end].trim()) { end += 1; continue; }
      if (indentOf(lines[end]).length <= baseIndent) break;
      end += 1;
    }
    out.push({ lines: lines.slice(index, end) });
    index = end;
  }
  return out;
}

function rewriteEventTarget(lines, oldId, newId) {
  const next = [...lines];
  const pattern = new RegExp(`^(\\s*when\\s+)${escapeRegExp(oldId)}(\\s+)`);
  if (!pattern.test(next[0] ?? '')) throw new Error('Clipboard control event handler could not be pasted safely.');
  next[0] = next[0].replace(pattern, `$1${newId}$2`);
  return next;
}

function appendEventBlocks(lines, blocks) {
  while (lines.length && !lines.at(-1).trim()) lines.pop();
  for (const block of blocks) {
    lines.push('', ...block);
    while (lines.length && !lines.at(-1).trim()) lines.pop();
  }
}

function allocatePastedId(originalId, type, usedIds, backingState, targetStates) {
  const targetState = backingState ? targetStates.get(originalId) : null;
  const reusableBackingState = !backingState || !targetState || (
    targetState.valueType === backingState.valueType && targetState.source === backingState.source
  );
  if (originalId && !usedIds.has(originalId) && reusableBackingState) {
    usedIds.add(originalId);
    return originalId;
  }
  return uniqueId(controlPrefix(type), usedIds, backingState ? targetStates : null);
}

function insertPastedBackingStates(rows, backingStates, idMap, targetStates) {
  const pending = [];
  for (const state of backingStates ?? []) {
    const nextId = idMap.get(state.id) ?? state.id;
    const existing = targetStates.get(nextId);
    if (existing) {
      if (existing.valueType === state.valueType && existing.source === state.source && nextId === state.id) continue;
      throw new Error(`Designer paste cannot safely replace existing state '${nextId}'.`);
    }
    const pattern = new RegExp(`^(\\s*create\\s+${state.valueType}\\s+)${escapeRegExp(state.id)}(\\s*=.*)$`, 'i');
    if (!pattern.test(state.source)) throw new Error(`Designer clipboard backing state '${state.id}' could not be remapped safely.`);
    pending.push(state.source.replace(pattern, `$1${nextId}$2`).trim());
  }
  if (!pending.length) return;
  let insertAt = 0;
  while (insertAt < rows.length) {
    if (!rows[insertAt].trim()) { insertAt += 1; continue; }
    if (!/^\s*create\b/i.test(rows[insertAt])) break;
    insertAt += 1;
  }
  const prefix = insertAt > 0 && rows[insertAt - 1]?.trim() ? [''] : [];
  rows.splice(insertAt, 0, ...prefix, ...pending, '');
}

function controlPrefix(type) {
  return type || 'control';
}

function uniqueId(prefix, usedIds, targetStates = null) {
  let index = 1;
  let candidate = `${prefix}_${index}`;
  while (usedIds.has(candidate) || targetStates?.has(candidate)) {
    index += 1;
    candidate = `${prefix}_${index}`;
  }
  usedIds.add(candidate);
  return candidate;
}

function offsetAxis(position, size, limit, offset) {
  if (!Number.isInteger(position)) return position;
  const delta = Math.max(1, Math.round(Math.abs(offset || 16)));
  const extent = Number.isInteger(size) && size > 0 ? size : 0;
  const maximum = Math.max(0, Math.round(Number(limit) || 0) - extent);
  if (position + delta <= maximum) return position + delta;
  if (position - delta >= 0) return position - delta;
  return Math.max(0, Math.min(maximum, position));
}

function blockEnd(lines, lineIndex) {
  const baseIndent = indentOf(lines[lineIndex]).length;
  let end = lineIndex + 1;
  while (end < lines.length) {
    if (!lines[end].trim()) { end += 1; continue; }
    if (indentOf(lines[end]).length <= baseIndent) break;
    end += 1;
  }
  return end;
}

function deindentBlock(lines) {
  const nonblank = lines.filter(line => line.trim());
  if (!nonblank.length) return [];
  const base = Math.min(...nonblank.map(line => indentOf(line).length));
  return lines.map(line => line.trim() ? line.slice(Math.min(base, indentOf(line).length)) : '');
}

function trimTrailingBlankLines(lines) {
  const next = [...lines];
  while (next.length && !next.at(-1).trim()) next.pop();
  return next;
}

function normalizeClipboardLines(value, label) {
  if (!Array.isArray(value) || value.length > MAX_LINES) throw new Error(`Designer clipboard ${label} lines are invalid.`);
  return value.map(line => {
    if (typeof line !== 'string' || line.length > MAX_LINE_LENGTH || line.includes('\0')) {
      throw new Error(`Designer clipboard ${label} line is invalid.`);
    }
    return line.replace(/\r$/, '');
  });
}

function validateAndPreserve(original, lines) {
  const text = preserveTrailingNewline(original, lines.join('\n'));
  parse(text);
  return text;
}

function freezeClipboard(value) {
  return Object.freeze({
    format: value.format,
    version: value.version,
    kind: value.kind,
    controlType: value.controlType,
    lines: Object.freeze([...value.lines]),
    ids: Object.freeze(value.ids.map(record => Object.freeze({ ...record }))),
    backingStates: Object.freeze((value.backingStates ?? []).map(record => Object.freeze({ ...record }))),
    handlers: Object.freeze(value.handlers.map(record => Object.freeze({
      targetId: record.targetId,
      lines: Object.freeze([...record.lines])
    })))
  });
}

function normalizeLines(source) {
  return String(source).replace(/\r\n/g, '\n').split('\n');
}

function indentOf(line) {
  return line.match(/^\s*/)?.[0] ?? '';
}

function preserveTrailingNewline(original, text) {
  const hasNewline = /(?:\r?\n)$/.test(String(original));
  return text.replace(/\s+$/, '') + (hasNewline ? '\n' : '');
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
