import { PatchRuntimeError } from './interpreter.js';

export const PATCH_WINDOW_EVENTS_VERSION = '0.1';

/**
 * Execute one Patch Window event with transient event-local data.
 *
 * Persistent state is never updated by this adapter. For an input `changed`
 * event the DOM/control value is exposed only as local `value`; source must use
 * an ordinary semantic `change` to commit it to persistent state.
 */
export function triggerWindowEvent(runtime, control, event = 'clicked', payload = {}) {
  if (!runtime) throw new PatchRuntimeError('The Patch Window runtime has not started.');

  if (event !== 'changed') return runtime.trigger(control, event);

  if (!Object.prototype.hasOwnProperty.call(payload ?? {}, 'value')) {
    throw new PatchRuntimeError(`The '${event}' action for '${control}' needs an event-local value.`);
  }

  try {
    runtime.output = [];
    const matches = (runtime.events ?? []).filter(handler => handler.control === control && handler.event === event);
    if (!matches.length) throw new PatchRuntimeError(`There is no '${event}' action for '${control}'.`);

    const locals = { value: payload.value };
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
