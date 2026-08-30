export const PATCH_WINDOW_LAYOUT_POLICY_VERSION = '0.1';
export const PATCH_WINDOW_LAYOUT_POLICY_FORMAT = 'patch-window-layout-policy';

const DIRECTIVE_RE = /^\s*#\s*@layout\s+(anchor\s+(?:left|right|top|bottom)(?:\s+(?:left|right|top|bottom))*|dock\s+(?:left|right|top|bottom|fill))\s*$/i;
const EDGE_ORDER = ['left', 'right', 'top', 'bottom'];

export function buildWindowLayoutPolicyManifest(source, ast) {
  const rows = sourceRows(source);
  const windows = [];
  for (const node of ast ?? []) {
    if (node.kind !== 'window') continue;
    const controls = [];
    for (const child of node.body ?? []) {
      if (child.kind !== 'uiControl' && child.kind !== 'tabs') continue;
      controls.push({ line: child.line ?? null, policy: readWindowLayoutPolicyFromRows(rows, child.line) });
    }
    windows.push({ line: node.line ?? null, width: node.width ?? 640, height: node.height ?? 420, controls });
  }
  return { format: PATCH_WINDOW_LAYOUT_POLICY_FORMAT, version: PATCH_WINDOW_LAYOUT_POLICY_VERSION, windows };
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
      const policy = normalizeWindowLayoutPolicy(policyForm.controls?.[controlIndex++]?.policy);
      Object.defineProperty(child, 'layoutPolicy', { value: policy, enumerable: false, configurable: true, writable: false });
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
    for (const control of form.controls) normalizeWindowLayoutPolicy(control.policy);
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

function readWindowLayoutPolicyFromRows(rows, sourceLine) {
  const lineIndex = resolveSourceLineIndex(rows, sourceLine);
  if (lineIndex < 1) return fixedPolicy();
  const match = rows[lineIndex - 1].match(DIRECTIVE_RE);
  return match ? parseWindowLayoutPolicy(match[1]) : fixedPolicy();
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
  return /^\s*(?:text|button|input|checkbox|radio|combo|listbox|slider|table|tree|tabs|panel|timer|picture|statusbar)\b/i.test(String(line));
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
