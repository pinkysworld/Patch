import {
  listDesignerControls,
  removeDesignerControl,
  updateDesignerControl
} from '../src/designer.js';
import {
  DESIGNER_SELECTION_EVENT,
  clearDesignerSelection,
  currentDesignerSelection,
  decorateDesignerAdapterElement,
  designerSelectionForControl,
  installDesignerSelectionBridge,
  rememberDesignerSelection,
  sameDesignerSelection,
  selectDesignerElement
} from './designer-selection.js';
import { duplicateDesignerControl } from './designer-control-duplicate-model.js';
import {
  copyDesignerControlClipboard,
  parseDesignerControlClipboard,
  pasteDesignerControlClipboard,
  serializeDesignerControlClipboard
} from './designer-control-clipboard-model.js';
import { validateDesignerControlClipboardSemantics } from './designer-control-clipboard-guard.js';

export const STUDIO_SOURCE_DESIGNER_SYNC_VERSION = '0.1';
export const DESIGNER_CONTROL_COMMAND_EVENT = 'patch-designer-control-command';
export const DESIGNER_CONTROL_COMMANDS = Object.freeze({
  DELETE: 'designer.control.delete',
  DUPLICATE: 'designer.control.duplicate',
  REVEAL_SOURCE: 'designer.control.reveal-source',
  COPY: 'designer.control.copy',
  CUT: 'designer.control.cut',
  PASTE: 'designer.control.paste'
});

const code = document.querySelector('#code');
const canvas = document.querySelector('#designerCanvas');
const sample = document.querySelector('#sample');
const CORE_TOOL_TYPES = new Map([
  ['addText', 'text'],
  ['addButton', 'button'],
  ['addInput', 'input'],
  ['addCheckbox', 'checkbox'],
  ['addRadio', 'radio'],
  ['addCombo', 'combo'],
  ['addListbox', 'listbox'],
  ['addSlider', 'slider'],
  ['addTabs', 'tabs']
]);
const SOURCE_NAVIGATION_KEYS = new Set(['ArrowUp', 'ArrowDown', 'Home', 'End', 'PageUp', 'PageDown']);
const SINGLE_SELECTION_COMMANDS = new Set([
  DESIGNER_CONTROL_COMMANDS.DUPLICATE,
  DESIGNER_CONTROL_COMMANDS.COPY,
  DESIGNER_CONTROL_COMMANDS.CUT
]);
let scheduled = false;
let pendingToolAdd = null;
let sourceNavigationScheduled = false;
let sourceNavigationForce = false;
let designerClipboardText = '';

if (canvas && code) {
  installDesignerSelectionBridge(canvas);
  installSharedInspectorBridge();
  document.addEventListener('click', captureToolboxIntent, { capture: true });
  canvas.addEventListener('click', captureCoreSelection, { capture: true });
  canvas.addEventListener('keydown', captureCoreSelectionKey, { capture: true });
  canvas.addEventListener(DESIGNER_CONTROL_COMMAND_EVENT, handleDesignerControlCommand);
  canvas.addEventListener(DESIGNER_SELECTION_EVENT, () => {
    populateSharedInspector();
    scheduleSync();
  });
  new MutationObserver(scheduleSync).observe(canvas, { childList: true, subtree: true });
  code.addEventListener('input', scheduleSync);
  code.addEventListener('change', scheduleSync);
  code.addEventListener('click', scheduleSourceNavigationSync);
  code.addEventListener('select', scheduleSourceNavigationSync);
  code.addEventListener('keyup', captureSourceNavigationKey);
  window.addEventListener('patch:studio-quick-open', event => scheduleSourceNavigationSync(event, true));
  sample?.addEventListener('change', () => {
    pendingToolAdd = null;
    clearDesignerSelection(canvas, { reason: 'sample-change' });
    scheduleSync();
  });
  scheduleSync();
}

