import { parse } from '../src/parser.js';
import { addDesignerControl, listDesignerControls } from '../src/designer.js';
import {
  readWindowPanelPresentation,
  setWindowPanelPresentation
} from '../src/window-layout-policy.js';
import {
  DESIGNER_SELECTION_EVENT,
  currentDesignerSelection,
  designerSelectionForControl,
  rememberDesignerSelection
} from './designer-selection.js';

export const PATCH_DESIGNER_UI_NAMESPACE_VERSION = '0.1';
export const PATCH_DESIGNER_GROUPBOX_VERSION = '0.1';

const doc = typeof document === 'undefined' ? null : document;
const code = doc?.querySelector('#code') ?? null;
const canvas = doc?.querySelector('#designerCanvas') ?? null;

if (doc && code && canvas) queueMicrotask(install);

export function listDesignerUiNamespace(source) {
  const ast = parse(String(source ?? ''));
  const out = [];
  const add = (id, kind, type, line) => {
    const name = String(id ?? '').trim();
    if (!name) return;
    out.push({ id: name, kind, type, line: line ?? null });
  };

  const visitControl = node => {
    if (node.kind === 'uiControl') {
      add(node.id, 'control', node.control, node.line);
      if (node.control === 'panel') {
        for (const nested of node.body ?? []) visitControl(nested);
      }
      return;
    }
    if (node.kind === 'tabs') {
      add(node.id, 'control', 'tabs', node.line);
      for (const page of node.body ?? []) {
        for (const nested of page.body ?? []) visitControl(nested);
      }
    }
  };

  const walk = nodes => {
    for (const node of nodes ?? []) {
      if (node.kind === 'window') {
        for (const child of node.body ?? []) {
          if (child.kind === 'uiControl' || child.kind === 'tabs') visitControl(child);
          else if (child.kind === 'menu') {
            for (const item of child.body ?? []) {
              if (item.kind === 'menuItem') add(item.id, 'menuItem', 'menuItem', item.line);
            }
          }
        }
      } else if (node.kind === 'confirmDialog' || node.kind === 'openFileDialog' || node.kind === 'saveFileDialog') {
        add(node.id, 'resultDialog', node.kind, node.line);
      }

      // Match the Window runtime validator's traversal boundary. Window/Tabs/Menu
      // children were handled structurally above; event/action bodies remain recursive.
      if (node.body && !['window', 'tabs', 'tabPage', 'menu'].includes(node.kind)) walk(node.body);
      if (node.thenBody) walk(node.thenBody);
      if (node.elseBody) walk(node.elseBody);
    }
  };

  walk(ast);
  return out;
}

export function designerUiIdCollision(source, desiredId, currentId = '') {
  const id = String(desiredId ?? '').trim();
  const current = String(currentId ?? '').trim();
  if (!id || id === current) return null;
  return listDesignerUiNamespace(source).find(record => record.id === id) ?? null;
}

export function describeDesignerUiId(record) {
  if (!record) return 'UI object';
  if (record.kind === 'menuItem') return 'MenuItem';
  if (record.kind === 'resultDialog') {
    if (record.type === 'confirmDialog') return 'Confirm dialog';
    if (record.type === 'openFileDialog') return 'Open-file dialog';
    if (record.type === 'saveFileDialog') return 'Save-file dialog';
    return 'Result dialog';
  }
  if (record.type === 'tabs') return 'Tabs';
  if (record.type === 'panel') return 'Panel';
  const type = String(record.type ?? 'control');
  return type ? `${type[0].toUpperCase()}${type.slice(1)} control` : 'Control';
}

function install() {
  if (doc.documentElement.dataset.patchUiNamespaceGuard === 'true') return;
  doc.documentElement.dataset.patchUiNamespaceGuard = 'true';
  doc.addEventListener('click', interceptInspectorApply, { capture: true });
  doc.addEventListener('keydown', interceptInspectorEnter, { capture: true });
  canvas.addEventListener(DESIGNER_SELECTION_EVENT, clearNamespaceError);
  code.addEventListener('input', clearNamespaceError);
  installGroupBoxStage1();
}

function interceptInspectorApply(event) {
  if (!event.target?.closest?.('#designerInspectorApply')) return;
  guardCurrentInspectorId(event);
}

function interceptInspectorEnter(event) {
  if (event.key !== 'Enter' || event.target?.id !== 'designerInspectorId') return;
  guardCurrentInspectorId(event);
}

