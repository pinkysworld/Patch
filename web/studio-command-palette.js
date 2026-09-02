import { lineSelectionRange } from '../src/studio-outline-model.js';
import { buildStudioQuickOpenItems, rankStudioQuickOpenItems } from './studio-quick-open.js';
import {
  activateStudioProjectFile,
  getActiveStudioProjectFile,
  getStudioProjectFiles
} from './project-lifecycle.js';

export const STUDIO_EDIT_HISTORY_VERSION = '0.1';
export const STUDIO_EDIT_HISTORY_LIMIT = 80;
export const STUDIO_EDIT_HISTORY_COALESCE_MS = 850;
export const STUDIO_VIEW_NAVIGATION_VERSION = '0.1';

const sourceEditor = document.querySelector('#code');
const saveState = document.querySelector('#saveState');
const editUndo = [];
const editRedo = [];
const sourceByFile = new Map();
let historyReady = false;
let replayingHistory = false;
let typingGroup = null;
let typingTimer = null;

installStudioEditHistory();
installStudioViewNavigation();

function installStudioEditHistory() {
  if (!sourceEditor) return;

  sourceEditor.addEventListener('input', captureSourceEdit);
  sourceEditor.addEventListener('change', captureSourceEdit);
  window.addEventListener('keydown', handleHistoryShortcut, { capture: true });
  window.addEventListener('patch:studio-active-file-changed', refreshActiveFileBaseline);
  window.addEventListener('patch:studio-project-files-changed', resetStudioEditHistory);
  window.addEventListener('patch:studio-project-resources-changed', resetStudioEditHistory);
  window.addEventListener('patch:studio-project-loaded', resetStudioEditHistory);

  queueMicrotask(resetStudioEditHistory);
}

