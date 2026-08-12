export const PATCH_STUDIO_PROJECT_FORMAT = 'patch-studio-project';
export const PATCH_STUDIO_PROJECT_VERSION = 1;
export const PATCH_STUDIO_RECOVERY_FORMAT = 'patch-studio-recovery';
export const PATCH_STUDIO_RECOVERY_VERSION = 1;
export const PATCH_STUDIO_MAX_SOURCE_BYTES = 2 * 1024 * 1024;
export const PATCH_STUDIO_MAX_RECOVERY_SNAPSHOTS = 5;

const encoder = new TextEncoder();

export class StudioProjectError extends Error {
  constructor(message, code = 'STUDIO_PROJECT_INVALID') {
    super(message);
    this.name = 'StudioProjectError';
    this.code = code;
  }
}

export function buildStudioProjectBundle(state) {
  const normalized = normalizeStudioState(state);
  return {
    format: PATCH_STUDIO_PROJECT_FORMAT,
    version: PATCH_STUDIO_PROJECT_VERSION,
    project: {
      name: normalized.name,
      kind: normalized.kind,
      entry: 'main.patch'
    },
    files: [{ path: 'main.patch', content: normalized.code }]
  };
}

export function validateStudioProjectBundle(value) {
  if (!isRecord(value)) throw new StudioProjectError('Patch Studio project must be a JSON object.');
  if (value.format !== PATCH_STUDIO_PROJECT_FORMAT) {
    throw new StudioProjectError(`Unsupported Patch Studio project format '${String(value.format ?? '?')}'.`, 'STUDIO_PROJECT_FORMAT');
  }
  const version = integer(value.version, 'Project version');
  if (version > PATCH_STUDIO_PROJECT_VERSION) {
    throw new StudioProjectError(
      `This project uses Patch Studio project version ${version}, but this Studio supports up to version ${PATCH_STUDIO_PROJECT_VERSION}.`,
      'STUDIO_PROJECT_FUTURE_VERSION'
    );
  }
  if (version < 1) throw new StudioProjectError(`Unsupported Patch Studio project version ${version}.`, 'STUDIO_PROJECT_VERSION');
  if (!isRecord(value.project)) throw new StudioProjectError('Project metadata is missing.');
  if (!Array.isArray(value.files) || value.files.length < 1) throw new StudioProjectError('Project files are missing.');

  const entry = normalizedPath(value.project.entry ?? 'main.patch', 'Project entry');
  const files = [];
  const seen = new Set();
  for (const file of value.files) {
    if (!isRecord(file)) throw new StudioProjectError('Each project file must be an object.');
    const path = normalizedPath(file.path, 'Project file path');
    if (seen.has(path)) throw new StudioProjectError(`Project file '${path}' appears more than once.`);
    seen.add(path);
    if (typeof file.content !== 'string') throw new StudioProjectError(`Project file '${path}' must contain text.`);
    if (encoder.encode(file.content).length > PATCH_STUDIO_MAX_SOURCE_BYTES) {
      throw new StudioProjectError(`Project file '${path}' exceeds the ${PATCH_STUDIO_MAX_SOURCE_BYTES} byte Studio limit.`, 'STUDIO_PROJECT_TOO_LARGE');
    }
    files.push({ path, content: file.content });
  }
  if (!seen.has(entry)) throw new StudioProjectError(`Project entry '${entry}' is not present in the bundle.`);
  if (entry !== 'main.patch' || files.length !== 1) {
    throw new StudioProjectError('Patch Studio project version 1 supports exactly one main.patch source file.', 'STUDIO_PROJECT_UNSUPPORTED_LAYOUT');
  }

  return buildStudioProjectBundle({
    name: value.project.name,
    kind: value.project.kind,
    code: files[0].content
  });
}

export function serializeStudioProjectBundle(bundle) {
  return JSON.stringify(validateStudioProjectBundle(bundle), null, 2) + '\n';
}

export function parseStudioProjectBundle(text) {
  let value;
  try {
    value = JSON.parse(String(text));
  } catch (error) {
    throw new StudioProjectError(`Patch Studio project JSON is invalid: ${error.message}`, 'STUDIO_PROJECT_JSON');
  }
  return validateStudioProjectBundle(value);
}

export function studioStateFromBundle(bundle) {
  const normalized = validateStudioProjectBundle(bundle);
  return {
    name: normalized.project.name,
    kind: normalized.project.kind,
    code: normalized.files[0].content
  };
}

export function parseStoredStudioProject(text) {
  if (text === null || text === undefined || String(text).trim() === '') return null;
  let value;
  try {
    value = JSON.parse(String(text));
  } catch (error) {
    throw new StudioProjectError(`Stored Patch Studio project is corrupted: ${error.message}`, 'STUDIO_PROJECT_STORAGE_JSON');
  }
  if (value?.format === PATCH_STUDIO_PROJECT_FORMAT) return validateStudioProjectBundle(value);
  if (isRecord(value) && typeof value.code === 'string') {
    return buildStudioProjectBundle({ name: value.name, kind: value.kind, code: value.code });
  }
  throw new StudioProjectError('Stored Patch Studio project has an unknown format.', 'STUDIO_PROJECT_STORAGE_FORMAT');
}

