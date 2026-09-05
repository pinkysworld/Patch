export const PATCH_WINDOW_LAYOUT_POLICY_VERSION = '0.1';
export const PATCH_WINDOW_LAYOUT_POLICY_FORMAT = 'patch-window-layout-policy';
export const PATCH_WINDOW_TAB_ORDER_VERSION = '0.1';
export const PATCH_WINDOW_TAB_ORDER_FORMAT = 'patch-window-tab-order';
export const PATCH_WINDOW_TAB_ORDER_MAX = 32767;

const DIRECTIVE_RE = /^\s*#\s*@layout\s+(anchor\s+(?:left|right|top|bottom)(?:\s+(?:left|right|top|bottom))*|dock\s+(?:left|right|top|bottom|fill))\s*$/i;
const TAB_ORDER_RE = /^\s*#\s*@taborder\s+(\d+)\s*$/i;
const TAB_ORDER_PREFIX_RE = /^\s*#\s*@taborder\b/i;
const LOCKED_RE = /^\s*#\s*@locked\s*$/i;
const LOCKED_PREFIX_RE = /^\s*#\s*@locked\b/i;
const METADATA_RE = /^\s*#\s*@(layout|taborder|locked)\b/i;
const EDGE_ORDER = ['left', 'right', 'top', 'bottom'];

export function buildWindowLayoutPolicyManifest(source, ast) {
  const rows = sourceRows(source);
  const windows = [];
  for (const node of ast ?? []) {
    if (node.kind !== 'window') continue;
    const controls = [];
    for (const child of node.body ?? []) {
      if (child.kind !== 'uiControl' && child.kind !== 'tabs') continue;
      controls.push({
        line: child.line ?? null,
        policy: readWindowLayoutPolicyFromRows(rows, child.line),
        tabOrder: readWindowTabOrderFromRows(rows, child.line)
      });
    }
    windows.push({ line: node.line ?? null, width: node.width ?? 640, height: node.height ?? 420, controls });
  }
  return validateWindowLayoutPolicyManifest({ format: PATCH_WINDOW_LAYOUT_POLICY_FORMAT, version: PATCH_WINDOW_LAYOUT_POLICY_VERSION, windows });
}

export function attachWindowLayoutPolicies(ast, manifest) {
  validateWindowLayoutPolicyManifest(manifest);
  let windowIndex = 0;
  for (const node of ast ?? []) {
    if (node.kind !== 'window') continue;
    const policyForm = manifest.windows[windowIndex++];
    if (!policyForm) throw new Error('Window layout policy manifest has fewer Forms than the compiled program.');
    let controlIndex = 0;
    for (const child of node.body ?? []) {
      if (child.kind !== 'uiControl' && child.kind !== 'tabs') continue;
      const metadata = policyForm.controls?.[controlIndex++] ?? {};
      const policy = normalizeWindowLayoutPolicy(metadata.policy);
      const tabOrder = normalizeWindowTabOrder(metadata.tabOrder);
      Object.defineProperty(child, 'layoutPolicy', { value: policy, enumerable: false, configurable: true, writable: false });
      Object.defineProperty(child, 'tabOrder', { value: tabOrder, enumerable: false, configurable: true, writable: false });
    }
  }
  if (windowIndex !== manifest.windows.length) throw new Error('Window layout policy manifest has more Forms than the compiled program.');
  return ast;
}

export function validateWindowLayoutPolicyManifest(manifest) {
  if (!manifest || manifest.format !== PATCH_WINDOW_LAYOUT_POLICY_FORMAT || manifest.version !== PATCH_WINDOW_LAYOUT_POLICY_VERSION) {
    throw new Error('Window layout policy manifest format/version is unsupported.');
  }
  if (!Array.isArray(manifest.windows)) throw new Error('Window layout policy manifest is incomplete.');
  for (const form of manifest.windows) {
    if (!Number.isFinite(Number(form.width)) || !Number.isFinite(Number(form.height)) || !Array.isArray(form.controls)) throw new Error('Window layout policy Form is incomplete.');
    const usedTabOrders = new Set();
    for (const control of form.controls) {
      normalizeWindowLayoutPolicy(control.policy);
      const tabOrder = normalizeWindowTabOrder(control.tabOrder);
      if (tabOrder === null) continue;
      if (usedTabOrders.has(tabOrder)) throw new Error(`Window TabOrder ${tabOrder} is duplicated within one Form.`);
      usedTabOrders.add(tabOrder);
    }
  }
  return manifest;
}

