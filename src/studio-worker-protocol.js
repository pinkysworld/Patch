import { compile } from './compiler.js';
import { buildStudioDesignModel } from './studio-design-model.js';

export const PATCH_STUDIO_WORKER_PROTOCOL = 'patch-studio-worker';
export const PATCH_STUDIO_WORKER_PROTOCOL_VERSION = '0.1';
export const PATCH_STUDIO_WORKER_MAX_SOURCE_CHARS = 2_000_000;
export const PATCH_STUDIO_WORKER_TASK_DESIGN_MODEL = 'design-model';
export const PATCH_STUDIO_WORKER_TASK_COMPILE = 'compile';

const TASKS = new Set([
  PATCH_STUDIO_WORKER_TASK_DESIGN_MODEL,
  PATCH_STUDIO_WORKER_TASK_COMPILE
]);

export class PatchStudioWorkerProtocolError extends Error {
  constructor(message, code = 'STUDIO_WORKER_PROTOCOL') {
    super(message);
    this.name = 'PatchStudioWorkerProtocolError';
    this.code = code;
  }
}

/**
 * Versioned structured-clone boundary for CPU-heavy Studio language work.
 *
 * The protocol deliberately carries source text + bounded plain options instead
 * of DOM state or live interpreter objects. This keeps a future Worker isolated
 * from the Studio UI and makes synchronous fallback use the exact same task
 * contract.
 */
export function createStudioWorkerRequest({ id, task, source, options = {} }) {
  const request = {
    protocol: PATCH_STUDIO_WORKER_PROTOCOL,
    version: PATCH_STUDIO_WORKER_PROTOCOL_VERSION,
    id: normalizeId(id),
    task: normalizeTask(task),
    source: normalizeSource(source),
    options: normalizeOptions(task, options)
  };
  return Object.freeze(request);
}

export function handleStudioWorkerRequest(input) {
  let request;
  try {
    request = validateStudioWorkerRequest(input);
    const result = runTask(request);
    return Object.freeze({
      protocol: PATCH_STUDIO_WORKER_PROTOCOL,
      version: PATCH_STUDIO_WORKER_PROTOCOL_VERSION,
      id: request.id,
      task: request.task,
      ok: true,
      result
    });
  } catch (error) {
    return Object.freeze({
      protocol: PATCH_STUDIO_WORKER_PROTOCOL,
      version: PATCH_STUDIO_WORKER_PROTOCOL_VERSION,
      id: safeEnvelopeId(input),
      task: safeEnvelopeTask(input),
      ok: false,
      error: serializeWorkerError(error)
    });
  }
}

export function validateStudioWorkerRequest(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new PatchStudioWorkerProtocolError('Studio worker request must be an object.', 'STUDIO_WORKER_REQUEST');
  }
  if (input.protocol !== PATCH_STUDIO_WORKER_PROTOCOL) {
    throw new PatchStudioWorkerProtocolError('Studio worker request uses an unknown protocol.', 'STUDIO_WORKER_PROTOCOL_NAME');
  }
  if (input.version !== PATCH_STUDIO_WORKER_PROTOCOL_VERSION) {
    throw new PatchStudioWorkerProtocolError(
      `Studio worker protocol ${input.version ?? '(missing)'} is not supported; expected ${PATCH_STUDIO_WORKER_PROTOCOL_VERSION}.`,
      'STUDIO_WORKER_PROTOCOL_VERSION'
    );
  }
  return Object.freeze({
    protocol: PATCH_STUDIO_WORKER_PROTOCOL,
    version: PATCH_STUDIO_WORKER_PROTOCOL_VERSION,
    id: normalizeId(input.id),
    task: normalizeTask(input.task),
    source: normalizeSource(input.source),
    options: normalizeOptions(input.task, input.options ?? {})
  });
}

