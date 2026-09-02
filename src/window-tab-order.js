export const PATCH_WINDOW_TAB_ORDER_VERSION = '0.1';
export const PATCH_WINDOW_TAB_ORDER_FORMAT = 'patch-window-tab-order';
export const PATCH_WINDOW_TAB_ORDER_MAX = 32767;

const TAB_ORDER_RE = /^\s*#\s*@taborder\s+(\d+)\s*$/i;
const TAB_ORDER_PREFIX_RE = /^\s*#\s*@taborder\b/i;
const DESIGNER_METADATA_RE = /^\s*#\s*@(layout|taborder)\b/i;
const CONTROL_RE = /^\s*(?:text|button|input|checkbox|radio|combo|listbox|slider|table|tree|tabs|panel|timer|picture|paintbox|imagelist|statusbar|shape)\b/i;

export function buildWindowTabOrderManifest(source, ast) {
  const rows = sourceRows(source);
  const windows = [];
  for (const node of ast ?? []) {
    if (node.kind !== 'window') continue;
    const controls = [];
    for (const child of node.body ?? []) {
      if (child.kind !== 'uiControl' && child.kind !== 'tabs') continue;
      controls.push({ line: child.line ?? null, tabOrder: readWindowTabOrderFromRows(rows, child.line) });
    }
    windows.push({ line: node.line ?? null, controls });
  }
  const manifest = { format: PATCH_WINDOW_TAB_ORDER_FORMAT, version: PATCH_WINDOW_TAB_ORDER_VERSION, windows };
  return validateWindowTabOrderManifest(manifest);
}

export function attachWindowTabOrders(ast, manifest) {
  validateWindowTabOrderManifest(manifest);
  let windowIndex = 0;
  for (const node of ast ?? []) {
    if (node.kind !== 'window') continue;
    const tabForm = manifest.windows[windowIndex++];
    if (!tabForm) throw new Error('Window TabOrder manifest has fewer Forms than the compiled program.');
    let controlIndex = 0;
    for (const child of node.body ?? []) {
      if (child.kind !== 'uiControl' && child.kind !== 'tabs') continue;
      const tabOrder = normalizeWindowTabOrder(tabForm.controls?.[controlIndex++]?.tabOrder);
      Object.defineProperty(child, 'tabOrder', {
        value: tabOrder,
        enumerable: false,
        configurable: true,
        writable: false
      });
    }
  }
  if (windowIndex !== manifest.windows.length) throw new Error('Window TabOrder manifest has more Forms than the compiled program.');
  return ast;
}

export function validateWindowTabOrderManifest(manifest) {
  if (!manifest || manifest.format !== PATCH_WINDOW_TAB_ORDER_FORMAT || manifest.version !== PATCH_WINDOW_TAB_ORDER_VERSION) {
    throw new Error('Window TabOrder manifest format/version is unsupported.');
  }
  if (!Array.isArray(manifest.windows)) throw new Error('Window TabOrder manifest is incomplete.');
  for (const form of manifest.windows) {
    if (!Array.isArray(form.controls)) throw new Error('Window TabOrder Form is incomplete.');
    const used = new Set();
    for (const control of form.controls) {
      const tabOrder = normalizeWindowTabOrder(control?.tabOrder);
      if (tabOrder === null) continue;
      if (used.has(tabOrder)) throw new Error(`Window TabOrder ${tabOrder} is duplicated within one Form.`);
      used.add(tabOrder);
    }
  }
  return manifest;
}

export function normalizeWindowTabOrder(value) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  if (!Number.isInteger(number) || number < 0 || number > PATCH_WINDOW_TAB_ORDER_MAX) {
    throw new Error(`TabOrder must be an integer from 0 to ${PATCH_WINDOW_TAB_ORDER_MAX}.`);
  }
  return number;
}

export function readWindowTabOrder(source, sourceLine) {
  return readWindowTabOrderFromRows(sourceRows(source), sourceLine);
}

export function setWindowTabOrder(source, sourceLine, tabOrder) {
  return setWindowTabOrders(source, [{ sourceLine, tabOrder }]);
}

