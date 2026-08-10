import { buildFormLayoutManifest } from './form-layout.js';
import { validateWindowRuntimeSupport } from './window-build.js';

export const PATCH_NATIVE_GUI_IR_FORMAT = 'patch-native-gui-ir';
export const PATCH_NATIVE_GUI_IR_VERSION = '0.1';

export class NativeGuiError extends Error {}

/**
 * Lower the deliberately small, beginner-facing Patch Forms surface into a
 * platform-neutral GUI IR. Backends fail closed instead of silently dropping
 * Patch behavior they do not understand.
 */
export function buildNativeGuiIR(compiled) {
  if (!compiled || !Array.isArray(compiled.ast)) {
    throw new NativeGuiError('A compiled Patch Window program is required for native GUI lowering.');
  }
  validateWindowRuntimeSupport(compiled);

  const layout = buildFormLayoutManifest(compiled.ast);
  const states = [];
  const stateByName = new Map();
  const forms = [];
  const controls = new Map();
  const events = [];
  const eventKeys = new Set();

  // State is collected first so a visual declaration can bind to state even
  // when the user places the create line later in the source file.
  for (const node of compiled.ast) {
    if (node.kind !== 'create') continue;
    if (!['number', 'text', 'boolean'].includes(node.valueType)) {
      throw new NativeGuiError(`line ${node.line ?? '?'}: native GUI v0.1 supports number, text and boolean state.`);
    }
    if (stateByName.has(node.name)) {
      throw new NativeGuiError(`line ${node.line ?? '?'}: native state '${node.name}' is declared more than once.`);
    }
    const state = { name: node.name, type: node.valueType, initial: parseInitialLiteral(node) };
    states.push(state);
    stateByName.set(node.name, state);
  }

  let namedFormIndex = 0;
  for (const node of compiled.ast) {
    if (node.kind === 'create') continue;

    if (node.kind === 'window') {
      const windowIndex = forms.length;
      const formLayout = layout.windows[windowIndex];
      const formId = node.id ?? `__window_${windowIndex + 1}`;
      const isNamed = Boolean(node.id);
      const form = {
        id: formId,
        sourceId: node.id ?? null,
        title: requireTextLiteral(node.titleExpr, node.line, 'Form title'),
        width: node.width ?? 640,
        height: node.height ?? 420,
        visible: isNamed ? namedFormIndex++ === 0 : true,
        controls: []
      };

      let controlIndex = 0;
      for (const child of node.body ?? []) {
        if (child.kind !== 'uiControl') continue;
        if (!['text', 'button', 'input', 'checkbox'].includes(child.control)) {
          throw new NativeGuiError(`line ${child.line ?? '?'}: native GUI v0.1 does not support '${child.control}' controls yet.`);
        }
        const effective = formLayout?.controls?.[controlIndex] ?? defaultLayout(child.control, controlIndex);
        const control = {
          type: child.control,
          id: child.id ?? `__${child.control}_${windowIndex + 1}_${controlIndex + 1}`,
          text: child.textExpr ? requireTextLiteral(child.textExpr, child.line, `${child.control} text`) : '',
          binding: child.id ?? null,
          layout: effective ?? defaultLayout(child.control, controlIndex)
        };

        if ((child.control === 'input' || child.control === 'checkbox') && !child.id) {
          throw new NativeGuiError(`line ${child.line ?? '?'}: native ${child.control} controls need a simple Patch name after 'as'.`);
        }
        if (child.control === 'checkbox') requireBindingType(child, stateByName, 'boolean', 'Checkbox');
        if (child.control === 'input') requireBindingType(child, stateByName, 'text', 'Input');
        if (child.id) controls.set(child.id, { ...control, formId });
        form.controls.push(control);
        controlIndex += 1;
      }
      forms.push(form);
      continue;
    }

    if (node.kind === 'event') {
      const control = controls.get(node.control);
      if (!control) {
        throw new NativeGuiError(`line ${node.line ?? '?'}: native event '${node.control}' refers to an unknown control.`);
      }
      const key = `${node.control}\u0000${node.event}`;
      if (eventKeys.has(key)) {
        throw new NativeGuiError(`line ${node.line ?? '?'}: native GUI v0.1 requires one '${node.event}' handler for '${node.control}'.`);
      }
      eventKeys.add(key);
      const valueType = control.type === 'checkbox' ? 'boolean' : control.type === 'input' ? 'text' : null;
      events.push({
        control: node.control,
        event: node.event,
        valueType,
        actions: lowerNativeActions(node.body ?? [], stateByName, { ...node, valueType })
      });
      continue;
    }

    if (['allow', 'function'].includes(node.kind)) continue;
    if (['openForm', 'closeForm'].includes(node.kind)) {
      throw new NativeGuiError(`line ${node.line ?? '?'}: open/close belongs inside a GUI event for native GUI v0.1.`);
    }
    if (node.kind === 'createThing') {
      throw new NativeGuiError(`line ${node.line ?? '?'}: native GUI v0.1 does not support thing state yet.`);
    }
    throw new NativeGuiError(`line ${node.line ?? '?'}: native GUI v0.1 cannot lower top-level '${node.kind}' yet.`);
  }

  if (!forms.length) throw new NativeGuiError('Native GUI lowering needs at least one Patch Form.');

  return {
    format: PATCH_NATIVE_GUI_IR_FORMAT,
    version: PATCH_NATIVE_GUI_IR_VERSION,
    project: { name: compiled.project?.name ?? 'PatchApp' },
    states,
    forms,
    events
  };
}

