export const PATCH_STUDIO_RUNTIME_SELECTION_STATE_VERSION = '0.1';
export const PATCH_STUDIO_RUNTIME_SELECTION_MAX_ENTRIES = 512;

const STORE_PROPERTY = '__patchRuntimeSelectionState';

/**
 * Build the same stable control identity used by the runtime renderer.
 * Explicit control ids win; id-less controls fall back to their source-backed
 * Form/path identity so transient toolkit state never becomes hidden app state.
 */
export function runtimeSelectionKey(control, context = {}) {
  const id = String(control?.id ?? '').trim();
  if (id) return `id:${id}`;
  const windowKey = String(context.windowId ?? `window${Number(context.windowIndex ?? 0) + 1}`);
  const path = String(context.controlPath ?? context.controlIndex ?? 'control');
  return `${windowKey}:path:${path}`;
}

export function getRuntimeSelection(container, namespace, key) {
  return selectionNamespace(container, namespace).get(String(key));
}

export function setRuntimeSelection(container, namespace, key, value) {
  const store = selectionNamespace(container, namespace);
  const normalizedKey = String(key);
  if (store.has(normalizedKey)) store.delete(normalizedKey);
  store.set(normalizedKey, freezeSelection(value));
  while (store.size > PATCH_STUDIO_RUNTIME_SELECTION_MAX_ENTRIES) {
    store.delete(store.keys().next().value);
  }
  return store.get(normalizedKey);
}

export function clearRuntimeSelections(container, namespace = null) {
  const root = runtimeSelectionRoot(container);
  if (namespace === null || namespace === undefined) {
    root.clear();
    return;
  }
  root.delete(normalizeNamespace(namespace));
}

export function runtimeSelectionStats(container) {
  const root = runtimeSelectionRoot(container);
  return Object.freeze(Object.fromEntries(
    [...root.entries()].map(([namespace, store]) => [namespace, store.size])
  ));
}

function selectionNamespace(container, namespace) {
  const root = runtimeSelectionRoot(container);
  const name = normalizeNamespace(namespace);
  if (!root.has(name)) root.set(name, new Map());
  return root.get(name);
}

function runtimeSelectionRoot(container) {
  if (!container || (typeof container !== 'object' && typeof container !== 'function')) {
    throw new TypeError('Runtime selection state requires a container object.');
  }
  if (!(container[STORE_PROPERTY] instanceof Map)) {
    Object.defineProperty(container, STORE_PROPERTY, {
      value: new Map(),
      configurable: true,
      enumerable: false,
      writable: false
    });
  }
  return container[STORE_PROPERTY];
}

function normalizeNamespace(namespace) {
  const name = String(namespace ?? '').trim();
  if (!name || !/^[a-z][a-z0-9-]{0,31}$/i.test(name)) {
    throw new TypeError('Runtime selection namespace must be a short alphanumeric name.');
  }
  return name;
}

function freezeSelection(value) {
  if (Array.isArray(value)) return Object.freeze(value.map(item => freezeSelection(item)));
  if (value && typeof value === 'object') {
    const clone = {};
    for (const [key, child] of Object.entries(value)) clone[key] = freezeSelection(child);
    return Object.freeze(clone);
  }
  return value;
}
