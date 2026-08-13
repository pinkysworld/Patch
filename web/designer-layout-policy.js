export const PATCH_DESIGNER_LAYOUT_POLICY_VERSION = '0.1';

const DIRECTIVE_RE = /^\s*#\s*@layout\s+(anchor\s+(?:left|right|top|bottom)(?:\s+(?:left|right|top|bottom))*|dock\s+(?:left|right|top|bottom|fill))\s*$/i;
const EDGE_ORDER = ['left', 'right', 'top', 'bottom'];

export function readDesignerLayoutPolicy(source, sourceLine) {
  const rows = String(source ?? '').replace(/\r\n/g, '\n').split('\n');
  const index = Number(sourceLine) - 2;
  if (index < 0 || index >= rows.length) return fixedPolicy();
  const match = rows[index].match(DIRECTIVE_RE);
  return match ? parsePolicy(match[1]) : fixedPolicy();
}

export function setDesignerLayoutPolicy(source, sourceLine, policy) {
  const rows = String(source ?? '').replace(/\r\n/g, '\n').split('\n');
  const lineIndex = Number(sourceLine) - 1;
  if (!Number.isInteger(lineIndex) || lineIndex < 0 || lineIndex >= rows.length) throw new Error('Selected control line is outside the Patch source.');
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
  const normalized = normalizeDesignerLayoutPolicy(policy);
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

export function normalizeDesignerLayoutPolicy(policy) {
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
  throw new Error(`Unsupported Designer layout policy '${policy.kind}'.`);
}

export function formatDesignerLayoutPolicy(policy) {
  const normalized = normalizeDesignerLayoutPolicy(policy);
  if (normalized.kind === 'fixed') return 'fixed';
  if (normalized.kind === 'dock') return `dock ${normalized.side}`;
  return `anchor ${normalized.edges.join(' ')}`;
}

export function parseDesignerLayoutPreset(value) {
  const text = String(value ?? '').trim().toLowerCase();
  if (!text || text === 'fixed') return fixedPolicy();
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

function parsePolicy(text) {
  const parts = String(text).trim().toLowerCase().split(/\s+/);
  if (parts[0] === 'dock') return normalizeDesignerLayoutPolicy({ kind: 'dock', side: parts[1] });
  return normalizeDesignerLayoutPolicy({ kind: 'anchor', edges: parts.slice(1) });
}

function dockLayout(layout, side, formWidth, formHeight) {
  if (side === 'fill') return rounded({ x: 0, y: 0, width: Math.max(16, formWidth), height: Math.max(16, formHeight) });
  if (side === 'top') return rounded({ x: 0, y: 0, width: Math.max(16, formWidth), height: layout.height });
  if (side === 'bottom') return rounded({ x: 0, y: Math.max(0, formHeight - layout.height), width: Math.max(16, formWidth), height: layout.height });
  if (side === 'left') return rounded({ x: 0, y: 0, width: layout.width, height: Math.max(16, formHeight) });
  return rounded({ x: Math.max(0, formWidth - layout.width), y: 0, width: layout.width, height: Math.max(16, formHeight) });
}

function fixedPolicy() { return { kind: 'fixed' }; }
function normalizeLayout(layout) {
  return rounded({
    x: Number(layout?.x ?? 0),
    y: Number(layout?.y ?? 0),
    width: Math.max(16, Number(layout?.width ?? 120)),
    height: Math.max(16, Number(layout?.height ?? 36))
  });
}
function rounded(layout) {
  return {
    x: Math.max(0, Math.round(layout.x)),
    y: Math.max(0, Math.round(layout.y)),
    width: Math.max(16, Math.round(layout.width)),
    height: Math.max(16, Math.round(layout.height))
  };
}
