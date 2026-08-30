import { handleStudioWorkerRequest } from '../src/studio-worker-protocol.js';

export const PATCH_STUDIO_LANGUAGE_WORKER_HOST_VERSION = '0.1';

/**
 * Browser Worker host for the versioned Studio language-task protocol.
 *
 * The Worker owns no UI state. Every message is self-contained and returns one
 * structured-clone-safe response envelope. The normal Studio can therefore use
 * a synchronous fallback through handleStudioWorkerRequest without changing
 * semantics when Worker startup is unavailable.
 */
export function installStudioLanguageWorkerHost(scope = globalThis) {
  if (!scope || typeof scope.addEventListener !== 'function' || typeof scope.postMessage !== 'function') {
    throw new Error('Studio language worker host needs a Worker-like message scope.');
  }
  const listener = event => scope.postMessage(handleStudioWorkerRequest(event?.data));
  scope.addEventListener('message', listener);
  return () => scope.removeEventListener?.('message', listener);
}

if (typeof WorkerGlobalScope !== 'undefined' && globalThis instanceof WorkerGlobalScope) {
  installStudioLanguageWorkerHost(globalThis);
}
