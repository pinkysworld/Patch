const installedPanels = new WeakSet();

export function nextStructuralOptionIndex(currentIndex, count, key) {
  if (!Number.isInteger(currentIndex) || !Number.isInteger(count) || count <= 0) return -1;
  if (key === 'Home') return 0;
  if (key === 'End') return count - 1;
  if (key === 'ArrowUp') return Math.max(0, currentIndex - 1);
  if (key === 'ArrowDown') return Math.min(count - 1, currentIndex + 1);
  return currentIndex;
}

export function structuralShortcut(kind, key, modified = true) {
  if (!modified) return null;
  if (kind === 'tree' || kind === 'nested-tree') {
    if (key === 'ArrowUp') return 'up';
    if (key === 'ArrowDown') return 'down';
    if (key === 'ArrowLeft') return 'outdent';
    if (key === 'ArrowRight') return 'indent';
    if (key === 'Enter') return 'focus-label';
  }
  if (kind === 'tabs') {
    if (key === 'ArrowUp') return 'up';
    if (key === 'ArrowDown') return 'down';
    if (key === 'Enter') return 'focus-label';
  }
  return null;
}

export function installDesignerStructuralKeyboard(panel) {
  if (!panel || installedPanels.has(panel)) return;
  installedPanels.add(panel);

  panel.addEventListener('keydown', event => {
    if (handleCommitShortcut(panel, event)) return;
    if (handleNestedCloseShortcut(panel, event)) return;

    const option = event.target?.closest?.('[role="option"]');
    const listbox = option?.closest?.('[role="listbox"]');
    if (!option || !listbox) return;

    const modified = Boolean(event.ctrlKey || event.metaKey);
    const kind = optionKind(option);
    const shortcut = structuralShortcut(kind, event.key, modified);
    if (shortcut) {
      event.preventDefault();
      if (shortcut === 'focus-label') {
        focusLabelForKind(panel, kind);
        return;
      }
      const actionButton = actionButtonForKind(panel, kind, shortcut, option);
      if (!actionButton || actionButton.disabled) return;
      const listboxLabel = listbox.getAttribute('aria-label') ?? '';
      actionButton.click();
      refocusSelectedOption(panel, listboxLabel);
      return;
    }

    if (modified || !['ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) return;
    const options = enabledOptions(listbox);
    const currentIndex = options.indexOf(option);
    const nextIndex = nextStructuralOptionIndex(currentIndex, options.length, event.key);
    const next = options[nextIndex];
    if (!next || next === option) return;
    event.preventDefault();
    const listboxLabel = listbox.getAttribute('aria-label') ?? '';
    next.click();
    refocusSelectedOption(panel, listboxLabel);
  });

  new MutationObserver(() => normalizeStructuralKeyboard(panel)).observe(panel, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['aria-selected']
  });
  normalizeStructuralKeyboard(panel);
}

export function normalizeStructuralKeyboard(panel) {
  if (!panel) return;
  for (const listbox of panel.querySelectorAll?.('[role="listbox"]') ?? []) {
    const options = enabledOptions(listbox);
    if (!options.length) continue;
    let active = options.find(option => option.getAttribute('aria-selected') === 'true') ?? options[0];
    for (const option of options) option.tabIndex = option === active ? 0 : -1;
    const kind = optionKind(active);
    const shortcuts = listboxShortcuts(kind);
    if (shortcuts) listbox.setAttribute('aria-keyshortcuts', shortcuts);
  }

  for (const input of panel.querySelectorAll?.('.designer-table-editor input, #designerTreeNodeLabel, #designerTabPageTitle, [data-tabs-tree-label]') ?? []) {
    input.setAttribute('aria-keyshortcuts', 'Control+Enter Meta+Enter');
  }

  for (const editor of panel.querySelectorAll?.('[data-tabs-structure-editor]') ?? []) {
    editor.setAttribute('aria-keyshortcuts', 'Escape');
  }
}

function handleCommitShortcut(panel, event) {
  if (!(event.ctrlKey || event.metaKey) || event.key !== 'Enter') return false;
  const target = event.target;
  if (!target?.matches?.('input')) return false;

  let action = null;
  let focusSelector = null;
  if (target.matches('[data-tabs-table-column], [data-tabs-table-cell]')) {
    action = target.closest('[data-tabs-structure-editor="table"]')?.querySelector('[data-tabs-table-action="apply"]');
    focusSelector = attributeSelector(target, ['data-tabs-table-column', 'data-tabs-table-cell']);
  } else if (target.matches('[data-table-column], [data-table-cell]')) {
    action = panel.querySelector('[data-table-action="apply"]');
    focusSelector = attributeSelector(target, ['data-table-column', 'data-table-cell']);
  } else if (target.matches('[data-tabs-tree-label]')) {
    action = target.closest('[data-tabs-structure-editor="tree"]')?.querySelector('[data-tabs-tree-action="rename"]');
    focusSelector = '[data-tabs-tree-label]';
  } else if (target.id === 'designerTreeNodeLabel') {
    action = panel.querySelector('[data-tree-action="rename"]');
    focusSelector = '#designerTreeNodeLabel';
  } else if (target.id === 'designerTabPageTitle') {
    action = panel.querySelector('[data-tabs-action="rename"]');
    focusSelector = '#designerTabPageTitle';
  }

  if (!action || action.disabled) return false;
  event.preventDefault();
  action.click();
  if (focusSelector) deferFocus(panel, focusSelector, true);
  return true;
}

function handleNestedCloseShortcut(panel, event) {
  if (event.key !== 'Escape' || event.ctrlKey || event.metaKey || event.altKey) return false;
  const editor = event.target?.closest?.('[data-tabs-structure-editor]');
  if (!editor) return false;
  const controlIndex = editor.dataset.structureControlIndex;
  const close = editor.querySelector('[data-tabs-close-structure]');
  if (!close) return false;
  event.preventDefault();
  close.click();
  if (controlIndex != null) deferFocus(panel, `[data-tabs-edit-structure="${cssEscape(controlIndex)}"]`);
  return true;
}

function optionKind(option) {
  if (option?.hasAttribute?.('data-tabs-tree-path')) return 'nested-tree';
  if (option?.hasAttribute?.('data-tree-path')) return 'tree';
  if (option?.hasAttribute?.('data-tab-page-index')) return 'tabs';
  return 'listbox';
}

function actionButtonForKind(panel, kind, action, option) {
  if (kind === 'tree') return panel.querySelector(`[data-tree-action="${action}"]`);
  if (kind === 'nested-tree') {
    return option.closest('[data-tabs-structure-editor="tree"]')?.querySelector(`[data-tabs-tree-action="${action}"]`);
  }
  if (kind === 'tabs') return panel.querySelector(`[data-tabs-action="${action}"]`);
  return null;
}

function focusLabelForKind(panel, kind) {
  if (kind === 'tree') panel.querySelector('#designerTreeNodeLabel')?.focus();
  if (kind === 'nested-tree') panel.querySelector('[data-tabs-structure-editor="tree"] [data-tabs-tree-label]')?.focus();
  if (kind === 'tabs') panel.querySelector('#designerTabPageTitle')?.focus();
}

function enabledOptions(listbox) {
  return [...(listbox?.querySelectorAll?.('[role="option"]') ?? [])].filter(option => !option.disabled && option.getAttribute('aria-disabled') !== 'true');
}

function listboxShortcuts(kind) {
  if (kind === 'tree' || kind === 'nested-tree') return 'ArrowUp ArrowDown Home End Control+ArrowUp Control+ArrowDown Control+ArrowLeft Control+ArrowRight Control+Enter Meta+ArrowUp Meta+ArrowDown Meta+ArrowLeft Meta+ArrowRight Meta+Enter';
  if (kind === 'tabs') return 'ArrowUp ArrowDown Home End Control+ArrowUp Control+ArrowDown Control+Enter Meta+ArrowUp Meta+ArrowDown Meta+Enter';
  return 'ArrowUp ArrowDown Home End';
}

function refocusSelectedOption(panel, ariaLabel) {
  defer(() => {
    const listbox = [...(panel.querySelectorAll?.('[role="listbox"]') ?? [])]
      .find(item => (item.getAttribute('aria-label') ?? '') === ariaLabel);
    const selected = listbox?.querySelector?.('[role="option"][aria-selected="true"]') ?? listbox?.querySelector?.('[role="option"]');
    selected?.focus?.();
  });
}

function deferFocus(panel, selector, selectText = false) {
  defer(() => {
    const target = panel.querySelector?.(selector);
    target?.focus?.();
    if (selectText && typeof target?.select === 'function') target.select();
  });
}

function defer(callback) {
  if (typeof requestAnimationFrame === 'function') requestAnimationFrame(() => callback());
  else setTimeout(callback, 0);
}

function attributeSelector(element, names) {
  for (const name of names) {
    if (!element.hasAttribute?.(name)) continue;
    return `[${name}="${cssEscape(element.getAttribute(name) ?? '')}"]`;
  }
  return null;
}

function cssEscape(value) {
  if (globalThis.CSS?.escape) return globalThis.CSS.escape(String(value));
  return String(value).replace(/(["\\])/g, '\\$1');
}
