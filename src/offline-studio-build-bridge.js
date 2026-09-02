import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { buildNativeGuiForHost } from './native-gui-host.js';

export const OFFLINE_BUILD_BRIDGE_PROTOCOL = 'patch-offline-build-bridge/0.1';
export const OFFLINE_BUILD_BRIDGE_PATH = '/v1/build';
export const OFFLINE_BUILD_BRIDGE_MAX_BODY = 64 * 1024;

const REQUEST_ID_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;
const APP_NAME_RE = /^[A-Za-z][A-Za-z0-9._-]{0,63}$/;

export class OfflineBuildBridgeError extends Error {
  constructor(code, message, status = 400) {
    super(message);
    this.name = 'OfflineBuildBridgeError';
    this.code = code;
    this.status = status;
  }
}

export function validateOfflineBuildRequest(value) {
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
  const requestId = String(value.requestId ?? '');
  if (!REQUEST_ID_RE.test(requestId)) {
    throw new OfflineBuildBridgeError('invalid-request-id', 'requestId must be 1-64 safe identifier characters.');
  }
  const source = String(value.source ?? '');
  if (!source || source.length > 512 || source.includes('\0') || path.isAbsolute(source) || path.win32.isAbsolute(source)) {
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

export function resolveOfflineBuildWorkspace(workspaceRoot, request) {
  const rootInput = path.resolve(String(workspaceRoot ?? ''));
  let root;
  try {
    root = fs.realpathSync(rootInput);
  } catch {
    throw new OfflineBuildBridgeError('workspace-missing', 'Opened workspace does not exist.', 409);
  }
  const rootStat = fs.statSync(root);
  if (!rootStat.isDirectory()) throw new OfflineBuildBridgeError('workspace-invalid', 'Opened workspace is not a directory.', 409);

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

export function executeOfflineBuildRequest(workspaceRoot, value, options = {}) {
  const request = validateOfflineBuildRequest(value);
  const workspace = resolveOfflineBuildWorkspace(workspaceRoot, request);
  fs.mkdirSync(workspace.outDir, { recursive: true });
  const builder = options.builder ?? buildNativeGuiForHost;
  const built = builder(workspace.sourcePath, {
    name: request.appName,
    outDir: workspace.outDir,
    capture: true,
    platform: options.platform ?? process.platform
  });
  return Object.freeze({
    protocol: OFFLINE_BUILD_BRIDGE_PROTOCOL,
    requestId: request.requestId,
    action: request.action,
    ok: true,
    platform: built.platform,
    backend: built.backend,
    outputKind: built.outputKind,
    outputDirectory: toWorkspaceRelative(workspace.root, workspace.outDir)
  });
}

export function createOfflineBuildBridge(options = {}) {
  const workspaceRoot = options.workspaceRoot;
  const token = String(options.token ?? '');
  const host = options.host ?? '127.0.0.1';
  if (host !== '127.0.0.1') {
    throw new OfflineBuildBridgeError('unsafe-host', 'Offline build bridge may bind only to 127.0.0.1.');
  }
  if (Buffer.byteLength(token, 'utf8') < 24) {
    throw new OfflineBuildBridgeError('weak-token', 'Offline build bridge requires a per-launch token of at least 24 bytes.');
  }

  const server = http.createServer(async (request, response) => {
    try {
      if (request.url !== OFFLINE_BUILD_BRIDGE_PATH) {
        return writeJson(response, 404, { ok: false, error: 'not-found' });
      }
      if (request.method !== 'POST') {
        response.setHeader('Allow', 'POST');
        return writeJson(response, 405, { ok: false, error: 'method-not-allowed' });
      }
      if (!authorized(request.headers.authorization, token)) {
        return writeJson(response, 401, { ok: false, error: 'unauthorized' });
      }
      const contentType = String(request.headers['content-type'] ?? '').split(';', 1)[0].trim().toLowerCase();
      if (contentType !== 'application/json') {
        return writeJson(response, 415, { ok: false, error: 'content-type' });
      }
      const body = await readJsonBody(request, options.maxBodyBytes ?? OFFLINE_BUILD_BRIDGE_MAX_BODY);
      const result = executeOfflineBuildRequest(workspaceRoot, body, {
        builder: options.builder,
        platform: options.platform
      });
      return writeJson(response, 200, result);
    } catch (error) {
      const status = error instanceof OfflineBuildBridgeError ? error.status : 500;
      const code = error instanceof OfflineBuildBridgeError ? error.code : 'build-failed';
      return writeJson(response, status, { ok: false, error: code, message: error?.message ?? String(error) });
    }
  });
  server.on('clientError', (_error, socket) => socket.end('HTTP/1.1 400 Bad Request\r\n\r\n'));
  return server;
}

export async function startOfflineBuildBridge(options = {}) {
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
    close: () => new Promise(resolve => server.close(resolve))
  });
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

function readJsonBody(request, limit) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    request.on('data', chunk => {
      size += chunk.length;
      if (size > limit) {
        reject(new OfflineBuildBridgeError('request-too-large', 'Build request body is too large.', 413));
        request.destroy();
        return;
      }
      chunks.push(chunk);
    });
    request.on('end', () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      } catch {
        reject(new OfflineBuildBridgeError('invalid-json', 'Build request body is not valid JSON.'));
      }
    });
    request.on('error', reject);
  });
}

function writeJson(response, status, value) {
  if (response.headersSent) return;
  const body = Buffer.from(`${JSON.stringify(value)}\n`, 'utf8');
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': String(body.length),
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer'
  });
  response.end(body);
}
