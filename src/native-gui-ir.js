import { buildFormLayoutManifest } from './form-layout.js';
import { validateWindowRuntimeSupport } from './window-build.js';

export const PATCH_NATIVE_GUI_IR_FORMAT = 'patch-native-gui-ir';
export const PATCH_NATIVE_GUI_IR_VERSION = '0.4';

export class NativeGuiError extends Error {}

/**
 * Lower the deliberately small, beginner-facing Patch Forms surface into a
 * platform-neutral GUI IR. Backends fail closed instead of silently dropping
 * Patch behavior they do not understand.
 *
 * Native GUI IR v0.4 adds real Tabs containers. A Tabs control owns pages and
 * each page owns ordinary Patch controls. Which page is selected is deliberately
 * absent from this IR because selection is transient renderer state, not Patch
 * application state and not a semantic Change History entry.
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

  for (const node of compiled.ast) {
    if (node.kind !== 'create') continue;
    if (!['number', 'text', 'boolean'].includes(node.valueType)) {
      throw new NativeGuiError(`line ${node.line ?? '?'}: native GUI v0.4 supports number, text and boolean state.`);
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
        if (child.kind === 'tabs') {
          const effective = formLayout?.controls?.[controlIndex] ?? defaultLayout('tabs', controlIndex);
          const tabs = lowerTabsControl(child, {
            formId,
            windowIndex,
            controlIndex,
            stateByName,
            controls,
            layout: effective
          });
          form.controls.push(tabs);
          controlIndex += 1;
          continue;
        }
        if (child.kind !== 'uiControl') continue;
        const effective = formLayout?.controls?.[controlIndex] ?? defaultLayout(child.control, controlIndex);
        const control = lowerLeafControl(child, {
          stateByName,
          layout: effective,
          generatedId: `__${child.control}_${windowIndex + 1}_${controlIndex + 1}`
        });
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
        throw new NativeGuiError(`line ${node.line ?? '?'}: native GUI v0.4 requires one '${node.event}' handler for '${node.control}'.`);
      }
      eventKeys.add(key);
      const valueType = control.type === 'checkbox'
        ? 'boolean'
        : ['input', 'combo', 'listbox'].includes(control.type) ? 'text' : null;
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
      throw new NativeGuiError(`line ${node.line ?? '?'}: open/close belongs inside a GUI event for native GUI v0.4.`);
    }
    if (node.kind === 'createThing') {
      throw new NativeGuiError(`line ${node.line ?? '?'}: native GUI v0.4 does not support thing state yet.`);
    }
    throw new NativeGuiError(`line ${node.line ?? '?'}: native GUI v0.4 cannot lower top-level '${node.kind}' yet.`);
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
  for (const form of ir.forms) {
    for (const control of form.controls ?? []) validateControl(control, false);
  }
  return ir;
}

/**
 * Flatten nested native controls for backends and sealed payloads while keeping
 * enough parent metadata to recreate real platform Tabs containers. `nativeIndex`
 * and `parentTabIndex` are global across the application and are implementation
 * metadata only.
 */
export function flattenNativeGuiControls(ir) {
  validateNativeGuiIR(ir);
  const out = [];
  for (let formIndex = 0; formIndex < ir.forms.length; formIndex += 1) {
    const form = ir.forms[formIndex];
    for (const control of form.controls ?? []) {
      const nativeIndex = out.length;
      out.push({
        ...control,
        formIndex,
        nativeIndex,
        parentTabIndex: -1,
        pageIndex: -1,
        pageTitles: control.type === 'tabs' ? control.pages.map(page => page.title) : []
      });
      if (control.type !== 'tabs') continue;
      for (let pageIndex = 0; pageIndex < control.pages.length; pageIndex += 1) {
        for (const child of control.pages[pageIndex].controls ?? []) {
          out.push({
            ...child,
            formIndex,
            nativeIndex: out.length,
            parentTabIndex: nativeIndex,
            pageIndex,
            pageTitles: []
          });
        }
      }
    }
  }
  return out;
}

function lowerTabsControl(node, context) {
  if (!node.id) throw new NativeGuiError(`line ${node.line ?? '?'}: native Tabs needs a simple Patch name after 'as'.`);
  const pages = node.body ?? [];
  if (pages.length < 2) throw new NativeGuiError(`line ${node.line ?? '?'}: native Tabs needs at least two pages.`);
  const tabs = {
    type: 'tabs',
    id: node.id,
    text: '',
    binding: null,
    options: [],
    layout: context.layout ?? defaultLayout('tabs', context.controlIndex),
    pages: []
  };

  for (let pageIndex = 0; pageIndex < pages.length; pageIndex += 1) {
    const page = pages[pageIndex];
    if (page.kind !== 'tabPage') {
      throw new NativeGuiError(`line ${page.line ?? '?'}: native Tabs contains an unsupported '${page.kind}' page node.`);
    }
    const nativePage = {
      title: requireTextLiteral(page.titleExpr, page.line, `Tabs page ${pageIndex + 1} title`),
      controls: []
    };
    let childIndex = 0;
    for (const child of page.body ?? []) {
      if (child.kind === 'tabs') {
        throw new NativeGuiError(`line ${child.line ?? '?'}: native GUI v0.4 does not support nested Tabs.`);
      }
      if (child.kind !== 'uiControl') {
        throw new NativeGuiError(`line ${child.line ?? '?'}: native Tabs pages currently contain UI controls only.`);
      }
      const control = lowerLeafControl(child, {
        stateByName: context.stateByName,
        layout: defaultTabPageLayout(child.control, childIndex),
        generatedId: `__${child.control}_${context.windowIndex + 1}_tab_${context.controlIndex + 1}_${pageIndex + 1}_${childIndex + 1}`
      });
      if (child.id) context.controls.set(child.id, { ...control, formId: context.formId, tabsId: node.id, pageIndex });
      nativePage.controls.push(control);
      childIndex += 1;
    }
    tabs.pages.push(nativePage);
  }
  return tabs;
}