export function executeDesignerControlCommand(source, selection, command, options = {}) {
  const text = String(source ?? '');

  if (command === DESIGNER_CONTROL_COMMANDS.PASTE) {
    const rawClipboard = options.clipboard ?? (
      typeof options.clipboardText === 'string'
        ? parseDesignerControlClipboard(options.clipboardText)
        : null
    );
    if (!rawClipboard) throw new Error('Designer Paste needs a copied Patch control.');
    const clipboard = validateDesignerControlClipboardSemantics(rawClipboard);
    const windowIndex = Number.isInteger(options.windowIndex)
      ? options.windowIndex
      : Number.isInteger(selection?.windowIndex)
        ? selection.windowIndex
        : 0;
    const result = pasteDesignerControlClipboard(text, clipboard, { windowIndex });
    return Object.freeze({
      command,
      source: result.source,
      control: null,
      nextControl: result.control,
      line: result.control?.line ?? null,
      windowIndex: result.windowIndex,
      clipboard,
      clipboardText: serializeDesignerControlClipboard(clipboard)
    });
  }

  const selected = listDesignerControls(text).find(control => sameLocation(control, selection)) ?? null;
  if (!selected) throw new Error('Designer command needs a live selected control.');

  if (command === DESIGNER_CONTROL_COMMANDS.DELETE) {
    return Object.freeze({
      command,
      source: removeDesignerControl(text, selection),
      control: selected,
      nextControl: null,
      line: selected.line
    });
  }
  if (command === DESIGNER_CONTROL_COMMANDS.DUPLICATE) {
    const result = duplicateDesignerControl(text, selection);
    return Object.freeze({
      command,
      source: result.source,
      control: selected,
      nextControl: result.control,
      line: result.control?.line ?? selected.line
    });
  }
  if (command === DESIGNER_CONTROL_COMMANDS.REVEAL_SOURCE) {
    return Object.freeze({
      command,
      source: text,
      control: selected,
      nextControl: selected,
      line: selected.line
    });
  }
  if (command === DESIGNER_CONTROL_COMMANDS.COPY || command === DESIGNER_CONTROL_COMMANDS.CUT) {
    const clipboard = copyDesignerControlClipboard(text, selection);
    const clipboardText = serializeDesignerControlClipboard(clipboard);
    return Object.freeze({
      command,
      source: command === DESIGNER_CONTROL_COMMANDS.CUT ? removeDesignerControl(text, selection) : text,
      control: selected,
      nextControl: command === DESIGNER_CONTROL_COMMANDS.CUT ? null : selected,
      line: selected.line,
      clipboard,
      clipboardText
    });
  }
  throw new Error(`Unknown Designer control command '${command}'.`);
}

export function dispatchDesignerControlCommand(command, detail = {}) {
  if (!canvas) return false;
  canvas.dispatchEvent(new CustomEvent(DESIGNER_CONTROL_COMMAND_EVENT, {
    bubbles: false,
    cancelable: true,
    detail: { ...detail, command }
  }));
  return true;
}

async function handleDesignerControlCommand(event) {
  const command = event?.detail?.command;
  if (!Object.values(DESIGNER_CONTROL_COMMANDS).includes(command)) return;
  const selection = currentDesignerSelection(canvas);
  const selectionRequired = command !== DESIGNER_CONTROL_COMMANDS.PASTE;
  if (selectionRequired && !selection) return;
  event.preventDefault?.();

  if (SINGLE_SELECTION_COMMANDS.has(command) && canvas.querySelectorAll('.designer-control.designer-multi-selected').length > 1) {
    showInspectorError(new Error('This command currently supports one selected control at a time.'));
    return;
  }

  try {
    if (command === DESIGNER_CONTROL_COMMANDS.PASTE) {
      const clipboardText = typeof event?.detail?.clipboardText === 'string'
        ? event.detail.clipboardText
        : await readDesignerClipboardText();
      if (!clipboardText) throw new Error('Copy a Patch Designer control before using Paste.');
      const windowIndex = Number.isInteger(event?.detail?.windowIndex)
        ? event.detail.windowIndex
        : Number(document.querySelector('#patchFormSelect')?.value) || 0;
      const result = executeDesignerControlCommand(code.value, selection, command, { clipboardText, windowIndex });
      const nextSelection = designerSelectionForControl(result.nextControl);
      if (!nextSelection) throw new Error('Pasted control selection could not be created.');
      clearDesignerSelection(canvas, { reason: 'paste-control' });
      rememberDesignerSelection(canvas, nextSelection, { emit: false, reason: 'paste-control' });
      setSource(result.source);
      focusCommandControl(nextSelection, 'paste-control');
      return;
    }

    const result = executeDesignerControlCommand(code.value, selection, command);
    if (command === DESIGNER_CONTROL_COMMANDS.REVEAL_SOURCE) {
      revealLine(result.line);
      return;
    }
    if (command === DESIGNER_CONTROL_COMMANDS.COPY) {
      await writeDesignerClipboardText(result.clipboardText);
      clearInspectorError();
      return;
    }
    if (command === DESIGNER_CONTROL_COMMANDS.CUT) {
      await writeDesignerClipboardText(result.clipboardText);
      clearDesignerSelection(canvas, { reason: 'cut-control' });
      setSource(result.source);
      return;
    }
    if (command === DESIGNER_CONTROL_COMMANDS.DELETE) {
      clearDesignerSelection(canvas, { reason: 'delete-control' });
      setSource(result.source);
      return;
    }
    const nextSelection = designerSelectionForControl(result.nextControl, selection.adapter);
    if (!nextSelection) throw new Error('Duplicated control selection could not be created.');
    rememberDesignerSelection(canvas, nextSelection, { emit: false, reason: 'duplicate-control' });
    setSource(result.source);
    focusCommandControl(nextSelection, 'duplicate-control');
  } catch (error) {
    showInspectorError(error);
  }
}

