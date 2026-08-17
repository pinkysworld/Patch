import { parse } from '../src/parser.js';
import {
  activateStudioProjectFile,
  addStudioProjectFile,
  getActiveStudioProjectFile,
  getStudioProjectBuildInput,
  getStudioProjectFiles,
  removeStudioProjectFile,
  replaceStudioProjectSource
} from './project-lifecycle.js';

const doc = typeof document === 'undefined' ? null : document;
const code = doc?.querySelector('#code') ?? null;
const outline = doc?.querySelector('#projectOutlineTree') ?? null;
const status = doc?.querySelector('#projectOutlineStatus') ?? null;
const designerTab = doc?.querySelector('#tabDesigner') ?? null;
const projectKind = doc?.querySelector('#projectKind') ?? null;
const sample = doc?.querySelector('#sample') ?? null;
const runButton = doc?.querySelector('#run') ?? null;
const buildButton = doc?.querySelector('#build') ?? null;

let scheduled = false;
const lastGoodModels = new Map();

if (code && outline && status) {
  installProjectTreeActions();
  installProjectSourceBridge();
  code.addEventListener('input', scheduleRender);
  code.addEventListener('change', scheduleRender);
  window.addEventListener('patch:studio-active-file-changed', scheduleRender);
  window.addEventListener('patch:studio-project-files-changed', scheduleRender);
  sample?.addEventListener('change', () => {
    queueMicrotask(() => {
      try {
        replaceStudioProjectSource(code.value, { kind: projectKind?.value ?? 'console', snapshot: 'force' });
        renderOutline();
      } catch { /* the regular Studio status reports persistence errors */ }
    });
  });
  requestAnimationFrame(renderOutline);
}

function installProjectTreeActions() {
  const title = outline.closest('.project-outline')?.querySelector('.pane-title');
  if (title && !title.querySelector('.outline-actions')) {
    const actions = document.createElement('span');
    actions.className = 'outline-actions';
    actions.innerHTML = '<button type="button" class="outline-action" data-project-action="file" title="Add Patch source file">+ File</button><button type="button" class="outline-action" data-project-action="form" title="Add a source-backed Form file">+ Form</button>';
    title.append(actions);
  }

  title?.addEventListener('click', event => {
    const action = event.target.closest('button[data-project-action]')?.dataset.projectAction;
    if (action === 'file') addSourceFile();
    if (action === 'form') addFormFile();
  });

  outline.addEventListener('click', event => {
    const remove = event.target.closest('button[data-remove-file]');
    if (remove) {
      const path = remove.dataset.removeFile;
      if (confirm(`Remove ${path} from this project?`)) {
        try {
          removeStudioProjectFile(path);
          signalEditorChanged();
          renderOutline();
        } catch (error) {
          setTreeStatus(error.message, 'invalid');
        }
      }
      return;
    }

    const symbol = event.target.closest('button[data-line][data-file]');
    if (symbol) {
      activateFile(symbol.dataset.file);
      jumpToLine(Number(symbol.dataset.line), symbol.dataset.file);
      if (symbol.dataset.kind === 'window') designerTab?.click();
      return;
    }

    const file = event.target.closest('button[data-file-only]');
    if (file) activateFile(file.dataset.fileOnly);
  });
}

function installProjectSourceBridge() {
  const descriptor = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value');
  if (!descriptor?.get || !descriptor?.set || code.dataset.projectSourceBridge === '1') return;
  let virtualSource = null;
  Object.defineProperty(code, 'value', {
    configurable: true,
    enumerable: true,
    get() { return virtualSource ?? descriptor.get.call(this); },
    set(value) { descriptor.set.call(this, value); }
  });
  code.dataset.projectSourceBridge = '1';

  document.addEventListener('click', event => {
    const target = event.target.closest?.('#run, #build');
    if (!target) return;
    try {
      const { composition } = getStudioProjectBuildInput();
      if (composition.files.length <= 1) return;
      virtualSource = composition.source;
      queueMicrotask(() => { virtualSource = null; });
    } catch {
      virtualSource = null;
    }
  }, true);

  document.addEventListener('keydown', event => {
    const isRun = (event.ctrlKey || event.metaKey) && event.key === 'Enter';
    if (!isRun) return;
    try {
      const { composition } = getStudioProjectBuildInput();
      if (composition.files.length <= 1) return;
      virtualSource = composition.source;
      queueMicrotask(() => { virtualSource = null; });
    } catch {
      virtualSource = null;
    }
  }, true);
}

