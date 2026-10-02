import {
  PATCH_STUDIO_WORKER_PROTOCOL,
  PATCH_STUDIO_WORKER_PROTOCOL_VERSION,
  PATCH_STUDIO_WORKER_TASK_COMPILE,
  PATCH_STUDIO_WORKER_TASK_DESIGN_MODEL,
  PATCH_STUDIO_WORKER_TASK_PARSE,
  createStudioWorkerRequest,
  handleStudioWorkerRequest
} from '../src/studio-worker-protocol.js';

export const PATCH_STUDIO_LANGUAGE_CLIENT_VERSION = '0.1';
export const PATCH_STUDIO_LANGUAGE_CLIENT_DESIGN_CACHE_ENTRIES = 8;

export function createStudioLanguageClient({ WorkerCtor = globalThis.Worker } = {}) {
  let worker = null;
  let workerDisabled = typeof WorkerCtor !== 'function';
  let nextId = 1;
  const pending = new Map();
  const designCache = new Map();

  function workerUrl() {
    const url = new URL('./studio-language-worker.js', import.meta.url);
    const moduleUrl = new URL(import.meta.url);
    if (moduleUrl.search) url.search = moduleUrl.search;
    return url;
  }

  function ensureWorker() {
    if (workerDisabled) return null;
    if (worker) return worker;
    try {
      worker = new WorkerCtor(workerUrl(), { type: 'module', name: 'patch-studio-language-worker-v0-2' });
      worker.addEventListener('message', event => {
        const response = event?.data;
        if (!isCompatibleEnvelope(response)) {
          disableWorker(new Error('Studio language Worker returned an incompatible protocol envelope.'), { retryPending: true });
          return;
        }
        const request = pending.get(response.id);
        if (!request) return;
        pending.delete(response.id);
        settleResponse(request, response);
      });
      worker.addEventListener('error', event => {
        disableWorker(event?.error ?? new Error(event?.message || 'Studio language Worker failed.'), { retryPending: true });
      });
      worker.addEventListener('messageerror', () => {
        disableWorker(new Error('Studio language Worker returned an unreadable message.'), { retryPending: true });
      });
      return worker;
    } catch {
      workerDisabled = true;
      worker = null;
      return null;
    }
  }

  function request(task, source, options = {}) {
    const envelope = createStudioWorkerRequest({
      id: `studio-${nextId++}`,
      task,
      source: String(source ?? ''),
      options
    });
    const activeWorker = ensureWorker();
    if (!activeWorker) return Promise.resolve().then(() => runSynchronously(envelope));

    return new Promise((resolve, reject) => {
      pending.set(envelope.id, { envelope, resolve, reject });
      try {
        activeWorker.postMessage(envelope);
      } catch (error) {
        pending.delete(envelope.id);
        disableWorker(error, { retryPending: true });
        Promise.resolve().then(() => runSynchronously(envelope)).then(resolve, reject);
      }
    });
  }

  function parseSource(source) {
    return request(PATCH_STUDIO_WORKER_TASK_PARSE, source);
  }

  function compileSource(source, options = {}) {
    return request(PATCH_STUDIO_WORKER_TASK_COMPILE, source, options);
  }

  function designModel(source, options = {}) {
    const normalizedSource = String(source ?? '');
    const cacheKey = designCacheKey(normalizedSource, options);
    if (designCache.has(cacheKey)) {
      const value = designCache.get(cacheKey);
      designCache.delete(cacheKey);
      designCache.set(cacheKey, value);
      return Promise.resolve(value);
    }
    return request(PATCH_STUDIO_WORKER_TASK_DESIGN_MODEL, normalizedSource, options).then(result => {
      designCache.set(cacheKey, result);
      while (designCache.size > PATCH_STUDIO_LANGUAGE_CLIENT_DESIGN_CACHE_ENTRIES) {
        designCache.delete(designCache.keys().next().value);
      }
      return result;
    });
  }

  function disableWorker(error, { retryPending = false } = {}) {
    workerDisabled = true;
    try { worker?.terminate(); } catch {}
    worker = null;
    const waiting = [...pending.values()];
    pending.clear();
    for (const request of waiting) {
      if (retryPending) {
        Promise.resolve().then(() => runSynchronously(request.envelope)).then(request.resolve, request.reject);
      } else {
        request.reject(error);
      }
    }
  }

  function dispose() {
    disableWorker(new Error('Studio language client disposed.'));
    designCache.clear();
  }

  return Object.freeze({
    version: PATCH_STUDIO_LANGUAGE_CLIENT_VERSION,
    parse: parseSource,
    compile: compileSource,
    designModel,
    dispose
  });
}

function runSynchronously(envelope) {
  const response = handleStudioWorkerRequest(envelope);
  if (!isCompatibleEnvelope(response) || response.id !== envelope.id || response.task !== envelope.task) {
    throw new Error('Studio language synchronous fallback returned an incompatible response.');
  }
  if (!response.ok) throw rehydrateError(response.error);
  return response.result;
}

function settleResponse(request, response) {
  if (response.task !== request.envelope.task) {
    request.reject(new Error('Studio language Worker response task did not match the request.'));
    return;
  }
  if (response.ok) request.resolve(response.result);
  else request.reject(rehydrateError(response.error));
}

function isCompatibleEnvelope(value) {
  return Boolean(
    value &&
    value.protocol === PATCH_STUDIO_WORKER_PROTOCOL &&
    value.version === PATCH_STUDIO_WORKER_PROTOCOL_VERSION &&
    typeof value.id === 'string' &&
    typeof value.task === 'string' &&
    typeof value.ok === 'boolean'
  );
}

function designCacheKey(source, options) {
  const keys = Object.keys(options ?? {}).sort();
  const normalized = {};
  for (const key of keys) normalized[key] = options[key];
  return `${source}\u0000${JSON.stringify(normalized)}`;
}

function rehydrateError(serialized) {
  const error = new Error(serialized?.message ?? 'Studio language task failed.');
  error.name = serialized?.name || 'Error';
  if (serialized?.code) error.code = serialized.code;
  if (Number.isInteger(serialized?.line)) error.line = serialized.line;
  return error;
}
