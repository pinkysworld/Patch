import { listDesignerControls } from '../src/designer.js';
import { duplicateDesignerTabPage } from './designer-tabs-page-model.js';

const code = document.querySelector('#code');
const canvas = document.querySelector('#designerCanvas');
const panel = document.querySelector('[data-designer-data-editor]');
let scheduled = false;
let pendingPageIndex = null;

if (panel) {
  new MutationObserver(scheduleSync).observe(panel, { childList: true, subtree: true });
  panel.addEventListener('click', handleClick, true);
}
code?.addEventListener('input', scheduleSync);
code?.addEventListener('change', scheduleSync);
canvas?.addEventListener('click', () => queueMicrotask(scheduleSync));
scheduleSync();

function scheduleSync() {
  if (scheduled) return;
  scheduled = true;
  queueMicrotask(() => {
    scheduled = false;
    try { syncDuplicatePageAction(); } catch { removeDuplicatePageAction(); }
  });
}

function syncDuplicatePageAction() {
  if (!panel || panel.hidden) return removeDuplicatePageAction();
  const context = currentContext();
  if (!context) return removeDuplicatePageAction();
  const actions = panel.querySelector(':scope > .designer-data-actions');
  if (!actions) return removeDuplicatePageAction();
  let button = actions.querySelector('[data-tabs-duplicate-page]');
  if (!button) {
    button = document.createElement('button');
    button.type = 'button';
    button.className = 'secondary';
    button.dataset.tabsDuplicatePage = '1';
    button.textContent = 'Duplicate page';
    button.title = 'Duplicate the selected page, its controls and matching control handlers';
    const deleteButton = actions.querySelector('.danger');
    actions.insertBefore(button, deleteButton ?? null);
  }
  restorePendingPageSelection();
}

function handleClick(event) {
  const button = event.target.closest?.('[data-tabs-duplicate-page]');
  if (!button) return;
  event.preventDefault();
  event.stopPropagation();
  const context = currentContext();
  if (!context) return;
  try {
    const result = duplicateDesignerTabPage(code.value, context.tabs, context.pageIndex);
    pendingPageIndex = result.pageIndex;
    setSource(result.source);
  } catch (error) {
    showError(error);
  }
}

function currentContext() {
  if (!panel || !code || !canvas) return null;
  const active = panel.querySelector('.designer-tabs-page.active[data-tab-page-index]');
  if (!active) return null;
  const pageIndex = Number(active.dataset.tabPageIndex);
  if (!Number.isInteger(pageIndex)) return null;
  const element = canvas.querySelector('.designer-control.designer-selected[data-window-index][data-control-index]');
  if (!element) return null;
  const windowIndex = Number(element.dataset.windowIndex);
  const controlIndex = Number(element.dataset.controlIndex);
  if (!Number.isInteger(windowIndex) || !Number.isInteger(controlIndex)) return null;
  const tabs = listDesignerControls(code.value).find(item =>
    item.windowIndex === windowIndex && item.controlIndex === controlIndex && item.type === 'tabs'
  );
  return tabs ? { tabs, pageIndex } : null;
}

function restorePendingPageSelection() {
  if (!Number.isInteger(pendingPageIndex)) return;
  const page = panel?.querySelector(`[data-tab-page-index="${pendingPageIndex}"]`);
  if (!page) return;
  const index = pendingPageIndex;
  pendingPageIndex = null;
  page.click();
  queueMicrotask(() => {
    const selected = panel?.querySelector(`[data-tab-page-index="${index}"]`);
    selected?.focus({ preventScroll: true });
    selected?.scrollIntoView?.({ block: 'nearest' });
  });
}

function setSource(source) {
  code.value = source;
  code.dispatchEvent(new Event('input', { bubbles: true }));
  code.dispatchEvent(new Event('change', { bubbles: true }));
  scheduleSync();
}

function removeDuplicatePageAction() {
  panel?.querySelectorAll('[data-tabs-duplicate-page]').forEach(element => element.remove());
}

function showError(error) {
  const target = document.querySelector('#designerInspectorError');
  if (!target) return;
  target.textContent = error?.message ?? String(error);
  target.hidden = false;
}