function addSourceFile() {
  const requested = prompt('New Patch source path', 'src/helpers.patch');
  if (!requested) return;
  const path = requested.trim().toLowerCase().endsWith('.patch') ? requested.trim() : `${requested.trim()}.patch`;
  try {
    addStudioProjectFile(path, '');
    signalEditorChanged();
    renderOutline();
  } catch (error) {
    setTreeStatus(error.message, 'invalid');
  }
}

function addFormFile() {
  const title = prompt('Form name', 'Settings');
  if (!title?.trim()) return;
  const id = safeIdentifier(title);
  const requested = prompt('Form source path', `forms/${id}.patch`);
  if (!requested) return;
  const path = requested.trim().toLowerCase().endsWith('.patch') ? requested.trim() : `${requested.trim()}.patch`;
  const escapedTitle = title.trim().replaceAll('\\', '\\\\').replaceAll('"', '\\"');
  const content = `window "${escapedTitle}" as ${id}:\n  text "${escapedTitle}"\n`;
  try {
    addStudioProjectFile(path, content);
    if (projectKind) {
      projectKind.value = 'window';
      projectKind.dispatchEvent(new Event('change', { bubbles: true }));
    }
    signalEditorChanged();
    designerTab?.click();
    renderOutline();
  } catch (error) {
    setTreeStatus(error.message, 'invalid');
  }
}

function activateFile(path) {
  try {
    activateStudioProjectFile(path);
    signalEditorChanged();
    renderOutline();
  } catch (error) {
    setTreeStatus(error.message, 'invalid');
  }
}

function signalEditorChanged() {
  code.dispatchEvent(new Event('input', { bubbles: true }));
  code.dispatchEvent(new Event('change', { bubbles: true }));
}

function scheduleRender() {
  if (scheduled) return;
  scheduled = true;
  requestAnimationFrame(() => {
    scheduled = false;
    renderOutline();
  });
}

function renderOutline() {
  let files;
  try {
    files = getStudioProjectFiles();
  } catch (error) {
    outline.replaceChildren(emptyMessage(error.message));
    setTreeStatus('Project tree unavailable', 'invalid');
    return;
  }

  const active = getActiveStudioProjectFile();
  const entry = files.some(file => file.path === 'main.patch') ? 'main.patch' : files[0]?.path;
  const fragment = document.createDocumentFragment();
  let invalidCount = 0;
  let symbolCount = 0;

  for (const file of files) {
    let groups;
    let error = null;
    try {
      groups = buildOutlineModel(parse(file.content));
      lastGoodModels.set(file.path, groups);
    } catch (caught) {
      error = caught;
      invalidCount += 1;
      groups = lastGoodModels.get(file.path) ?? [];
    }
    symbolCount += groups.reduce((sum, group) => sum + group.items.length, 0);
    fragment.append(renderFile(file, groups, {
      active: file.path === active,
      entry: file.path === entry,
      invalid: Boolean(error),
      error
    }));
  }

  if (!files.length) fragment.append(emptyMessage('Add a Patch source file to begin.'));
  outline.replaceChildren(fragment);
  const suffix = invalidCount ? ` · ${invalidCount} invalid` : symbolCount ? ` · ${symbolCount} symbols` : '';
  setTreeStatus(`${files.length} file${files.length === 1 ? '' : 's'} · ${active}${suffix}`, invalidCount ? 'invalid' : 'ready');
}

export function buildOutlineModel(ast) {
  const groups = [
    { key: 'forms', label: 'Forms', items: [] },
    { key: 'state', label: 'State', items: [] },
    { key: 'events', label: 'Events', items: [] },
    { key: 'recipes', label: 'Recipes', items: [] }
  ];
  const byKey = new Map(groups.map(group => [group.key, group]));

  for (const node of ast) {
    if (node.kind === 'window') {
      byKey.get('forms').items.push({
        kind: 'window',
        line: node.line,
        label: node.id || displayExpr(node.titleExpr) || 'window',
        meta: displayExpr(node.titleExpr)
      });
    } else if (node.kind === 'create') {
      byKey.get('state').items.push({ kind: 'state', line: node.line, label: node.name, meta: node.valueType });
    } else if (node.kind === 'createThing') {
      byKey.get('state').items.push({ kind: 'state', line: node.line, label: node.name, meta: 'thing' });
    } else if (node.kind === 'event') {
      byKey.get('events').items.push({ kind: 'event', line: node.line, label: node.control, meta: node.event });
    } else if (node.kind === 'recipe' || node.kind === 'function') {
      byKey.get('recipes').items.push({ kind: 'recipe', line: node.line, label: node.name, meta: 'recipe' });
    }
  }

  return groups.filter(group => group.items.length);
}