export function createRecoverySnapshot(bundle, savedAt = new Date()) {
  const date = savedAt instanceof Date ? savedAt : new Date(savedAt);
  if (!Number.isFinite(date.getTime())) throw new StudioProjectError('Recovery snapshot timestamp is invalid.', 'STUDIO_RECOVERY_TIME');
  return {
    format: PATCH_STUDIO_RECOVERY_FORMAT,
    version: PATCH_STUDIO_RECOVERY_VERSION,
    savedAt: date.toISOString(),
    project: validateStudioProjectBundle(bundle)
  };
}

export function validateRecoverySnapshot(value) {
  if (!isRecord(value) || value.format !== PATCH_STUDIO_RECOVERY_FORMAT) {
    throw new StudioProjectError('Recovery snapshot format is invalid.', 'STUDIO_RECOVERY_FORMAT');
  }
  const version = integer(value.version, 'Recovery version');
  if (version > PATCH_STUDIO_RECOVERY_VERSION) {
    throw new StudioProjectError(`Recovery snapshot version ${version} is newer than this Studio supports.`, 'STUDIO_RECOVERY_FUTURE_VERSION');
  }
  if (version !== PATCH_STUDIO_RECOVERY_VERSION) throw new StudioProjectError(`Unsupported recovery snapshot version ${version}.`, 'STUDIO_RECOVERY_VERSION');
  const savedAt = new Date(value.savedAt);
  if (!Number.isFinite(savedAt.getTime())) throw new StudioProjectError('Recovery snapshot timestamp is invalid.', 'STUDIO_RECOVERY_TIME');
  return createRecoverySnapshot(value.project, savedAt);
}

export function parseRecoverySnapshots(text) {
  if (text === null || text === undefined || String(text).trim() === '') return [];
  let value;
  try {
    value = JSON.parse(String(text));
  } catch {
    return [];
  }
  if (!Array.isArray(value)) return [];
  const snapshots = [];
  for (const item of value) {
    try { snapshots.push(validateRecoverySnapshot(item)); } catch { /* ignore one corrupted recovery slot */ }
  }
  return snapshots
    .sort((a, b) => b.savedAt.localeCompare(a.savedAt))
    .slice(0, PATCH_STUDIO_MAX_RECOVERY_SNAPSHOTS);
}

export function addRecoverySnapshot(existing, bundle, savedAt = new Date(), max = PATCH_STUDIO_MAX_RECOVERY_SNAPSHOTS) {
  const limit = Math.max(1, Math.min(20, Number.isInteger(max) ? max : PATCH_STUDIO_MAX_RECOVERY_SNAPSHOTS));
  const snapshot = createRecoverySnapshot(bundle, savedAt);
  const canonical = serializeStudioProjectBundle(snapshot.project);
  const kept = [];
  for (const item of existing ?? []) {
    let normalized;
    try { normalized = validateRecoverySnapshot(item); } catch { continue; }
    if (serializeStudioProjectBundle(normalized.project) === canonical) continue;
    kept.push(normalized);
  }
  return [snapshot, ...kept]
    .sort((a, b) => b.savedAt.localeCompare(a.savedAt))
    .slice(0, limit);
}

export function serializeRecoverySnapshots(snapshots) {
  const normalized = [];
  for (const item of snapshots ?? []) {
    try { normalized.push(validateRecoverySnapshot(item)); } catch { /* omit corrupt entries */ }
  }
  return JSON.stringify(normalized.slice(0, PATCH_STUDIO_MAX_RECOVERY_SNAPSHOTS));
}

function normalizeStudioState(state) {
  if (!isRecord(state)) throw new StudioProjectError('Project state must be an object.');
  const rawName = typeof state.name === 'string' ? state.name.trim() : '';
  const name = (rawName || 'PatchApp').slice(0, 128);
  const kind = state.kind === 'window' ? 'window' : state.kind === 'console' ? 'console' : null;
  if (!kind) throw new StudioProjectError(`Project kind must be 'console' or 'window'.`);
  if (typeof state.code !== 'string') throw new StudioProjectError('Project source must be text.');
  if (encoder.encode(state.code).length > PATCH_STUDIO_MAX_SOURCE_BYTES) {
    throw new StudioProjectError(`Project source exceeds the ${PATCH_STUDIO_MAX_SOURCE_BYTES} byte Studio limit.`, 'STUDIO_PROJECT_TOO_LARGE');
  }
  return { name, kind, code: state.code };
}

function normalizedPath(value, label) {
  const path = String(value ?? '').replaceAll('\\', '/').trim();
  if (!path || path.startsWith('/') || path.includes('\0')) throw new StudioProjectError(`${label} is invalid.`);
  const parts = path.split('/');
  if (parts.some(part => !part || part === '.' || part === '..')) throw new StudioProjectError(`${label} must stay inside the project.`);
  return parts.join('/');
}

function integer(value, label) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < 0) throw new StudioProjectError(`${label} must be a non-negative integer.`);
  return number;
}

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
