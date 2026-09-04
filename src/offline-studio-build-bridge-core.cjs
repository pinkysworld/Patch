'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');

const OFFLINE_BUILD_BRIDGE_PROTOCOL = 'patch-offline-build-bridge/0.2';
const OFFLINE_BUILD_BRIDGE_PATH = '/v1/build';
const OFFLINE_BUILD_BRIDGE_MAX_BODY = 64 * 1024;
const OFFLINE_WORKSPACE_SNAPSHOT_PROTOCOL = 'patch-offline-workspace-snapshot/0.2';
const OFFLINE_WORKSPACE_SNAPSHOT_PATH = '/v1/snapshot';
const OFFLINE_WORKSPACE_SNAPSHOT_MAX_BODY = 24 * 1024 * 1024;
const OFFLINE_BUILD_ARTIFACT_PREFIX = '/v1/artifacts/';
const ARTIFACT_TTL_MS = 10 * 60 * 1000;
const MAX_ARTIFACTS = 8;

const PATCH_PROJECT_FORMAT = 'patch-studio-project';
const PATCH_PROJECT_VERSION = 4;
const PATCH_PROJECT_MAX_FILES = 64;
const PATCH_PROJECT_MAX_FILE_BYTES = 2 * 1024 * 1024;
const PATCH_PROJECT_MAX_SOURCE_BYTES = 8 * 1024 * 1024;
const PATCH_PROJECT_MAX_RESOURCE_BYTES = 2 * 1024 * 1024;
const PATCH_PROJECT_MAX_RESOURCE_TOTAL_BYTES = 8 * 1024 * 1024;
const PATCH_PROJECT_MAX_RESOURCES = 128;
const PATCH_PROJECT_MAX_SERIALIZED_BYTES = 22 * 1024 * 1024;
const PATCH_IMAGE_MEDIA_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']);

const REQUEST_ID_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;
const APP_NAME_RE = /^[A-Za-z][A-Za-z0-9._-]{0,63}$/;
const RESOURCE_ID_RE = /^[A-Za-z][A-Za-z0-9]*(?:[._-][A-Za-z0-9]+)*$/;
const SHA256_RE = /^[0-9a-f]{64}$/;
const ARTIFACT_ID_RE = /^[a-f0-9]{32}$/;
const PATCH_DIAGNOSTIC_CODE_RE = /^PATCH\d{4}$/;
const PATCH_DIAGNOSTIC_PHASE_RE = /^[a-z][a-z0-9-]{0,31}$/;
const PATCH_DIAGNOSTIC_MAX_MESSAGE_BYTES = 4 * 1024;

class OfflineBuildBridgeError extends Error {
  constructor(code, message, status = 400) {
    super(message);
    this.name = 'OfflineBuildBridgeError';
    this.code = code;
    this.status = status;
  }
}

function validateOfflineBuildRequest(value) {
  if (!isRecord(value)) {
    throw new OfflineBuildBridgeError('invalid-request', 'Build request must be a JSON object.');
  }
  const allowed = new Set(['protocol', 'action', 'requestId', 'source', 'appName']);
  rejectUnknownFields(value, allowed, 'unknown-field', 'build request');
  if (value.protocol !== OFFLINE_BUILD_BRIDGE_PROTOCOL) {
    throw new OfflineBuildBridgeError('protocol-mismatch', `Expected protocol ${OFFLINE_BUILD_BRIDGE_PROTOCOL}.`);
  }
  if (value.action !== 'build-native-window') {
    throw new OfflineBuildBridgeError('unsupported-action', "Only 'build-native-window' is allowed by bridge 0.2.");
  }
  const requestId = validateRequestId(value.requestId);
  const source = validateRelativeBuildInput(value.source);
  const appName = String(value.appName ?? '');
  if (!APP_NAME_RE.test(appName)) {
    throw new OfflineBuildBridgeError('invalid-app-name', 'appName must start with a letter and contain only letters, digits, dot, underscore or hyphen.');
  }
  return Object.freeze({
    protocol: OFFLINE_BUILD_BRIDGE_PROTOCOL,
    action: 'build-native-window',
    requestId,
    source,
    appName
  });
}