async function writeDesignerClipboardText(text) {
  designerClipboardText = String(text ?? '');
  try {
    if (navigator?.clipboard?.writeText) await navigator.clipboard.writeText(designerClipboardText);
  } catch {
    // Clipboard permission is optional. The in-memory Designer clipboard remains usable.
  }
  return designerClipboardText;
}

async function readDesignerClipboardText() {
  try {
    if (navigator?.clipboard?.readText) {
      const external = await navigator.clipboard.readText();
      if (looksLikeDesignerClipboard(external)) return external;
    }
  } catch {
    // Fall back to the in-memory copy when browser clipboard permission is unavailable.
  }
  return designerClipboardText;
}

function looksLikeDesignerClipboard(text) {
  const value = String(text ?? '').trim();
  return value.startsWith('{') && value.includes('"patch-designer-control-clipboard"');
}

function focusCommandControl(selection, reason) {
  requestAnimationFrame(() => {
    const element = canvas.querySelector(`.designer-control[data-window-index="${selection.windowIndex}"][data-control-index="${selection.controlIndex}"]`);
    if (!element) return;
    selectDesignerElement(canvas, element, selection, { reason });
    element.focus?.({ preventScroll: true });
    element.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
  });
}

function captureToolboxIntent(event) {
  const button = event.target?.closest?.('button[id]');
  const type = button ? CORE_TOOL_TYPES.get(button.id) : null;
  if (!type) return;
  pendingToolAdd = {
    type,
    windowIndex: Number(document.querySelector('#patchFormSelect')?.value) || 0
  };
}

function captureCoreSelection(event) {
  if (event.metaKey || event.ctrlKey || event.shiftKey) return;
  const element = coreControlFromTarget(event.target);
  if (!element) return;
  selectCoreElement(element, 'core-control');
}

function captureCoreSelectionKey(event) {
  if (!['Enter', ' '].includes(event.key)) return;
  if (event.metaKey || event.ctrlKey || event.shiftKey) return;
  const element = coreControlFromTarget(event.target);
  if (!element) return;
  selectCoreElement(element, 'core-keyboard');
}

function selectCoreElement(element, reason) {
  const control = controlFromElement(element);
  const selection = designerSelectionForControl(control, 'core');
  if (!selection) return;
  selectDesignerElement(canvas, element, selection, { reason });
}

function scheduleSync() {
  if (scheduled) return;
  scheduled = true;
  queueMicrotask(() => {
    scheduled = false;
    try {
      syncCoreSelection();
      populateSharedInspector();
    } catch {
      // Source may be transiently invalid while typing. Playground owns the visible parse diagnostic.
    }
  });
}

function syncCoreSelection() {
  const controls = listDesignerControls(code.value);
  const elements = [...canvas.querySelectorAll('.designer-control')].filter(isCoreElement);

  if (pendingToolAdd) {
    const added = controls
      .filter(control => control.windowIndex === pendingToolAdd.windowIndex && control.type === pendingToolAdd.type)
      .at(-1);
    const element = added ? elementFor(added) : null;
    if (added && element) {
      selectDesignerElement(canvas, element, designerSelectionForControl(added, 'core'), { reason: 'add-core-control' });
      pendingToolAdd = null;
    }
  }

  const shared = currentDesignerSelection(canvas);
  if (shared?.adapter === 'core') {
    const live = controls.find(control => sameLocation(control, shared) && isCoreType(control.type));
    if (!live) {
      clearDesignerSelection(canvas, { adapter: 'core', reason: 'missing-core-control' });
    } else {
      const normalized = designerSelectionForControl(live, 'core');
      if (!sameDesignerSelection(shared, normalized) || (shared.id ?? '') !== (normalized.id ?? '')) {
        rememberDesignerSelection(canvas, normalized, { emit: false });
      }
    }
  }

  for (const element of elements) {
    const control = controlFromElement(element, controls);
    if (!control) continue;
    decorateDesignerAdapterElement(canvas, element, designerSelectionForControl(control, 'core'));
  }
}

