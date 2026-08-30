import { compile } from './src/compiler.js?v=868f0784ca7f3972';
import { listDesignerControls } from './src/designer.js?v=868f0784ca7f3972';
import {
  DESIGNER_SELECTION_EVENT,
  currentDesignerSelection,
  designerSelectionForControl,
  selectDesignerElement
} from './designer-selection.js?v=868f0784ca7f3972';

const doc = typeof document === 'undefined' ? null : document;
const code = doc?.querySelector('#code') ?? null;
const canvas = doc?.querySelector('#designerCanvas') ?? null;
const inspector = doc?.querySelector('#designerInspector') ?? null;
const DOUBLE_CLICK_TYPES = new Set(['button', 'input', 'checkbox', 'radio', 'combo', 'listbox', 'slider', 'paintbox']);
let cachedSource = null;
let cachedControls = [];
let cachedPickerSignature = null;
let syncQueued = false;

const EVENT_SPECS = Object.freeze({
  button: Object.freeze({ event: 'clicked', label: 'OnClick', value: false }),
  picture: Object.freeze({ event: 'clicked', label: 'OnClick', value: false }),
  paintbox: Object.freeze({ event: 'paint', label: 'OnPaint', value: false }),
  timer: Object.freeze({ event: 'ticked', label: 'OnTick', value: false }),
  input: Object.freeze({ event: 'changed', label: 'OnChange', value: true }),
  checkbox: Object.freeze({ event: 'changed', label: 'OnChange', value: true }),
  radio: Object.freeze({ event: 'changed', label: 'OnChange', value: true }),
  combo: Object.freeze({ event: 'changed', label: 'OnChange', value: true }),
  listbox: Object.freeze({ event: 'changed', label: 'OnChange', value: true }),
  slider: Object.freeze({ event: 'changed', label: 'OnChange', value: true }),
  table: Object.freeze({ event: 'changed', label: 'OnChange', value: true }),
  tree: Object.freeze({ event: 'changed', label: 'OnChange', value: true })
});

if (doc) queueMicrotask(install);

export function designerEventSpec(type) {
  const spec = EVENT_SPECS[String(type ?? '')];
  return spec ? { ...spec } : null;
}

export function findDesignerEventHandler(source, id, eventName) {
  const safeId = String(id ?? '').trim();
  const safeEvent = String(eventName ?? '').trim();
  if (!safeId || !safeEvent) return null;
  const pattern = new RegExp(`^\\s*when\\s+${escapeRegExp(safeId)}\\s+${escapeRegExp(safeEvent)}\\s*:\\s*$`);
  const lines = String(source ?? '').replace(/\r\n/g, '\n').split('\n');
  let offset = 0;
  for (let index = 0; index < lines.length; index += 1) {
    if (pattern.test(lines[index])) {
      return { line: index + 1, start: offset, end: offset + lines[index].length };
    }
    offset += lines[index].length + 1;
  }
  return null;
}

export function ensureDesignerEventHandler(source, id, type) {
  const safeId = String(id ?? '').trim();
  if (!/^[A-Za-z_]\w*$/.test(safeId)) throw new Error('The selected control needs a named Patch id before an event handler can be created.');
  const spec = designerEventSpec(type);
  if (!spec) throw new Error(`${displayType(type)} does not expose a Patch event in the current Designer contract.`);
  const existing = findDesignerEventHandler(source, safeId, spec.event);
  if (existing) return { source: String(source ?? ''), created: false, handler: existing, spec };

  const original = String(source ?? '').replace(/\r\n/g, '\n');
  const trimmed = original.replace(/\s+$/, '');
  const statement = type === 'paintbox'
    ? '  draw clear transparent'
    : spec.value
      ? '  show value'
      : `  show ${JSON.stringify(`${safeId} ${spec.event}`)}`;
  const next = `${trimmed}${trimmed ? '\n\n' : ''}when ${safeId} ${spec.event}:\n${statement}\n`;

  // Event generation must never leave the visible source in a syntactically invalid state.
  compile(next, { name: 'PatchStudioEventHandler', entry: 'main.patch' });
  const handler = findDesignerEventHandler(next, safeId, spec.event);
  if (!handler) throw new Error('Patch Studio could not locate the generated event handler.');
  return { source: next, created: true, handler, spec };
}