function validateOfflineWorkspaceSnapshot(value) {
  if (!isRecord(value)) {
    throw new OfflineBuildBridgeError('invalid-snapshot', 'Workspace snapshot request must be a JSON object.');
  }
  const allowed = new Set(['protocol', 'requestId', 'source', 'project']);
  rejectUnknownFields(value, allowed, 'unknown-snapshot-field', 'workspace snapshot');
  if (value.protocol !== OFFLINE_WORKSPACE_SNAPSHOT_PROTOCOL) {
    throw new OfflineBuildBridgeError('snapshot-protocol-mismatch', `Expected protocol ${OFFLINE_WORKSPACE_SNAPSHOT_PROTOCOL}.`);
  }
  const requestId = validateRequestId(value.requestId);
  const hasSource = typeof value.source === 'string';
  const hasProject = value.project !== undefined && value.project !== null;
  if (hasSource === hasProject) {
    throw new OfflineBuildBridgeError('snapshot-shape', 'Workspace snapshot must contain exactly one of source or project.');
  }

  if (hasSource) {
    const source = value.source;
    if (!source.trim()) throw new OfflineBuildBridgeError('empty-snapshot', 'Patch source snapshot is empty.');
    const bytes = Buffer.byteLength(source, 'utf8');
    if (bytes > PATCH_PROJECT_MAX_SOURCE_BYTES) {
      throw new OfflineBuildBridgeError('snapshot-too-large', 'Patch source snapshot exceeds the 8 MiB Stage 2 source limit.', 413);
    }
    return Object.freeze({ protocol: OFFLINE_WORKSPACE_SNAPSHOT_PROTOCOL, requestId, kind: 'source', source, bytes });
  }

  const project = validateProjectSnapshot(value.project);
  const serialized = `${JSON.stringify(project, null, 2)}\n`;
  const bytes = Buffer.byteLength(serialized, 'utf8');
  if (bytes > PATCH_PROJECT_MAX_SERIALIZED_BYTES) {
    throw new OfflineBuildBridgeError('snapshot-too-large', 'Patch project snapshot exceeds the 22 MiB Stage 2 serialized-project limit.', 413);
  }
  return Object.freeze({
    protocol: OFFLINE_WORKSPACE_SNAPSHOT_PROTOCOL,
    requestId,
    kind: 'project',
    project,
    serialized,
    bytes,
    sourceFileCount: project.files.length,
    resourceCount: project.resources.length
  });
}

function validateProjectSnapshot(value) {
  if (!isRecord(value)) throw new OfflineBuildBridgeError('invalid-project', 'Project snapshot must be a JSON object.');
  rejectUnknownFields(value, new Set(['format', 'version', 'project', 'files', 'resources']), 'project-unknown-field', 'project snapshot');
  if (value.format !== PATCH_PROJECT_FORMAT || value.version !== PATCH_PROJECT_VERSION) {
    throw new OfflineBuildBridgeError('project-version', `Installed host builds require ${PATCH_PROJECT_FORMAT} version ${PATCH_PROJECT_VERSION}.`);
  }
  if (!isRecord(value.project)) throw new OfflineBuildBridgeError('project-metadata', 'Project snapshot metadata is missing.');
  rejectUnknownFields(value.project, new Set(['name', 'kind', 'entry', 'build']), 'project-metadata-field', 'project metadata');
  const name = String(value.project.name ?? '').trim();
  if (!name || name.length > 128) throw new OfflineBuildBridgeError('project-name', 'Project snapshot name must be 1-128 characters.');
  if (value.project.kind !== 'window') throw new OfflineBuildBridgeError('project-kind', "Installed host build snapshots currently require project kind 'window'.");
  const entry = validateProjectPath(value.project.entry, 'Project entry', '.patch');

  if (!Array.isArray(value.files) || value.files.length < 1 || value.files.length > PATCH_PROJECT_MAX_FILES) {
    throw new OfflineBuildBridgeError('project-files', `Project snapshot must contain 1-${PATCH_PROJECT_MAX_FILES} Patch source files.`);
  }
  const files = [];
  const filePaths = new Set();
  let sourceBytes = 0;
  for (const item of value.files) {
    if (!isRecord(item)) throw new OfflineBuildBridgeError('project-file', 'Each project source file must be an object.');
    rejectUnknownFields(item, new Set(['path', 'content']), 'project-file-field', 'project source file');
    const filePath = validateProjectPath(item.path, 'Project file', '.patch');
    if (filePaths.has(filePath)) throw new OfflineBuildBridgeError('project-file-duplicate', `Project file '${filePath}' appears more than once.`);
    if (typeof item.content !== 'string') throw new OfflineBuildBridgeError('project-file-content', `Project file '${filePath}' must contain text.`);
    const bytes = Buffer.byteLength(item.content, 'utf8');
    if (bytes > PATCH_PROJECT_MAX_FILE_BYTES) throw new OfflineBuildBridgeError('project-file-too-large', `Project file '${filePath}' exceeds the 2 MiB limit.`, 413);
    sourceBytes += bytes;
    if (sourceBytes > PATCH_PROJECT_MAX_SOURCE_BYTES) throw new OfflineBuildBridgeError('project-source-too-large', 'Project source exceeds the 8 MiB limit.', 413);
    filePaths.add(filePath);
    files.push({ path: filePath, content: item.content });
  }
  if (!filePaths.has(entry)) throw new OfflineBuildBridgeError('project-entry', `Project entry '${entry}' is not present in the project files.`);

  const resources = validateProjectResources(value.resources);
  return Object.freeze({
    format: PATCH_PROJECT_FORMAT,
    version: PATCH_PROJECT_VERSION,
    project: Object.freeze({
      name,
      kind: 'window',
      entry,
      build: isRecord(value.project.build) ? { ...value.project.build } : { target: 'web', nativeMode: 'prebuilt' }
    }),
    files: Object.freeze(files.map(file => Object.freeze(file))),
    resources: Object.freeze(resources)
  });
}

