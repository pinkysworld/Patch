const doc = typeof document === 'undefined' ? null : document;
const panel = doc?.querySelector('[data-designer-data-editor]') ?? null;
const filterState = new Map();
let scheduled = false;

export function filterStructureLabels(labels, query) {
  const needle = String(query ?? '').trim().toLocaleLowerCase();
  return (labels ?? []).map(label => !needle || String(label ?? '').toLocaleLowerCase().includes(needle));
}

export function structuralEditorSummary(kind, countText = '') {
  const normalized = String(kind ?? '').trim().toLowerCase();
  if (normalized === 'tree') return { label: 'TreeView', count: countText, quickLabel: 'Add node' };
  if (normalized === 'table') return { label: 'Table', count: countText, quickLabel: 'Add row' };
  if (normalized === 'tabs') return { label: 'Tabs', count: countText, quickLabel: 'Add page' };
  return null;
}

if (panel && doc) {
  installStylesheet();
  new MutationObserver(scheduleEnhance).observe(panel, { childList: true, subtree: true });
  panel.addEventListener('click', handleDelegatedAction);
  scheduleEnhance();
}

function scheduleEnhance() {
  if (scheduled) return;
  scheduled = true;
  queueMicrotask(() => {
    scheduled = false;
    try { enhance(); } catch { /* transient source/selection changes are owned by the base editor */ }
  });
}

function enhance() {
  if (!panel || panel.hidden) return;
  const mode = currentMode();
  if (!mode) return;
  enhanceOverview(mode);
  enhanceListFilters();
  enhanceTableEmptyStates();
  enhanceActionGroups();
}

function currentMode() {
  const heading = panel.querySelector(':scope > .designer-data-editor-head strong')?.textContent?.trim() ?? '';
  if (heading === 'Tree nodes') return 'tree';
  if (heading === 'Table data') return 'table';
  if (heading === 'Tab pages') return 'tabs';
  return null;
}

function enhanceOverview(mode) {
  const head = panel.querySelector(':scope > .designer-data-editor-head');
  if (!head) return;
  const countText = head.querySelector('span')?.textContent?.trim() ?? '';
  const summary = structuralEditorSummary(mode, countText);
  if (!summary) return;

  let overview = panel.querySelector(':scope > [data-designer-structure-overview]');
  if (!overview) {
    overview = doc.createElement('div');
    overview.className = 'designer-structure-overview';
    overview.dataset.designerStructureOverview = '1';
    panel.insertBefore(overview, head);
  }
  overview.dataset.structureKind = mode;
  overview.innerHTML = `
    <div class="designer-structure-overview-copy">
      <span class="designer-structure-kicker">Structure</span>
      <strong>${escapeHtml(summary.label)}</strong>
      <span class="designer-structure-count">${escapeHtml(summary.count || 'Source-backed')}</span>
    </div>
    <div class="designer-structure-quick-actions">
      <button type="button" class="secondary small" data-structure-quick="add">${escapeHtml(summary.quickLabel)}</button>
      <button type="button" class="secondary small" data-structure-quick="source">Source</button>
    </div>`;
}

function enhanceListFilters() {
  const lists = [...panel.querySelectorAll('.designer-tree-node-list, .designer-tabs-page-list, .designer-tabs-control-list')];
  for (const list of lists) {
    if (list.dataset.structureFilterEnhanced === 'true') continue;
    list.dataset.structureFilterEnhanced = 'true';
    const config = filterConfig(list);
    if (!config) continue;

    const controls = doc.createElement('div');
    controls.className = 'designer-structure-filter';
    controls.dataset.structureFilter = config.key;
    controls.innerHTML = `
      <label><span>${escapeHtml(config.label)}</span><input type="search" spellcheck="false" autocomplete="off" placeholder="${escapeAttr(config.placeholder)}" aria-label="${escapeAttr(config.label)}"></label>
      <span class="designer-structure-filter-status" role="status" aria-live="polite"></span>`;
    const input = controls.querySelector('input');
    input.value = filterState.get(config.key) ?? '';
    input.addEventListener('input', () => {
      filterState.set(config.key, input.value);
      applyListFilter(list, controls, config);
    });
    list.insertAdjacentElement('beforebegin', controls);

    const empty = doc.createElement('p');
    empty.className = 'designer-structure-empty designer-structure-filter-empty';
    empty.hidden = true;
    empty.textContent = config.empty;
    list.insertAdjacentElement('afterend', empty);
    applyListFilter(list, controls, config);
  }
}