function captureSourceNavigationKey(event) {
  if (!SOURCE_NAVIGATION_KEYS.has(event.key)) return;
  if (event.altKey || event.ctrlKey || event.metaKey) return;
  scheduleSourceNavigationSync(event);
}

function scheduleSourceNavigationSync(_event = null, force = false) {
  sourceNavigationForce = sourceNavigationForce || force;
  if (sourceNavigationScheduled) return;
  sourceNavigationScheduled = true;
  queueMicrotask(() => {
    const forced = sourceNavigationForce;
    sourceNavigationForce = false;
    sourceNavigationScheduled = false;
    if (!forced && document.activeElement !== code) return;
    syncSourceNavigationToDesigner();
  });
}

function syncSourceNavigationToDesigner() {
  let target;
  try {
    target = sourceDesignerNavigationTarget(code.value, code.selectionStart);
  } catch {
    return;
  }
  if (!target) return;
  applySourceNavigationTarget(target);
}

export function sourceDesignerNavigationTarget(source, selectionStart = 0) {
  const text = String(source ?? '');
  const offset = Math.max(0, Math.min(text.length, Number(selectionStart) || 0));
  const line = (text.slice(0, offset).match(/\n/g)?.length ?? 0) + 1;
  const controls = listDesignerControls(text);
  const declaration = controls.find(control => control.line === line) ?? null;
  if (declaration) return Object.freeze({ kind: 'control', control: declaration, eventName: null, line });

  const sourceLine = text.split(/\r?\n/)[line - 1] ?? '';
  const eventMatch = sourceLine.match(/^\s*when\s+([A-Za-z_][A-Za-z0-9_]*)\s+([A-Za-z_][A-Za-z0-9_]*)\s*:\s*$/);
  if (!eventMatch) return null;
  const control = controls.find(item => item.id === eventMatch[1]) ?? null;
  if (!control) return null;
  return Object.freeze({ kind: 'event', control, eventName: eventMatch[2], line });
}

function applySourceNavigationTarget(target) {
  const control = target?.control;
  if (!control) return false;
  const formSelect = document.querySelector('#patchFormSelect');
  const selectVisibleControl = () => {
    const element = elementFor(control);
    if (!element) return false;
    const selection = designerSelectionForControl(control);
    if (!selection) return false;
    selectDesignerElement(canvas, element, selection, {
      reason: target.kind === 'event' ? 'source-event-navigation' : 'source-control-navigation'
    });
    if (target.kind === 'event') document.querySelector('#designerEventsTab')?.click();
    return true;
  };

  if (formSelect && Number(formSelect.value) !== Number(control.windowIndex)) {
    formSelect.value = String(control.windowIndex);
    formSelect.dispatchEvent(new Event('change', { bubbles: true }));
    requestAnimationFrame(() => {
      if (!selectVisibleControl()) requestAnimationFrame(selectVisibleControl);
    });
    return true;
  }
  return selectVisibleControl();
}

function installSharedInspectorBridge() {
  const apply = document.querySelector('#designerInspectorApply');
  const remove = document.querySelector('#designerInspectorDelete');
  const source = document.querySelector('#designerInspectorSource');
  apply?.addEventListener('click', captureInspectorApply, { capture: true });
  remove?.addEventListener('click', captureInspectorDelete, { capture: true });
  source?.addEventListener('click', captureInspectorSource, { capture: true });
  for (const field of [
    document.querySelector('#designerInspectorId'),
    document.querySelector('#designerInspectorText'),
    document.querySelector('#designerInspectorOptions'),
    document.querySelector('#designerInspectorSliderMin'),
    document.querySelector('#designerInspectorSliderMax'),
    document.querySelector('#designerInspectorSliderStep')
  ]) {
    field?.addEventListener('keydown', event => {
      if (event.key !== 'Enter' || !currentDesignerSelection(canvas)) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      applySharedInspector();
    }, { capture: true });
  }
}

