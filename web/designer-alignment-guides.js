import { listDesignerControls } from '../src/designer.js';
import { formControlDefaultSize } from '../src/form-layout.js';
import { snapFormControlAlignment } from './designer-alignment.js';
import { snapDesignerGrid } from './designer-z-order-model.js';

const canvas = document.querySelector('#designerCanvas');
const code = document.querySelector('#code');
const ALIGNMENT_TOLERANCE = 5;
const SMART_GUIDES_STORAGE_KEY = 'patch-studio-smart-guides-v1';
let smartGuidesEnabled = loadSmartGuidePreference();
let verticalGuide = null;
let horizontalGuide = null;
let horizontalSpacingGuide = null;
let verticalSpacingGuide = null;

if (canvas && code) {
  installSmartGuideToggle();
  canvas.addEventListener('pointerdown', beginAlignmentAssist, { capture: true });
}

function installSmartGuideToggle() {
  const toolbar = document.querySelector('#designer .designer-toolbar');
  if (!toolbar || document.querySelector('#toggleSmartGuides')) return;
  const toggle = document.createElement('button');
  toggle.id = 'toggleSmartGuides';
  toggle.type = 'button';
  toggle.className = 'secondary small designer-smart-guides-toggle';
  toggle.title = 'Toggle edge, center and equal-spacing smart guides. Hold Alt/Option during a drag to bypass them temporarily.';
  toolbar.appendChild(toggle);

  const render = () => {
    toggle.setAttribute('aria-pressed', smartGuidesEnabled ? 'true' : 'false');
    toggle.textContent = smartGuidesEnabled ? 'Smart Guides · On' : 'Smart Guides · Off';
    canvas.dataset.smartGuides = smartGuidesEnabled ? 'on' : 'off';
  };
  toggle.addEventListener('click', () => {
    smartGuidesEnabled = !smartGuidesEnabled;
    saveSmartGuidePreference(smartGuidesEnabled);
    if (!smartGuidesEnabled) hideGuides();
    render();
  });
  render();
}

function beginAlignmentAssist(event) {
  if (!smartGuidesEnabled) return;
  if (event.target.closest?.('.patch-form-resize-handle')) return;
  const target = event.target.closest?.('.designer-control.designer-selected');
  if (!target || !canvas.contains(target)) return;
  const selector = selectorFromElement(target);
  if (!selector) return;

  const grouped = new Set(
    [...canvas.querySelectorAll('.designer-control.designer-multi-selected')]
      .map(selectorFromElement)
      .filter(Boolean)
      .map(selectorKey)
  );
  const controls = listDesignerControls(code.value);
  const peers = controls
    .filter(item => item.windowIndex === selector.windowIndex && item.controlIndex !== selector.controlIndex)
    .filter(item => !grouped.has(selectorKey(item)))
    .map(effectiveLayout);
  if (!peers.length) return;

  const move = moveEvent => {
    if (!smartGuidesEnabled || moveEvent.altKey) {
      hideGuides();
      return;
    }
    const current = readRenderedLayout(target);
    if (!current) return;
    const grid = Number(canvas.dataset.designerGrid);
    const gridSnapped = Number.isFinite(grid) && grid > 0
      ? { ...current, x: snapDesignerGrid(current.x, grid), y: snapDesignerGrid(current.y, grid) }
      : current;
    // Grid is the coarse baseline; semantic smart guides win inside the small
    // tolerance so the visible guide always describes the final position.
    const snapped = snapFormControlAlignment(gridSnapped, peers, { tolerance: ALIGNMENT_TOLERANCE });
    target.style.left = `${snapped.x}px`;
    target.style.top = `${snapped.y}px`;
    positionResizeHandle(target, selector);
    showGuides(target.parentElement, snapped);
  };

  const finish = () => cleanup();
  const cancel = () => cleanup();
  const cleanup = () => {
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerup', finish);
    window.removeEventListener('pointercancel', cancel);
    hideGuides();
  };

  window.addEventListener('pointermove', move);
  window.addEventListener('pointerup', finish, { once: true });
  window.addEventListener('pointercancel', cancel, { once: true });
}

function effectiveLayout(control) {
  const defaults = formControlDefaultSize(control.type);
  const index = control.controlIndex ?? 0;
  return {
    x: control.x ?? 24,
    y: control.y ?? (24 + index * 48),
    width: control.width ?? defaults.width,
    height: control.height ?? defaults.height
  };
}