export function readWindowLayoutPolicy(source, sourceLine) { return readWindowLayoutPolicyFromRows(sourceRows(source), sourceLine); }

export function normalizeWindowLayoutPolicy(policy) {
  if (!policy || policy.kind === 'fixed') return fixedPolicy();
  if (policy.kind === 'dock') {
    const side = String(policy.side ?? '').toLowerCase();
    if (!['left', 'right', 'top', 'bottom', 'fill'].includes(side)) throw new Error(`Unsupported dock '${policy.side}'.`);
    return { kind: 'dock', side };
  }
  if (policy.kind === 'anchor') {
    const edges = [...new Set((policy.edges ?? []).map(edge => String(edge).toLowerCase()))].filter(edge => EDGE_ORDER.includes(edge));
    if (!edges.length) throw new Error('Anchor layout needs at least one edge.');
    edges.sort((a, b) => EDGE_ORDER.indexOf(a) - EDGE_ORDER.indexOf(b));
    return { kind: 'anchor', edges };
  }
  throw new Error(`Unsupported window layout policy '${policy.kind}'.`);
}

export function parseWindowLayoutPolicy(text) {
  const parts = String(text ?? '').trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (!parts.length || parts[0] === 'fixed') return fixedPolicy();
  if (parts[0] === 'dock') return normalizeWindowLayoutPolicy({ kind: 'dock', side: parts[1] });
  if (parts[0] === 'anchor') return normalizeWindowLayoutPolicy({ kind: 'anchor', edges: parts.slice(1) });
  throw new Error(`Unknown window layout policy '${text}'.`);
}

export function formatWindowLayoutPolicy(policy) {
  const normalized = normalizeWindowLayoutPolicy(policy);
  if (normalized.kind === 'fixed') return 'fixed';
  if (normalized.kind === 'dock') return `dock ${normalized.side}`;
  return `anchor ${normalized.edges.join(' ')}`;
}

export function applyWindowResizePolicy(layout, policy, resize) {
  const normalized = normalizeWindowLayoutPolicy(policy);
  const current = normalizeLayout(layout);
  const deltaWidth = Number(resize?.deltaWidth ?? 0);
  const deltaHeight = Number(resize?.deltaHeight ?? 0);
  const formWidth = Number(resize?.width ?? (current.x + current.width));
  const formHeight = Number(resize?.height ?? (current.y + current.height));
  if (![deltaWidth, deltaHeight, formWidth, formHeight].every(Number.isFinite)) return current;
  if (normalized.kind === 'dock') return dockLayout(current, normalized.side, formWidth, formHeight);
  if (normalized.kind !== 'anchor') return current;
  const edges = new Set(normalized.edges);
  let { x, y, width, height } = current;
  if (edges.has('left') && edges.has('right')) width = Math.max(16, width + deltaWidth);
  else if (!edges.has('left') && edges.has('right')) x = Math.max(0, x + deltaWidth);
  if (edges.has('top') && edges.has('bottom')) height = Math.max(16, height + deltaHeight);
  else if (!edges.has('top') && edges.has('bottom')) y = Math.max(0, y + deltaHeight);
  return rounded({ x, y, width, height });
}

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
      Object.defineProperty(child, 'tabOrder', { value: tabOrder, enumerable: false, configurable: true, writable: false });
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
    lineIndex: resolveSourceLineIndex(rows, entry?.sourceLine)
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
    if (used.has(control.explicitTabOrder)) throw new Error(`Window TabOrder ${control.explicitTabOrder} is duplicated within one Form.`);
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

export function readWindowDesignerLock(source, sourceLine) {
  const rows = sourceRows(source);
  const lineIndex = resolveSourceLineIndex(rows, sourceLine);
  if (lineIndex < 1) return false;
  for (let index = lineIndex - 1; index >= 0 && isDesignerMetadataDirective(rows[index]); index -= 1) {
    if (!LOCKED_PREFIX_RE.test(rows[index])) continue;
    if (!LOCKED_RE.test(rows[index])) throw new Error(`Invalid Designer lock directive on source line ${index + 1}.`);
    return true;
  }
  return false;
}