export function lineSelectionRange(source, line) {
  const lines = String(source).split(/\r?\n/);
  if (!Number.isInteger(line) || line < 1 || !lines.length) return null;
  const target = Math.min(line, lines.length);
  let start = 0;
  for (let index = 0; index < target - 1; index += 1) start += lines[index].length + 1;
  return { line: target, start, end: start + (lines[target - 1]?.length ?? 0) };
}

function renderFile(file, groups, options) {
  const section = document.createElement('section');
  section.className = 'outline-file-section';
  if (options.active) section.classList.add('active');
  if (options.invalid) section.classList.add('invalid');

  const header = document.createElement('div');
  header.className = 'outline-file-row';
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'outline-file';
  button.dataset.fileOnly = file.path;
  button.setAttribute('aria-current', options.active ? 'true' : 'false');
  button.innerHTML = `<span aria-hidden="true">${options.entry ? '◆' : '◇'}</span><strong></strong><span class="outline-file-state"></span>`;
  button.querySelector('strong').textContent = file.path;
  button.querySelector('.outline-file-state').textContent = options.invalid ? 'invalid' : options.entry ? 'entry' : '';
  header.append(button);

  if (!options.entry) {
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'outline-file-remove';
    remove.dataset.removeFile = file.path;
    remove.title = `Remove ${file.path}`;
    remove.setAttribute('aria-label', `Remove ${file.path}`);
    remove.textContent = '×';
    header.append(remove);
  }
  section.append(header);

  if (options.invalid && !groups.length) {
    const line = Number.isInteger(options.error?.line) ? ` at line ${options.error.line}` : '';
    section.append(emptyMessage(`Waiting for valid source${line}.`));
    return section;
  }
  if (!groups.length) {
    section.append(emptyMessage('No outline symbols yet.'));
    return section;
  }

  for (const group of groups) {
    const groupSection = document.createElement('div');
    groupSection.className = 'outline-group';
    groupSection.dataset.group = group.key;
    const heading = document.createElement('div');
    heading.className = 'outline-group-title';
    heading.textContent = `${group.label} · ${group.items.length}`;
    groupSection.append(heading);
    const list = document.createElement('div');
    list.className = 'outline-items';
    for (const item of group.items) list.append(renderItem(item, file.path));
    groupSection.append(list);
    section.append(groupSection);
  }
  return section;
}

function renderItem(item, file) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'outline-item';
  button.dataset.file = file;
  button.dataset.line = String(item.line);
  button.dataset.kind = item.kind;
  button.title = `Jump to ${file}:${item.line}`;
  button.setAttribute('aria-label', `${item.label}, ${item.meta || item.kind}, ${file} line ${item.line}`);

  const label = document.createElement('span');
  label.className = 'outline-item-label';
  label.textContent = item.label;
  const meta = document.createElement('span');
  meta.className = 'outline-item-meta';
  meta.textContent = item.meta || `line ${item.line}`;
  button.append(label, meta);
  return button;
}

function emptyMessage(text) {
  const message = document.createElement('p');
  message.className = 'outline-empty';
  message.textContent = text;
  return message;
}

function jumpToLine(line, file = getActiveStudioProjectFile()) {
  const range = lineSelectionRange(code.value, line);
  if (!range) return;
  code.focus({ preventScroll: true });
  code.setSelectionRange(range.start, range.end);
  code.scrollIntoView({ behavior: 'smooth', block: 'center' });
  setTreeStatus(`${file} · line ${range.line}`, 'ready');
}

function setTreeStatus(text, state) {
  status.textContent = text;
  status.dataset.state = state;
}

function safeIdentifier(value) {
  const id = String(value).trim().toLowerCase().replace(/[^a-z0-9_]+/g, '_').replace(/^\d+/, '').replace(/^_+|_+$/g, '');
  return id || 'form';
}

function displayExpr(expr) {
  const text = String(expr ?? '').trim();
  if (text.length >= 2 && text.startsWith('"') && text.endsWith('"')) return text.slice(1, -1);
  return text;
}
