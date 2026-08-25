import { addDesignerControl, listDesignerControls } from '../src/designer.js';
import {
  PANEL_CHILD_TYPES,
  addDesignerPanelChild,
  duplicateDesignerPanelChild,
  listDesignerPanels,
  moveDesignerPanelChild,
  removeDesignerPanelChild,
  updateDesignerPanelChild
} from '../src/designer-panel.js';
import {
  designerEventSpec,
  ensureDesignerEventHandler
} from './designer-event-inspector.js';
import {
  DESIGNER_SELECTION_EVENT,
  currentDesignerSelection,
  designerSelectionForControl,
  rememberDesignerSelection
} from './designer-selection.js';

export const PATCH_DESIGNER_PANEL_VERSION = '0.1';

const doc = typeof document === 'undefined' ? null : document;
const code = doc?.querySelector('#code') ?? null;
const canvas = doc?.querySelector('#designerCanvas') ?? null;
const designer = doc?.querySelector('#designer') ?? null;
const toolbar = doc?.querySelector('#designer .designer-toolbar') ?? null;
let queued = false;
let selectedChildIndex = 0;

if (doc) {
  installStylesheet();
  queueMicrotask(install);
}

export function panelPreviewLabel(child) {
  if (!child) return '';
  const literal = expressionLabel(child.textExpr);
  if (literal) return literal;
  if (child.type === 'slider') return `${child.id ?? 'Slider'} ${child.min ?? 0}..${child.max ?? 100}`;
  if (child.options?.length) return `${displayType(child.type)} · ${child.options.map(expressionLabel).filter(Boolean).join(' / ')}`;
  return child.id || displayType(child.type);
}

function install() {
  if (!designer || !toolbar || !canvas || !code || designer.dataset.patchPanelRad === 'true') return;
  designer.dataset.patchPanelRad = 'true';
  installPanelButton();
  installPanelInspector();
  code.addEventListener('input', scheduleSync);
  code.addEventListener('change', scheduleSync);
  canvas.addEventListener(DESIGNER_SELECTION_EVENT, () => {
    selectedChildIndex = 0;
    scheduleSync();
  });
  doc.querySelector('#patchFormSelect')?.addEventListener('change', scheduleSync);
  new MutationObserver(scheduleSync).observe(canvas, { childList: true, subtree: true });
  scheduleSync();
}

function installPanelButton() {
  if (toolbar.querySelector('#addPanel')) return;
  const button = doc.createElement('button');
  button.id = 'addPanel';
  button.className = 'secondary small';
  button.type = 'button';
  button.textContent = '+ Panel';
  button.setAttribute('aria-label', 'Add Panel');
  button.title = 'Add a source-backed flow-layout Panel to the active Form';
  toolbar.appendChild(button);
  button.addEventListener('click', event => {
    event.preventDefault();
    event.stopImmediatePropagation();
    try {
      const windowIndex = activeFormIndex();
      const next = addDesignerControl(code.value, 'panel', { windowIndex });
      const panel = listDesignerControls(next)
        .filter(control => control.windowIndex === windowIndex && control.type === 'panel')
        .at(-1);
      setSource(next);
      if (panel) rememberDesignerSelection(canvas, designerSelectionForControl(panel, 'core'), { reason: 'add-panel' });
      scheduleSync();
    } catch (error) {
      showError(error);
    }
  }, { capture: true });
}

