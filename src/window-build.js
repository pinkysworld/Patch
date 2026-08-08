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

/**
 * Require an actual Patch window for a project explicitly built as Window.
 * This consumes normalized IR (`code: 'WINDOW'`), not source AST node fields.
 */
export function validateWindowBuild(compiled) {
  const count = countWindowInstructions(compiled?.ir?.instructions);
  if (!count) {
    throw new WindowBuildError(
      'This project is marked Window but does not define a Patch window. Add a window in Designer or change Project Type to Console.'
    );
  }
  return count;
}

/**
 * Validate the shared Window runtime surface used by Studio preview,
 * Standalone Window Web Apps and the generated desktop player.
 *
 * Beta.24 deliberately exposes only the event pairs implemented consistently
 * across all three targets: button `clicked` and input `changed`. Other parsed
 * event forms fail before packaging rather than becoming target-specific or
 * silently dead behavior.
 */
export function validateWindowRuntimeSupport(compiled) {
  validateWindowBuild(compiled);
  const controls = new Map();
  const events = [];

  const walk = nodes => {
    for (const node of nodes ?? []) {
      if (node.kind === 'window') {
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
      (controlType === 'input' && event.event === 'changed');
    if (!supported) {
      throw new WindowBuildError(
        `line ${event.line ?? '?'}: Window builds currently support 'clicked' on buttons and 'changed' on inputs. ` +
        `'${event.control}' is a ${controlType} using '${event.event}'.`
      );
    }
  }

  return { windows: countWindowInstructions(compiled?.ir?.instructions), controls: controls.size, events: events.length };
}
