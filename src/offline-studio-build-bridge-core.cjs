'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');

const OFFLINE_BUILD_BRIDGE_PROTOCOL = 'patch-offline-build-bridge/0.1';
const OFFLINE_BUILD_BRIDGE_PATH = '/v1/build';
const OFFLINE_BUILD_BRIDGE_MAX_BODY = 64 * 1024;
const OFFLINE_WORKSPACE_SNAPSHOT_PROTOCOL = 'patch-offline-workspace-snapshot/0.1';
const OFFLINE_WORKSPACE_SNAPSHOT_PATH = '/v1/snapshot';
const OFFLINE_WORKSPACE_SNAPSHOT_MAX_BODY = 1024 * 1024;
const OFFLINE_BUILD_ARTIFACT_PREFIX = '/v1/artifacts/';
const ARTIFACT_TTL_MS = 10 * 60 * 1000;
const MAX_ARTIFACTS = 8;

const REQUEST_ID_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;
const APP_NAME_RE = /^[A-Za-z][A-Za-z0-9._-]{0,63}$/;
const ARTIFACT_ID_RE = /^[a-f0-9]{32}$/;

class OfflineBuildBridgeError extends Error {
  constructor(code, message, status = 400) {
    super(message);
    this.name = 'OfflineBuildBridgeError';
    this.code = code;
    this.status = status;
  }
}

function validateOfflineBuildRequest(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new OfflineBuildBridgeError('invalid-request', 'Build request must be a JSON object.');
  }
  const allowed = new Set(['protocol', 'action', 'requestId', 'source', 'appName']);
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) throw new OfflineBuildBridgeError('unknown-field', `Unknown build request field '${key}'.`);
  }
  if (value.protocol !== OFFLINE_BUILD_BRIDGE_PROTOCOL) {
    throw new OfflineBuildBridgeError('protocol-mismatch', `Expected protocol ${OFFLINE_BUILD_BRIDGE_PROTOCOL}.`);
  }
  if (value.action !== 'build-native-window') {
    throw new OfflineBuildBridgeError('unsupported-action', "Only 'build-native-window' is allowed by bridge 0.1.");
  }
  const requestId = validateRequestId(value.requestId);
  const source = String(value.source ?? '');
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
    throw new OfflineBuildBridgeError('invalid-source', 'source must be a relative Patch file path inside the opened workspace.');
  }
  if (path.extname(source).toLowerCase() !== '.patch') {
    throw new OfflineBuildBridgeError('invalid-source', 'source must name a .patch file.');
  }
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
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new OfflineBuildBridgeError('invalid-snapshot', 'Workspace snapshot request must be a JSON object.');
  }
  const allowed = new Set(['protocol', 'requestId', 'source']);
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) throw new OfflineBuildBridgeError('unknown-snapshot-field', `Unknown workspace snapshot field '${key}'.`);
  }
  if (value.protocol !== OFFLINE_WORKSPACE_SNAPSHOT_PROTOCOL) {
    throw new OfflineBuildBridgeError('snapshot-protocol-mismatch', `Expected protocol ${OFFLINE_WORKSPACE_SNAPSHOT_PROTOCOL}.`);
  }
  const requestId = validateRequestId(value.requestId);
  const source = typeof value.source === 'string' ? value.source : '';
  if (!source.trim()) throw new OfflineBuildBridgeError('empty-snapshot', 'Patch source snapshot is empty.');
  if (Buffer.byteLength(source, 'utf8') > OFFLINE_WORKSPACE_SNAPSHOT_MAX_BODY) {
    throw new OfflineBuildBridgeError('snapshot-too-large', 'Patch source snapshot exceeds the 1 MiB Stage 2 limit.', 413);
  }
  return Object.freeze({ protocol: OFFLINE_WORKSPACE_SNAPSHOT_PROTOCOL, requestId, source });
}

function validateRequestId(value) {
  const requestId = String(value ?? '');
  if (!REQUEST_ID_RE.test(requestId)) {
    throw new OfflineBuildBridgeError('invalid-request-id', 'requestId must be 1-64 safe identifier characters.');
  }
  return requestId;
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
    throw new OfflineBuildBridgeError('source-missing', 'Requested Patch source does not exist.', 404);
  }
  assertInsideWorkspace(root, sourcePath, 'source');
  const sourceStat = fs.statSync(sourcePath);
  if (!sourceStat.isFile()) throw new OfflineBuildBridgeError('source-invalid', 'Requested Patch source is not a regular file.');

  const outDir = path.resolve(root, '.patch-build', 'native', request.requestId);
  assertInsideWorkspace(root, outDir, 'output');
  return Object.freeze({ root, sourcePath, outDir });
}

function materializeOfflineWorkspaceSnapshot(workspaceRoot, value) {
  const snapshot = validateOfflineWorkspaceSnapshot(value);
  const root = resolveOpenedWorkspace(workspaceRoot);
  const snapshotRoot = prepareSafeDirectory(root, ['.patch-studio', 'snapshots', snapshot.requestId], 'snapshot');
  const sourcePath = path.join(snapshotRoot, 'main.patch');
  assertInsideWorkspace(root, sourcePath, 'snapshot');
  if (fs.existsSync(sourcePath) && fs.lstatSync(sourcePath).isSymbolicLink()) {
    throw new OfflineBuildBridgeError('snapshot-symlink', 'Workspace snapshot target may not be a symbolic link.', 409);
  }
  fs.writeFileSync(sourcePath, snapshot.source, { encoding: 'utf8', mode: 0o600 });
  const relative = path.relative(root, sourcePath).split(path.sep).join('/');
  return Object.freeze({
    protocol: OFFLINE_WORKSPACE_SNAPSHOT_PROTOCOL,
    requestId: snapshot.requestId,
    ok: true,
    source: relative,
    bytes: Buffer.byteLength(snapshot.source, 'utf8'),
    sha256: sha256File(sourcePath)
  });
}

function executeOfflineBuildRequest(workspaceRoot, value, options = {}) {
  const request = validateOfflineBuildRequest(value);
  const workspace = resolveOfflineBuildWorkspace(workspaceRoot, request);
  const outDir = prepareOfflineBuildOutput(workspace.root, request.requestId);
  const builder = options.builder;
  if (typeof builder !== 'function') {
    throw new OfflineBuildBridgeError('builder-unavailable', 'Offline build bridge has no host-native builder configured.', 503);
  }
  const built = builder(workspace.sourcePath, {
    name: request.appName,
    outDir,
    capture: true,
    platform: options.platform ?? process.platform
  });
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
        const body = await readJsonBody(request, options.snapshotMaxBodyBytes ?? OFFLINE_WORKSPACE_SNAPSHOT_MAX_BODY + 4096);
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
      return writeJson(response, status, { ok: false, error: code, message: error?.message ?? String(error) }, request, allowedOrigin);
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
  resolveOpenedWorkspace,
  resolveOfflineBuildWorkspace,
  materializeOfflineWorkspaceSnapshot,
  executeOfflineBuildRequest,
  createOfflineBuildRequestHandler,
  createOfflineBuildBridge,
  startOfflineBuildBridge
};