function filterConfig(list) {
  if (list.classList.contains('designer-tabs-control-list')) {
    return { key: 'tabs-controls', label: 'Filter page controls', placeholder: 'Type or id…', empty: 'No page controls match this filter.', item: '.designer-tabs-control-row' };
  }
  if (list.classList.contains('designer-tabs-page-list')) {
    return { key: 'tabs-pages', label: 'Filter pages', placeholder: 'Page title…', empty: 'No tab pages match this filter.', item: '.designer-tabs-page' };
  }
  const nested = Boolean(list.closest('[data-tabs-structure-editor="tree"]'));
  return {
    key: nested ? 'tabs-tree-nodes' : 'tree-nodes',
    label: nested ? 'Filter nested nodes' : 'Filter nodes',
    placeholder: 'Node label…',
    empty: 'No TreeView nodes match this filter.',
    item: '.designer-tree-node'
  };
}

function applyListFilter(list, controls, config) {
  const items = [...list.querySelectorAll(config.item)];
  const labels = items.map(item => item.textContent ?? '');
  const visible = filterStructureLabels(labels, controls.querySelector('input')?.value ?? '');
  let shown = 0;
  items.forEach((item, index) => {
    item.hidden = !visible[index];
    if (visible[index]) shown += 1;
  });
  const status = controls.querySelector('.designer-structure-filter-status');
  if (status) status.textContent = `${shown} of ${items.length}`;
  const empty = list.nextElementSibling?.classList?.contains('designer-structure-filter-empty') ? list.nextElementSibling : null;
  if (empty) empty.hidden = shown !== 0;
}

function enhanceTableEmptyStates() {
  const editors = [...panel.querySelectorAll('.designer-table-editor')];
  for (const editor of editors) {
    if (editor.dataset.structureEmptyEnhanced === 'true') continue;
    editor.dataset.structureEmptyEnhanced = 'true';
    const nested = Boolean(editor.closest('[data-tabs-structure-editor="table"]'));
    const rowSelector = nested ? '[data-tabs-table-row]' : '[data-table-row]';
    if (editor.querySelector(rowSelector)) continue;

    const empty = doc.createElement('div');
    empty.className = 'designer-structure-empty designer-table-empty';
    empty.innerHTML = `<strong>No rows yet</strong><span>Add a row to start editing source-backed Table data.</span><button type="button" class="secondary small" data-structure-empty-add-row="${nested ? 'nested' : 'top'}">Add first row</button>`;
    editor.insertAdjacentElement('afterend', empty);
  }
}

function enhanceActionGroups() {
  for (const group of panel.querySelectorAll('.designer-data-actions')) {
    group.classList.add('designer-data-actions-polished');
    for (const button of group.querySelectorAll('button')) {
      const text = button.textContent?.trim() ?? '';
      if (/^(Apply data|Rename)$/.test(text)) button.classList.add('designer-structure-primary-action');
      if (/^(Delete|Delete node|Delete page|Remove)/.test(text)) button.classList.add('designer-structure-destructive-action');
    }
  }
}

function handleDelegatedAction(event) {
  const quick = event.target.closest?.('[data-structure-quick]')?.dataset.structureQuick;
  if (quick === 'source') {
    event.preventDefault();
    doc.querySelector('#designerInspectorSource')?.click();
    return;
  }
  if (quick === 'add') {
    event.preventDefault();
    clickQuickAdd();
    return;
  }
  const emptyRow = event.target.closest?.('[data-structure-empty-add-row]');
  if (emptyRow) {
    event.preventDefault();
    const selector = emptyRow.dataset.structureEmptyAddRow === 'nested'
      ? '[data-tabs-table-action="add-row"]'
      : '[data-table-action="add-row"]';
    clickExisting(selector);
  }
}

function clickQuickAdd() {
  const mode = currentMode();
  if (mode === 'table') return clickExisting('[data-table-action="add-row"]');
  if (mode === 'tabs') return clickExisting('[data-tabs-action="add"]');
  if (mode === 'tree') {
    const child = panel.querySelector('[data-tree-action="add-child"]');
    if (child && !child.disabled) return child.click();
    return clickExisting('[data-tree-action="add-root"]');
  }
}

function clickExisting(selector) {
  const button = panel.querySelector(selector);
  if (button && !button.disabled) button.click();
}

function installStylesheet() {
  if (doc.querySelector('link[data-patch-designer-structure-ux]')) return;
  const link = doc.createElement('link');
  link.rel = 'stylesheet';
  link.href = './designer-structure-ux.css';
  link.dataset.patchDesignerStructureUx = '1';
  doc.head.appendChild(link);
}

function escapeHtml(text) {
  return String(text ?? '').replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[char]);
}

function escapeAttr(text) {
  return escapeHtml(text).replace(/`/g, '&#96;');
}