function guardCurrentInspectorId(event) {
  const selection = currentDesignerSelection(canvas);
  if (!selection) return;
  let control = null;
  try {
    control = listDesignerControls(code.value).find(item =>
      Number(item.windowIndex) === Number(selection.windowIndex) &&
      Number(item.controlIndex) === Number(selection.controlIndex)
    ) ?? null;
  } catch {
    return;
  }
  if (!control || control.type === 'text') return;
  const field = doc.querySelector('#designerInspectorId');
  if (!field) return;
  const collision = designerUiIdCollision(code.value, field.value, control.id ?? '');
  if (!collision) return;

  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation();
  const label = describeDesignerUiId(collision);
  const line = collision.line ? ` at line ${collision.line}` : '';
  showNamespaceError(`UI name '${collision.id}' is already used by ${label}${line}. Choose a unique control name.`);
  field.focus();
  field.select?.();
}

function showNamespaceError(message) {
  const target = doc.querySelector('#designerInspectorError');
  if (!target) return;
  target.textContent = message;
  target.hidden = false;
  target.dataset.patchUiNamespaceError = 'true';
}

function clearNamespaceError() {
  const target = doc?.querySelector('#designerInspectorError');
  if (!target || target.dataset.patchUiNamespaceError !== 'true') return;
  target.hidden = true;
  target.textContent = '';
  delete target.dataset.patchUiNamespaceError;
}

function installGroupBoxStage1() {
  if (doc.documentElement.dataset.patchGroupBoxStage1 === 'true') return;
  doc.documentElement.dataset.patchGroupBoxStage1 = 'true';
  installGroupBoxStyles();
  installGroupBoxButton();
  installGroupBoxInspector();

  let queued = false;
  const schedule = () => {
    if (queued) return;
    queued = true;
    queueMicrotask(() => {
      queued = false;
      syncGroupBoxPresentation();
    });
  };
  code.addEventListener('input', schedule);
  code.addEventListener('change', schedule);
  canvas.addEventListener(DESIGNER_SELECTION_EVENT, schedule);
  new MutationObserver(schedule).observe(canvas, { childList: true, subtree: true });
  schedule();
}

function installGroupBoxStyles() {
  if (doc.querySelector('style[data-patch-groupbox-stage1]')) return;
  const style = doc.createElement('style');
  style.dataset.patchGroupboxStage1 = PATCH_DESIGNER_GROUPBOX_VERSION;
  style.textContent = `
.patch-panel.patch-groupbox{overflow:visible;border-color:color-mix(in srgb,var(--accent) 32%,var(--border));background:var(--surface)}
.patch-panel.patch-groupbox>.patch-panel-legend,.patch-panel.patch-groupbox>.patch-panel-title{display:inline-flex;align-items:center;width:auto;max-width:calc(100% - 24px);min-height:22px;margin:-10px 0 0 12px;padding:2px 7px;border:0;background:var(--surface);color:var(--text);font-size:12px;font-weight:750;letter-spacing:0;text-transform:none;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.patch-panel.patch-groupbox>.patch-panel-surface{height:calc(100% - 18px);margin-top:2px}
.designer-groupbox-mode{display:grid;grid-template-columns:1fr auto;gap:8px;align-items:end;margin:0 0 12px}.designer-groupbox-mode label{display:grid;gap:5px;font-size:12px}.designer-groupbox-mode select{min-width:0}
`;
  doc.head.appendChild(style);
}

function installGroupBoxButton() {
  const toolbar = doc.querySelector('#designer .designer-toolbar');
  if (!toolbar || toolbar.querySelector('#addGroupBox')) return;
  const button = doc.createElement('button');
  button.id = 'addGroupBox';
  button.className = 'secondary small';
  button.type = 'button';
  button.textContent = '+ GroupBox';
  button.setAttribute('aria-label', 'Add GroupBox');
  button.title = 'Add a source-backed GroupBox presentation of Panel to the active Form';
  toolbar.appendChild(button);
  button.addEventListener('click', event => {
    event.preventDefault();
    event.stopImmediatePropagation();
    try {
      const windowIndex = Number(doc.querySelector('#patchFormSelect')?.value) || 0;
      const withPanel = addDesignerControl(code.value, 'panel', { windowIndex });
      const panel = listDesignerControls(withPanel)
        .filter(control => control.windowIndex === windowIndex && control.type === 'panel')
        .at(-1);
      if (!panel) throw new Error('Designer did not create the GroupBox Panel.');
      const next = setWindowPanelPresentation(withPanel, panel.line, 'group');
      setGroupBoxSource(next);
      rememberDesignerSelection(canvas, designerSelectionForControl(panel, 'core'), { reason: 'add-groupbox' });
    } catch (error) {
      showNamespaceError(error?.message ?? String(error));
    }
  }, { capture: true });
}