export function validateNativeGuiIR(ir) {
  if (!ir || ir.format !== PATCH_NATIVE_GUI_IR_FORMAT || ir.version !== PATCH_NATIVE_GUI_IR_VERSION) {
    throw new NativeGuiError('Native GUI IR format/version is unsupported.');
  }
  if (!Array.isArray(ir.forms) || !ir.forms.length) throw new NativeGuiError('Native GUI IR contains no Forms.');
  if (!Array.isArray(ir.states) || !Array.isArray(ir.events)) throw new NativeGuiError('Native GUI IR is incomplete.');
  return ir;
}

function lowerNativeActions(nodes, states, event) {
  const actions = [];
  for (const node of nodes) {
    if (node.kind === 'openForm') {
      actions.push({ kind: 'openForm', form: node.form });
      continue;
    }
    if (node.kind === 'closeForm') {
      actions.push({ kind: 'closeForm', form: node.form });
      continue;
    }
    if (node.kind === 'change') {
      const state = states.get(node.target);
      if (!state) throw new NativeGuiError(`line ${node.line ?? '?'}: native change target '${node.target}' is not simple state.`);
      const ops = [];
      for (const op of node.ops ?? []) {
        if (op.field) throw new NativeGuiError(`line ${op.line ?? '?'}: native GUI v0.1 does not support field mutation yet.`);
        validateTypedOperation(state, op);
        if (op.op === 'clear') {
          ops.push({ op: 'clear' });
          continue;
        }
        const expr = String(op.expr ?? '').trim();
        if (expr === 'value') {
          if (!event || event.event !== 'changed' || !event.valueType) {
            throw new NativeGuiError(`line ${op.line ?? '?'}: event-local value is only available in typed changed handlers.`);
          }
          if (state.type !== event.valueType) {
            throw new NativeGuiError(`line ${op.line ?? '?'}: ${event.valueType} event value cannot be assigned to ${state.type} state '${state.name}'.`);
          }
          ops.push({ op: op.op, value: { kind: 'eventValue' } });
          continue;
        }
        ops.push({ op: op.op, value: { kind: 'literal', value: parseTypedLiteral(expr, state.type, op.line) } });
      }
      actions.push({ kind: 'change', target: node.target, stateType: state.type, ops });
      continue;
    }
    throw new NativeGuiError(`line ${node.line ?? '?'}: native GUI v0.1 event handlers support change, open and close only.`);
  }
  return actions;
}

function validateTypedOperation(state, op) {
  const allowed = state.type === 'number'
    ? new Set(['set', 'add', 'remove', 'clear'])
    : state.type === 'text'
      ? new Set(['set', 'add', 'clear'])
      : new Set(['set', 'clear']);
  if (!allowed.has(op.op)) {
    throw new NativeGuiError(`line ${op.line ?? '?'}: native GUI v0.1 cannot apply '${op.op}' to ${state.type} state '${state.name}'.`);
  }
}

function requireBindingType(control, states, expected, label) {
  const state = states.get(control.id);
  if (!state || state.type !== expected) {
    throw new NativeGuiError(`line ${control.line ?? '?'}: native ${label} '${control.id}' must bind to ${expected} state with the same name.`);
  }
}

function parseInitialLiteral(node) {
  return parseTypedLiteral(String(node.expr ?? '').trim(), node.valueType, node.line);
}

function parseTypedLiteral(expr, type, line) {
  if (type === 'boolean') {
    if (expr === 'true') return true;
    if (expr === 'false') return false;
    throw new NativeGuiError(`line ${line ?? '?'}: native boolean state currently needs a literal true/false value.`);
  }
  if (type === 'number') {
    const value = Number(expr);
    if (!Number.isFinite(value)) throw new NativeGuiError(`line ${line ?? '?'}: native number state currently needs a numeric literal.`);
    return value;
  }
  if (type === 'text') return requireTextLiteral(expr, line, 'text state');
  throw new NativeGuiError(`line ${line ?? '?'}: unsupported native state type '${type}'.`);
}

function requireTextLiteral(expr, line, label) {
  const text = String(expr ?? '').trim();
  if (!(text.startsWith('"') && text.endsWith('"'))) {
    throw new NativeGuiError(`line ${line ?? '?'}: ${label} must currently be simple text in quotes for native GUI v0.1.`);
  }
  try {
    const value = JSON.parse(text);
    if (typeof value !== 'string') throw new Error('not text');
    return value;
  } catch {
    throw new NativeGuiError(`line ${line ?? '?'}: ${label} is not valid quoted text.`);
  }
}

function defaultLayout(type, index) {
  const sizes = {
    text: [200, 30],
    button: [120, 36],
    input: [220, 36],
    checkbox: [220, 36]
  };
  const [width, height] = sizes[type] ?? [120, 36];
  return { x: 24, y: 24 + index * 48, width, height };
}
