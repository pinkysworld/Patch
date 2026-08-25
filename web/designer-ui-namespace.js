import { parse } from '../src/parser.js';
import { listDesignerControls } from '../src/designer.js';
import {
  DESIGNER_SELECTION_EVENT,
  currentDesignerSelection
} from './designer-selection.js';

export const PATCH_DESIGNER_UI_NAMESPACE_VERSION = '0.1';

const doc = typeof document === 'undefined' ? null : document;
const code = doc?.querySelector('#code') ?? null;
const canvas = doc?.querySelector('#designerCanvas') ?? null;

if (doc && code && canvas) queueMicrotask(install);

export function listDesignerUiNamespace(source) {
  const ast = parse(String(source ?? ''));
  const out = [];
  const add = (id, kind, type, line) => {
    const name = String(id ?? '').trim();
    if (!name) return;
    out.push({ id: name, kind, type, line: line ?? null });
  };
  const visitControls = nodes => {
    for (const node of nodes ?? []) {
      if (node.kind === 'uiControl') {
        add(node.id, 'control', node.control, node.line);
        if (node.control === 'panel') visitControls(node.body);
        continue;
      }
      if (node.kind === 'tabs') {
        add(node.id, 'control', 'tabs', node.line);
        for (const page of node.body ?? []) visitControls(page.body);
      }
    }
  };

  for (const node of ast) {
    if (node.kind === 'window') {
      visitControls(node.body);
      for (const child of node.body ?? []) {
        if (child.kind !== 'menu') continue;
        for (const item of child.body ?? []) {
          if (item.kind === 'menuItem') add(item.id, 'menuItem', 'menuItem', item.line);
        }
      }
      continue;
    }
    if (node.kind === 'confirmDialog' || node.kind === 'openFileDialog' || node.kind === 'saveFileDialog') {
      add(node.id, 'resultDialog', node.kind, node.line);
    }
  }
  return out;
}

export function designerUiIdCollision(source, desiredId, currentId = '') {
  const id = String(desiredId ?? '').trim();
  const current = String(currentId ?? '').trim();
  if (!id || id === current) return null;
  return listDesignerUiNamespace(source).find(record => record.id === id) ?? null;
}

export function describeDesignerUiId(record) {
  if (!record) return 'UI object';
  if (record.kind === 'menuItem') return 'MenuItem';
  if (record.kind === 'resultDialog') {
    if (record.type === 'confirmDialog') return 'Confirm dialog';
    if (record.type === 'openFileDialog') return 'Open-file dialog';
    if (record.type === 'saveFileDialog') return 'Save-file dialog';
    return 'Result dialog';
  }
  if (record.type === 'tabs') return 'Tabs';
  if (record.type === 'panel') return 'Panel';
  const type = String(record.type ?? 'control');
  return type ? `${type[0].toUpperCase()}${type.slice(1)} control` : 'Control';
}

function install() {
  if (doc.documentElement.dataset.patchUiNamespaceGuard === 'true') return;
  doc.documentElement.dataset.patchUiNamespaceGuard = 'true';
  doc.addEventListener('click', interceptInspectorApply, { capture: true });
  doc.addEventListener('keydown', interceptInspectorEnter, { capture: true });
  canvas.addEventListener(DESIGNER_SELECTION_EVENT, clearNamespaceError);
  code.addEventListener('input', clearNamespaceError);
}

function interceptInspectorApply(event) {
  if (!event.target?.closest?.('#designerInspectorApply')) return;
  guardCurrentInspectorId(event);
}

function interceptInspectorEnter(event) {
  if (event.key !== 'Enter' || event.target?.id !== 'designerInspectorId') return;
  guardCurrentInspectorId(event);
}

function guardCurrentInspectorId(event) {
  const selection = currentDesignerSelection(canvas);
  if (!selection) return;
  let control = null;
  try {
    control = listDesignerControls(code.value).find(item =>
      Number(item.windowIndex) === Number(selection.windowIndex) &&
      Number(item.controlIndex) === Number(selection.controlIndex)
    ) ?? null;
  } catch {
    return;
  }
  if (!control || control.type === 'text') return;
  const field = doc.querySelector('#designerInspectorId');
  if (!field) return;
  const collision = designerUiIdCollision(code.value, field.value, control.id ?? '');
  if (!collision) return;

  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation();
  const label = describeDesignerUiId(collision);
  const line = collision.line ? ` at line ${collision.line}` : '';
  showNamespaceError(`UI name '${collision.id}' is already used by ${label}${line}. Choose a unique control name.`);
  field.focus();
  field.select?.();
}

function showNamespaceError(message) {
  const target = doc.querySelector('#designerInspectorError');
  if (!target) return;
  target.textContent = message;
  target.hidden = false;
  target.dataset.patchUiNamespaceError = 'true';
}

function clearNamespaceError() {
  const target = doc?.querySelector('#designerInspectorError');
  if (!target || target.dataset.patchUiNamespaceError !== 'true') return;
  target.hidden = true;
  target.textContent = '';
  delete target.dataset.patchUiNamespaceError;
}