function installPanelInspector() {
  const form = doc.querySelector('#designerInspectorForm');
  if (!form || form.querySelector('#designerPanelEditor')) return;
  const section = doc.createElement('section');
  section.id = 'designerPanelEditor';
  section.className = 'designer-panel-editor';
  section.hidden = true;
  section.innerHTML = `
    <div class="designer-panel-editor-heading">
      <strong>Panel children</strong>
      <span id="designerPanelChildCount" class="inspector-hint"></span>
    </div>
    <p class="inspector-hint">Panel Stage 1 uses source-backed flow layout. Child geometry is intentionally not stored independently.</p>
    <select id="designerPanelChildList" size="6" aria-label="Controls inside selected Panel"></select>
    <div class="designer-panel-add-row">
      <select id="designerPanelChildType" aria-label="Panel child type"></select>
      <button id="designerPanelAddChild" class="secondary" type="button">Add</button>
    </div>
    <div class="designer-panel-actions">
      <button id="designerPanelEarlier" class="secondary" type="button" title="Move child earlier">↑</button>
      <button id="designerPanelLater" class="secondary" type="button" title="Move child later">↓</button>
      <button id="designerPanelDuplicate" class="secondary" type="button">Duplicate</button>
      <button id="designerPanelDeleteChild" class="secondary" type="button">Delete child</button>
    </div>
    <div id="designerPanelChildProperties" class="designer-panel-child-properties">
      <label id="designerPanelChildIdField" class="inspector-field">Name <input id="designerPanelChildId" autocomplete="off" spellcheck="false"></label>
      <label id="designerPanelChildTextField" class="inspector-field">Text expression <input id="designerPanelChildText" autocomplete="off" spellcheck="false"></label>
      <label id="designerPanelChildOptionsField" class="inspector-field">Options <input id="designerPanelChildOptions" autocomplete="off" spellcheck="false" placeholder='"One", "Two"'></label>
      <div id="designerPanelChildSliderFields" class="forms-geometry-grid">
        <strong>Slider range</strong>
        <label>Min <input id="designerPanelChildMin" inputmode="decimal"></label>
        <label>Max <input id="designerPanelChildMax" inputmode="decimal"></label>
        <label>Step <input id="designerPanelChildStep" inputmode="decimal"></label>
      </div>
      <div class="designer-panel-actions">
        <button id="designerPanelApplyChild" class="secondary" type="button">Apply child</button>
        <button id="designerPanelChildEvent" class="secondary" type="button">Event…</button>
        <button id="designerPanelChildSource" class="secondary" type="button">Source</button>
      </div>
    </div>`;

  const actions = form.querySelector('.inspector-actions');
  actions?.insertAdjacentElement('beforebegin', section);
  const typeSelect = section.querySelector('#designerPanelChildType');
  for (const type of PANEL_CHILD_TYPES) {
    const option = doc.createElement('option');
    option.value = type;
    option.textContent = displayType(type);
    typeSelect.appendChild(option);
  }

  section.querySelector('#designerPanelChildList').addEventListener('change', event => {
    selectedChildIndex = Number(event.target.value) || 0;
    renderPanelInspector();
  });
  section.querySelector('#designerPanelAddChild').addEventListener('click', addChild);
  section.querySelector('#designerPanelEarlier').addEventListener('click', () => moveChild('earlier'));
  section.querySelector('#designerPanelLater').addEventListener('click', () => moveChild('later'));
  section.querySelector('#designerPanelDuplicate').addEventListener('click', duplicateChild);
  section.querySelector('#designerPanelDeleteChild').addEventListener('click', deleteChild);
  section.querySelector('#designerPanelApplyChild').addEventListener('click', applyChild);
  section.querySelector('#designerPanelChildEvent').addEventListener('click', openChildEvent);
  section.querySelector('#designerPanelChildSource').addEventListener('click', revealChildSource);
  section.addEventListener('keydown', event => {
    if (event.key !== 'Enter' || !(event.ctrlKey || event.metaKey)) return;
    if (!event.target?.matches?.('input')) return;
    event.preventDefault();
    applyChild();
  });
}

function scheduleSync() {
  if (queued) return;
  queued = true;
  queueMicrotask(() => {
    queued = false;
    try {
      renderPanels();
      renderPanelInspector();
    } catch {
      // Source may be temporarily incomplete while typing.
    }
  });
}