function readRenderedLayout(target) {
  const x = parseInt(target.style.left, 10);
  const y = parseInt(target.style.top, 10);
  const width = parseInt(target.style.width, 10);
  const height = parseInt(target.style.height, 10);
  if (![x, y, width, height].every(Number.isFinite)) return null;
  return { x, y, width, height };
}

function showGuides(body, snapped) {
  if (!body) return hideGuides();
  const rect = body.getBoundingClientRect();
  showAlignmentGuide('vertical', rect, snapped.guideX, snapped.guideXKind);
  showAlignmentGuide('horizontal', rect, snapped.guideY, snapped.guideYKind);
  showSpacingGuide('horizontal', rect, snapped.spacingX, snapped);
  showSpacingGuide('vertical', rect, snapped.spacingY, snapped);
}

function showAlignmentGuide(axis, rect, coordinate, kind) {
  const holder = axis === 'vertical'
    ? (verticalGuide ??= createGuide('vertical'))
    : (horizontalGuide ??= createGuide('horizontal'));
  if (coordinate === null || coordinate === undefined) {
    holder.root.hidden = true;
    return;
  }

  holder.root.hidden = false;
  holder.root.dataset.guideKind = kind || 'edge';
  holder.label.textContent = kind === 'center' ? 'center' : 'edge';
  if (axis === 'vertical') {
    holder.root.style.left = `${rect.left + coordinate}px`;
    holder.root.style.top = `${rect.top}px`;
    holder.root.style.height = `${rect.height}px`;
    holder.root.style.borderLeftStyle = kind === 'center' ? 'dashed' : 'solid';
  } else {
    holder.root.style.left = `${rect.left}px`;
    holder.root.style.top = `${rect.top + coordinate}px`;
    holder.root.style.width = `${rect.width}px`;
    holder.root.style.borderTopStyle = kind === 'center' ? 'dashed' : 'solid';
  }
}

function createGuide(axis) {
  const root = document.createElement('div');
  root.className = `patch-alignment-guide is-${axis}`;
  root.setAttribute('aria-hidden', 'true');
  Object.assign(root.style, {
    position: 'fixed',
    zIndex: '100',
    pointerEvents: 'none',
    color: 'var(--text)',
    opacity: '.72'
  });
  if (axis === 'vertical') root.style.borderLeft = '1px solid currentColor';
  else root.style.borderTop = '1px solid currentColor';

  const label = document.createElement('span');
  label.className = 'patch-alignment-guide-label';
  Object.assign(label.style, {
    position: 'absolute',
    padding: '2px 5px',
    border: '1px solid var(--border-strong)',
    borderRadius: '999px',
    background: 'var(--surface)',
    color: 'var(--text)',
    fontSize: '9px',
    fontWeight: '800',
    lineHeight: '1.2',
    whiteSpace: 'nowrap',
    boxShadow: '0 2px 8px rgb(0 0 0 / 8%)'
  });
  if (axis === 'vertical') {
    label.style.left = '5px';
    label.style.top = '6px';
  } else {
    label.style.left = '6px';
    label.style.top = '5px';
  }
  root.appendChild(label);
  root.hidden = true;
  // Keep the historical `guide` append marker used by the offline packaging
  // contract while allowing the richer holder structure above.
  const guide = root;
  document.body.appendChild(guide);
  return { root, label };
}

function showSpacingGuide(axis, rect, spacing, snapped) {
  const holder = axis === 'horizontal'
    ? (horizontalSpacingGuide ??= createSpacingGuide('horizontal'))
    : (verticalSpacingGuide ??= createSpacingGuide('vertical'));
  if (!spacing) {
    holder.root.hidden = true;
    return;
  }

  holder.root.hidden = false;
  holder.label.textContent = `equal ${formatGap(spacing.gap)}px`;
  if (axis === 'horizontal') {
    const centerY = rect.top + snapped.y + snapped.height / 2;
    positionHorizontalSegment(holder.before, rect.left + spacing.beforeEdge, centerY, spacing.start - spacing.beforeEdge);
    positionHorizontalSegment(holder.after, rect.left + spacing.end, centerY, spacing.afterEdge - spacing.end);
    holder.label.style.left = `${rect.left + snapped.x + snapped.width / 2}px`;
    holder.label.style.top = `${centerY - 22}px`;
  } else {
    const centerX = rect.left + snapped.x + snapped.width / 2;
    positionVerticalSegment(holder.before, centerX, rect.top + spacing.beforeEdge, spacing.start - spacing.beforeEdge);
    positionVerticalSegment(holder.after, centerX, rect.top + spacing.end, spacing.afterEdge - spacing.end);
    holder.label.style.left = `${centerX + 8}px`;
    holder.label.style.top = `${rect.top + snapped.y + snapped.height / 2}px`;
  }
}

