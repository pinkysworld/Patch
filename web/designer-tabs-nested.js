import { listDesignerControls } from '../src/designer.js';
import {
  addDesignerTabPageControl,
  listDesignerTabPageControls,
  removeDesignerTabPageControl,
  supportedDesignerTabControlTypes
} from '../src/designer-tabs-nested.js';

const code = document.querySelector('#code');
const canvas = document.querySelector('#designerCanvas');
const panel = document.querySelector('[data-designer-data-editor]');
let scheduled = false;

if (panel) {
  new MutationObserver(scheduleEnhance).observe(panel, { childList: true, subtree: true });
  panel.addEventListener('click', handleClick);
}
code?.addEventListener('input', scheduleEnhance);
code?.addEventListener('change', scheduleEnhance);
canvas?.addEventListener('click', () => queueMicrotask(scheduleEnhance));
scheduleEnhance();

function scheduleEnhance() {
  if (scheduled) return;
  scheduled = true;
  queueMicrotask(() => {
    scheduled = false;
    try { enhanceTabsEditor(); } catch { removeEnhancement(); }
  });
}

function enhanceTabsEditor() {
  if (!panel || panel.hidden) return removeEnhancement();
  const control = selectedTabsControl();
  const activePage = panel.querySelector('.designer-tabs-page.active[data-tab-page-index]');
  if (!control || !activePage) return removeEnhancement();

  const pageIndex = Number(activePage.dataset.tabPageIndex);
  if (!Number.isInteger(pageIndex)) return removeEnhancement();
  const controls = listDesignerTabPageControls(code.value, control, pageIndex);
  const signature = `${control.windowIndex}:${control.controlIndex}:${pageIndex}:${controls.map(item => `${item.type}:${item.id ?? ''}:${item.line}`).join('|')}`;
  const existing = panel.querySelector('[data-tabs-nested-controls]');
  if (existing?.dataset.signature === signature) return;
  existing?.remove();

  const section = document.createElement('div');
  section.className = 'designer-tabs-nested-controls';
  section.dataset.tabsNestedControls = '1';
  section.dataset.signature = signature;
  section.dataset.pageIndex = String(pageIndex);
  section.innerHTML = `
    <div class="designer-data-editor-head"><strong>Page controls</strong><span>${controls.length} control${controls.length === 1 ? '' : 's'}</span></div>
    <div class="designer-tabs-control-list" role="list" aria-label="Controls in selected tab page">
      ${controls.map(item => `<div class="designer-tabs-control-row" role="listitem"><span><strong>${escapeHtml(displayType(item.type))}</strong>${item.id ? `<small>${escapeHtml(item.id)}</small>` : '<small>unnamed</small>'}</span><button type="button" class="danger small" data-tabs-remove-control="${item.controlIndex}" ${controls.length <= 1 ? 'disabled' : ''}>Remove</button></div>`).join('')}
    </div>
    <div class="designer-tabs-control-add">
      <label>New control <select data-tabs-control-type>${supportedDesignerTabControlTypes().map(type => `<option value="${type}">${escapeHtml(displayType(type))}</option>`).join('')}</select></label>
      <button type="button" class="secondary" data-tabs-add-control>Add control</button>
    </div>
    <p class="inspector-hint">Nested controls use Tabs flow layout. Text, inputs, selection controls, Table and TreeView are inserted as ordinary visible Patch source. Table rows and TreeView nodes remain source-backed; use their source block for structural edits until the dedicated nested data inspector lands. Removing a named control also removes its event handler.</p>`;

  const hint = panel.querySelector('.inspector-hint:last-child');
  if (hint) hint.insertAdjacentElement('afterend', section);
  else panel.appendChild(section);
}

function handleClick(event) {
  const add = event.target.closest?.('[data-tabs-add-control]');
  if (add) {
    event.preventDefault();
    const context = currentContext();
    if (!context) return;
    try {
      const type = panel.querySelector('[data-tabs-control-type]')?.value ?? 'text';
      setSource(addDesignerTabPageControl(code.value, context.control, context.pageIndex, type));
    } catch (error) { showError(error); }
    return;
  }

  const remove = event.target.closest?.('[data-tabs-remove-control]');
  if (!remove) return;
  event.preventDefault();
  const context = currentContext();
  if (!context) return;
  try {
    setSource(removeDesignerTabPageControl(code.value, context.control, context.pageIndex, Number(remove.dataset.tabsRemoveControl)));
  } catch (error) { showError(error); }
}

function currentContext() {
  const control = selectedTabsControl();
  const activePage = panel?.querySelector('.designer-tabs-page.active[data-tab-page-index]');
  const pageIndex = Number(activePage?.dataset.tabPageIndex);
  if (!control || !Number.isInteger(pageIndex)) return null;
  return { control, pageIndex };
}

function selectedTabsControl() {
  const element = canvas?.querySelector('.designer-control.designer-selected[data-window-index][data-control-index]');
  if (!element) return null;
  const windowIndex = Number(element.dataset.windowIndex);
  const controlIndex = Number(element.dataset.controlIndex);
  if (!Number.isInteger(windowIndex) || !Number.isInteger(controlIndex)) return null;
  return listDesignerControls(code.value).find(item =>
    item.windowIndex === windowIndex && item.controlIndex === controlIndex && item.type === 'tabs'
  ) ?? null;
}

function setSource(source) {
  code.value = source;
  code.dispatchEvent(new Event('input', { bubbles: true }));
  code.dispatchEvent(new Event('change', { bubbles: true }));
  scheduleEnhance();
}

function removeEnhancement() {
  panel?.querySelector('[data-tabs-nested-controls]')?.remove();
}

function showError(error) {
  const target = document.querySelector('#designerInspectorError');
  if (target) {
    target.textContent = error?.message ?? String(error);
    target.hidden = false;
  }
}

function displayType(type) {
  return ({ listbox: 'ListBox', checkbox: 'Checkbox', radio: 'Radio', combo: 'ComboBox', button: 'Button', input: 'Input', text: 'Text', table: 'Table', tree: 'TreeView' })[type] ?? String(type);
}

function escapeHtml(text) {
  return String(text).replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[char]);
}