function installGroupBoxInspector() {
  const panelEditor = doc.querySelector('#designerPanelEditor');
  if (!panelEditor || panelEditor.querySelector('#designerPanelPresentation')) return;
  const row = doc.createElement('div');
  row.className = 'designer-groupbox-mode';
  row.innerHTML = `
    <label>Panel presentation
      <select id="designerPanelPresentation">
        <option value="plain">Panel</option>
        <option value="group">GroupBox</option>
      </select>
    </label>
    <span class="inspector-hint">source-backed</span>`;
  panelEditor.insertBefore(row, panelEditor.children[1] ?? null);
  row.querySelector('#designerPanelPresentation')?.addEventListener('change', event => {
    const control = selectedPanelControl();
    if (!control) return;
    try {
      setGroupBoxSource(setWindowPanelPresentation(code.value, control.line, event.target.value));
    } catch (error) {
      showNamespaceError(error?.message ?? String(error));
    }
  });
}

function selectedPanelControl() {
  const selection = currentDesignerSelection(canvas);
  if (!selection) return null;
  try {
    return listDesignerControls(code.value).find(item =>
      item.type === 'panel' &&
      Number(item.windowIndex) === Number(selection.windowIndex) &&
      Number(item.controlIndex) === Number(selection.controlIndex)
    ) ?? null;
  } catch {
    return null;
  }
}

function syncGroupBoxPresentation() {
  let controls = [];
  try { controls = listDesignerControls(code.value).filter(control => control.type === 'panel'); }
  catch { return; }
  const modes = new Map();
  for (const control of controls) {
    let mode = 'plain';
    try { mode = readWindowPanelPresentation(code.value, control.line); } catch { continue; }
    modes.set(`${control.windowIndex}:${control.controlIndex}`, { mode, id: control.id ?? '' });
  }

  for (const element of canvas.querySelectorAll('.patch-panel[data-patch-panel-adapter="true"]')) {
    const key = `${element.dataset.windowIndex}:${element.dataset.controlIndex}`;
    const record = modes.get(key);
    decorateGroupBoxElement(element, record?.mode === 'group', record?.id || element.dataset.panelId || '');
  }

  const groupIds = new Set([...modes.values()].filter(record => record.mode === 'group').map(record => record.id).filter(Boolean));
  for (const element of doc.querySelectorAll('.patch-panel-runtime[data-patch-panel-runtime="true"]')) {
    const aria = String(element.getAttribute('aria-label') ?? '');
    const id = element.dataset.patchPanelId || (aria.startsWith('Panel ') ? aria.slice(6) : '');
    if (id) element.dataset.patchPanelId = id;
    decorateGroupBoxElement(element, groupIds.has(id), id);
  }

  const select = doc.querySelector('#designerPanelPresentation');
  const selected = selectedPanelControl();
  if (select && selected) {
    try { select.value = readWindowPanelPresentation(code.value, selected.line); }
    catch { select.value = 'plain'; }
  }
}

function decorateGroupBoxElement(element, group, id) {
  element.classList.toggle('patch-groupbox', Boolean(group));
  element.dataset.patchPanelPresentation = group ? 'group' : 'plain';
  const title = element.querySelector(':scope > .patch-panel-legend, :scope > .patch-panel-title');
  if (!group) {
    const plainTitle = String(id ?? '').trim() || 'Panel';
    if (title && title.textContent !== plainTitle) title.textContent = plainTitle;
    if (element.classList.contains('patch-panel-runtime')) {
      element.setAttribute('aria-label', id ? `Panel ${id}` : 'Panel');
    } else if (id) {
      element.setAttribute('aria-label', `Select Panel ${id}`);
    }
    return;
  }
  const caption = groupBoxCaption(id);
  if (title && title.textContent !== caption) title.textContent = caption;
  if (caption) element.setAttribute('aria-label', `GroupBox ${caption}`);
}

function groupBoxCaption(id) {
  const raw = String(id ?? '').trim();
  if (!raw) return 'Group';
  return raw.replace(/[_-]+/g, ' ').replace(/\b[a-z]/g, letter => letter.toUpperCase());
}

function setGroupBoxSource(next) {
  if (typeof next !== 'string' || next === code.value) return;
  code.value = next;
  code.dispatchEvent(new Event('input', { bubbles: true }));
  code.dispatchEvent(new Event('change', { bubbles: true }));
}
