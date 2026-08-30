import { parseMenuShortcutExpression, menuShortcutIdentity } from './menu-shortcut.js?v=868f0784ca7f3972';
import { resolveButtonImageBinding } from './button-image.js?v=868f0784ca7f3972';
import { hasWindowIcon } from './window-icon.js?v=868f0784ca7f3972';

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
export function validateWindowRuntimeSupport(compiled, options = {}) {
  validateWindowBuild(compiled);
  const controls = new Map();
  const tabs = new Map();
  const menuItems = new Map();
  const resultDialogs = new Map();
  const forms = new Map();
  const events = [];
  const formActions = [];
  const menuShortcuts = new Map();
  const stateTypes = new Map(
    (compiled?.ast ?? [])
      .filter(node => node.kind === 'create')
      .map(node => [node.name, node.valueType])
  );
  let menuSeparators = 0;
  let menuShortcutCount = 0;
  let menuEnabledBindings = 0;
  let menuCheckedBindings = 0;
  let treeViews = 0;
  let sliders = 0;
  let paintboxes = 0;
  let imageLists = 0;
  let buttonImages = 0;
  let windowIcons = 0;
  const imageListsByForm = new Map();

  const idTaken = id => controls.has(id) || tabs.has(id) || menuItems.has(id) || resultDialogs.has(id);
  const duplicateId = node => new WindowBuildError(
    `line ${node.line ?? '?'}: Window UI id '${node.id}' is declared more than once. ` +
    'Control, Tabs, MenuItem and result-dialog ids must be unique across the current application.'
  );
  const requireBooleanMenuState = (item, stateName, role) => {
    if (!stateName) return;
    const type = stateTypes.get(stateName);
    if (type !== 'boolean') {
      const found = type ? `${type} state` : 'no declared state';
      throw new WindowBuildError(
        `line ${item.line ?? '?'}: MenuItem '${item.id}' ${role} binding '${stateName}' must be boolean state; found ${found}.`
      );
    }
  };

  const registerControl = (child, formId) => {
    if (!child?.id) return;
    if (idTaken(child.id)) throw duplicateId(child);
    controls.set(child.id, { type: child.control, formId, node: child });
    if (child.control === 'tree') treeViews += 1;
    if (child.control === 'paintbox') paintboxes += 1;
    if (child.control === 'imagelist') {
      imageLists += 1;
      let lists = imageListsByForm.get(formId);
      if (!lists) {
        lists = new Map();
        imageListsByForm.set(formId, lists);
      }
      lists.set(child.id, child);
    }
    if (child.control === 'button' && child.imageListId && child.imageItem) buttonImages += 1;
    if (child.control === 'slider') {
      sliders += 1;
      const stateType = stateTypes.get(child.id);
      if (stateType && stateType !== 'number') {
        throw new WindowBuildError(
          `line ${child.line ?? '?'}: Slider '${child.id}' can bind only to number state; found ${stateType} state with the same name.`
        );
      }
    }
    if (child.control === 'panel') {
      for (const nested of child.body ?? []) {
        if (nested.kind !== 'uiControl') {
          throw new WindowBuildError(
            `line ${nested.line ?? '?'}: Panel '${child.id}' supports window controls only in Chrome Stage 1.`
          );
        }
        registerControl(nested, formId);
      }
    }
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

      requireBooleanMenuState(item, item.enabledState, 'enabled');
      requireBooleanMenuState(item, item.checkedState, 'checked');
      if (item.enabledState) menuEnabledBindings += 1;
      if (item.checkedState) menuCheckedBindings += 1;

      let shortcut = null;
      if (item.shortcutExpr) {
        try {
          shortcut = parseMenuShortcutExpression(item.shortcutExpr, item.line);
        } catch (error) {
          throw new WindowBuildError(error.message);
        }
        const identity = menuShortcutIdentity(shortcut);
        const previous = menuShortcuts.get(identity);
        if (previous) {
          throw new WindowBuildError(
            `line ${item.line ?? '?'}: Menu shortcut '${identity}' is already used by '${previous.id}' in this application.`
          );
        }
        menuShortcuts.set(identity, item);
        menuShortcutCount += 1;
      }
      menuItems.set(item.id, {
        type: 'menuItem',
        formId,
        node: item,
        shortcut,
        enabledState: item.enabledState ?? null,
        checkedState: item.checkedState ?? null
      });
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
        if (hasWindowIcon(node)) windowIcons += 1;
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

  for (const control of controls.values()) {
    if (control.type !== 'button' || !control.node?.imageListId || !control.node?.imageItem) continue;
    try {
      resolveButtonImageBinding(
        imageListsByForm.get(control.formId) ?? new Map(),
        { imageListId: control.node.imageListId, imageItem: control.node.imageItem },
        control.node.line
      );
    } catch (error) {
      throw new WindowBuildError(error?.message ?? String(error));
    }
  }

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
    if (controlType === 'imagelist') {
      throw new WindowBuildError(
        `line ${event.line ?? '?'}: ImageList '${event.control}' is nonvisual and exposes no Patch events in ImageList Stage 1.`
      );
    }
    if (controlType === 'table' && event.event !== 'changed') {
      throw new WindowBuildError(
        `line ${event.line ?? '?'}: Table '${event.control}' exposes only 'changed' for transient row selection, not '${event.event}'.`
      );
    }
    if (controlType === 'tree' && event.event !== 'changed') {
      throw new WindowBuildError(
        `line ${event.line ?? '?'}: TreeView '${event.control}' exposes only 'changed' for transient node-path selection, not '${event.event}'.`
      );
    }
    if (controlType === 'slider' && event.event !== 'changed') {
      throw new WindowBuildError(
        `line ${event.line ?? '?'}: Slider '${event.control}' exposes only 'changed' for transient numeric values, not '${event.event}'.`
      );
    }
    if (controlType === 'timer' && event.event !== 'ticked') {
      throw new WindowBuildError(
        `line ${event.line ?? '?'}: Timer '${event.control}' exposes only 'ticked', not '${event.event}'.`
      );
    }
    if (controlType === 'picture' && event.event !== 'clicked') {
      throw new WindowBuildError(
        `line ${event.line ?? '?'}: PictureBox '${event.control}' exposes only 'clicked', not '${event.event}'.`
      );
    }
    if (controlType === 'paintbox' && event.event !== 'paint') {
      throw new WindowBuildError(
        `line ${event.line ?? '?'}: PaintBox '${event.control}' exposes only 'paint', not '${event.event}'.`
      );
    }
    const supported =
      ((controlType === 'button' || controlType === 'menuItem' || controlType === 'picture') && event.event === 'clicked') ||
      (controlType === 'timer' && event.event === 'ticked') ||
      (controlType === 'paintbox' && event.event === 'paint') ||
      ((controlType === 'input' || controlType === 'checkbox' || controlType === 'combo' || controlType === 'listbox' || controlType === 'radio' || controlType === 'table' || controlType === 'tree' || controlType === 'slider') && event.event === 'changed');
    if (!supported) {
      throw new WindowBuildError(
        `line ${event.line ?? '?'}: Window builds support 'clicked' on buttons/menu items/PictureBox, 'paint' on PaintBox, 'ticked' on Timer, and 'changed' on inputs/checkboxes/combos/listboxes/radios/tables/trees/sliders. ` +
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

  if (treeViews && !options.allowTree) {
    throw new WindowBuildError(
      'TreeView is not enabled for this Window target. Select a TreeView-capable target or enable its versioned TreeView runtime contract; validation fails closed otherwise.'
    );
  }

  if (sliders && !options.allowSlider) {
    throw new WindowBuildError(
      'Slider is not enabled for this Window target. Select a Slider-capable browser target or enable its versioned Slider runtime contract; validation fails closed otherwise.'
    );
  }

  if (paintboxes && !options.allowPaintBox) {
    throw new WindowBuildError(
      'PaintBox is not enabled for this Window target. Select a PaintBox-capable browser target or enable its versioned pure drawing contract; validation fails closed otherwise.'
    );
  }

  if (imageLists && !options.allowImageList) {
    throw new WindowBuildError(
      'ImageList is not enabled for this Window target. Native GUI IR 1.4 has no ImageList consumer contract; validation fails closed rather than silently dropping the nonvisual image collection.'
    );
  }

  const menuStateBindings = menuEnabledBindings + menuCheckedBindings;
  if ((menuSeparators || menuShortcutCount || menuStateBindings) && !options.allowMenuDecorations) {
    const required = menuStateBindings
      ? 'Native GUI IR 1.0 / direct AOT backend 1.1'
      : 'Native GUI IR 0.9 / direct AOT backend 1.0';
    throw new WindowBuildError(
      `Menu decorations in this source require ${required}. ` +
      'This Window target has not enabled the corresponding menu-decoration contract; validation fails closed rather than silently dropping separators, shortcuts or state bindings.'
    );
  }

  return {
    windows: countWindowInstructions(compiled?.ir?.instructions),
    namedForms: forms.size,
    controls: controls.size,
    treeViews,
    sliders,
    paintboxes,
    imageLists,
    buttonImages,
    windowIcons,
    tabs: tabs.size,
    menuItems: menuItems.size,
    menuSeparators,
    menuShortcuts: menuShortcutCount,
    menuEnabledBindings,
    menuCheckedBindings,
    resultDialogs: resultDialogs.size,
    events: events.length,
    formActions: formActions.length
  };
}