import { parseMenuShortcutExpression, menuShortcutIdentity } from './menu-shortcut.js';

export class WindowBuildError extends Error {}

/** Count Patch WINDOW instructions in normalized Change IR. */
export function countWindowInstructions(instructions) {
  let count = 0;
  const visit = list => {
    for (const instruction of list ?? []) {
      if (instruction?.code === 'WINDOW') count += 1;
      if (instruction?.body) visit(instruction.body);
      if (instruction?.then) visit(instruction.then);
      if (instruction?.else) visit(instruction.else);
    }
  };
  visit(instructions);
  return count;
}

/** Require an actual Patch window for a project explicitly built as Window. */
export function validateWindowBuild(compiled) {
  const count = countWindowInstructions(compiled?.ir?.instructions);
  if (!count) {
    throw new WindowBuildError(
      'This project is marked Window but does not define a Patch window. Add a window in Designer or change Project Type to Console.'
    );
  }
  return count;
}

/** Validate the shared Window runtime surface used by Studio, Web and desktop. */
export function validateWindowRuntimeSupport(compiled) {
  validateWindowBuild(compiled);
  const controls = new Map();
  const tabs = new Map();
  const menuItems = new Map();
  const resultDialogs = new Map();
  const forms = new Map();
  const events = [];
  const formActions = [];
  const menuShortcuts = new Map();
  let menuSeparators = 0;
  let menuShortcutCount = 0;

  const idTaken = id => controls.has(id) || tabs.has(id) || menuItems.has(id) || resultDialogs.has(id);
  const duplicateId = node => new WindowBuildError(
    `line ${node.line ?? '?'}: Window UI id '${node.id}' is declared more than once. ` +
    'Control, Tabs, MenuItem and result-dialog ids must be unique across the current application.'
  );

  const registerControl = (child, formId) => {
    if (!child?.id) return;
    if (idTaken(child.id)) throw duplicateId(child);
    controls.set(child.id, { type: child.control, formId });
  };

  const registerTabs = (node, formId) => {
    if (idTaken(node.id)) throw duplicateId(node);
    tabs.set(node.id, { node, formId });
    for (const page of node.body ?? []) {
      if (page.kind !== 'tabPage') {
        throw new WindowBuildError(`line ${page.line ?? '?'}: Tabs '${node.id}' contains an invalid page node.`);
      }
      for (const child of page.body ?? []) {
        if (child.kind !== 'uiControl') {
          throw new WindowBuildError(`line ${child.line ?? '?'}: Tabs Stage 1 pages support window controls only.`);
        }
        registerControl(child, formId);
      }
    }
  };

  const registerMenu = (node, formId) => {
    if (!Array.isArray(node.body) || !node.body.length) {
      throw new WindowBuildError(`line ${node.line ?? '?'}: Window menu needs at least one item.`);
    }
    for (const item of node.body) {
      if (item.kind === 'menuSeparator') {
        menuSeparators += 1;
        continue;
      }
      if (item.kind !== 'menuItem') {
        throw new WindowBuildError(`line ${item.line ?? '?'}: Window menu can only contain menu items and separators.`);
      }
      if (!item.id) throw new WindowBuildError(`line ${item.line ?? '?'}: Window menu item needs a name after 'as'.`);
      if (idTaken(item.id)) throw duplicateId(item);

      let shortcut = null;
      if (item.shortcutExpr) {
        try {
          shortcut = parseMenuShortcutExpression(item.shortcutExpr, item.line);
        } catch (error) {
          throw new WindowBuildError(error.message);
        }
        const identity = menuShortcutIdentity(shortcut);
        const key = `${formId}\u0000${identity}`;
        const previous = menuShortcuts.get(key);
        if (previous) {
          throw new WindowBuildError(
            `line ${item.line ?? '?'}: Menu shortcut '${identity}' is already used by '${previous.id}' on this Form.`
          );
        }
        menuShortcuts.set(key, item);
        menuShortcutCount += 1;
      }
      menuItems.set(item.id, { type: 'menuItem', formId, node: item, shortcut });
    }
  };

  const registerResultDialog = node => {
    if (!node.id) throw new WindowBuildError(`line ${node.line ?? '?'}: Result dialog needs a name after 'as'.`);
    if (idTaken(node.id)) throw duplicateId(node);
    const type = node.kind === 'confirmDialog' ? 'confirmDialog' : node.kind === 'openFileDialog' ? 'openFileDialog' : 'saveFileDialog';
    resultDialogs.set(node.id, { type, node });
  };

  let unnamedFormIndex = 0;
  const walk = nodes => {
    for (const node of nodes ?? []) {
      if (node.kind === 'window') {
        const formId = node.id ?? `__window_${++unnamedFormIndex}`;
        if (node.id) {
          if (forms.has(node.id)) {
            throw new WindowBuildError(
              `line ${node.line ?? '?'}: Form name '${node.id}' is declared more than once. ` +
              'Each named Form needs a unique name after as.'
            );
          }
          forms.set(node.id, node);
        }
        for (const child of node.body ?? []) {
          if (child.kind === 'uiControl') registerControl(child, formId);
          else if (child.kind === 'tabs') registerTabs(child, formId);
          else if (child.kind === 'menu') registerMenu(child, formId);
        }
      } else if (node.kind === 'event') {
        events.push(node);
      } else if (node.kind === 'openForm' || node.kind === 'closeForm') {
        formActions.push(node);
      } else if (node.kind === 'confirmDialog' || node.kind === 'openFileDialog' || node.kind === 'saveFileDialog') {
        registerResultDialog(node);
      }
      if (node.body && !['window', 'tabs', 'tabPage', 'menu'].includes(node.kind)) walk(node.body);
      if (node.thenBody) walk(node.thenBody);
      if (node.elseBody) walk(node.elseBody);
    }
  };
  walk(compiled?.ast);

  for (const event of events) {
    const control = controls.get(event.control);
    const menuItem = menuItems.get(event.control);
    const resultDialog = resultDialogs.get(event.control);
    if (!control && !menuItem && !resultDialog) {
      if (tabs.has(event.control)) {
        throw new WindowBuildError(
          `line ${event.line ?? '?'}: Tabs '${event.control}' has transient page selection and does not expose Patch events in Tabs Stage 1.`
        );
      }
      throw new WindowBuildError(
        `line ${event.line ?? '?'}: event '${event.control} ${event.event}' refers to a control, menu item or result dialog that is not defined in a Patch window.`
      );
    }
    if (resultDialog) {
      const supported = resultDialog.type === 'confirmDialog'
        ? (event.event === 'confirmed' || event.event === 'cancelled')
        : (event.event === 'chosen' || event.event === 'cancelled');
      if (!supported) {
        const expected = resultDialog.type === 'confirmDialog' ? "'confirmed' or 'cancelled'" : "'chosen' or 'cancelled'";
        throw new WindowBuildError(
          `line ${event.line ?? '?'}: ${resultDialog.type} '${event.control}' supports ${expected}, not '${event.event}'.`
        );
      }
      continue;
    }
    const controlType = menuItem ? 'menuItem' : control.type;
    if (controlType === 'table' && event.event !== 'changed') {
      throw new WindowBuildError(
        `line ${event.line ?? '?'}: Table '${event.control}' exposes only 'changed' for transient row selection, not '${event.event}'.`
      );
    }
    const supported =
      ((controlType === 'button' || controlType === 'menuItem') && event.event === 'clicked') ||
      ((controlType === 'input' || controlType === 'checkbox' || controlType === 'combo' || controlType === 'listbox' || controlType === 'radio' || controlType === 'table') && event.event === 'changed');
    if (!supported) {
      throw new WindowBuildError(
        `line ${event.line ?? '?'}: Window builds support 'clicked' on buttons/menu items and 'changed' on inputs/checkboxes/combos/listboxes/radios/tables. ` +
        `'${event.control}' is a ${controlType} using '${event.event}'.`
      );
    }
  }

  for (const action of formActions) {
    if (!forms.has(action.form)) {
      throw new WindowBuildError(
        `line ${action.line ?? '?'}: Form '${action.form}' is not defined. ` +
        `Name a window with 'as ${action.form}' or use the correct Form name.`
      );
    }
  }

  return {
    windows: countWindowInstructions(compiled?.ir?.instructions),
    namedForms: forms.size,
    controls: controls.size,
    tabs: tabs.size,
    menuItems: menuItems.size,
    menuSeparators,
    menuShortcuts: menuShortcutCount,
    resultDialogs: resultDialogs.size,
    events: events.length,
    formActions: formActions.length
  };
}