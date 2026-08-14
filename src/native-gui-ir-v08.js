import {
  PATCH_NATIVE_GUI_IR_FORMAT,
  buildNativeGuiIR,
  validateNativeGuiIR,
  NativeGuiError
} from './native-gui-ir.js';
import { attachWindowLayoutPolicies } from './window-layout-policy.js';

export const PATCH_NATIVE_GUI_IR_V08_VERSION = '0.8';

/**
 * Opt-in Native GUI IR 0.8 lowering for source-backed Table controls.
 *
 * The stable buildNativeGuiIR() entry point remains v0.7. This adapter reuses
 * the proven v0.7 lowering for every existing construct, then restores Table
 * structure and its transient list-valued `changed` event contract. No native
 * persistent list-state support is implied by this IR version.
 */
export function buildNativeGuiIRV08(compiled) {
  if (!compiled || !Array.isArray(compiled.ast)) {
    throw new NativeGuiError('A compiled Patch Window program is required for native GUI 0.8 lowering.');
  }

  const cloned = structuredClone(compiled);
  if (cloned.windowLayoutPolicy) attachWindowLayoutPolicies(cloned.ast, cloned.windowLayoutPolicy);
  const tableSpecs = [];
  const usedNames = collectNames(cloned.ast);
  let ordinal = 0;

  const rewriteControls = nodes => (nodes ?? []).map(node => {
    if (node.kind === 'window') return { ...node, body: rewriteControls(node.body) };
    if (node.kind === 'tabs') {
      return {
        ...node,
        body: (node.body ?? []).map(page => ({ ...page, body: rewriteControls(page.body) }))
      };
    }
    if (node.kind !== 'uiControl' || node.control !== 'table') return node;
    if (!node.id) throw new NativeGuiError(`line ${node.line ?? '?'}: native Table needs a simple Patch name after 'as'.`);

    const tempId = nextTempName(usedNames, ++ordinal);
    usedNames.add(tempId);
    const columns = requireTextList(node.columns, node.line, 'Table column');
    const rows = (node.rows ?? []).map((row, rowIndex) => {
      const values = requireTextList(row, node.line, `Table row ${rowIndex + 1}`);
      if (values.length !== columns.length) {
        throw new NativeGuiError(`line ${node.line ?? '?'}: native Table row ${rowIndex + 1} does not match its column count.`);
      }
      return values;
    });
    if (!columns.length || !rows.length) throw new NativeGuiError(`line ${node.line ?? '?'}: native Table needs columns and at least one row.`);

    tableSpecs.push({ id: node.id, tempId, columns, rows, line: node.line ?? null });
    return {
      ...node,
      control: 'listbox',
      id: tempId,
      options: ['"__patch_table_row_1"', '"__patch_table_row_2"'],
      columns: undefined,
      rows: undefined
    };
  });

  cloned.ast = rewriteControls(cloned.ast);

  for (const spec of tableSpecs) {
    cloned.ast.unshift({
      kind: 'create',
      valueType: 'text',
      name: spec.tempId,
      expr: '""',
      line: spec.line
    });
  }

  const tableById = new Map(tableSpecs.map(spec => [spec.id, spec]));
  cloned.ast = cloned.ast.map(node => {
    if (node.kind !== 'event' || !tableById.has(node.control)) return node;
    if (node.event !== 'changed') {
      throw new NativeGuiError(`line ${node.line ?? '?'}: native Table '${node.control}' exposes only 'changed'.`);
    }
    rejectListValueScalarUse(node);
    return { ...node, control: tableById.get(node.control).tempId };
  });

  const ir = buildNativeGuiIR(cloned);
  const tempToSpec = new Map(tableSpecs.map(spec => [spec.tempId, spec]));
  ir.states = ir.states.filter(state => !tempToSpec.has(state.name));

  const restoreControls = controls => (controls ?? []).map(control => {
    if (control.type === 'tabs') {
      return {
        ...control,
        pages: control.pages.map(page => ({ ...page, controls: restoreControls(page.controls) }))
      };
    }
    const spec = tempToSpec.get(control.id);
    if (!spec) return control;
    return {
      type: 'table',
      id: spec.id,
      text: '',
      binding: null,
      options: [],
      columns: [...spec.columns],
      rows: spec.rows.map(row => [...row]),
      layout: control.layout
    };
  });

  for (const form of ir.forms) form.controls = restoreControls(form.controls);
  for (const event of ir.events) {
    const spec = tempToSpec.get(event.control);
    if (!spec) continue;
    event.control = spec.id;
    event.valueType = 'text-list';
  }

  ir.version = PATCH_NATIVE_GUI_IR_V08_VERSION;
  return validateNativeGuiIRV08(ir);
}

