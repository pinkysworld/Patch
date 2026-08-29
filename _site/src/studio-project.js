import { patchArtifactStem } from './artifact-name.js?v=9ad29318e93c7c71';
import { validateStudioResources } from './studio-resources.js?v=9ad29318e93c7c71';

export const PATCH_STUDIO_PROJECT_FORMAT = 'patch-studio-project';
export const PATCH_STUDIO_PROJECT_VERSION = 4;
export const PREVIOUS_PATCH_STUDIO_PROJECT_VERSION = 3;
export const PATCH_STUDIO_RECOVERY_FORMAT = 'patch-studio-recovery';
export const PATCH_STUDIO_RECOVERY_VERSION = 1;
export const PATCH_STUDIO_MAX_SOURCE_BYTES = 2 * 1024 * 1024;
export const PATCH_STUDIO_MAX_PROJECT_BYTES = 8 * 1024 * 1024;
export const PATCH_STUDIO_MAX_PROJECT_FILES = 64;
export const PATCH_STUDIO_MAX_RECOVERY_SNAPSHOTS = 5;
export const PATCH_STUDIO_BUILD_TARGETS = Object.freeze([
  'web', 'native-windows', 'native-macos', 'native-linux', 'native-freebsd', 'portable', 'wasm-direct', 'wasm-bootstrap'
]);
export const PATCH_STUDIO_NATIVE_BUILD_MODES = Object.freeze(['prebuilt', 'cloud', 'local', 'compat']);
export const PATCH_STUDIO_DEFAULT_BUILD_TARGET = 'web';
export const PATCH_STUDIO_DEFAULT_NATIVE_BUILD_MODE = 'prebuilt';

const encoder = new TextEncoder();

