const editor = document.querySelector('#code');
const skipLink = document.querySelector('#skipToEditor');
const resultTabList = document.querySelector('#resultTabs');
const resultTabs = Array.from(resultTabList?.querySelectorAll('[role="tab"]') ?? []);
const runButton = document.querySelector('#run');
const buildButton = document.querySelector('#build');

installSkipLink();
installResultTabKeyboard();
installStudioShortcuts();
installWorkspaceLayoutV2();
installEditorCaret();
syncResultTabs();

if (resultTabList && typeof MutationObserver !== 'undefined') {
  const observer = new MutationObserver(syncResultTabs);
  observer.observe(resultTabList, { attributes: true, subtree: true, attributeFilter: ['class'] });
}

announceStudioReady();

function installSkipLink() {
  skipLink?.addEventListener('click', event => {
    event.preventDefault();
    editor?.focus({ preventScroll: true });
    editor?.scrollIntoView({ block: 'center' });
  });
}

function installResultTabKeyboard() {
  resultTabList?.addEventListener('keydown', event => {
    const current = event.target?.closest?.('[role="tab"]');
    if (!current || !resultTabList.contains(current)) return;
    const index = resultTabs.indexOf(current);
    if (index < 0) return;

    let nextIndex = null;
    if (event.key === 'ArrowRight') nextIndex = (index + 1) % resultTabs.length;
    if (event.key === 'ArrowLeft') nextIndex = (index - 1 + resultTabs.length) % resultTabs.length;
    if (event.key === 'Home') nextIndex = 0;
    if (event.key === 'End') nextIndex = resultTabs.length - 1;
    if (nextIndex === null) return;

    event.preventDefault();
    const next = resultTabs[nextIndex];
    next.focus();
    next.click();
    syncResultTabs();
  });
}

function installStudioShortcuts() {
  window.addEventListener('keydown', event => {
    if (event.defaultPrevented || event.isComposing || hasOpenDialog()) return;
    const command = event.ctrlKey || event.metaKey;
    if (!command || event.key !== 'Enter') return;

    event.preventDefault();
    if (event.shiftKey) buildButton?.click();
    else runButton?.click();
  });
}

function syncResultTabs() {
  for (const tab of resultTabs) {
    const panelId = tab.getAttribute('aria-controls');
    const panel = panelId ? document.getElementById(panelId) : null;
    const selected = tab.classList.contains('active') && !panel?.hidden;
    tab.setAttribute('aria-selected', selected ? 'true' : 'false');
    tab.tabIndex = selected ? 0 : -1;
  }
}

function announceStudioReady() {
  window.dispatchEvent(new CustomEvent('patch:studio-ready', {
    detail: { module: 'studio-accessibility' }
  }));
}

function installEditorCaret() {
  const caret = document.querySelector('#editorCaret');
  if (!editor || !caret) return;

  const update = () => {
    const text = editor.value ?? '';
    const offset = Math.max(0, Math.min(Number(editor.selectionStart ?? 0), text.length));
    let line = 1;
    let column = 1;
    for (let i = 0; i < offset; i += 1) {
      if (text.charCodeAt(i) === 10) {
        line += 1;
        column = 1;
      } else {
        column += 1;
      }
    }
    caret.textContent = `Ln ${line} · Col ${column}`;
  };

  document.addEventListener('selectionchange', () => {
    if (document.activeElement === editor) update();
  });
  editor.addEventListener('input', update);
  editor.addEventListener('keyup', update);
  editor.addEventListener('click', update);
  window.addEventListener('patch:studio-active-file-changed', update);
  update();
}