function validateProjectResources(value) {
  if (value === undefined || value === null) return Object.freeze([]);
  if (!Array.isArray(value) || value.length > PATCH_PROJECT_MAX_RESOURCES) {
    throw new OfflineBuildBridgeError('project-resources', `Project snapshot may contain at most ${PATCH_PROJECT_MAX_RESOURCES} resources.`);
  }
  const resources = [];
  const ids = new Set();
  const paths = new Set();
  let totalBytes = 0;
  for (const item of value) {
    if (!isRecord(item)) throw new OfflineBuildBridgeError('project-resource', 'Each project resource must be an object.');
    rejectUnknownFields(item, new Set(['id', 'path', 'mediaType', 'size', 'sha256', 'data']), 'project-resource-field', 'project resource');
    const id = String(item.id ?? '').trim();
    if (id.length > 128 || !RESOURCE_ID_RE.test(id)) throw new OfflineBuildBridgeError('project-resource-id', `Project resource id '${id || '?'}' is invalid.`);
    const resourcePath = validateProjectPath(item.path, `Resource '${id}' path`);
    const mediaType = String(item.mediaType ?? '').trim().toLowerCase();
    if (!PATCH_IMAGE_MEDIA_TYPES.has(mediaType)) throw new OfflineBuildBridgeError('project-resource-media', `Resource '${id}' media type '${mediaType || '?'}' is not supported.`);
    if (ids.has(id)) throw new OfflineBuildBridgeError('project-resource-duplicate-id', `Resource id '${id}' appears more than once.`);
    if (paths.has(resourcePath)) throw new OfflineBuildBridgeError('project-resource-duplicate-path', `Resource path '${resourcePath}' appears more than once.`);

    const data = String(item.data ?? '');
    if (!data || data.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(data)) {
      throw new OfflineBuildBridgeError('project-resource-data', `Resource '${id}' data is not canonical base64.`);
    }
    const bytes = Buffer.from(data, 'base64');
    if (!bytes.length || bytes.length > PATCH_PROJECT_MAX_RESOURCE_BYTES || bytes.toString('base64') !== data) {
      throw new OfflineBuildBridgeError('project-resource-data', `Resource '${id}' data is invalid or exceeds the 2 MiB per-resource limit.`, bytes.length > PATCH_PROJECT_MAX_RESOURCE_BYTES ? 413 : 400);
    }
    const declaredSize = Number(item.size);
    if (!Number.isInteger(declaredSize) || declaredSize !== bytes.length) {
      throw new OfflineBuildBridgeError('project-resource-size', `Resource '${id}' size metadata does not match its data.`);
    }
    totalBytes += bytes.length;
    if (totalBytes > PATCH_PROJECT_MAX_RESOURCE_TOTAL_BYTES) {
      throw new OfflineBuildBridgeError('project-resource-total', 'Project resources exceed the 8 MiB total-resource limit.', 413);
    }
    const sha256 = String(item.sha256 ?? '').trim().toLowerCase();
    if (!SHA256_RE.test(sha256)) throw new OfflineBuildBridgeError('project-resource-hash', `Resource '${id}' SHA-256 is invalid.`);
    const actualSha256 = crypto.createHash('sha256').update(bytes).digest('hex');
    if (actualSha256 !== sha256) throw new OfflineBuildBridgeError('project-resource-hash-mismatch', `Resource '${id}' failed SHA-256 verification.`);

    ids.add(id);
    paths.add(resourcePath);
    resources.push(Object.freeze({ id, path: resourcePath, mediaType, size: bytes.length, sha256, data }));
  }
  return Object.freeze(resources);
}