function install() {
  if (!inspector || !code || !canvas || inspector.dataset.patchEventInspector === 'true') return;
  inspector.dataset.patchEventInspector = 'true';
  installStyles();

  const heading = inspector.querySelector('h3');
  const tabs = doc.createElement('div');
  tabs.className = 'designer-object-inspector-tabs';
  tabs.setAttribute('role', 'tablist');
  tabs.setAttribute('aria-label', 'Object Inspector view');
  tabs.innerHTML = `
    <button id="designerPropertiesTab" class="active" type="button" role="tab" aria-selected="true">Properties</button>
    <button id="designerEventsTab" type="button" role="tab" aria-selected="false">Events</button>`;

  const objectPicker = doc.createElement('label');
  objectPicker.className = 'designer-object-picker';
  objectPicker.innerHTML = '<span>Object</span><select id="designerObjectSelect" aria-label="Select Designer object"></select>';

  const eventPanel = doc.createElement('section');
  eventPanel.id = 'designerEventsPanel';
  eventPanel.className = 'designer-events-panel';
  eventPanel.setAttribute('role', 'tabpanel');
  eventPanel.hidden = true;

  if (heading) heading.insertAdjacentElement('afterend', tabs);
  else inspector.prepend(tabs);
  tabs.insertAdjacentElement('afterend', objectPicker);
  objectPicker.insertAdjacentElement('afterend', eventPanel);

  tabs.querySelector('#designerPropertiesTab')?.addEventListener('click', () => setView('properties'));
  tabs.querySelector('#designerEventsTab')?.addEventListener('click', () => setView('events'));
  objectPicker.querySelector('select')?.addEventListener('change', selectObjectFromPicker);

  canvas.addEventListener(DESIGNER_SELECTION_EVENT, scheduleSync);
  code.addEventListener('input', scheduleSync);
  code.addEventListener('change', scheduleSync);
  canvas.addEventListener('dblclick', handleDesignerDoubleClick, { capture: true });
  new MutationObserver(scheduleSync).observe(inspector, { childList: true, subtree: false });
  sync();
}

function scheduleSync() {
  if (syncQueued) return;
  syncQueued = true;
  queueMicrotask(() => {
    syncQueued = false;
    sync();
  });
}

function setView(view) {
  const events = view === 'events';
  inspector.dataset.objectInspectorView = events ? 'events' : 'properties';
  const propertiesTab = inspector.querySelector('#designerPropertiesTab');
  const eventsTab = inspector.querySelector('#designerEventsTab');
  if (propertiesTab) {
    propertiesTab.classList.toggle('active', !events);
    propertiesTab.setAttribute('aria-selected', events ? 'false' : 'true');
  }
  if (eventsTab) {
    eventsTab.classList.toggle('active', events);
    eventsTab.setAttribute('aria-selected', events ? 'true' : 'false');
  }
  const panel = inspector.querySelector('#designerEventsPanel');
  if (panel) panel.hidden = !events;
  syncPropertyVisibility(events);
  if (events) renderEventsPanel();
}

function syncPropertyVisibility(eventsView) {
  const selection = currentDesignerSelection(canvas);
  const propertyForm = inspector.querySelector('#designerInspectorForm');
  const empty = inspector.querySelector('#designerInspectorEmpty');
  if (eventsView) {
    if (propertyForm) propertyForm.hidden = true;
    if (empty) empty.hidden = true;
    return;
  }
  if (propertyForm) propertyForm.hidden = !selection;
  if (empty) empty.hidden = Boolean(selection);
}

function sync() {
  syncObjectPicker();
  const eventsView = inspector?.dataset.objectInspectorView === 'events';
  syncPropertyVisibility(eventsView);
  if (eventsView) renderEventsPanel();
}