function installWorkspaceLayoutV2() {
  const workspace = document.querySelector('.workspace');
  const source = workspace?.querySelector(':scope > .source-workspace');
  const result = workspace?.querySelector(':scope > .result-pane');
  if (!workspace || !source || !result || workspace.dataset.workspaceLayout === 'v2') return;

  const storageKey = 'patchStudio.workspaceSplit.v2';
  const defaultRatio = 0.40;
  const minSource = 320;
  const minResult = 480;
  const narrow = window.matchMedia('(max-width: 760px)');
  let ratio = readRatio();
  let totalHeight = 0;
  let dragging = null;
  let resizeFrame = 0;

  installWorkspaceStyles();

  const bar = document.createElement('div');
  bar.className = 'workspace-layout-bar';
  bar.setAttribute('aria-label', 'Workspace layout controls');

  const handle = document.createElement('div');
  handle.id = 'workspaceSplitHandle';
  handle.className = 'workspace-split-handle';
  handle.setAttribute('role', 'separator');
  handle.setAttribute('aria-orientation', 'horizontal');
  handle.setAttribute('aria-label', 'Resize source and result workspace');
  handle.tabIndex = 0;
  handle.innerHTML = '<span class="workspace-split-grip" aria-hidden="true"></span><span class="workspace-split-label">Source / Result</span>';

  const reset = document.createElement('button');
  reset.id = 'resetWorkspaceLayout';
  reset.className = 'workspace-layout-reset secondary small';
  reset.type = 'button';
  reset.textContent = 'Reset split';
  reset.title = 'Reset source/result workspace split';

  bar.append(handle, reset);
  workspace.insertBefore(bar, result);
  workspace.dataset.workspaceLayout = 'v2';

  requestAnimationFrame(() => {
    captureNaturalHeight();
    applyRatio(ratio, { persist: false });
  });

  handle.addEventListener('pointerdown', event => {
    if (narrow.matches || event.button !== 0) return;
    captureNaturalHeight();
    dragging = {
      pointerId: event.pointerId,
      startY: event.clientY,
      startSource: source.getBoundingClientRect().height,
      startRatio: ratio
    };
    handle.setPointerCapture?.(event.pointerId);
    workspace.classList.add('workspace-layout-resizing');
    event.preventDefault();
  });

  handle.addEventListener('pointermove', event => {
    if (!dragging || event.pointerId !== dragging.pointerId) return;
    const sourceHeight = dragging.startSource + (event.clientY - dragging.startY);
    applySourceHeight(sourceHeight, { persist: false });
  });

  handle.addEventListener('pointerup', event => {
    if (!dragging || event.pointerId !== dragging.pointerId) return;
    dragging = null;
    workspace.classList.remove('workspace-layout-resizing');
    persistRatio();
  });

  handle.addEventListener('pointercancel', event => {
    if (!dragging || event.pointerId !== dragging.pointerId) return;
    const startRatio = dragging.startRatio;
    dragging = null;
    workspace.classList.remove('workspace-layout-resizing');
    applyRatio(startRatio, { persist: false });
  });

  handle.addEventListener('keydown', event => {
    if (narrow.matches) return;
    let delta = null;
    const step = event.shiftKey ? 64 : 24;
    if (event.key === 'ArrowUp') delta = -step;
    if (event.key === 'ArrowDown') delta = step;
    if (event.key === 'Home') {
      event.preventDefault();
      applyRatio(defaultRatio);
      return;
    }
    if (delta === null) return;
    event.preventDefault();
    captureNaturalHeight();
    applySourceHeight(source.getBoundingClientRect().height + delta);
  });

  handle.addEventListener('dblclick', () => applyRatio(defaultRatio));
  reset.addEventListener('click', () => {
    ratio = defaultRatio;
    try { localStorage.removeItem(storageKey); } catch {}
    captureNaturalHeight();
    applyRatio(defaultRatio, { persist: false });
    handle.focus();
  });

  const onBreakpointChange = () => {
    if (narrow.matches) {
      clearSizedLayout();
    } else {
      requestAnimationFrame(() => recaptureGeometry());
    }
  };
  if (typeof narrow.addEventListener === 'function') narrow.addEventListener('change', onBreakpointChange);
  else narrow.addListener?.(onBreakpointChange);

  window.addEventListener('resize', () => {
    if (narrow.matches || dragging) return;
    cancelAnimationFrame(resizeFrame);
    resizeFrame = requestAnimationFrame(recaptureGeometry);
  }, { passive: true });

  function captureNaturalHeight() {
    if (narrow.matches) return;
    const sourceHeight = source.getBoundingClientRect().height;
    const resultHeight = result.getBoundingClientRect().height;
    const measured = sourceHeight + resultHeight;
    if (!totalHeight || (!workspace.style.getPropertyValue('--workspace-source-height') && measured > 0)) {
      totalHeight = Math.max(minSource + minResult, measured);
    }
  }

  function recaptureGeometry() {
    if (narrow.matches || dragging) return;
    const preservedRatio = ratio;
    clearSizedLayout({ sync: false });
    totalHeight = 0;
    captureNaturalHeight();
    applyRatio(preservedRatio, { persist: false });
  }

  function applySourceHeight(requested, options = {}) {
    if (narrow.matches) return;
    if (!totalHeight) captureNaturalHeight();
    const maxSource = Math.max(minSource, totalHeight - minResult);
    const sourceHeight = clamp(Number(requested), minSource, maxSource);
    const resultHeight = Math.max(minResult, totalHeight - sourceHeight);
    ratio = sourceHeight / Math.max(1, totalHeight);
    workspace.style.setProperty('--workspace-source-height', `${Math.round(sourceHeight)}px`);
    workspace.style.setProperty('--workspace-result-height', `${Math.round(resultHeight)}px`);
    workspace.dataset.workspaceSized = 'true';
    syncSeparator();
    if (options.persist !== false) persistRatio();
  }

  function applyRatio(next, options = {}) {
    if (narrow.matches) {
      clearSizedLayout();
      return;
    }
    if (!totalHeight) captureNaturalHeight();
    ratio = clamp(Number(next), 0.25, 0.70);
    applySourceHeight(totalHeight * ratio, options);
  }

  function clearSizedLayout(options = {}) {
    workspace.style.removeProperty('--workspace-source-height');
    workspace.style.removeProperty('--workspace-result-height');
    delete workspace.dataset.workspaceSized;
    if (options.sync !== false) syncSeparator();
  }

  function syncSeparator() {
    const percent = Math.round(ratio * 100);
    const minPercent = totalHeight ? Math.ceil((minSource / totalHeight) * 100) : 25;
    const maxPercent = totalHeight ? Math.floor(((totalHeight - minResult) / totalHeight) * 100) : 70;
    handle.setAttribute('aria-valuemin', String(minPercent));
    handle.setAttribute('aria-valuemax', String(Math.max(minPercent, maxPercent)));
    handle.setAttribute('aria-valuenow', String(percent));
    handle.setAttribute('aria-valuetext', `Source ${percent} percent, result ${100 - percent} percent`);
    handle.dataset.ratio = String(percent);
  }

  function readRatio() {
    try {
      const parsed = Number(localStorage.getItem(storageKey));
      if (Number.isFinite(parsed) && parsed >= 0.25 && parsed <= 0.70) return parsed;
    } catch {}
    return defaultRatio;
  }

  function persistRatio() {
    try { localStorage.setItem(storageKey, ratio.toFixed(4)); } catch {}
  }
}