export function validateNativeGuiIRV08(ir) {
  if (!ir || ir.format !== PATCH_NATIVE_GUI_IR_FORMAT || ir.version !== PATCH_NATIVE_GUI_IR_V08_VERSION) {
    throw new NativeGuiError('Native GUI IR 0.8 format/version is unsupported.');
  }

  const tables = new Map();
  const inspect = (controls, formId) => {
    for (const control of controls ?? []) {
      if (control.type === 'tabs') {
        for (const page of control.pages ?? []) inspect(page.controls, formId);
        continue;
      }
      if (control.type !== 'table') continue;
      if (!control.id || tables.has(control.id)) throw new NativeGuiError('Native GUI IR 0.8 Table needs a unique id.');
      if (!Array.isArray(control.columns) || !control.columns.length || !control.columns.every(value => typeof value === 'string')) {
        throw new NativeGuiError(`Native GUI IR 0.8 Table '${control.id}' needs text columns.`);
      }
      if (!Array.isArray(control.rows) || !control.rows.length || !control.rows.every(row =>
        Array.isArray(row) && row.length === control.columns.length && row.every(value => typeof value === 'string')
      )) {
        throw new NativeGuiError(`Native GUI IR 0.8 Table '${control.id}' has invalid rows.`);
      }
      tables.set(control.id, { formId });
    }
  };
  for (const form of ir.forms ?? []) inspect(form.controls, form.id);

  for (const event of ir.events ?? []) {
    if (!tables.has(event.control)) continue;
    if (event.event !== 'changed' || event.valueType !== 'text-list') {
      throw new NativeGuiError(`Native GUI IR 0.8 Table event '${event.control}' must be changed with text-list value.`);
    }
  }

  // Reuse the stable v0.7 structural validator after replacing only the new
  // Table surface with validation-only ListBox equivalents.
  const compatible = structuredClone(ir);
  compatible.version = '0.7';
  const sanitize = controls => (controls ?? []).map(control => {
    if (control.type === 'tabs') {
      return { ...control, pages: control.pages.map(page => ({ ...page, controls: sanitize(page.controls) })) };
    }
    if (control.type !== 'table') return control;
    const { columns: _columns, rows: _rows, ...rest } = control;
    return { ...rest, type: 'listbox', options: ['__row_1', '__row_2'] };
  });
  for (const form of compatible.forms ?? []) form.controls = sanitize(form.controls);
  for (const event of compatible.events ?? []) {
    if (tables.has(event.control)) event.valueType = 'text';
  }
  validateNativeGuiIR(compatible);
  return ir;
}

export function flattenNativeGuiControlsV08(ir) {
  validateNativeGuiIRV08(ir);
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

export function flattenNativeGuiMenuItemsV08(ir) {
  validateNativeGuiIRV08(ir);
  const out = [];
  for (let formIndex = 0; formIndex < ir.forms.length; formIndex += 1) {
    const form = ir.forms[formIndex];
    for (let menuIndex = 0; menuIndex < (form.menus ?? []).length; menuIndex += 1) {
      const menu = form.menus[menuIndex];
      for (let itemIndex = 0; itemIndex < menu.items.length; itemIndex += 1) {
        out.push({
          ...menu.items[itemIndex],
          formIndex,
          menuIndex,
          itemIndex,
          menuTitle: menu.title,
          nativeIndex: out.length
        });
      }
    }
  }
  return out;
}

function rejectListValueScalarUse(event) {
  for (const action of event.body ?? []) {
    if (action.kind !== 'change') continue;
    for (const op of action.ops ?? []) {
      if (String(op.expr ?? '').trim() === 'value') {
        throw new NativeGuiError(
          `line ${op.line ?? event.line ?? '?'}: native Table row value is list-valued and cannot be assigned to scalar native state yet.`
        );
      }
    }
  }
}

function requireTextList(expressions, line, label) {
  return (expressions ?? []).map((expr, index) => {
    const text = String(expr ?? '').trim();
    try {
      const value = JSON.parse(text);
      if (typeof value !== 'string') throw new Error('not text');
      return value;
    } catch {
      throw new NativeGuiError(`line ${line ?? '?'}: ${label} ${index + 1} must be quoted text for native GUI 0.8.`);
    }
  });
}

function collectNames(ast) {
  const names = new Set();
  const walk = nodes => {
    for (const node of nodes ?? []) {
      if (node.name) names.add(node.name);
      if (node.id) names.add(node.id);
      if (node.control) names.add(node.control);
      if (node.body) walk(node.body);
      if (node.thenBody) walk(node.thenBody);
      if (node.elseBody) walk(node.elseBody);
    }
  };
  walk(ast);
  return names;
}

function nextTempName(usedNames, ordinal) {
  let candidate = `__patch_table_v08_${ordinal}`;
  let suffix = ordinal;
  while (usedNames.has(candidate)) candidate = `__patch_table_v08_${++suffix}`;
  return candidate;
}
