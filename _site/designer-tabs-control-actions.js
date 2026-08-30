import { listDesignerControls } from './src/designer.js?v=868f0784ca7f3972';
import {
  designerTabPageControlActionAvailability,
  duplicateDesignerTabPageControl,
  moveDesignerTabPageControl
} from './designer-tabs-control-model.js?v=868f0784ca7f3972';

const code = document.querySelector('#code');
const canvas = document.querySelector('#designerCanvas');
const panel = document.querySelector('[data-designer-data-editor]');
let scheduled = false;
let pendingFocus = null;

if (panel) {
  new MutationObserver(scheduleEnhance).observe(panel, { childList: true, subtree: true });
  panel.addEventListener('click', handleClick, true);
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
    try { enhanceRows(); } catch { /* base nested editor remains usable */ }
  });
}

function enhanceRows() {
  const context = currentContext();
  if (!context) return;
  const rows = [...panel.querySelectorAll('[data-tabs-nested-controls] .designer-tabs-control-row[data-tabs-control-index]')];
  for (const row of rows) {
    const controlIndex = Number(row.dataset.tabsControlIndex);
    if (!Number.isInteger(controlIndex)) continue;
    const actions = row.querySelector('.designer-tabs-control-row-actions');
    if (!actions || actions.querySelector('[data-tabs-page-control-action]')) continue;
    const availability = designerTabPageControlActionAvailability(code.value, context.tabs, context.pageIndex, controlIndex);
    const label = controlLabel(row, controlIndex);
    const fragment = document.createDocumentFragment();
    fragment.append(
      actionButton('up', '↑', `Move ${label} up`, !availability.up),
      actionButton('down', '↓', `Move ${label} down`, !availability.down),
      actionButton('duplicate', 'Duplicate', `Duplicate ${label}`, !availability.duplicate)
    );
    actions.prepend(fragment);
  }
  restorePendingFocus(context);
}

function actionButton(action, text, label, disabled) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'secondary small';
  button.dataset.tabsPageControlAction = action;
  button.textContent = text;
  button.setAttribute('aria-label', label);
  button.title = label;
  button.disabled = disabled;
  return button;
}

function handleClick(event) {
  const button = event.target.closest?.('[data-tabs-page-control-action]');
  if (!button) return;
  const row = button.closest('[data-tabs-control-index]');
  const context = currentContext();
  const controlIndex = Number(row?.dataset.tabsControlIndex);
  if (!context || !Number.isInteger(controlIndex)) return;
  event.preventDefault();
  event.stopPropagation();

  try {
    closeOpenStructureEditor();
    const action = button.dataset.tabsPageControlAction;
    const result = action === 'duplicate'
      ? duplicateDesignerTabPageControl(code.value, context.tabs, context.pageIndex, controlIndex)
      : moveDesignerTabPageControl(code.value, context.tabs, context.pageIndex, controlIndex, action);
    pendingFocus = { pageIndex: context.pageIndex, controlIndex: result.controlIndex, action };
    setSource(result.source);
  } catch (error) {
    showError(error);
  }
}

function currentContext() {
  if (!panel || !code || !canvas) return null;
  const host = panel.querySelector('[data-tabs-nested-controls][data-page-index]');
  if (!host) return null;
  const pageIndex = Number(host.dataset.pageIndex);
  if (!Number.isInteger(pageIndex)) return null;
  const element = canvas.querySelector('.designer-control.designer-selected[data-window-index][data-control-index]');
  if (!element) return null;
  const windowIndex = Number(element.dataset.windowIndex);
  const controlIndex = Number(element.dataset.controlIndex);
  if (!Number.isInteger(windowIndex) || !Number.isInteger(controlIndex)) return null;
  const tabs = listDesignerControls(code.value).find(item =>
    item.windowIndex === windowIndex && item.controlIndex === controlIndex && item.type === 'tabs'
  );
  return tabs ? { tabs, pageIndex, host } : null;
}

function closeOpenStructureEditor() {
  const close = panel?.querySelector('[data-tabs-close-structure]');
  close?.click();
}

function restorePendingFocus(context) {
  if (!pendingFocus || pendingFocus.pageIndex !== context.pageIndex) return;
  const row = panel.querySelector(`[data-tabs-control-index="${pendingFocus.controlIndex}"]`);
  if (!row) return;
  const target = row.querySelector(`[data-tabs-page-control-action="${pendingFocus.action}"]`)
    ?? row.querySelector('[data-tabs-page-control-action]');
  if (!target) return;
  pendingFocus = null;
  target.focus({ preventScroll: true });
  row.scrollIntoView?.({ block: 'nearest' });
}

function controlLabel(row, controlIndex) {
  const type = row.querySelector('strong')?.textContent?.trim() || 'control';
  const id = row.querySelector('small')?.textContent?.trim();
  return id && id !== 'unnamed' ? `${type} ${id}` : `${type} ${controlIndex + 1}`;
}

function setSource(source) {
  code.value = source;
  code.dispatchEvent(new Event('input', { bubbles: true }));
  code.dispatchEvent(new Event('change', { bubbles: true }));
  scheduleEnhance();
}

function showError(error) {
  const target = document.querySelector('#designerInspectorError');
  if (!target) return;
  target.textContent = error?.message ?? String(error);
  target.hidden = false;
}