function lowerLeafControl(child, context) {
  if (!['text', 'button', 'input', 'checkbox', 'combo', 'listbox'].includes(child.control)) {
    throw new NativeGuiError(`line ${child.line ?? '?'}: native GUI v0.4 does not support '${child.control}' controls yet.`);
  }
  const selectionControl = ['combo', 'listbox'].includes(child.control);
  const control = {
    type: child.control,
    id: child.id ?? context.generatedId,
    text: child.textExpr ? requireTextLiteral(child.textExpr, child.line, `${child.control} text`) : '',
    binding: child.id ?? null,
    options: selectionControl ? requireSelectionOptions(child) : [],
    layout: context.layout ?? defaultLayout(child.control, 0)
  };

  if (['input', 'checkbox', 'combo', 'listbox'].includes(child.control) && !child.id) {
    throw new NativeGuiError(`line ${child.line ?? '?'}: native ${child.control} controls need a simple Patch name after 'as'.`);
  }
  if (child.control === 'checkbox') requireBindingType(child, context.stateByName, 'boolean', 'Checkbox');
  if (child.control === 'input') requireBindingType(child, context.stateByName, 'text', 'Input');
  if (child.control === 'combo') requireBindingType(child, context.stateByName, 'text', 'ComboBox');
  if (child.control === 'listbox') requireBindingType(child, context.stateByName, 'text', 'ListBox');
  return control;
}

function validateControl(control, insideTabs) {
  if (control.type === 'tabs') {
    if (insideTabs) throw new NativeGuiError('Native GUI IR v0.4 does not allow nested Tabs.');
    if (!control.id || !Array.isArray(control.pages) || control.pages.length < 2) {
      throw new NativeGuiError('Native GUI IR Tabs needs an id and at least two pages.');
    }
    for (const page of control.pages) {
      if (typeof page?.title !== 'string' || !Array.isArray(page.controls)) {
        throw new NativeGuiError('Native GUI IR Tabs page is incomplete.');
      }
      for (const child of page.controls) validateControl(child, true);
    }
    return;
  }
  if (!['text', 'button', 'input', 'checkbox', 'combo', 'listbox'].includes(control.type)) {
    throw new NativeGuiError(`Native GUI IR control '${control.type}' is unsupported.`);
  }
  if (['combo', 'listbox'].includes(control.type) && (!Array.isArray(control.options) || control.options.length < 2)) {
    throw new NativeGuiError(`Native GUI IR ${control.type === 'combo' ? 'ComboBox' : 'ListBox'} needs at least two options.`);
  }
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
        if (op.field) throw new NativeGuiError(`line ${op.line ?? '?'}: native GUI v0.4 does not support field mutation yet.`);
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
    throw new NativeGuiError(`line ${node.line ?? '?'}: native GUI v0.4 event handlers support change, open and close only.`);
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
    throw new NativeGuiError(`line ${op.line ?? '?'}: native GUI v0.4 cannot apply '${op.op}' to ${state.type} state '${state.name}'.`);
  }
}

function requireBindingType(control, states, expected, label) {
  const state = states.get(control.id);
  if (!state || state.type !== expected) {
    throw new NativeGuiError(`line ${control.line ?? '?'}: native ${label} '${control.id}' must bind to ${expected} state with the same name.`);
  }
}

function requireSelectionOptions(control) {
  const options = control.options ?? [];
  const label = control.control === 'combo' ? 'ComboBox' : 'ListBox';
  if (options.length < 2) throw new NativeGuiError(`line ${control.line ?? '?'}: native ${label} needs at least two options.`);
  return options.map((expr, index) => requireTextLiteral(expr, control.line, `${label} option ${index + 1}`));
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
    throw new NativeGuiError(`line ${line ?? '?'}: ${label} must currently be simple text in quotes for native GUI v0.4.`);
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
    checkbox: [220, 36],
    combo: [220, 36],
    listbox: [220, 120],
    tabs: [420, 240]
  };
  const [width, height] = sizes[type] ?? [120, 36];
  return { x: 24, y: 24 + index * 48, width, height };
}

function defaultTabPageLayout(type, index) {
  const sizes = {
    text: [200, 30],
    button: [120, 36],
    input: [220, 36],
    checkbox: [220, 36],
    combo: [220, 36],
    listbox: [220, 120]
  };
  const [width, height] = sizes[type] ?? [120, 36];
  return { x: 12, y: 12 + index * 48, width, height };
}