function validateRequestId(value) {
  const requestId = String(value ?? '');
  if (!REQUEST_ID_RE.test(requestId)) {
    throw new OfflineBuildBridgeError('invalid-request-id', 'requestId must be 1-64 safe identifier characters.');
  }
  return requestId;
}

function validateRelativeBuildInput(value) {
  const source = String(value ?? '');
  const sourceSegments = source.replaceAll('\\', '/').split('/');
  if (
    !source ||
    source.length > 512 ||
    source.includes('\0') ||
    source.includes(':') ||
    sourceSegments.includes('..') ||
    path.isAbsolute(source) ||
    path.win32.isAbsolute(source)
  ) {
    throw new OfflineBuildBridgeError('invalid-source', 'source must be a relative Patch input path inside the opened workspace.');
  }
  const extension = path.extname(source).toLowerCase();
  if (extension !== '.patch' && extension !== '.patchproject') {
    throw new OfflineBuildBridgeError('invalid-source', 'source must name a .patch or .patchproject file.');
  }
  return source;
}

function validateProjectPath(value, label, requiredExtension = '') {
  const raw = String(value ?? '').trim();
  if (!raw || raw.length > 512 || raw.includes('\0') || raw.includes('\\') || raw.includes(':') || raw.startsWith('/') || path.posix.isAbsolute(raw) || path.win32.isAbsolute(raw)) {
    throw new OfflineBuildBridgeError('project-path', `${label} must be a bounded project-relative path.`);
  }
  const parts = raw.split('/');
  if (parts.some(part => !part || part === '.' || part === '..')) throw new OfflineBuildBridgeError('project-path', `${label} must stay inside the project.`);
  if (requiredExtension && path.posix.extname(raw).toLowerCase() !== requiredExtension) {
    throw new OfflineBuildBridgeError('project-path', `${label} must use the ${requiredExtension} extension.`);
  }
  return parts.join('/');
}

function rejectUnknownFields(value, allowed, code, label) {
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) throw new OfflineBuildBridgeError(code, `Unknown ${label} field '${key}'.`);
  }
}