function installStudioViewNavigation() {
  window.addEventListener('keydown', event => {
    if (event.defaultPrevented || event.isComposing || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    if (event.key !== 'F12' || document.querySelector('dialog[open]')) return;
    event.preventDefault();
    event.stopPropagation();
    toggleSourceDesignerView();
  }, { capture: true });
}

function captureSourceEdit(event) {
  if (replayingHistory || !historyReady || !sourceEditor) return;
  const file = safeActiveFile();
  if (!file) return;
  const after = sourceEditor.value;
  const before = sourceByFile.get(file);
  if (before == null) {
    sourceByFile.set(file, after);
    return;
  }
  if (before === after) return;

  const now = Date.now();
  const trustedTyping = event?.type === 'input' && event.isTrusted === true;
  const coalesce = trustedTyping
    && typingGroup?.file === file
    && now - typingGroup.at <= STUDIO_EDIT_HISTORY_COALESCE_MS
    && editUndo.at(-1)?.kind === 'typing'
    && editUndo.at(-1)?.file === file;

  if (coalesce) {
    const previous = editUndo.at(-1);
    editUndo[editUndo.length - 1] = Object.freeze({ ...previous, after });
  } else {
    pushBounded(editUndo, Object.freeze({
      file,
      before,
      after,
      kind: trustedTyping ? 'typing' : 'studio'
    }));
  }

  editRedo.length = 0;
  sourceByFile.set(file, after);
  if (trustedTyping) beginTypingGroup(file, now);
  else clearTypingGroup();
  announceHistoryAvailability();
}

function beginTypingGroup(file, at) {
  typingGroup = { file, at };
  if (typingTimer) clearTimeout(typingTimer);
  typingTimer = setTimeout(clearTypingGroup, STUDIO_EDIT_HISTORY_COALESCE_MS);
}

function clearTypingGroup() {
  typingGroup = null;
  if (typingTimer) clearTimeout(typingTimer);
  typingTimer = null;
}

function pushBounded(stack, transaction) {
  stack.push(transaction);
  if (stack.length > STUDIO_EDIT_HISTORY_LIMIT) stack.splice(0, stack.length - STUDIO_EDIT_HISTORY_LIMIT);
}

function refreshActiveFileBaseline() {
  if (replayingHistory) return;
  try {
    for (const file of getStudioProjectFiles()) sourceByFile.set(file.path, file.content);
    historyReady = true;
  } catch {
    // A transient parse/storage problem must not create guessed history entries.
  }
}

export function resetStudioEditHistory() {
  if (replayingHistory) return;
  clearTypingGroup();
  editUndo.length = 0;
  editRedo.length = 0;
  sourceByFile.clear();
  try {
    for (const file of getStudioProjectFiles()) sourceByFile.set(file.path, file.content);
    historyReady = true;
  } catch {
    historyReady = false;
  }
  announceHistoryAvailability();
}

export function canUndoStudioEdit() {
  return editUndo.length > 0;
}

export function canRedoStudioEdit() {
  return editRedo.length > 0;
}

export function undoStudioEdit() {
  const transaction = editUndo.pop();
  if (!transaction) {
    announceHistoryStatus('Nothing to undo');
    return false;
  }
  try {
    replaySourceTransaction(transaction.file, transaction.before, 'Undo applied');
    pushBounded(editRedo, transaction);
    announceHistoryAvailability();
    return true;
  } catch (error) {
    editUndo.push(transaction);
    resetStudioEditHistory();
    reportNavigationFailure(error);
    return false;
  }
}

export function redoStudioEdit() {
  const transaction = editRedo.pop();
  if (!transaction) {
    announceHistoryStatus('Nothing to redo');
    return false;
  }
  try {
    replaySourceTransaction(transaction.file, transaction.after, 'Redo applied');
    pushBounded(editUndo, transaction);
    announceHistoryAvailability();
    return true;
  } catch (error) {
    editRedo.push(transaction);
    resetStudioEditHistory();
    reportNavigationFailure(error);
    return false;
  }
}

function replaySourceTransaction(file, source, status) {
  if (!sourceEditor) return;
  replayingHistory = true;
  clearTypingGroup();
  try {
    if (safeActiveFile() !== file) activateStudioProjectFile(file);
    sourceEditor.value = source;
    sourceByFile.set(file, source);
    sourceEditor.dispatchEvent(new Event('input', { bubbles: true }));
    sourceEditor.dispatchEvent(new Event('change', { bubbles: true }));
    announceHistoryStatus(status);
    sourceEditor.focus({ preventScroll: true });
  } finally {
    replayingHistory = false;
  }
}

function safeActiveFile() {
  try {
    return getActiveStudioProjectFile();
  } catch {
    return null;
  }
}

function handleHistoryShortcut(event) {
  if (event.defaultPrevented || event.isComposing || event.altKey) return;
  const commandKey = event.ctrlKey || event.metaKey;
  if (!commandKey) return;

  const target = event.target;
  if (target && target !== sourceEditor && (target.matches?.('input, textarea, select') || target.isContentEditable)) return;
  if (document.querySelector('dialog[open]')) return;

  const key = event.key.toLowerCase();
  const redo = (key === 'z' && event.shiftKey) || (key === 'y' && !event.shiftKey);
  const undo = key === 'z' && !event.shiftKey;
  if (!undo && !redo) return;

  event.preventDefault();
  event.stopPropagation();
  if (redo) redoStudioEdit();
  else undoStudioEdit();
}

function announceHistoryAvailability() {
  document.documentElement.dataset.patchUndo = canUndoStudioEdit() ? 'available' : 'empty';
  document.documentElement.dataset.patchRedo = canRedoStudioEdit() ? 'available' : 'empty';
}

function announceHistoryStatus(message) {
  if (!saveState) return;
  saveState.textContent = message;
  saveState.title = `${canUndoStudioEdit() ? 'Undo available' : 'Undo empty'} · ${canRedoStudioEdit() ? 'Redo available' : 'Redo empty'}`;
}

export function viewStudioSource() {
  const selected = document.querySelector('#designerCanvas .designer-selected');
  const sourceAction = document.querySelector('#designerInspectorSource');
  if (selected && sourceAction && !sourceAction.disabled) {
    sourceAction.click();
    return true;
  }
  if (!sourceEditor) return false;
  sourceEditor.focus({ preventScroll: true });
  sourceEditor.scrollIntoView({ block: 'center' });
  return true;
}

export function viewStudioDesigner() {
  document.querySelector('#tabDesigner')?.click();
  requestAnimationFrame(() => {
    const selected = document.querySelector('#designerCanvas .designer-selected');
    const target = selected ?? document.querySelector('#designerCanvas .designer-control');
    if (target && typeof target.focus === 'function') target.focus({ preventScroll: true });
    (target ?? document.querySelector('#designer'))?.scrollIntoView?.({ block: 'center' });
  });
  return Boolean(document.querySelector('#tabDesigner'));
}

export function toggleSourceDesignerView() {
  const active = document.activeElement;
  if (sourceEditor && (active === sourceEditor || sourceEditor.contains?.(active))) return viewStudioDesigner();
  return viewStudioSource();
}

const dialog = document.querySelector('#commandPalette');
const trigger = document.querySelector('#openCommandPalette');
const statusTrigger = document.querySelector('#statusCommands');
const input = document.querySelector('#commandPaletteInput');
const list = document.querySelector('#commandPaletteList');
const empty = document.querySelector('#commandPaletteEmpty');

if (dialog && trigger && input && list && empty) {
  const staticCommands = [
    command('run', 'Run project', 'Execute the current Patch project', 'Ctrl/Cmd + Enter', 'run execute start', () => document.querySelector('#run')?.click()),
    command('build', 'Build selected target', 'Build using the current target selector', 'Ctrl/Cmd + Shift + Enter', 'build compile package target', () => document.querySelector('#build')?.click()),
    command('undo-edit', 'Undo Studio edit', 'Undo the most recent source or Designer transaction', 'Ctrl/Cmd + Z', 'undo history designer source edit', undoStudioEdit),
    command('redo-edit', 'Redo Studio edit', 'Replay the most recently undone Studio transaction', 'Ctrl/Cmd + Shift + Z', 'redo history designer source edit', redoStudioEdit),
    command('toggle-source-designer', 'Toggle Source / Designer', 'Switch between the active Patch source and visual Form Designer', 'F12', 'source designer form code unit toggle view', toggleSourceDesignerView),
    command('editor', 'Focus source editor', 'Jump to the active Patch source or selected Designer control declaration', '', 'source code editor main patch view source', viewStudioSource),
    command('designer', 'Open Designer', 'Show the source-backed visual Designer and restore Designer focus', '', 'designer form controls visual view form', viewStudioDesigner),
    command('app', 'Open App preview', 'Show the last running Window app', '', 'app preview window', () => click('#tabApp')),
    command('output', 'Open Output', 'Show runtime and build output', '', 'output console logs', () => click('#tabOutput')),
    command('changes', 'Open Change Contract', 'Inspect semantic changes and capabilities', '', 'changes contract capabilities policy', () => click('#tabChanges')),
    command('ir', 'Open Change IR', 'Inspect the compiled Change IR', '', 'ir compiler change intermediate', () => click('#tabIr')),
    command('recovery', 'Open Recovery', 'Manage local project recovery snapshots', '', 'recovery restore snapshots local', () => click('#recoverProject')),
    command('documentation', 'Open Documentation', 'Browse the current Patch product map', '', 'docs documentation reference', () => navigate('./docs.html')),
    command('downloads', 'Open Downloads', 'Get the offline compiler and release assets', '', 'downloads compiler offline', () => navigate('./downloads.html')),
    command('help', 'Open Help', 'Keyboard shortcuts, Designer and build help', '', 'help keyboard shortcuts support', () => navigate('./help.html'))
  ];

  let commands = staticCommands;
  let visible = commands;
  let activeIndex = 0;
  let returnFocus = null;
  const defer = typeof queueMicrotask === 'function'
    ? queueMicrotask
    : callback => Promise.resolve().then(callback);

  input.setAttribute('aria-controls', list.id);
  input.setAttribute('aria-autocomplete', 'list');

  trigger.addEventListener('click', openPalette);
  statusTrigger?.addEventListener('click', openPalette);
  window.addEventListener('keydown', event => {
    if (event.defaultPrevented || event.isComposing) return;
    const commandKey = event.ctrlKey || event.metaKey;
    if (!commandKey || event.altKey || event.shiftKey || event.key.toLowerCase() !== 'k') return;
    event.preventDefault();
    if (dialog.open) closePalette();
    else openPalette();
  });

  input.addEventListener('input', applyFilter);

  input.addEventListener('keydown', event => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      move(1);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      move(-1);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      runActive();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      closePalette();
    }
  });

  list.addEventListener('click', event => {
    const button = event.target?.closest?.('[data-command-index]');
    if (!button || !list.contains(button)) return;
    const index = Number(button.dataset.commandIndex);
    if (!Number.isInteger(index) || !visible[index]) return;
    execute(visible[index]);
  });

  dialog.addEventListener('click', event => {
    if (event.target === dialog) closePalette();
  });
  dialog.addEventListener('cancel', event => {
    event.preventDefault();
    closePalette();
  });
  dialog.addEventListener('close', () => {
    resetPalette();
    restorePaletteFocus();
  });
  window.addEventListener('patch:studio-project-files-changed', refreshOpenPalette);
  window.addEventListener('patch:studio-active-file-changed', refreshOpenPalette);

  refreshCommands();
  render();

  function openPalette() {
    if (!dialog.open) {
      const active = document.activeElement;
      returnFocus = active && active !== document.body && typeof active.focus === 'function' ? active : trigger;
    }
    resetPalette();
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else dialog.setAttribute('open', '');
    requestAnimationFrame(() => input.focus({ preventScroll: true }));
  }

  function closePalette() {
    const wasOpen = dialog.open || dialog.hasAttribute('open');
    if (!wasOpen) return;
    if (typeof dialog.close === 'function' && dialog.open) dialog.close();
    else {
      dialog.removeAttribute('open');
      resetPalette();
      restorePaletteFocus();
    }
  }

  function restorePaletteFocus() {
    const target = returnFocus;
    returnFocus = null;
    if (!target?.isConnected || typeof target.focus !== 'function') return;
    target.focus({ preventScroll: true });
  }

  function resetPalette() {
    input.value = '';
    refreshCommands();
    visible = commands;
    activeIndex = 0;
    render();
  }

  function refreshOpenPalette() {
    if (!dialog.open) return;
    refreshCommands();
    applyFilter();
  }

  function refreshCommands() {
    let projectItems = [];
    try {
      projectItems = buildStudioQuickOpenItems(getStudioProjectFiles()).map(item => command(
        `quick-open:${item.id}`,
        item.label,
        item.detail,
        '',
        item.keywords,
        () => openProjectItem(item),
        item.type === 'file' ? 'File' : symbolTypeLabel(item.symbolKind)
      ));
    } catch {
      projectItems = [];
    }
    commands = [...staticCommands, ...projectItems];
  }

  function applyFilter() {
    visible = rankStudioQuickOpenItems(commands, input.value);
    activeIndex = 0;
    render();
  }

  function move(delta) {
    if (!visible.length) return;
    activeIndex = (activeIndex + delta + visible.length) % visible.length;
    render();
    list.querySelector(`[data-command-index="${activeIndex}"]`)?.scrollIntoView({ block: 'nearest' });
  }

  function runActive() {
    const item = visible[activeIndex];
    if (item) execute(item);
  }

  function execute(item) {
    closePalette();
    defer(() => {
      try {
        item.run();
      } catch (error) {
        reportNavigationFailure(error);
      }
    });
  }

  function render() {
    list.replaceChildren();
    empty.hidden = visible.length !== 0;
    let activeOptionId = '';
    visible.forEach((item, index) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.id = `commandPaletteOption-${index}`;
      button.className = 'command-palette-item';
      button.dataset.commandIndex = String(index);
      button.setAttribute('role', 'option');
      button.setAttribute('aria-selected', index === activeIndex ? 'true' : 'false');
      if (index === activeIndex) activeOptionId = button.id;

      const copy = document.createElement('span');
      copy.className = 'command-palette-copy';
      const labelRow = document.createElement('span');
      labelRow.className = 'command-palette-label-row';
      const label = document.createElement('strong');
      label.textContent = item.label;
      labelRow.appendChild(label);
      if (item.kind) {
        const kind = document.createElement('span');
        kind.className = 'command-palette-kind';
        kind.textContent = item.kind;
        labelRow.appendChild(kind);
      }
      const detail = document.createElement('span');
      detail.textContent = item.detail;
      copy.append(labelRow, detail);
      button.appendChild(copy);

      if (item.shortcut) {
        const shortcut = document.createElement('kbd');
        shortcut.textContent = item.shortcut;
        button.appendChild(shortcut);
      }
      list.appendChild(button);
    });
    if (activeOptionId) input.setAttribute('aria-activedescendant', activeOptionId);
    else input.removeAttribute('aria-activedescendant');
  }
}