export function studioProjectFileStem(name) {
  return patchArtifactStem(name).slice(0, 64) || 'PatchApp';
}

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
      entry: normalized.entry,
      build: {
        target: normalized.buildTarget,
        nativeMode: normalized.nativeBuildMode
      }
    },
    files: normalized.files.map(file => ({ path: file.path, content: file.content })),
    resources: normalized.resources.map(resource => ({ ...resource }))
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
  const files = validateProjectFiles(value.files, entry);
  if (version <= 2 && (entry !== 'main.patch' || files.length !== 1 || files[0].path !== 'main.patch')) {
    throw new StudioProjectError(`Patch Studio project version ${version} supports exactly one main.patch source file.`, 'STUDIO_PROJECT_UNSUPPORTED_LAYOUT');
  }

  const migratedBuild = version === 1
    ? { target: PATCH_STUDIO_DEFAULT_BUILD_TARGET, nativeMode: PATCH_STUDIO_DEFAULT_NATIVE_BUILD_MODE }
    : validateBuildSettings(value.project.build);
  const resources = version >= 4 ? validateStudioResources(value.resources) : [];

  return buildStudioProjectBundle({
    name: value.project.name,
    kind: value.project.kind,
    entry,
    files,
    resources,
    buildTarget: migratedBuild.target,
    nativeBuildMode: migratedBuild.nativeMode
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
  const entryFile = normalized.files.find(file => file.path === normalized.project.entry);
  return {
    name: normalized.project.name,
    kind: normalized.project.kind,
    entry: normalized.project.entry,
    files: normalized.files.map(file => ({ ...file })),
    resources: normalized.resources.map(resource => ({ ...resource })),
    code: entryFile?.content ?? '',
    buildTarget: normalized.project.build.target,
    nativeBuildMode: normalized.project.build.nativeMode
  };
}

export function composeStudioProjectSource(bundle) {
  const normalized = validateStudioProjectBundle(bundle);
  const ordered = orderedProjectFiles(normalized);
  let source = '';
  const segments = [];

  for (const file of ordered) {
    const content = file.content.replace(/\r\n?/g, '\n');
    if (source.length) source += source.endsWith('\n') ? '\n' : '\n\n';
    const startLine = lineCount(source);
    source += content;
    const endLine = startLine + Math.max(0, lineCount(content) - 1);
    segments.push({ path: file.path, startLine, endLine });
  }

  return {
    source,
    entry: normalized.project.entry,
    files: ordered.map(file => file.path),
    segments
  };
}

export function mapStudioProjectLine(composition, line) {
  const number = Number(line);
  if (!composition || !Array.isArray(composition.segments) || !Number.isInteger(number) || number < 1) return null;
  for (const segment of composition.segments) {
    if (number >= segment.startLine && number <= segment.endLine) {
      return { path: segment.path, line: number - segment.startLine + 1 };
    }
  }
  return null;
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
    return buildStudioProjectBundle({
      name: value.name,
      kind: value.kind,
      code: value.code,
      buildTarget: value.buildTarget,
      nativeBuildMode: value.nativeBuildMode
    });
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
  const entry = normalizedPath(state.entry ?? 'main.patch', 'Project entry');
  const rawFiles = Array.isArray(state.files)
    ? state.files
    : [{ path: entry, content: typeof state.code === 'string' ? state.code : '' }];
  const files = validateProjectFiles(rawFiles, entry);
  const resources = validateStudioResources(state.resources);
  const buildTarget = normalizeBuildTarget(state.buildTarget);
  const nativeBuildMode = normalizeNativeBuildMode(state.nativeBuildMode);
  return { name, kind, entry, files, resources, buildTarget, nativeBuildMode };
}

function validateProjectFiles(value, entry) {
  if (!Array.isArray(value) || value.length < 1) throw new StudioProjectError('Project files are missing.');
  if (value.length > PATCH_STUDIO_MAX_PROJECT_FILES) {
    throw new StudioProjectError(`Project contains more than ${PATCH_STUDIO_MAX_PROJECT_FILES} source files.`, 'STUDIO_PROJECT_TOO_MANY_FILES');
  }
  const files = [];
  const seen = new Set();
  let totalBytes = 0;
  for (const file of value) {
    if (!isRecord(file)) throw new StudioProjectError('Each project file must be an object.');
    const path = normalizedPath(file.path, 'Project file path');
    if (!/\.patch$/i.test(path)) throw new StudioProjectError(`Project file '${path}' must use the .patch extension.`, 'STUDIO_PROJECT_FILE_TYPE');
    if (seen.has(path)) throw new StudioProjectError(`Project file '${path}' appears more than once.`);
    seen.add(path);
    if (typeof file.content !== 'string') throw new StudioProjectError(`Project file '${path}' must contain text.`);
    const bytes = encoder.encode(file.content).length;
    if (bytes > PATCH_STUDIO_MAX_SOURCE_BYTES) {
      throw new StudioProjectError(`Project file '${path}' exceeds the ${PATCH_STUDIO_MAX_SOURCE_BYTES} byte Studio limit.`, 'STUDIO_PROJECT_TOO_LARGE');
    }
    totalBytes += bytes;
    files.push({ path, content: file.content });
  }
  if (totalBytes > PATCH_STUDIO_MAX_PROJECT_BYTES) {
    throw new StudioProjectError(`Project sources exceed the ${PATCH_STUDIO_MAX_PROJECT_BYTES} byte Studio limit.`, 'STUDIO_PROJECT_TOO_LARGE');
  }
  if (!seen.has(entry)) throw new StudioProjectError(`Project entry '${entry}' is not present in the bundle.`);
  return files;
}

function orderedProjectFiles(bundle) {
  const entry = bundle.project.entry;
  const entryFile = bundle.files.find(file => file.path === entry);
  return [entryFile, ...bundle.files.filter(file => file.path !== entry)];
}

function validateBuildSettings(value) {
  if (!isRecord(value)) throw new StudioProjectError('Project build settings are missing.', 'STUDIO_PROJECT_BUILD_SETTINGS');
  if (typeof value.target !== 'string' || !PATCH_STUDIO_BUILD_TARGETS.includes(value.target)) {
    throw new StudioProjectError(`Unsupported Studio build target '${String(value.target ?? '?')}'.`, 'STUDIO_PROJECT_BUILD_TARGET');
  }
  if (typeof value.nativeMode !== 'string' || !PATCH_STUDIO_NATIVE_BUILD_MODES.includes(value.nativeMode)) {
    throw new StudioProjectError(`Unsupported Studio native build mode '${String(value.nativeMode ?? '?')}'.`, 'STUDIO_PROJECT_NATIVE_MODE');
  }
  return { target: value.target, nativeMode: value.nativeMode };
}

function normalizeBuildTarget(value) {
  if (value === undefined || value === null || value === '') return PATCH_STUDIO_DEFAULT_BUILD_TARGET;
  if (!PATCH_STUDIO_BUILD_TARGETS.includes(value)) throw new StudioProjectError(`Unsupported Studio build target '${String(value)}'.`, 'STUDIO_PROJECT_BUILD_TARGET');
  return value;
}

function normalizeNativeBuildMode(value) {
  if (value === undefined || value === null || value === '') return PATCH_STUDIO_DEFAULT_NATIVE_BUILD_MODE;
  if (!PATCH_STUDIO_NATIVE_BUILD_MODES.includes(value)) throw new StudioProjectError(`Unsupported Studio native build mode '${String(value)}'.`, 'STUDIO_PROJECT_NATIVE_MODE');
  return value;
}

function normalizedPath(value, label) {
  const path = String(value ?? '').replaceAll('\\', '/').trim();
  if (!path || path.startsWith('/') || path.includes('\0')) throw new StudioProjectError(`${label} is invalid.`);
  const parts = path.split('/');
  if (parts.some(part => !part || part === '.' || part === '..')) throw new StudioProjectError(`${label} must stay inside the project.`);
  return parts.join('/');
}

function lineCount(text) {
  if (text === '') return 1;
  return String(text).split('\n').length;
}

function integer(value, label) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < 0) throw new StudioProjectError(`${label} must be a non-negative integer.`);
  return number;
}

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