function syncObjectPicker() {
  const select = inspector?.querySelector('#designerObjectSelect');
  if (!select) return;
  const controls = safeControls();
  const selection = currentDesignerSelection(canvas);
  const selectedKey = selection ? `${selection.windowIndex}:${selection.controlIndex}` : '';
  const previous = select.value;
  const signature = controls.map(control => `${control.windowIndex}:${control.controlIndex}:${control.type}:${control.id ?? ''}`).join('|');

  if (signature !== cachedPickerSignature) {
    cachedPickerSignature = signature;
    select.replaceChildren();
    const prompt = doc.createElement('option');
    prompt.value = '';
    prompt.textContent = controls.length ? 'Choose control…' : 'No controls';
    select.appendChild(prompt);
    for (const control of controls) {
      const option = doc.createElement('option');
      option.value = `${control.windowIndex}:${control.controlIndex}`;
      option.textContent = `${control.id || displayType(control.type)} · ${displayType(control.type)} · Form ${control.windowIndex + 1}`;
      select.appendChild(option);
    }
  }

  select.value = controls.some(control => `${control.windowIndex}:${control.controlIndex}` === selectedKey)
    ? selectedKey
    : controls.some(control => `${control.windowIndex}:${control.controlIndex}` === previous) ? previous : '';
}

function selectObjectFromPicker(event) {
  const [windowText, controlText] = String(event.target.value ?? '').split(':');
  const windowIndex = Number(windowText);
  const controlIndex = Number(controlText);
  if (!Number.isInteger(windowIndex) || !Number.isInteger(controlIndex)) return;
  const control = safeControls().find(item => item.windowIndex === windowIndex && item.controlIndex === controlIndex);
  if (!control) return;
  const element = canvas.querySelector(`.designer-control[data-window-index="${windowIndex}"][data-control-index="${controlIndex}"]`);
  if (!element) {
    revealLine(control.line);
    return;
  }
  selectDesignerElement(canvas, element, designerSelectionForControl(control), { reason: 'object-inspector-picker' });
  element.focus?.({ preventScroll: true });
  element.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
}

function renderEventsPanel() {
  const panel = inspector?.querySelector('#designerEventsPanel');
  if (!panel) return;
  const control = selectedControl();
  if (!control) {
    panel.innerHTML = '<p class="designer-events-empty"><strong>No object selected.</strong><br>Select a named control to inspect its Patch events.</p>';
    return;
  }
  const spec = designerEventSpec(control.type);
  if (!control.id || !spec) {
    panel.innerHTML = `<p class="designer-events-empty"><strong>${escapeHtml(displayType(control.type))}</strong><br>This object has no source-backed event in the current contract.</p>`;
    return;
  }
  const handler = findDesignerEventHandler(code.value, control.id, spec.event);
  panel.innerHTML = `
    <div class="designer-event-row">
      <div><strong>${escapeHtml(spec.label)}</strong><span>when ${escapeHtml(control.id)} ${escapeHtml(spec.event)}</span></div>
      <button id="designerEventHandlerAction" class="secondary" type="button">${handler ? 'Open handler' : 'Create handler'}</button>
    </div>
    <p class="designer-event-state">${handler ? `Source-backed handler · line ${handler.line}` : 'No handler yet. Creating one writes ordinary visible Patch source.'}</p>
    <p class="designer-event-hint">${control.type === 'paintbox' ? 'OnPaint is pure Stage 1 drawing: use draw, if and repeat. Persistent state changes stay outside paint handlers.' : spec.value ? 'The event-local value is available as value.' : 'This event has no implicit value.'}</p>`;
  panel.querySelector('#designerEventHandlerAction')?.addEventListener('click', () => openOrCreateHandler(control));
}

function openOrCreateHandler(control) {
  try {
    const result = ensureDesignerEventHandler(code.value, control.id, control.type);
    if (result.created) setSource(result.source);
    revealRange(result.handler.start, result.handler.end);
    setView('events');
  } catch (error) {
    const panel = inspector?.querySelector('#designerEventsPanel');
    if (panel) panel.innerHTML = `<p class="designer-event-error">${escapeHtml(error?.message ?? String(error))}</p>`;
  }
}