function installWorkspaceStyles() {
  if (document.querySelector('style[data-patch-workspace-layout-v2]')) return;
  const style = document.createElement('style');
  style.dataset.patchWorkspaceLayoutV2 = '1';
  style.textContent = `
    .workspace-layout-bar {
      min-height: 30px;
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      align-items: center;
      gap: 8px;
      margin: -7px 0;
    }
    .workspace-split-handle {
      min-width: 0;
      min-height: 30px;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      cursor: row-resize;
      color: var(--muted);
      touch-action: none;
      user-select: none;
      border-radius: 8px;
    }
    .workspace-split-handle:hover,
    .workspace-split-handle:focus-visible { background: var(--soft); color: var(--text); }
    .workspace-split-handle:focus-visible { outline: 2px solid var(--text); outline-offset: 2px; }
    .workspace-split-grip { width: 58px; height: 4px; border-radius: 999px; background: var(--border-strong); }
    .workspace-split-label { font-size: 9px; font-weight: 750; letter-spacing: .04em; text-transform: uppercase; }
    .workspace-layout-reset { min-height: 26px; padding: 3px 7px; font-size: 9px; }
    .workspace[data-workspace-layout="v2"][data-workspace-sized="true"] > .source-workspace { height: var(--workspace-source-height); min-height: 320px; }
    .workspace[data-workspace-layout="v2"][data-workspace-sized="true"] > .source-workspace > .pane { height: 100%; min-height: 0; }
    .workspace[data-workspace-layout="v2"][data-workspace-sized="true"] .editor-pane textarea { flex: 1 1 auto; height: auto; min-height: 0; resize: none; }
    .workspace[data-workspace-layout="v2"][data-workspace-sized="true"] .project-outline-tree { height: calc(100% - 42px); min-height: 0; max-height: none; }
    .workspace[data-workspace-layout="v2"][data-workspace-sized="true"] > .result-pane { height: var(--workspace-result-height); min-height: 480px; }
    .workspace[data-workspace-layout="v2"][data-workspace-sized="true"] > .result-pane > pre,
    .workspace[data-workspace-layout="v2"][data-workspace-sized="true"] > .result-pane > .app-preview,
    .workspace[data-workspace-layout="v2"][data-workspace-sized="true"] > .result-pane > .designer-view { height: calc(100% - 42px); min-height: 0; max-height: none; }
    .workspace[data-workspace-layout="v2"][data-workspace-sized="true"] .designer-surface,
    .workspace[data-workspace-layout="v2"][data-workspace-sized="true"] .designer-surface .designer-canvas { min-height: 0; max-height: none; }
    .workspace-layout-resizing,
    .workspace-layout-resizing * { cursor: row-resize !important; user-select: none !important; }
    @media (max-width: 760px) {
      .workspace-layout-bar { display: none; }
      .workspace[data-workspace-layout="v2"] > .source-workspace,
      .workspace[data-workspace-layout="v2"] > .result-pane { height: auto; }
    }
    @media (forced-colors: active) {
      .workspace-split-grip { border: 1px solid CanvasText; }
    }
  `;
  document.head.appendChild(style);
}

function clamp(value, min, max) {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

function hasOpenDialog() {
  return Boolean(document.querySelector('dialog[open]'));
}
