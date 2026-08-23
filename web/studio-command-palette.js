import { lineSelectionRange } from '../src/studio-outline-model.js';
import { buildStudioQuickOpenItems, rankStudioQuickOpenItems } from '../src/studio-quick-open.js';
import { activateStudioProjectFile, getStudioProjectFiles } from './project-lifecycle.js';

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
    command('editor', 'Focus source editor', 'Jump to the active Patch source', '', 'source code editor main patch', () => focus('#code')),
    command('designer', 'Open Designer', 'Show the source-backed visual Designer', '', 'designer form controls visual', () => click('#tabDesigner')),
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
  const defer = typeof queueMicrotask === 'function'
    ? queueMicrotask
    : callback => Promise.resolve().then(callback);

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
  dialog.addEventListener('close', resetPalette);
  window.addEventListener('patch:studio-project-files-changed', refreshOpenPalette);
  window.addEventListener('patch:studio-active-file-changed', refreshOpenPalette);

  refreshCommands();
  render();

  function openPalette() {
    resetPalette();
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else dialog.setAttribute('open', '');
    requestAnimationFrame(() => input.focus());
  }

  function closePalette() {
    if (typeof dialog.close === 'function' && dialog.open) dialog.close();
    else dialog.removeAttribute('open');
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
    visible.forEach((item, index) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'command-palette-item';
      button.dataset.commandIndex = String(index);
      button.setAttribute('role', 'option');
      button.setAttribute('aria-selected', index === activeIndex ? 'true' : 'false');

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
      const status = document.querySelector('#projectOutlineStatus');
      if (status) {
        status.textContent = `${item.file} · line ${range.line}`;
        status.dataset.state = 'ready';
      }
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
  const labels = { window: 'Form', state: 'State', event: 'Event', recipe: 'Recipe' };
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