function renderPanels() {
  let controls = [];
  let panels = [];
  try {
    controls = listDesignerControls(code.value);
    panels = listDesignerPanels(code.value);
  } catch {
    return;
  }
  const live = new Set();
  for (const panel of panels) {
    const control = controls.find(item => item.windowIndex === panel.windowIndex && item.type === 'panel' && item.id === panel.id);
    if (!control) continue;
    const shell = canvas.querySelectorAll('.patch-window')[panel.windowIndex];
    const body = shell?.querySelector(':scope > .patch-window-body');
    if (!body) continue;
    const key = `${panel.windowIndex}:${control.controlIndex}`;
    live.add(key);
    let element = body.querySelector(`:scope > .patch-panel[data-patch-panel-adapter="true"][data-control-index="${control.controlIndex}"]`);
    if (!element) {
      element = doc.createElement('section');
      element.className = 'patch-panel designer-control';
      element.dataset.patchPanelAdapter = 'true';
      element.tabIndex = 0;
      body.prepend(element);
    }
    element.dataset.windowIndex = String(panel.windowIndex);
    element.dataset.controlIndex = String(control.controlIndex);
    element.dataset.panelId = panel.id ?? '';
    element.setAttribute('aria-label', `Select Panel ${panel.id ?? control.controlIndex + 1}`);
    const signature = JSON.stringify(panel.children.map(child => [child.type, child.id, child.textExpr, child.options, child.min, child.max, child.step]));
    if (element.dataset.panelSignature !== signature) {
      element.dataset.panelSignature = signature;
      renderPanelBody(element, panel);
    }
    const x = Number.isInteger(panel.x) ? panel.x : 24;
    const y = Number.isInteger(panel.y) ? panel.y : 24 + control.controlIndex * 48;
    const width = Number.isInteger(panel.width) ? panel.width : 280;
    const height = Number.isInteger(panel.height) ? panel.height : 160;
    Object.assign(element.style, {
      position: 'absolute',
      left: `${x}px`,
      top: `${y}px`,
      width: `${width}px`,
      height: `${height}px`,
      maxWidth: 'none',
      margin: '0'
    });
  }

  for (const stale of canvas.querySelectorAll('.patch-panel[data-patch-panel-adapter="true"]')) {
    const key = `${stale.dataset.windowIndex}:${stale.dataset.controlIndex}`;
    if (!live.has(key)) stale.remove();
  }
}

function renderPanelBody(element, panel) {
  element.replaceChildren();
  const legend = doc.createElement('div');
  legend.className = 'patch-panel-legend';
  legend.textContent = panel.id || 'Panel';
  const flow = doc.createElement('div');
  flow.className = 'patch-panel-flow';
  for (const child of panel.children) {
    const item = doc.createElement('div');
    item.className = `patch-panel-child patch-panel-child-${child.type}`;
    item.dataset.panelChildIndex = String(child.childIndex);
    const type = doc.createElement('span');
    type.className = 'patch-panel-child-type';
    type.textContent = displayType(child.type);
    const label = doc.createElement('span');
    label.className = 'patch-panel-child-label';
    label.textContent = panelPreviewLabel(child);
    item.append(type, label);
    flow.appendChild(item);
  }
  if (!panel.children.length) {
    const empty = doc.createElement('div');
    empty.className = 'patch-panel-empty';
    empty.textContent = 'Empty Panel';
    flow.appendChild(empty);
  }
  element.append(legend, flow);
}

function renderPanelInspector() {
  const section = doc.querySelector('#designerPanelEditor');
  if (!section) return;
  const selection = currentDesignerSelection(canvas);
  let control = null;
  let panel = null;
  try {
    control = selection
      ? listDesignerControls(code.value).find(item => sameLocation(item, selection)) ?? null
      : null;
    if (control?.type === 'panel') {
      panel = listDesignerPanels(code.value).find(item => item.windowIndex === control.windowIndex && item.id === control.id) ?? null;
    }
  } catch {
    control = null;
    panel = null;
  }
  section.hidden = !panel;
  if (!panel) return;

  const location = doc.querySelector('#designerInspectorLocation');
  if (location && !location.textContent.includes('children')) {
    location.textContent += ` · ${panel.children.length} children · flow layout`;
  }
  const list = section.querySelector('#designerPanelChildList');
  list.replaceChildren();
  selectedChildIndex = Math.max(0, Math.min(selectedChildIndex, Math.max(0, panel.children.length - 1)));
  for (const child of panel.children) {
    const option = doc.createElement('option');
    option.value = String(child.childIndex);
    option.textContent = `${child.childIndex + 1}. ${displayType(child.type)}${child.id ? ` · ${child.id}` : ''} · ${panelPreviewLabel(child)}`;
    option.selected = child.childIndex === selectedChildIndex;
    list.appendChild(option);
  }
  if (!panel.children.length) {
    const option = doc.createElement('option');
    option.textContent = 'No children';
    option.disabled = true;
    option.selected = true;
    list.appendChild(option);
  }
  section.querySelector('#designerPanelChildCount').textContent = `${panel.children.length}`;
  renderChildProperties(panel.children[selectedChildIndex] ?? null, panel);
}