function handleDesignerDoubleClick(event) {
  const element = event.target?.closest?.('.designer-control');
  if (!element || !canvas.contains(element)) return;
  const selection = currentDesignerSelection(canvas);
  if (!selection) return;
  const control = safeControls().find(item => item.windowIndex === selection.windowIndex && item.controlIndex === selection.controlIndex);
  if (!control?.id || !DOUBLE_CLICK_TYPES.has(control.type) || !designerEventSpec(control.type)) return;
  event.preventDefault();
  event.stopPropagation();
  openOrCreateHandler(control);
}

function selectedControl() {
  const selection = currentDesignerSelection(canvas);
  if (!selection) return null;
  return safeControls().find(item => item.windowIndex === selection.windowIndex && item.controlIndex === selection.controlIndex) ?? null;
}

function safeControls() {
  const source = code?.value ?? '';
  if (source === cachedSource) return cachedControls;
  cachedSource = source;
  try { cachedControls = listDesignerControls(source); }
  catch { cachedControls = []; }
  return cachedControls;
}

function setSource(source) {
  code.value = source;
  code.dispatchEvent(new Event('input', { bubbles: true }));
  code.dispatchEvent(new Event('change', { bubbles: true }));
}

function revealLine(line) {
  const lines = code.value.replace(/\r\n/g, '\n').split('\n');
  let start = 0;
  for (let index = 0; index < Math.max(0, Number(line) - 1); index += 1) start += (lines[index]?.length ?? 0) + 1;
  revealRange(start, start + (lines[Math.max(0, Number(line) - 1)]?.length ?? 0));
}

function revealRange(start, end) {
  code.focus();
  code.setSelectionRange(Math.max(0, start), Math.max(start, end));
  code.scrollIntoView?.({ block: 'center', behavior: 'smooth' });
}

function displayType(type) {
  if (type === 'combo') return 'ComboBox';
  if (type === 'listbox') return 'ListBox';
  if (type === 'tree') return 'TreeView';
  if (type === 'picture') return 'PictureBox';
  if (type === 'paintbox') return 'PaintBox';
  const text = String(type ?? 'Control');
  return text ? text[0].toUpperCase() + text.slice(1) : 'Control';
}

function escapeRegExp(text) {
  return String(text).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function escapeHtml(text) {
  return String(text).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);
}

function installStyles() {
  if (doc.querySelector('style[data-patch-event-inspector]')) return;
  const style = doc.createElement('style');
  style.dataset.patchEventInspector = '1';
  style.textContent = `
    .designer-object-inspector-tabs{display:grid;grid-template-columns:1fr 1fr;gap:4px;margin:6px 0}
    .designer-object-inspector-tabs button{min-height:28px;border:1px solid var(--border);border-radius:6px;background:var(--surface-subtle);color:var(--muted);font-size:11px;font-weight:750;cursor:pointer}
    .designer-object-inspector-tabs button.active{background:var(--soft);color:var(--text);border-color:var(--border-strong)}
    .designer-object-picker{display:grid;grid-template-columns:auto minmax(0,1fr);gap:8px;align-items:center;margin:6px 0 10px;color:var(--muted);font-size:10px;font-weight:750}
    .designer-object-picker select{width:100%;min-width:0}
    .designer-events-panel{display:grid;gap:8px;padding:8px 0}
    .designer-events-panel[hidden]{display:none}
    .designer-event-row{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px;align-items:center;padding:9px;border:1px solid var(--border);border-radius:8px;background:var(--surface-subtle)}
    .designer-event-row div{display:grid;gap:2px;min-width:0}.designer-event-row span{font:10px/1.35 ui-monospace,SFMono-Regular,Menlo,monospace;color:var(--muted);overflow-wrap:anywhere}
    .designer-event-state,.designer-event-hint,.designer-events-empty,.designer-event-error{margin:0;color:var(--muted);font-size:10px;line-height:1.45}.designer-event-error{color:var(--danger,#b42318)}
  `;
  doc.head.appendChild(style);
}