function isRecord(value) {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function sanitizeBuildDiagnostic(value) {
  if (!isRecord(value)) return null;
  const keys = Object.keys(value);
  if (keys.some(key => !['format', 'version', 'code', 'severity', 'phase', 'message', 'location'].includes(key))) return null;
  if (value.format !== 'patch-diagnostic' || value.version !== 1) return null;
  const code = String(value.code ?? '');
  const severity = String(value.severity ?? '');
  const phase = String(value.phase ?? '').trim().toLowerCase();
  const message = String(value.message ?? '').trim();
  if (!PATCH_DIAGNOSTIC_CODE_RE.test(code) || severity !== 'error' || !PATCH_DIAGNOSTIC_PHASE_RE.test(phase) || !message) return null;

  let location = null;
  if (value.location !== null && value.location !== undefined) {
    if (!isRecord(value.location)) return null;
    if (Object.keys(value.location).some(key => !['entry', 'file', 'line', 'column'].includes(key))) return null;
    const entry = sanitizeDiagnosticPath(value.location.entry);
    const file = value.location.file == null ? null : sanitizeDiagnosticPath(value.location.file);
    const line = Number(value.location.line);
    const column = Number(value.location.column);
    if (!entry || (value.location.file != null && !file) || !Number.isInteger(line) || line < 1 || !Number.isInteger(column) || column < 1) return null;
    location = Object.freeze({ entry, ...(file ? { file } : {}), line, column });
  }

  return Object.freeze({
    format: 'patch-diagnostic',
    version: 1,
    code,
    severity: 'error',
    phase,
    message: boundedText(message, PATCH_DIAGNOSTIC_MAX_MESSAGE_BYTES),
    location
  });
}

function sanitizeDiagnosticPath(value) {
  const raw = String(value ?? '').trim().replaceAll('\\', '/');
  if (!raw || raw.length > 512 || raw.includes('\0') || raw.includes(':') || raw.startsWith('/')) return null;
  const parts = raw.split('/');
  if (parts.some(part => !part || part === '.' || part === '..')) return null;
  return parts.join('/');
}

function resolveOpenedWorkspace(workspaceRoot) {
  const rootInput = path.resolve(String(workspaceRoot ?? ''));
  let root;
  try {
    root = fs.realpathSync(rootInput);
  } catch {
    throw new OfflineBuildBridgeError('workspace-missing', 'Opened workspace does not exist.', 409);
  }
  const rootStat = fs.statSync(root);
  if (!rootStat.isDirectory()) throw new OfflineBuildBridgeError('workspace-invalid', 'Opened workspace is not a directory.', 409);
  return root;
}

function resolveOfflineBuildWorkspace(workspaceRoot, request) {
  const root = resolveOpenedWorkspace(workspaceRoot);
  const sourceCandidate = path.resolve(root, request.source);
  assertInsideWorkspace(root, sourceCandidate, 'source');

  let sourcePath;
  try {
    sourcePath = fs.realpathSync(sourceCandidate);
  } catch {
    throw new OfflineBuildBridgeError('source-missing', 'Requested Patch build input does not exist.', 404);
  }
  assertInsideWorkspace(root, sourcePath, 'source');
  const sourceStat = fs.statSync(sourcePath);
  if (!sourceStat.isFile()) throw new OfflineBuildBridgeError('source-invalid', 'Requested Patch build input is not a regular file.');

  const outDir = path.resolve(root, '.patch-build', 'native', request.requestId);
  assertInsideWorkspace(root, outDir, 'output');
  return Object.freeze({ root, sourcePath, outDir });
}

function materializeOfflineWorkspaceSnapshot(workspaceRoot, value) {
  const snapshot = validateOfflineWorkspaceSnapshot(value);
  const root = resolveOpenedWorkspace(workspaceRoot);
  const snapshotRoot = prepareSafeDirectory(root, ['.patch-studio', 'snapshots', snapshot.requestId], 'snapshot');
  const filename = snapshot.kind === 'project' ? 'project.patchproject' : 'main.patch';
  const sourcePath = path.join(snapshotRoot, filename);
  assertInsideWorkspace(root, sourcePath, 'snapshot');
  if (fs.existsSync(sourcePath) && fs.lstatSync(sourcePath).isSymbolicLink()) {
    throw new OfflineBuildBridgeError('snapshot-symlink', 'Workspace snapshot target may not be a symbolic link.', 409);
  }
  const text = snapshot.kind === 'project' ? snapshot.serialized : snapshot.source;
  fs.writeFileSync(sourcePath, text, { encoding: 'utf8', mode: 0o600 });
  const relative = path.relative(root, sourcePath).split(path.sep).join('/');
  const response = {
    protocol: OFFLINE_WORKSPACE_SNAPSHOT_PROTOCOL,
    requestId: snapshot.requestId,
    ok: true,
    kind: snapshot.kind,
    source: relative,
    bytes: Buffer.byteLength(text, 'utf8'),
    sha256: sha256File(sourcePath)
  };
  if (snapshot.kind === 'project') {
    response.sourceFileCount = snapshot.sourceFileCount;
    response.resourceCount = snapshot.resourceCount;
  }
  return Object.freeze(response);
}

function executeOfflineBuildRequest(workspaceRoot, value, options = {}) {
  const request = validateOfflineBuildRequest(value);
  const workspace = resolveOfflineBuildWorkspace(workspaceRoot, request);
  const outDir = prepareOfflineBuildOutput(workspace.root, request.requestId);
  const builder = options.builder;
  if (typeof builder !== 'function') {
    throw new OfflineBuildBridgeError('builder-unavailable', 'Offline build bridge has no host-native builder configured.', 503);
  }
  let built;
  try {
    built = builder(workspace.sourcePath, {
      name: request.appName,
      outDir,
      capture: true,
      platform: options.platform ?? process.platform
    });
  } catch (error) {
    const diagnostic = sanitizeBuildDiagnostic(error?.diagnostic);
    if (diagnostic) {
      const failure = new OfflineBuildBridgeError('build-diagnostic', boundedText(error?.message ?? String(error), 8 * 1024), 422);
      failure.diagnostic = diagnostic;
      throw failure;
    }
    throw error;
  }
  const result = {
    protocol: OFFLINE_BUILD_BRIDGE_PROTOCOL,
    requestId: request.requestId,
    action: request.action,
    ok: true,
    platform: built.platform,
    backend: built.backend,
    outputKind: built.outputKind,
    outputDirectory: toWorkspaceRelative(workspace.root, outDir)
  };
  if (built.stdout) result.diagnostics = boundedText(built.stdout, 64 * 1024);
  if (built.artifactPath) result.artifact = inspectBuildArtifact(workspace.root, built.artifactPath, built.artifactType);
  return Object.freeze(result);
}

function inspectBuildArtifact(root, artifactPath, artifactType = 'application/octet-stream') {
  const candidate = path.resolve(String(artifactPath));
  assertInsideWorkspace(root, candidate, 'artifact');
  let canonical;
  try { canonical = fs.realpathSync(candidate); }
  catch { throw new OfflineBuildBridgeError('artifact-missing', 'Native builder did not produce the declared artifact.', 500); }
  assertInsideWorkspace(root, canonical, 'artifact');
  const stat = fs.statSync(canonical);
  if (!stat.isFile()) throw new OfflineBuildBridgeError('artifact-invalid', 'Native builder artifact must be a regular file.', 500);
  return Object.freeze({
    path: toWorkspaceRelative(root, canonical),
    filename: path.basename(canonical),
    type: String(artifactType || 'application/octet-stream'),
    size: stat.size,
    sha256: sha256File(canonical)
  });
}

function createOfflineBuildRequestHandler(options = {}) {
  const workspaceRoot = options.workspaceRoot;
  const token = String(options.token ?? '');
  const allowedOrigin = options.allowedOrigin ? String(options.allowedOrigin) : '';
  if (Buffer.byteLength(token, 'utf8') < 24) {
    throw new OfflineBuildBridgeError('weak-token', 'Offline build bridge requires a per-launch token of at least 24 bytes.');
  }
  const artifacts = new Map();

  const handler = async (request, response) => {
    try {
      cleanupArtifacts(artifacts);
      const urlPath = String(request.url ?? '').split('?', 1)[0];
      if (request.method === 'OPTIONS') {
        if (!isBridgePath(urlPath)) return writeJson(response, 404, { ok: false, error: 'not-found' }, request, allowedOrigin);
        if (!originAllowed(request, allowedOrigin)) return writeJson(response, 403, { ok: false, error: 'origin' }, request, allowedOrigin);
        response.writeHead(204, {
          ...corsHeaders(request, allowedOrigin),
          'Access-Control-Allow-Methods': 'POST, GET, HEAD, OPTIONS',
          'Access-Control-Allow-Headers': 'authorization, content-type',
          'Access-Control-Max-Age': '600',
          'Cache-Control': 'no-store'
        });
        response.end();
        return;
      }
      if (!isBridgePath(urlPath)) return writeJson(response, 404, { ok: false, error: 'not-found' }, request, allowedOrigin);
      if (!originAllowed(request, allowedOrigin)) return writeJson(response, 403, { ok: false, error: 'origin' }, request, allowedOrigin);
      if (!authorized(request.headers.authorization, token)) {
        return writeJson(response, 401, { ok: false, error: 'unauthorized' }, request, allowedOrigin);
      }

      if (urlPath === OFFLINE_WORKSPACE_SNAPSHOT_PATH) {
        if (request.method !== 'POST') return methodNotAllowed(response, request, allowedOrigin, 'POST');
        requireJson(request);
        const body = await readJsonBody(request, options.snapshotMaxBodyBytes ?? OFFLINE_WORKSPACE_SNAPSHOT_MAX_BODY);
        const result = materializeOfflineWorkspaceSnapshot(workspaceRoot, body);
        return writeJson(response, 200, result, request, allowedOrigin);
      }

      if (urlPath === OFFLINE_BUILD_BRIDGE_PATH) {
        if (request.method !== 'POST') return methodNotAllowed(response, request, allowedOrigin, 'POST');
        requireJson(request);
        const body = await readJsonBody(request, options.maxBodyBytes ?? OFFLINE_BUILD_BRIDGE_MAX_BODY);
        const result = executeOfflineBuildRequest(workspaceRoot, body, {
          builder: options.builder,
          platform: options.platform
        });
        let responseResult = result;
        if (result.artifact) {
          const artifactId = crypto.randomBytes(16).toString('hex');
          const root = resolveOpenedWorkspace(workspaceRoot);
          const artifactPath = path.resolve(root, ...result.artifact.path.split('/'));
          assertInsideWorkspace(root, artifactPath, 'artifact');
          artifacts.set(artifactId, {
            path: artifactPath,
            createdAt: Date.now(),
            metadata: result.artifact
          });
          trimArtifacts(artifacts);
          responseResult = Object.freeze({
            ...result,
            artifact: Object.freeze({
              ...result.artifact,
              downloadPath: `${OFFLINE_BUILD_ARTIFACT_PREFIX}${artifactId}`
            })
          });
        }
        return writeJson(response, 200, responseResult, request, allowedOrigin);
      }

      const artifactId = urlPath.startsWith(OFFLINE_BUILD_ARTIFACT_PREFIX)
        ? urlPath.slice(OFFLINE_BUILD_ARTIFACT_PREFIX.length)
        : '';
      if (!ARTIFACT_ID_RE.test(artifactId)) return writeJson(response, 404, { ok: false, error: 'not-found' }, request, allowedOrigin);
      if (request.method !== 'GET' && request.method !== 'HEAD') return methodNotAllowed(response, request, allowedOrigin, 'GET, HEAD');
      const artifact = artifacts.get(artifactId);
      if (!artifact) return writeJson(response, 404, { ok: false, error: 'artifact-not-found' }, request, allowedOrigin);
      const bytes = fs.readFileSync(artifact.path);
      const headers = {
        ...corsHeaders(request, allowedOrigin),
        'Content-Type': artifact.metadata.type,
        'Content-Length': String(bytes.length),
        'Content-Disposition': `attachment; filename="${safeHeaderFilename(artifact.metadata.filename)}"`,
        'Cache-Control': 'no-store',
        'X-Patch-Artifact-Sha256': artifact.metadata.sha256,
        'X-Content-Type-Options': 'nosniff',
        'Referrer-Policy': 'no-referrer'
      };
      response.writeHead(200, headers);
      if (request.method === 'HEAD') response.end();
      else response.end(bytes);
      return;
    } catch (error) {
      const status = error instanceof OfflineBuildBridgeError ? error.status : 500;
      const code = error instanceof OfflineBuildBridgeError ? error.code : 'build-failed';
      const body = { ok: false, error: code, message: error?.message ?? String(error) };
      const diagnostic = sanitizeBuildDiagnostic(error?.diagnostic);
      if (diagnostic) body.diagnostic = diagnostic;
      return writeJson(response, status, body, request, allowedOrigin);
    }
  };

  handler.dispose = () => artifacts.clear();
  return handler;
}

function createOfflineBuildBridge(options = {}) {
  const host = options.host ?? '127.0.0.1';
  if (host !== '127.0.0.1') {
    throw new OfflineBuildBridgeError('unsafe-host', 'Offline build bridge may bind only to 127.0.0.1.');
  }
  const handler = createOfflineBuildRequestHandler(options);
  const server = http.createServer(handler);
  server.on('clientError', (_error, socket) => socket.end('HTTP/1.1 400 Bad Request\r\n\r\n'));
  server.on('close', () => handler.dispose());
  return server;
}

async function startOfflineBuildBridge(options = {}) {
  const server = createOfflineBuildBridge(options);
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(options.port ?? 0, '127.0.0.1', () => {
      server.off('error', reject);
      resolve();
    });
  });
  const address = server.address();
  return Object.freeze({
    server,
    origin: `http://127.0.0.1:${address.port}`,
    path: OFFLINE_BUILD_BRIDGE_PATH,
    snapshotPath: OFFLINE_WORKSPACE_SNAPSHOT_PATH,
    close: () => new Promise(resolve => server.close(resolve))
  });
}