function captureInspectorApply(event) {
  if (!currentDesignerSelection(canvas)) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  applySharedInspector();
}

function captureInspectorDelete(event) {
  if (!currentDesignerSelection(canvas)) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  dispatchDesignerControlCommand(DESIGNER_CONTROL_COMMANDS.DELETE, { origin: 'inspector-delete' });
}

function captureInspectorSource(event) {
  if (!currentDesignerSelection(canvas)) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  dispatchDesignerControlCommand(DESIGNER_CONTROL_COMMANDS.REVEAL_SOURCE, { origin: 'inspector-source' });
}

function applySharedInspector() {
  const selection = currentDesignerSelection(canvas);
  const selected = currentSharedControl();
  if (!selection || !selected) return;
  try {
    const changes = {};
    if (selected.type !== 'text') changes.id = document.querySelector('#designerInspectorId')?.value ?? '';
    if (['text', 'button', 'checkbox'].includes(selected.type)) {
      changes.textExpr = document.querySelector('#designerInspectorText')?.value ?? '';
    }
    if (['combo', 'listbox', 'radio'].includes(selected.type)) {
      changes.options = splitOptionExpressions(document.querySelector('#designerInspectorOptions')?.value ?? '');
    }
    if (selected.type === 'slider') {
      changes.min = document.querySelector('#designerInspectorSliderMin')?.value ?? selected.min;
      changes.max = document.querySelector('#designerInspectorSliderMax')?.value ?? selected.max;
      changes.step = document.querySelector('#designerInspectorSliderStep')?.value ?? selected.step;
    }
    const next = updateDesignerControl(code.value, selection, changes);
    const updated = listDesignerControls(next).find(control => sameLocation(control, selection));
    if (updated) rememberDesignerSelection(canvas, designerSelectionForControl(updated, selection.adapter), { emit: false });
    setSource(next);
  } catch (error) {
    showInspectorError(error);
  }
}

function populateSharedInspector() {
  const selection = currentDesignerSelection(canvas);
  const control = currentSharedControl();
  const empty = document.querySelector('#designerInspectorEmpty');
  const form = document.querySelector('#designerInspectorForm');
  if (!selection || !control) {
    if (empty) empty.hidden = false;
    if (form) form.hidden = true;
    return;
  }

  if (empty) empty.hidden = true;
  if (form) form.hidden = false;
  const type = document.querySelector('#designerInspectorType');
  const location = document.querySelector('#designerInspectorLocation');
  const idField = document.querySelector('#designerInspectorIdField');
  const textField = document.querySelector('#designerInspectorTextField');
  const optionsField = document.querySelector('#designerInspectorOptionsField');
  const sliderFields = document.querySelector('#designerInspectorSliderFields');
  const id = document.querySelector('#designerInspectorId');
  const text = document.querySelector('#designerInspectorText');
  const options = document.querySelector('#designerInspectorOptions');
  const sliderMin = document.querySelector('#designerInspectorSliderMin');
  const sliderMax = document.querySelector('#designerInspectorSliderMax');
  const sliderStep = document.querySelector('#designerInspectorSliderStep');

  if (type) type.textContent = displayControlType(control.type);
  if (location) location.textContent = inspectorLocation(control);
  if (idField) idField.hidden = control.type === 'text';
  if (textField) textField.hidden = !['text', 'button', 'checkbox'].includes(control.type);
  if (optionsField) optionsField.hidden = !['combo', 'listbox', 'radio'].includes(control.type);
  if (sliderFields) sliderFields.hidden = control.type !== 'slider';
  if (id) id.value = control.id ?? '';
  if (text) text.value = control.textExpr ?? '';
  if (options) options.value = control.options?.join(', ') ?? '';
  if (sliderMin) sliderMin.value = control.type === 'slider' ? String(control.min) : '';
  if (sliderMax) sliderMax.value = control.type === 'slider' ? String(control.max) : '';
  if (sliderStep) sliderStep.value = control.type === 'slider' ? String(control.step) : '';
  clearInspectorError();
}

function currentSharedControl() {
  const selection = currentDesignerSelection(canvas);
  if (!selection) return null;
  return listDesignerControls(code.value).find(control => sameLocation(control, selection)) ?? null;
}

