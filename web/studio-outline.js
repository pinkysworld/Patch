import { parse } from '../src/parser.js';

const doc = typeof document === 'undefined' ? null : document;
const code = doc?.querySelector('#code') ?? null;
const outline = doc?.querySelector('#projectOutlineTree') ?? null;
const status = doc?.querySelector('#projectOutlineStatus') ?? null;
const designerTab = doc?.querySelector('#tabDesigner') ?? null;

let scheduled = false;
let lastGoodModel = null;

if (code && outline && status) {
  code.addEventListener('input', scheduleRender);
  code.addEventListener('change', scheduleRender);
  outline.addEventListener('click', event => {
    const target = event.target.closest('button[data-line]');
    if (!target) return;
    jumpToLine(Number(target.dataset.line));
    if (target.dataset.kind === 'window') designerTab?.click();
  });
  requestAnimationFrame(renderOutline);
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
  try {
    const ast = parse(code.value);
    lastGoodModel = buildOutlineModel(ast);
    outline.replaceChildren(renderModel(lastGoodModel));
    status.textContent = summarize(lastGoodModel);
    status.dataset.state = 'ready';
  } catch (error) {
    if (lastGoodModel) outline.replaceChildren(renderModel(lastGoodModel));
    else outline.replaceChildren(emptyMessage('Outline appears when main.patch parses.'));
    const line = Number.isInteger(error?.line) ? ` at line ${error.line}` : '';
    status.textContent = `Waiting for valid source${line}`;
    status.dataset.state = 'invalid';
  }
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
    } else if (node.kind === 'recipe') {
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

function renderModel(groups) {
  const fragment = document.createDocumentFragment();
  const file = document.createElement('div');
  file.className = 'outline-file';
  file.innerHTML = '<span aria-hidden="true">◆</span><strong>main.patch</strong>';
  fragment.append(file);

  if (!groups.length) {
    fragment.append(emptyMessage('No outline symbols yet.'));
    return fragment;
  }

  for (const group of groups) {
    const section = document.createElement('section');
    section.className = 'outline-group';
    section.dataset.group = group.key;

    const heading = document.createElement('div');
    heading.className = 'outline-group-title';
    heading.textContent = `${group.label} · ${group.items.length}`;
    section.append(heading);

    const list = document.createElement('div');
    list.className = 'outline-items';
    for (const item of group.items) list.append(renderItem(item));
    section.append(list);
    fragment.append(section);
  }
  return fragment;
}

function renderItem(item) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'outline-item';
  button.dataset.line = String(item.line);
  button.dataset.kind = item.kind;
  button.title = `Jump to line ${item.line}`;
  button.setAttribute('aria-label', `${item.label}, ${item.meta || item.kind}, line ${item.line}`);

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

function jumpToLine(line) {
  const range = lineSelectionRange(code.value, line);
  if (!range) return;
  code.focus({ preventScroll: true });
  code.setSelectionRange(range.start, range.end);
  code.scrollIntoView({ behavior: 'smooth', block: 'center' });
  status.textContent = `main.patch · line ${range.line}`;
  status.dataset.state = 'ready';
}

function displayExpr(expr) {
  const text = String(expr ?? '').trim();
  if (text.length >= 2 && text.startsWith('"') && text.endsWith('"')) return text.slice(1, -1);
  return text;
}

function summarize(groups) {
  const count = groups.reduce((sum, group) => sum + group.items.length, 0);
  return count ? `${count} symbol${count === 1 ? '' : 's'}` : 'main.patch';
}