function runTask(request) {
  if (request.task === PATCH_STUDIO_WORKER_TASK_DESIGN_MODEL) {
    return buildStudioDesignModel(request.source, request.options);
  }
  if (request.task === PATCH_STUDIO_WORKER_TASK_COMPILE) {
    const compiled = compile(request.source, request.options);
    // Keep the transfer surface plain and explicit. Runtime instances, DOM nodes
    // and functions never cross this boundary.
    return Object.freeze({
      project: compiled.project,
      ast: compiled.ast,
      ir: compiled.ir,
      changeAnalysis: compiled.changeAnalysis,
      formalBridge: compiled.formalBridge,
      formalSource: compiled.formalSource,
      formalCalls: compiled.formalCalls,
      sourceValidation: compiled.sourceValidation,
      guardValidation: compiled.guardValidation,
      callSiteValidation: compiled.callSiteValidation,
      windowLayoutPolicy: compiled.windowLayoutPolicy
    });
  }
  throw new PatchStudioWorkerProtocolError(`Unknown Studio worker task '${request.task}'.`, 'STUDIO_WORKER_TASK');
}

function normalizeTask(task) {
  if (!TASKS.has(task)) {
    throw new PatchStudioWorkerProtocolError(
      `Studio worker task must be one of: ${[...TASKS].join(', ')}.`,
      'STUDIO_WORKER_TASK'
    );
  }
  return task;
}

function normalizeId(id) {
  const value = String(id ?? '').trim();
  if (!value || value.length > 128) {
    throw new PatchStudioWorkerProtocolError('Studio worker request id must contain 1 to 128 characters.', 'STUDIO_WORKER_ID');
  }
  return value;
}

function normalizeSource(source) {
  const value = String(source ?? '');
  if (value.length > PATCH_STUDIO_WORKER_MAX_SOURCE_CHARS) {
    throw new PatchStudioWorkerProtocolError(
      `Studio worker source is ${value.length} characters; the boundary limit is ${PATCH_STUDIO_WORKER_MAX_SOURCE_CHARS}.`,
      'STUDIO_WORKER_SOURCE_BUDGET'
    );
  }
  return value;
}

function normalizeOptions(task, options) {
  if (!options || typeof options !== 'object' || Array.isArray(options)) {
    throw new PatchStudioWorkerProtocolError('Studio worker options must be an object.', 'STUDIO_WORKER_OPTIONS');
  }
  if (task === PATCH_STUDIO_WORKER_TASK_DESIGN_MODEL) {
    return compactPlainOptions(options, [
      'maxTopLevelNodes', 'maxExpressionChars', 'maxTotalExpressionChars'
    ]);
  }
  if (task === PATCH_STUDIO_WORKER_TASK_COMPILE) {
    return compactPlainOptions(options, ['name', 'kind', 'entry']);
  }
  return Object.freeze({});
}

function compactPlainOptions(options, allowed) {
  const result = {};
  for (const key of allowed) {
    if (options[key] === undefined) continue;
    const value = options[key];
    if (!['string', 'number', 'boolean'].includes(typeof value) && value !== null) {
      throw new PatchStudioWorkerProtocolError(`Studio worker option '${key}' must be a primitive value.`, 'STUDIO_WORKER_OPTIONS');
    }
    result[key] = value;
  }
  for (const key of Object.keys(options)) {
    if (!allowed.includes(key)) {
      throw new PatchStudioWorkerProtocolError(`Studio worker option '${key}' is not allowed for this task.`, 'STUDIO_WORKER_OPTIONS');
    }
  }
  return Object.freeze(result);
}

function serializeWorkerError(error) {
  return Object.freeze({
    name: String(error?.name ?? 'Error'),
    message: String(error?.message ?? error ?? 'Unknown Studio worker error'),
    code: error?.code === undefined ? null : String(error.code),
    line: Number.isInteger(error?.line) ? error.line : null
  });
}

function safeEnvelopeId(input) {
  try { return normalizeId(input?.id); } catch { return null; }
}

function safeEnvelopeTask(input) {
  return typeof input?.task === 'string' ? input.task : null;
}
