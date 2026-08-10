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
  const forms = new Map();
  const events = [];
  const formActions = [];

  const walk = nodes => {
    for (const node of nodes ?? []) {
      if (node.kind === 'window') {
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
          if (child.kind !== 'uiControl' || !child.id) continue;
          if (controls.has(child.id)) {
            throw new WindowBuildError(
              `line ${child.line ?? '?'}: Window control id '${child.id}' is declared more than once. ` +
              'Control ids must be unique across the current application.'
            );
          }
          controls.set(child.id, child.control);
        }
      } else if (node.kind === 'event') {
        events.push(node);
      } else if (node.kind === 'openForm' || node.kind === 'closeForm') {
        formActions.push(node);
      }
      if (node.body && node.kind !== 'window') walk(node.body);
      if (node.thenBody) walk(node.thenBody);
      if (node.elseBody) walk(node.elseBody);
    }
  };
  walk(compiled?.ast);

  for (const event of events) {
    const controlType = controls.get(event.control);
    if (!controlType) {
      throw new WindowBuildError(
        `line ${event.line ?? '?'}: event '${event.control} ${event.event}' refers to a control that is not defined in a Patch window.`
      );
    }
    const supported =
      (controlType === 'button' && event.event === 'clicked') ||
      ((controlType === 'input' || controlType === 'checkbox' || controlType === 'combo' || controlType === 'listbox') && event.event === 'changed');
    if (!supported) {
      throw new WindowBuildError(
        `line ${event.line ?? '?'}: Window builds support 'clicked' on buttons and 'changed' on inputs/checkboxes/combos/listboxes. ` +
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
    events: events.length,
    formActions: formActions.length
  };
}