function renderChildProperties(child, panel) {
  const section = doc.querySelector('#designerPanelEditor');
  if (!section) return;
  const properties = section.querySelector('#designerPanelChildProperties');
  properties.hidden = !child;
  const earlier = section.querySelector('#designerPanelEarlier');
  const later = section.querySelector('#designerPanelLater');
  const duplicate = section.querySelector('#designerPanelDuplicate');
  const remove = section.querySelector('#designerPanelDeleteChild');
  if (earlier) earlier.disabled = !child || child.childIndex <= 0;
  if (later) later.disabled = !child || child.childIndex >= panel.children.length - 1;
  if (duplicate) duplicate.disabled = !child;
  if (remove) remove.disabled = !child;
  if (!child) return;

  const idField = section.querySelector('#designerPanelChildIdField');
  const textField = section.querySelector('#designerPanelChildTextField');
  const optionsField = section.querySelector('#designerPanelChildOptionsField');
  const sliderFields = section.querySelector('#designerPanelChildSliderFields');
  const id = section.querySelector('#designerPanelChildId');
  const text = section.querySelector('#designerPanelChildText');
  const options = section.querySelector('#designerPanelChildOptions');
  const min = section.querySelector('#designerPanelChildMin');
  const max = section.querySelector('#designerPanelChildMax');
  const step = section.querySelector('#designerPanelChildStep');
  if (idField) idField.hidden = child.type === 'text';
  if (textField) textField.hidden = !['text', 'button', 'checkbox'].includes(child.type);
  if (optionsField) optionsField.hidden = !['radio', 'combo', 'listbox'].includes(child.type);
  if (sliderFields) sliderFields.hidden = child.type !== 'slider';
  if (id) id.value = child.id ?? '';
  if (text) text.value = child.textExpr ?? '';
  if (options) options.value = child.options?.join(', ') ?? '';
  if (min) min.value = child.type === 'slider' ? String(child.min) : '';
  if (max) max.value = child.type === 'slider' ? String(child.max) : '';
  if (step) step.value = child.type === 'slider' ? String(child.step) : '';
  const event = designerEventSpec(child.type);
  const eventButton = section.querySelector('#designerPanelChildEvent');
  if (eventButton) {
    eventButton.disabled = !child.id || !event;
    eventButton.textContent = event ? event.label : 'No event';
    eventButton.title = event ? `Create or open ${event.label} handler in Patch source` : 'This Panel child has no Patch event.';
  }
}

function addChild() {
  const selected = currentPanel();
  if (!selected) return;
  const type = doc.querySelector('#designerPanelChildType')?.value ?? 'button';
  mutate(() => {
    const result = addDesignerPanelChild(code.value, selected.panel, type);
    selectedChildIndex = result.child?.childIndex ?? selected.panel.children.length;
    return result.source;
  });
}

function moveChild(direction) {
  const selected = currentPanelChild();
  if (!selected) return;
  mutate(() => {
    const result = moveDesignerPanelChild(code.value, { ...selected.panel, childIndex: selected.child.childIndex }, direction);
    if (result.moved && result.child) selectedChildIndex = result.child.childIndex;
    return result.source;
  });
}

function duplicateChild() {
  const selected = currentPanelChild();
  if (!selected) return;
  mutate(() => {
    const result = duplicateDesignerPanelChild(code.value, { ...selected.panel, childIndex: selected.child.childIndex });
    if (result.child) selectedChildIndex = result.child.childIndex;
    return result.source;
  });
}

function deleteChild() {
  const selected = currentPanelChild();
  if (!selected) return;
  mutate(() => {
    const next = removeDesignerPanelChild(code.value, { ...selected.panel, childIndex: selected.child.childIndex });
    selectedChildIndex = Math.max(0, selectedChildIndex - 1);
    return next;
  });
}

function applyChild() {
  const selected = currentPanelChild();
  if (!selected) return;
  const section = doc.querySelector('#designerPanelEditor');
  const changes = {};
  if (selected.child.type !== 'text') changes.id = section.querySelector('#designerPanelChildId')?.value ?? selected.child.id;
  if (['text', 'button', 'checkbox'].includes(selected.child.type)) {
    changes.textExpr = section.querySelector('#designerPanelChildText')?.value ?? selected.child.textExpr;
  }
  if (['radio', 'combo', 'listbox'].includes(selected.child.type)) {
    changes.options = splitExpressions(section.querySelector('#designerPanelChildOptions')?.value ?? '');
  }
  if (selected.child.type === 'slider') {
    changes.min = section.querySelector('#designerPanelChildMin')?.value ?? selected.child.min;
    changes.max = section.querySelector('#designerPanelChildMax')?.value ?? selected.child.max;
    changes.step = section.querySelector('#designerPanelChildStep')?.value ?? selected.child.step;
  }
  mutate(() => updateDesignerPanelChild(code.value, { ...selected.panel, childIndex: selected.child.childIndex }, changes).source);
}