function prepareOfflineBuildOutput(root, requestId) {
  return prepareSafeDirectory(root, ['.patch-build', 'native', requestId], 'output');
}

function prepareSafeDirectory(root, segments, label) {
  let current = root;
  for (const segment of segments) {
    const candidate = path.join(current, segment);
    assertInsideWorkspace(root, candidate, label);
    if (fs.existsSync(candidate)) {
      const stat = fs.lstatSync(candidate);
      if (stat.isSymbolicLink()) {
        throw new OfflineBuildBridgeError(`${label}-symlink`, `${capitalize(label)} path may not contain symbolic links.`, 409);
      }
      if (!stat.isDirectory()) {
        throw new OfflineBuildBridgeError(`${label}-invalid`, `${capitalize(label)} path collides with a non-directory entry.`, 409);
      }
    } else {
      fs.mkdirSync(candidate, { mode: 0o700 });
    }
    const canonical = fs.realpathSync(candidate);
    assertInsideWorkspace(root, canonical, label);
    current = canonical;
  }
  return current;
}

function assertInsideWorkspace(root, candidate, label) {
  const relative = path.relative(root, candidate);
  if (!relative || relative === '.') return;
  if (relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    throw new OfflineBuildBridgeError('workspace-escape', `${label} path escapes the opened workspace.`);
  }
}

