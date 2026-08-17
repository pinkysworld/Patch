import { PatchRuntimeError } from './interpreter.js';

// Historical beta.35 contract marker retained for release-surface separation:
// PATCH_WINDOW_EVENTS_VERSION = '0.7'
// Current TreeView Stage 1 extends only the transient event-local value contract.
export const PATCH_WINDOW_EVENTS_VERSION = '0.8';

/**
 * Execute one Patch Window event with transient event-local data.
 *
 * Persistent state is never updated by this adapter. `changed` control values
 * and `chosen` file-dialog paths are exposed only as local `value`; source must
 * use an ordinary semantic `change` to commit them. Checkbox `changed` values
 * are Boolean. Input, ComboBox, Radio and text-bound ListBox `changed` plus
 * file-dialog `chosen` values are text. A ListBox whose id is backed by
 * `create list` carries the selected options as a transient text list. Table
 * `changed` carries the selected row as a transient list of display strings.
 */
export function triggerWindowEvent(runtime, control, event = 'clicked', payload = {}) {
  if (!runtime) throw new PatchRuntimeError('The Patch Window runtime has not started.');

  const carriesValue = event === 'changed' || event === 'chosen';
  if (!carriesValue) return runtime.trigger(control, event);

  if (!Object.prototype.hasOwnProperty.call(payload ?? {}, 'value')) {
    throw new PatchRuntimeError(`The '${event}' action for '${control}' needs an event-local value.`);
  }

  if (event === 'chosen' && typeof payload.value !== 'string') {
    throw new PatchRuntimeError(`The 'chosen' action for file dialog '${control}' needs a text event-local value.`);
  }

  if (event === 'changed') {
    const controlType = findControlType(runtime, control);
    if (controlType === 'checkbox' && typeof payload.value !== 'boolean') {
      throw new PatchRuntimeError(`The 'changed' action for checkbox '${control}' needs a Boolean event-local value.`);
    }
    if (['input', 'combo', 'radio'].includes(controlType) && typeof payload.value !== 'string') {
      throw new PatchRuntimeError(`The 'changed' action for ${controlType} '${control}' needs a text event-local value.`);
    }
    if (controlType === 'listbox') {
      const stateType = runtime.types?.get?.(control) ?? null;
      if (stateType === 'list') {
        if (!Array.isArray(payload.value) || !payload.value.every(item => typeof item === 'string')) {
          throw new PatchRuntimeError(`The 'changed' action for listbox '${control}' needs a text-list event-local value because '${control}' is list state.`);
        }
      } else if (typeof payload.value !== 'string') {
        throw new PatchRuntimeError(`The 'changed' action for listbox '${control}' needs a text event-local value.`);
      }
    }
    if (controlType === 'table' && (!Array.isArray(payload.value) || !payload.value.every(cell => typeof cell === 'string'))) {
      throw new PatchRuntimeError(`The 'changed' action for table '${control}' needs a row list of text event-local values.`);
    }
    if (controlType === 'tree' && (!Array.isArray(payload.value) || !payload.value.length || !payload.value.every(item => typeof item === 'string'))) {
      throw new PatchRuntimeError(`The 'changed' action for tree '${control}' needs a non-empty text-list event-local value containing the selected node path.`);
    }
  }

  try {
    runtime.output = [];
    const matches = (runtime.events ?? []).filter(handler => handler.control === control && handler.event === event);
    if (!matches.length) throw new PatchRuntimeError(`There is no '${event}' action for '${control}'.`);

    const locals = { value: structuredClone(payload.value) };
    for (const handler of matches) {
      runtime.withCause(
        { kind: 'event', control, event, line: handler.line },
        () => runtime.executeBlock(handler.body, { ...locals })
      );
    }
    return runtime.result();
  } catch (error) {
    if (error instanceof PatchRuntimeError) throw error;
    throw new PatchRuntimeError(error?.message ?? String(error));
  }
}

function findControlType(runtime, id) {
  const find = nodes => {
    for (const node of nodes ?? []) {
      if (node.kind === 'uiControl' && node.id === id) return node.control;
      if (node.kind === 'tabs') {
        for (const page of node.body ?? []) {
          const nested = find(page.body);
          if (nested) return nested;
        }
      }
    }
    return null;
  };
  for (const windowNode of runtime.windows ?? []) {
    const type = find(windowNode.body);
    if (type) return type;
  }
  return null;
}