import { parse } from '../src/parser.js';
import { normalizeDesignerControlClipboard } from './designer-control-clipboard-model.js';

export const DESIGNER_CONTROL_CLIPBOARD_GUARD_VERSION = '0.1';

export function validateDesignerControlClipboardSemantics(value) {
  const payload = normalizeDesignerControlClipboard(value);
  const source = syntheticClipboardSource(payload);
  let ast;
  try {
    ast = parse(source);
  } catch (error) {
    throw new Error(`Designer clipboard control source is not valid Patch: ${error?.message ?? error}`);
  }

  const window = (ast ?? []).find(node => node.kind === 'window');
  const controls = (window?.body ?? []).filter(node => node.kind === 'uiControl' || node.kind === 'tabs');
  if (controls.length !== 1) throw new Error('Designer clipboard must contain exactly one top-level control.');

  const root = controls[0];
  const actualType = root.kind === 'tabs' ? 'tabs' : root.control;
  if (actualType !== payload.controlType) {
    throw new Error(`Designer clipboard control type '${payload.controlType}' does not match parsed '${actualType}'.`);
  }

  const actualIds = collectIds(root).map(record => ({
    id: record.id,
    type: record.type,
    line: record.line - 2
  }));
  const declaredIds = payload.ids.map(record => ({ id: record.id, type: record.type, line: record.line }));
  if (JSON.stringify(actualIds) !== JSON.stringify(declaredIds)) {
    throw new Error('Designer clipboard id records do not exactly match the copied control source.');
  }

  if (payload.handlers.length) {
    const handlerSource = [
      source.replace(/\n$/, ''),
      '',
      ...payload.handlers.flatMap((handler, index) => [
        ...(index ? [''] : []),
        ...handler.lines
      ])
    ].join('\n') + '\n';
    try {
      parse(handlerSource);
    } catch (error) {
      throw new Error(`Designer clipboard event handler source is not valid Patch: ${error?.message ?? error}`);
    }
  }

  return payload;
}

function syntheticClipboardSource(payload) {
  return [
    'window "Clipboard" as clipboard size 640, 420:',
    ...payload.lines.map(line => line ? `  ${line}` : ''),
    ''
  ].join('\n');
}

function collectIds(node, out = []) {
  if (!node || typeof node !== 'object') return out;
  if ((node.kind === 'uiControl' || node.kind === 'tabs') && node.id) {
    out.push({
      id: node.id,
      type: node.kind === 'tabs' ? 'tabs' : node.control,
      line: node.line
    });
  }
  if (node.kind === 'tabs') {
    for (const page of node.body ?? []) {
      for (const child of page.body ?? []) collectIds(child, out);
    }
  }
  if (node.kind === 'uiControl' && node.control === 'panel') {
    for (const child of node.body ?? []) collectIds(child, out);
  }
  return out;
}