function toWorkspaceRelative(root, absolutePath) {
  const relative = path.relative(root, absolutePath);
  assertInsideWorkspace(root, absolutePath, 'output');
  return relative.split(path.sep).join('/');
}

function authorized(header, expectedToken) {
  const prefix = 'Bearer ';
  if (typeof header !== 'string' || !header.startsWith(prefix)) return false;
  const actual = Buffer.from(header.slice(prefix.length), 'utf8');
  const expected = Buffer.from(expectedToken, 'utf8');
  if (actual.length !== expected.length) return false;
  return crypto.timingSafeEqual(actual, expected);
}

function originAllowed(request, allowedOrigin) {
  const origin = String(request.headers.origin ?? '');
  if (!origin) return true;
  return Boolean(allowedOrigin && origin === allowedOrigin);
}

function corsHeaders(request, allowedOrigin) {
  const origin = String(request.headers.origin ?? '');
  if (!origin || !allowedOrigin || origin !== allowedOrigin) return {};
  return { 'Access-Control-Allow-Origin': allowedOrigin, Vary: 'Origin' };
}

function requireJson(request) {
  const contentType = String(request.headers['content-type'] ?? '').split(';', 1)[0].trim().toLowerCase();
  if (contentType !== 'application/json') {
    throw new OfflineBuildBridgeError('content-type', 'Bridge requests require application/json.', 415);
  }
}