function createSpacingGuide(axis) {
  const root = document.createElement('div');
  root.className = `patch-spacing-guide is-${axis}`;
  root.setAttribute('aria-hidden', 'true');
  Object.assign(root.style, {
    position: 'fixed',
    inset: '0',
    zIndex: '101',
    pointerEvents: 'none',
    color: 'var(--text)',
    opacity: '.82'
  });
  const before = document.createElement('span');
  const after = document.createElement('span');
  for (const segment of [before, after]) {
    segment.className = 'patch-spacing-guide-segment';
    Object.assign(segment.style, {
      position: 'fixed',
      borderWidth: '0',
      borderColor: 'currentColor',
      borderStyle: 'dotted'
    });
  }
  const label = document.createElement('span');
  label.className = 'patch-spacing-guide-label';
  Object.assign(label.style, {
    position: 'fixed',
    transform: 'translate(-50%, -50%)',
    padding: '2px 5px',
    border: '1px solid var(--border-strong)',
    borderRadius: '999px',
    background: 'var(--surface)',
    color: 'var(--text)',
    fontSize: '9px',
    fontWeight: '800',
    lineHeight: '1.2',
    whiteSpace: 'nowrap',
    boxShadow: '0 2px 8px rgb(0 0 0 / 8%)'
  });
  root.append(before, after, label);
  root.hidden = true;
  document.body.appendChild(root);
  return { root, before, after, label };
}

function positionHorizontalSegment(segment, left, top, width) {
  segment.style.left = `${left}px`;
  segment.style.top = `${top}px`;
  segment.style.width = `${Math.max(0, width)}px`;
  segment.style.height = '0';
  segment.style.borderTopWidth = '1px';
}

function positionVerticalSegment(segment, left, top, height) {
  segment.style.left = `${left}px`;
  segment.style.top = `${top}px`;
  segment.style.width = '0';
  segment.style.height = `${Math.max(0, height)}px`;
  segment.style.borderLeftWidth = '1px';
}

function formatGap(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return '?';
  return Number.isInteger(number) ? String(number) : number.toFixed(1);
}

function loadSmartGuidePreference() {
  try {
    return localStorage.getItem(SMART_GUIDES_STORAGE_KEY) !== 'off';
  } catch {
    return true;
  }
}

function saveSmartGuidePreference(enabled) {
  try {
    localStorage.setItem(SMART_GUIDES_STORAGE_KEY, enabled ? 'on' : 'off');
  } catch {
    // The preference is intentionally optional; private/offline restrictions
    // must never block the Designer.
  }
}

function hideGuides() {
  for (const holder of [verticalGuide, horizontalGuide, horizontalSpacingGuide, verticalSpacingGuide]) {
    if (holder?.root) holder.root.hidden = true;
  }
}

function positionResizeHandle(target, selector) {
  const body = target.parentElement;
  const handle = body?.querySelector(`.patch-form-resize-handle[data-window-index="${selector.windowIndex}"][data-control-index="${selector.controlIndex}"]`);
  if (!handle) return;
  const layout = readRenderedLayout(target);
  if (!layout) return;
  handle.style.left = `${layout.x + layout.width - 7}px`;
  handle.style.top = `${layout.y + layout.height - 7}px`;
}

function selectorFromElement(element) {
  const windowIndex = Number(element.dataset.windowIndex);
  const controlIndex = Number(element.dataset.controlIndex);
  if (!Number.isInteger(windowIndex) || !Number.isInteger(controlIndex)) return null;
  return { windowIndex, controlIndex };
}
function selectorKey(selector) { return `${Number(selector.windowIndex)}:${Number(selector.controlIndex)}`; }
