import { validateNativeGuiIR, NativeGuiError } from './native-gui-ir.js';

const RESULT_ACTIONS = new Set(['confirmDialog', 'openFileDialog', 'saveFileDialog']);

export function planNativeResultDialogs(input) {
  const ir = validateNativeGuiIR(input);
  const resultSources = new Map();

  for (const event of ir.events) {
    for (const action of event.actions ?? []) {
      if (!RESULT_ACTIONS.has(action.kind)) continue;
      const type = action.kind === 'confirmDialog' ? 'confirmResult' : 'fileResult';
      const existing = resultSources.get(action.id);
      if (existing && (existing.type !== type || existing.form !== action.form)) {
        throw new NativeGuiError(`Native result source '${action.id}' has conflicting definitions.`);
      }
      resultSources.set(action.id, { id: action.id, type, form: action.form, action });
    }
  }

  const handlers = new Map();
  for (const event of ir.events) {
    if (!resultSources.has(event.control)) continue;
    if ((event.actions ?? []).some(action => RESULT_ACTIONS.has(action.kind))) {
      throw new NativeGuiError(
        `Native GUI 0.7 does not yet chain a second result dialog directly from result handler '${event.control} ${event.event}'.`
      );
    }
    handlers.set(`${event.control}\u0000${event.event}`, event);
  }

  const baseEvents = [];
  const triggers = [];
  for (const event of ir.events) {
    if (resultSources.has(event.control)) continue;
    const resultActions = (event.actions ?? []).filter(action => RESULT_ACTIONS.has(action.kind));
    if (resultActions.length > 1) {
      throw new NativeGuiError(`Native GUI 0.7 allows one result dialog action per '${event.control} ${event.event}' handler.`);
    }
    if (resultActions.length) {
      const action = resultActions[0];
      if (event.actions.at(-1) !== action) {
        throw new NativeGuiError(
          `Native GUI 0.7 requires result dialog '${action.id}' to be the final action in '${event.control} ${event.event}'.`
        );
      }
      triggers.push({ event, baseIndex: baseEvents.length, action });
    }
    baseEvents.push({
      ...event,
      actions: (event.actions ?? []).filter(action => !RESULT_ACTIONS.has(action.kind))
    });
  }

  return {
    ir,
    baseIr: { ...ir, events: baseEvents },
    resultSources,
    handlers,
    triggers,
    resultEvents: ir.events.filter(event => resultSources.has(event.control))
  };
}

export function buildAuxiliaryResultIr(ir, event) {
  const syntheticId = `__patch_result_${identifier(event.control)}_${identifier(event.event)}`;
  const valueState = `__patch_result_value_${identifier(event.control)}`;
  const carriesText = event.valueType === 'text';
  const controls = carriesText
    ? [{ type: 'input', id: syntheticId, text: '', binding: valueState, options: [], layout: { x: 0, y: 0, width: 16, height: 16 } }]
    : [{ type: 'button', id: syntheticId, text: '', binding: null, options: [], layout: { x: 0, y: 0, width: 16, height: 16 } }];

  const forms = ir.forms.map(form => ({
    ...form,
    controls: form.id === event.form ? controls : [],
    menus: []
  }));
  const states = carriesText && !ir.states.some(state => state.name === valueState)
    ? [...ir.states, { name: valueState, type: 'text', initial: '' }]
    : [...ir.states];

  return {
    ...ir,
    states,
    forms,
    events: [{
      ...event,
      control: syntheticId,
      event: carriesText ? 'changed' : 'clicked'
    }]
  };
}

export function resultHandlerName(control, event) {
  return `PatchResult_${identifier(control)}_${identifier(event)}`;
}

export function resultHandler(plan, id, event) {
  return plan.handlers.get(`${id}\u0000${event}`) ?? null;
}

export function injectIntoEvent(source, eventIndex, code) {
  const start = source.indexOf(`static void Event_${eventIndex}(`);
  if (start < 0) throw new NativeGuiError(`Generated native source is missing Event_${eventIndex}.`);
  const marker = '\n  RefreshUI();\n}';
  const end = source.indexOf(marker, start);
  if (end < 0) throw new NativeGuiError(`Generated native Event_${eventIndex} has an unexpected shape.`);
  return source.slice(0, end) + `\n${code}` + source.slice(end);
}

export function extractEventZero(source, replacementName) {
  const start = source.indexOf('static void Event_0(');
  if (start < 0) throw new NativeGuiError('Auxiliary native source is missing Event_0.');
  const marker = '\n  RefreshUI();\n}';
  const end = source.indexOf(marker, start);
  if (end < 0) throw new NativeGuiError('Auxiliary native Event_0 has an unexpected shape.');
  const finish = end + marker.length;
  return source.slice(start, finish).replace('static void Event_0(', `static void ${replacementName}(`);
}

export function insertAfter(source, marker, text) {
  const index = source.indexOf(marker);
  if (index < 0) throw new NativeGuiError(`Generated native source is missing marker '${marker}'.`);
  const at = index + marker.length;
  return source.slice(0, at) + text + source.slice(at);
}

export function insertBefore(source, marker, text) {
  const index = source.indexOf(marker);
  if (index < 0) throw new NativeGuiError(`Generated native source is missing marker '${marker}'.`);
  return source.slice(0, index) + text + source.slice(index);
}

export function identifier(value) {
  return String(value ?? '').replace(/[^A-Za-z0-9_]/g, '_').replace(/^[0-9]/, '_$&');
}