function coreControlFromTarget(target) {
  const element = target?.closest?.('.designer-control');
  if (!element || !canvas.contains(element) || !isCoreElement(element)) return null;
  return element;
}

function isCoreElement(element) {
  if (!element?.classList?.contains('designer-control')) return false;
  if (element.classList.contains('patch-table-stage1-control')) return false;
  if (element.classList.contains('patch-tree-designer-control')) return false;
  if (element.dataset.patchDesignerTree === 'true') return false;
  const adapter = String(element.dataset.patchDesignerAdapter ?? '');
  return !adapter || adapter === 'core';
}

function isCoreType(type) {
  return !['table', 'tree'].includes(String(type ?? ''));
}

function controlFromElement(element, controls = null) {
  const windowIndex = Number(element?.dataset?.windowIndex);
  const controlIndex = Number(element?.dataset?.controlIndex);
  if (!Number.isInteger(windowIndex) || !Number.isInteger(controlIndex)) return null;
  const sourceControls = controls ?? listDesignerControls(code.value);
  const control = sourceControls.find(item => item.windowIndex === windowIndex && item.controlIndex === controlIndex) ?? null;
  return control && isCoreType(control.type) ? control : null;
}

function elementFor(control) {
  return canvas.querySelector(
    `.designer-control[data-window-index="${control.windowIndex}"][data-control-index="${control.controlIndex}"]`
  );
}

function sameLocation(control, selection) {
  return Number(control.windowIndex) === Number(selection.windowIndex) && Number(control.controlIndex) === Number(selection.controlIndex);
}

function displayControlType(type) {
  if (type === 'tree') return 'TreeView';
  if (type === 'combo') return 'ComboBox';
  if (type === 'listbox') return 'ListBox';
  if (type === 'tabs') return 'Tabs';
  if (type === 'table') return 'Table';
  if (type === 'slider') return 'Slider';
  const text = String(type ?? 'Control');
  return text ? text[0].toUpperCase() + text.slice(1) : 'Control';
}

function inspectorLocation(control) {
  let suffix = '';
  if (control.type === 'tree') suffix = ` · ${countTreeNodes(control.treeNodes)} nodes`;
  if (control.type === 'table') suffix = ` · ${(control.columns ?? []).length} columns · ${(control.rows ?? []).length} rows`;
  if (control.type === 'slider') suffix = ` · ${control.min}..${control.max} · step ${control.step}`;
  return `Window ${control.windowIndex + 1} · control ${control.controlIndex + 1} · line ${control.line}${suffix}`;
}

function countTreeNodes(nodes = []) {
  return (nodes ?? []).reduce((count, node) => count + 1 + countTreeNodes(node.children), 0);
}

function splitOptionExpressions(text) {
  const out = [];
  let current = '';
  let quote = null;
  let escaped = false;
  let depth = 0;
  for (const ch of String(text ?? '')) {
    if (quote) {
      current += ch;
      if (escaped) { escaped = false; continue; }
      if (ch === '\\') { escaped = true; continue; }
      if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'") { quote = ch; current += ch; continue; }
    if (ch === '(' || ch === '[') depth += 1;
    if ((ch === ')' || ch === ']') && depth > 0) depth -= 1;
    if (ch === ',' && depth === 0) {
      if (current.trim()) out.push(current.trim());
      current = '';
      continue;
    }
    current += ch;
  }
  if (current.trim()) out.push(current.trim());
  return out;
}

function revealLine(line) {
  const lines = code.value.replace(/\r\n/g, '\n').split('\n');
  let start = 0;
  for (let index = 0; index < line - 1; index += 1) start += lines[index].length + 1;
  const end = start + (lines[line - 1]?.length ?? 0);
  code.focus();
  code.setSelectionRange(start, end);
}

function setSource(source) {
  code.value = source;
  code.dispatchEvent(new Event('input', { bubbles: true }));
  code.dispatchEvent(new Event('change', { bubbles: true }));
  scheduleSync();
}

function showInspectorError(error) {
  const target = document.querySelector('#designerInspectorError');
  if (!target) return;
  target.textContent = error?.message ?? String(error);
  target.hidden = false;
}

function clearInspectorError() {
  const target = document.querySelector('#designerInspectorError');
  if (!target) return;
  target.textContent = '';
  target.hidden = true;
}