export function setWindowDesignerLock(source, sourceLine, locked) {
  const original = String(source ?? '').replace(/\r\n/g, '\n');
  const rows = original.split('\n');
  const lineIndex = resolveSourceLineIndex(rows, sourceLine);
  if (lineIndex < 0) throw new Error('Selected control line is outside the Patch source.');
  let existingIndex = -1;
  for (let index = lineIndex - 1; index >= 0 && isDesignerMetadataDirective(rows[index]); index -= 1) {
    if (LOCKED_PREFIX_RE.test(rows[index])) existingIndex = index;
  }
  if (!locked) {
    if (existingIndex >= 0) rows.splice(existingIndex, 1);
    return preserveTrailingNewline(original, rows.join('\n'));
  }
  const indent = /^\s*/.exec(rows[lineIndex])?.[0] ?? '';
  const directive = `${indent}# @locked`;
  if (existingIndex >= 0) rows[existingIndex] = directive;
  else rows.splice(lineIndex, 0, directive);
  return preserveTrailingNewline(original, rows.join('\n'));
}

export function isDesignerMetadataDirective(line) {
  return METADATA_RE.test(String(line ?? ''));
}

function readWindowLayoutPolicyFromRows(rows, sourceLine) {
  const lineIndex = resolveSourceLineIndex(rows, sourceLine);
  if (lineIndex < 1) return fixedPolicy();
  for (let index = lineIndex - 1; index >= 0 && isDesignerMetadataDirective(rows[index]); index -= 1) {
    const match = rows[index].match(DIRECTIVE_RE);
    if (match) return parseWindowLayoutPolicy(match[1]);
  }
  return fixedPolicy();
}

function readWindowTabOrderFromRows(rows, sourceLine) {
  const lineIndex = resolveSourceLineIndex(rows, sourceLine);
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
  for (let index = lineIndex - 1; index >= 0 && isDesignerMetadataDirective(rows[index]); index -= 1) {
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

function resolveSourceLineIndex(rows, sourceLine) {
  const raw = Number(sourceLine);
  if (!Number.isInteger(raw)) return -1;
  for (const candidate of [raw - 1, raw]) {
    if (candidate < 0 || candidate >= rows.length) continue;
    if (looksLikeControlLine(rows[candidate])) return candidate;
  }
  return raw >= 1 && raw <= rows.length ? raw - 1 : -1;
}

function looksLikeControlLine(line) {
  return /^\s*(?:text|button|input|memo|checkbox|radio|combo|listbox|slider|table|tree|tabs|panel|timer|picture|paintbox|imagelist|statusbar|shape)\b/i.test(String(line));
}
function sourceRows(source) { return String(source ?? '').replace(/\r\n/g, '\n').split('\n'); }

function dockLayout(layout, side, formWidth, formHeight) {
  if (side === 'fill') return rounded({ x: 0, y: 0, width: Math.max(16, formWidth), height: Math.max(16, formHeight) });
  if (side === 'top') return rounded({ x: 0, y: 0, width: Math.max(16, formWidth), height: layout.height });
  if (side === 'bottom') return rounded({ x: 0, y: Math.max(0, formHeight - layout.height), width: Math.max(16, formWidth), height: layout.height });
  if (side === 'left') return rounded({ x: 0, y: 0, width: layout.width, height: Math.max(16, formHeight) });
  return rounded({ x: Math.max(0, formWidth - layout.width), y: 0, width: layout.width, height: Math.max(16, formHeight) });
}

function fixedPolicy() { return { kind: 'fixed' }; }
function normalizeLayout(layout) { return rounded({ x: Number(layout?.x ?? 0), y: Number(layout?.y ?? 0), width: Math.max(16, Number(layout?.width ?? 120)), height: Math.max(16, Number(layout?.height ?? 36)) }); }
function rounded(layout) { return { x: Math.max(0, Math.round(layout.x)), y: Math.max(0, Math.round(layout.y)), width: Math.max(16, Math.round(layout.width)), height: Math.max(16, Math.round(layout.height)) }; }
function preserveTrailingNewline(original, text) {
  const hasNewline = /\n$/.test(original);
  return text.replace(/\s+$/, '') + (hasNewline ? '\n' : '');
}