function openChildEvent() {
  const selected = currentPanelChild();
  if (!selected?.child?.id) return;
  try {
    const result = ensureDesignerEventHandler(code.value, selected.child.id, selected.child.type);
    if (result.source !== code.value) setSource(result.source);
    revealLine(result.handler.line);
  } catch (error) {
    showError(error);
  }
}

function revealChildSource() {
  const selected = currentPanelChild();
  if (selected) revealLine(selected.child.line);
}

function mutate(operation) {
  try {
    const next = operation();
    setSource(next);
    scheduleSync();
  } catch (error) {
    showError(error);
  }
}

function currentPanel() {
  const selection = currentDesignerSelection(canvas);
  if (!selection) return null;
  try {
    const control = listDesignerControls(code.value).find(item => sameLocation(item, selection));
    if (control?.type !== 'panel') return null;
    const panel = listDesignerPanels(code.value).find(item => item.windowIndex === control.windowIndex && item.id === control.id);
    return panel ? { control, panel } : null;
  } catch {
    return null;
  }
}

function currentPanelChild() {
  const selected = currentPanel();
  if (!selected) return null;
  const child = selected.panel.children[selectedChildIndex] ?? null;
  return child ? { ...selected, child } : null;
}

function setSource(source) {
  code.value = source;
  code.dispatchEvent(new Event('input', { bubbles: true }));
  code.dispatchEvent(new Event('change', { bubbles: true }));
}

function revealLine(line) {
  const lines = code.value.replace(/\r\n/g, '\n').split('\n');
  let start = 0;
  for (let index = 0; index < line - 1; index += 1) start += (lines[index]?.length ?? 0) + 1;
  const end = start + (lines[line - 1]?.length ?? 0);
  code.focus();
  code.setSelectionRange(start, end);
}

function activeFormIndex() {
  const value = Number(doc.querySelector('#patchFormSelect')?.value);
  return Number.isInteger(value) && value >= 0 ? value : 0;
}

function sameLocation(control, selection) {
  return Number(control?.windowIndex) === Number(selection?.windowIndex) && Number(control?.controlIndex) === Number(selection?.controlIndex);
}

function displayType(type) {
  if (type === 'combo') return 'ComboBox';
  if (type === 'listbox') return 'ListBox';
  const text = String(type ?? 'Control');
  return text ? text[0].toUpperCase() + text.slice(1) : 'Control';
}

function expressionLabel(expression) {
  const text = String(expression ?? '').trim();
  if (!text) return '';
  if (text.startsWith('"') && text.endsWith('"')) {
    try { return JSON.parse(text); } catch { return text.slice(1, -1); }
  }
  if (text.startsWith("'") && text.endsWith("'")) return text.slice(1, -1);
  return text;
}

function splitExpressions(text) {
  const out = [];
  let current = '';
  let quote = null;
  let escaped = false;
  for (const ch of String(text ?? '')) {
    if (quote) {
      current += ch;
      if (escaped) { escaped = false; continue; }
      if (ch === '\\') { escaped = true; continue; }
      if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'") { quote = ch; current += ch; continue; }
    if (ch === ',') {
      if (current.trim()) out.push(current.trim());
      current = '';
      continue;
    }
    current += ch;
  }
  if (current.trim()) out.push(current.trim());
  return out;
}

function showError(error) {
  const target = doc.querySelector('#designerInspectorError');
  if (!target) return;
  target.textContent = error?.message ?? String(error);
  target.hidden = false;
}

function installStylesheet() {
  if (doc.querySelector('link[data-patch-panel-rad]')) return;
  const link = doc.createElement('link');
  link.rel = 'stylesheet';
  link.href = './designer-panel.css';
  link.dataset.patchPanelRad = '1';
  doc.head.appendChild(link);
}