function readJsonBody(request, limit) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    let settled = false;
    request.on('data', chunk => {
      if (settled) return;
      size += chunk.length;
      if (size > limit) {
        settled = true;
        reject(new OfflineBuildBridgeError('request-too-large', 'Bridge request body is too large.', 413));
        request.resume();
        return;
      }
      chunks.push(chunk);
    });
    request.on('end', () => {
      if (settled) return;
      settled = true;
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); }
      catch { reject(new OfflineBuildBridgeError('invalid-json', 'Bridge request body is not valid JSON.')); }
    });
    request.on('error', error => {
      if (settled) return;
      settled = true;
      reject(error);
    });
  });
}

function isBridgePath(urlPath) {
  return urlPath === OFFLINE_BUILD_BRIDGE_PATH ||
    urlPath === OFFLINE_WORKSPACE_SNAPSHOT_PATH ||
    urlPath.startsWith(OFFLINE_BUILD_ARTIFACT_PREFIX);
}

function methodNotAllowed(response, request, allowedOrigin, allow) {
  response.setHeader('Allow', allow);
  return writeJson(response, 405, { ok: false, error: 'method-not-allowed' }, request, allowedOrigin);
}

function writeJson(response, status, value, request = { headers: {} }, allowedOrigin = '') {
  if (response.headersSent) return;
  const body = Buffer.from(`${JSON.stringify(value)}\n`, 'utf8');
  response.writeHead(status, {
    ...corsHeaders(request, allowedOrigin),
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': String(body.length),
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer'
  });
  response.end(body);
}

function cleanupArtifacts(artifacts) {
  const now = Date.now();
  for (const [id, artifact] of artifacts) {
    if (now - artifact.createdAt > ARTIFACT_TTL_MS) artifacts.delete(id);
  }
}

function trimArtifacts(artifacts) {
  cleanupArtifacts(artifacts);
  while (artifacts.size > MAX_ARTIFACTS) artifacts.delete(artifacts.keys().next().value);
}

function safeHeaderFilename(value) {
  return String(value ?? 'PatchApp').replace(/["\\\r\n]/g, '_');
}

function sha256File(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

function boundedText(value, maxBytes) {
  const bytes = Buffer.from(String(value), 'utf8');
  if (bytes.length <= maxBytes) return bytes.toString('utf8');
  return `${bytes.subarray(0, maxBytes).toString('utf8')}\n… diagnostics truncated …`;
}

function capitalize(value) {
  const text = String(value);
  return text ? text[0].toUpperCase() + text.slice(1) : text;
}

module.exports = {
  OFFLINE_BUILD_BRIDGE_PROTOCOL,
  OFFLINE_BUILD_BRIDGE_PATH,
  OFFLINE_BUILD_BRIDGE_MAX_BODY,
  OFFLINE_WORKSPACE_SNAPSHOT_PROTOCOL,
  OFFLINE_WORKSPACE_SNAPSHOT_PATH,
  OFFLINE_WORKSPACE_SNAPSHOT_MAX_BODY,
  OFFLINE_BUILD_ARTIFACT_PREFIX,
  OfflineBuildBridgeError,
  validateOfflineBuildRequest,
  validateOfflineWorkspaceSnapshot,
  validateProjectSnapshot,
  sanitizeBuildDiagnostic,
  resolveOpenedWorkspace,
  resolveOfflineBuildWorkspace,
  materializeOfflineWorkspaceSnapshot,
  executeOfflineBuildRequest,
  createOfflineBuildRequestHandler,
  createOfflineBuildBridge,
  startOfflineBuildBridge
};