export function setWindowTabOrders(source, entries) {
  const original = String(source ?? '').replace(/\r\n/g, '\n');
  const rows = original.split('\n');
  const normalizedEntries = (entries ?? []).map(entry => ({
    sourceLine: Number(entry?.sourceLine),
    tabOrder: normalizeWindowTabOrder(entry?.tabOrder),
    lineIndex: resolveControlLineIndex(rows, entry?.sourceLine)
  }));
  for (const entry of normalizedEntries) {
    if (entry.lineIndex < 0) throw new Error('Selected control line is outside the Patch source.');
  }
  normalizedEntries.sort((a, b) => b.lineIndex - a.lineIndex);
  for (const entry of normalizedEntries) setWindowTabOrderInRows(rows, entry.lineIndex, entry.tabOrder);
  return preserveTrailingNewline(original, rows.join('\n'));
}

export function resolveWindowTabOrders(source, controls) {
  const rows = sourceRows(source);
  const result = (controls ?? []).map((control, sourceIndex) => ({
    ...control,
    sourceIndex,
    explicitTabOrder: readWindowTabOrderFromRows(rows, control?.line)
  }));
  const used = new Set();
  for (const control of result) {
    if (control.explicitTabOrder === null) continue;
    if (used.has(control.explicitTabOrder)) {
      throw new Error(`Window TabOrder ${control.explicitTabOrder} is duplicated within one Form.`);
    }
    used.add(control.explicitTabOrder);
  }
  let next = 0;
  for (const control of result) {
    if (control.explicitTabOrder !== null) {
      control.tabOrder = control.explicitTabOrder;
      continue;
    }
    while (used.has(next)) next += 1;
    control.tabOrder = next;
    used.add(next);
    next += 1;
  }
  result.sort((a, b) => a.tabOrder - b.tabOrder || a.sourceIndex - b.sourceIndex);
  return result;
}

export function isDesignerMetadataDirective(line) {
  return DESIGNER_METADATA_RE.test(String(line ?? ''));
}

function readWindowTabOrderFromRows(rows, sourceLine) {
  const lineIndex = resolveControlLineIndex(rows, sourceLine);
  if (lineIndex < 1) return null;
  for (let index = lineIndex - 1; index >= 0 && isDesignerMetadataDirective(rows[index]); index -= 1) {
    const line = rows[index];
    if (!TAB_ORDER_PREFIX_RE.test(line)) continue;
    const match = line.match(TAB_ORDER_RE);
    if (!match) throw new Error(`Invalid TabOrder directive on source line ${index + 1}.`);
    return normalizeWindowTabOrder(match[1]);
  }
  return null;
}

function setWindowTabOrderInRows(rows, lineIndex, tabOrder) {
  let existingIndex = -1;
  let metadataStart = lineIndex;
  for (let index = lineIndex - 1; index >= 0 && isDesignerMetadataDirective(rows[index]); index -= 1) {
    metadataStart = index;
    if (TAB_ORDER_PREFIX_RE.test(rows[index])) existingIndex = index;
  }
  if (tabOrder === null) {
    if (existingIndex >= 0) rows.splice(existingIndex, 1);
    return;
  }
  const indent = /^\s*/.exec(rows[lineIndex])?.[0] ?? '';
  const directive = `${indent}# @taborder ${tabOrder}`;
  if (existingIndex >= 0) rows[existingIndex] = directive;
  else rows.splice(lineIndex, 0, directive);
}

function resolveControlLineIndex(rows, sourceLine) {
  const raw = Number(sourceLine);
  if (!Number.isInteger(raw)) return -1;
  for (const candidate of [raw - 1, raw]) {
    if (candidate < 0 || candidate >= rows.length) continue;
    if (CONTROL_RE.test(rows[candidate])) return candidate;
  }
  return raw >= 1 && raw <= rows.length ? raw - 1 : -1;
}

function sourceRows(source) {
  return String(source ?? '').replace(/\r\n/g, '\n').split('\n');
}

function preserveTrailingNewline(original, text) {
  const hasNewline = /\n$/.test(original);
  return text.replace(/\s+$/, '') + (hasNewline ? '\n' : '');
}