function command(id, label, detail, shortcut, keywords, run, kind = 'Command') {
  return { id, label, detail, shortcut, keywords, run, kind };
}

function openProjectItem(item) {
  activateStudioProjectFile(item.file);
  const editor = document.querySelector('#code');
  if (!editor) return;
  editor.dispatchEvent(new Event('input', { bubbles: true }));
  editor.dispatchEvent(new Event('change', { bubbles: true }));

  if (Number.isInteger(item.line)) {
    const range = lineSelectionRange(editor.value, item.line);
    if (range) {
      editor.focus({ preventScroll: true });
      editor.setSelectionRange(range.start, range.end);
      editor.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  } else {
    editor.focus({ preventScroll: true });
    editor.scrollIntoView({ block: 'center' });
  }

  window.dispatchEvent(new CustomEvent('patch:studio-quick-open', {
    detail: { file: item.file, line: item.line, type: item.type }
  }));
}

function symbolTypeLabel(kind) {
  const labels = { window: 'Form', state: 'State', event: 'Event', recipe: 'Recipe', field: 'Field', param: 'Param' };
  return labels[kind] ?? 'Symbol';
}

function reportNavigationFailure(error) {
  const status = document.querySelector('#projectOutlineStatus');
  if (!status) return;
  status.textContent = error?.message || 'Quick open failed';
  status.dataset.state = 'invalid';
}

function click(selector) {
  document.querySelector(selector)?.click();
}

function focus(selector) {
  const element = document.querySelector(selector);
  element?.focus({ preventScroll: true });
  element?.scrollIntoView({ block: 'center' });
}

function navigate(href) {
  window.location.href = href;
}