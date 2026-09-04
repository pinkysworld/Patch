'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const CONTRACT = 'patch-offline-studio-build-bridge/0.1';
const REQUEST_FORMAT = 'patch-offline-studio-build-request';
const MAX_REQUEST_BYTES = 2 * 1024 * 1024;
const MAX_DIAGNOSTIC_BYTES = 64 * 1024;
const ARTIFACT_TTL_MS = 10 * 60 * 1000;
const MAX_ARTIFACTS = 8;
const TOKEN_HEADER = 'x-patch-local-token';

function createOfflineStudioBuildBridge(options = {}) {
  const platform = normalizePlatform(options.platform ?? process.platform);
  const arch = String(options.arch ?? process.arch);
  const compilerPath = options.compilerPath ? path.resolve(options.compilerPath) : null;
  const compilerBytes = options.compilerBytes ? Buffer.from(options.compilerBytes) : null;
  const compilerSha256 = String(options.compilerSha256 ?? '').toLowerCase();
  const compilerPrefixArgs = Array.isArray(options.compilerPrefixArgs) ? options.compilerPrefixArgs.map(String) : [];
  const token = crypto.randomBytes(32).toString('hex');
  const artifacts = new Map();
  let extractedCompiler = null;

  const support = inspectSupport();

  return Object.freeze({
    contract: CONTRACT,
    capability,
    route,
    build,
    consumeArtifact,
    dispose
  });

  function inspectSupport() {
    if (!['windows', 'macos', 'linux'].includes(platform)) {
      return { supported: false, reason: `Host-native Stage 2 builds are not published for ${platform}/${arch}.` };
    }
    if (compilerPath) {
      try {
        const stat = fs.statSync(compilerPath);
        if (!stat.isFile()) return { supported: false, reason: 'Configured offline compiler is not a file.' };
        if (compilerSha256 && sha256File(compilerPath) !== compilerSha256) {
          return { supported: false, reason: 'Configured offline compiler failed SHA-256 verification.' };
        }
        return { supported: true, reason: '' };
      } catch (error) {
        return { supported: false, reason: `Configured offline compiler is unavailable: ${error?.message ?? error}` };
      }
    }
    if (compilerBytes) {
      if (!compilerBytes.length) return { supported: false, reason: 'Embedded offline compiler is empty.' };
      if (compilerSha256 && sha256Bytes(compilerBytes) !== compilerSha256) {
        return { supported: false, reason: 'Embedded offline compiler failed SHA-256 verification.' };
      }
      return { supported: true, reason: '' };
    }
    return { supported: false, reason: 'This Offline Studio package does not contain a host-native offline compiler.' };
  }

  function capability() {
    return Object.freeze({
      contract: CONTRACT,
      supported: support.supported,
      platform,
      arch,
      compilerSha256: compilerSha256 || null,
      reason: support.reason || null,
      target: 'native-host',
      requestVersion: 1,
      maxSourceBytes: MAX_REQUEST_BYTES
    });
  }

  function route(request, response, context = {}) {
    const prefix = String(context.prefix ?? '/');
    const securityHeaders = typeof context.securityHeaders === 'function' ? context.securityHeaders : () => ({});
    const rawPath = String(request.url ?? '/').split('?', 1)[0];
    if (!rawPath.startsWith(prefix)) return false;
    const relative = rawPath.slice(prefix.length);

    if (relative === '__patch/session') {
      if (request.method !== 'GET') return methodNotAllowed(response, securityHeaders, 'GET');
      if (!isLoopbackRequest(request)) return forbidden(response, securityHeaders);
      return json(response, 200, {
        format: 'patch-offline-studio-session',
        version: 1,
        token,
        nativeBuild: capability()
      }, securityHeaders, { 'Cache-Control': 'no-store' });
    }

    if (relative === '__patch/build') {
      if (request.method !== 'POST') return methodNotAllowed(response, securityHeaders, 'POST');
      if (!authorized(request, context)) return forbidden(response, securityHeaders);
      if (!isJsonContentType(request.headers['content-type'])) {
        return json(response, 415, { error: 'Build requests require application/json.' }, securityHeaders);
      }
      readBoundedBody(request, MAX_REQUEST_BYTES + 4096, (error, body) => {
        if (error) {
          json(response, error.code === 'TOO_LARGE' ? 413 : 400, { error: error.message }, securityHeaders);
          return;
        }
        let payload;
        try { payload = JSON.parse(body.toString('utf8')); }
        catch { return json(response, 400, { error: 'Build request JSON is invalid.' }, securityHeaders); }
        try {
          const result = build(payload);
          json(response, 200, result, securityHeaders, { 'Cache-Control': 'no-store' });
        } catch (buildError) {
          json(response, 400, {
            error: buildError?.message ?? String(buildError),
            diagnostics: buildError?.diagnostics ?? null
          }, securityHeaders, { 'Cache-Control': 'no-store' });
        }
      });
      return true;
    }

    const artifactMatch = /^__patch\/artifacts\/([A-Fa-f0-9]{32})$/.exec(relative);
    if (artifactMatch) {
      if (request.method !== 'GET' && request.method !== 'HEAD') return methodNotAllowed(response, securityHeaders, 'GET, HEAD');
      if (!authorized(request, context)) return forbidden(response, securityHeaders);
      const artifact = artifacts.get(artifactMatch[1]);
      if (!artifact) return notFound(response, securityHeaders);
      if (Date.now() - artifact.createdAt > ARTIFACT_TTL_MS) {
        releaseArtifact(artifactMatch[1]);
        return notFound(response, securityHeaders);
      }
      const body = fs.readFileSync(artifact.path);
      const headers = {
        ...securityHeaders(),
        'Content-Type': artifact.type,
        'Content-Length': String(body.length),
        'Content-Disposition': `attachment; filename="${artifact.filename.replace(/["\\]/g, '_')}"`,
        'Cache-Control': 'no-store',
        'X-Patch-Artifact-Sha256': artifact.sha256
      };
      response.writeHead(200, headers);
      if (request.method === 'HEAD') response.end();
      else {
        response.end(body);
        releaseArtifact(artifactMatch[1]);
      }
      return true;
    }

    return false;
  }

  function authorized(request, context) {
    if (!isLoopbackRequest(request)) return false;
    const presented = String(request.headers[TOKEN_HEADER] ?? '');
    if (!timingSafeEqualText(presented, token)) return false;
    const origin = String(request.headers.origin ?? '');
    if (!origin) return true;
    const expectedOrigin = context.origin ? String(context.origin) : null;
    return Boolean(expectedOrigin && origin === expectedOrigin);
  }

  function build(payload) {
    if (!support.supported) throw new Error(support.reason || 'Host-native local build is unavailable.');
    const request = validateBuildRequest(payload, platform);
    cleanupExpiredArtifacts();

    const compiler = materializeCompiler();
    const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'patch-studio-build-'));
    const sourcePath = path.join(workspace, 'main.patch');
    const outputBase = path.join(workspace, request.name);
    fs.writeFileSync(sourcePath, request.source, 'utf8');

    const args = [...compilerPrefixArgs, 'link', sourcePath, '--name', request.name, '--out', outputBase];
    const result = spawnSync(compiler, args, {
      cwd: workspace,
      encoding: 'utf8',
      windowsHide: true,
      maxBuffer: 4 * 1024 * 1024,
      env: {
        ...process.env,
        PATCH_STUDIO_LOCAL_BUILD: '1'
      }
    });
    const diagnostics = boundedDiagnostics(result);
    if (result.error) {
      fs.rmSync(workspace, { recursive: true, force: true });
      throw buildFailure(`Could not start the bundled Patch offline compiler: ${result.error.message}`, diagnostics);
    }
    if (result.status !== 0) {
      fs.rmSync(workspace, { recursive: true, force: true });
      throw buildFailure(`Patch offline compiler exited with status ${result.status}.`, diagnostics);
    }

    const packaged = packageArtifact(workspace, outputBase, request.name);
    if (!fs.existsSync(packaged.path) || !fs.statSync(packaged.path).isFile()) {
      fs.rmSync(workspace, { recursive: true, force: true });
      throw buildFailure('Patch offline compiler completed without producing the expected host artifact.', diagnostics);
    }
    const stat = fs.statSync(packaged.path);
    const artifactId = crypto.randomBytes(16).toString('hex');
    const artifact = {
      id: artifactId,
      workspace,
      path: packaged.path,
      filename: packaged.filename,
      type: packaged.type,
      size: stat.size,
      sha256: sha256File(packaged.path),
      createdAt: Date.now()
    };
    artifacts.set(artifactId, artifact);
    trimArtifacts();

    return Object.freeze({
      format: 'patch-offline-studio-build-result',
      version: 1,
      contract: CONTRACT,
      platform,
      arch,
      kind: request.kind,
      name: request.name,
      artifactId,
      filename: artifact.filename,
      type: artifact.type,
      size: artifact.size,
      sha256: artifact.sha256,
      diagnostics,
      downloadPath: `__patch/artifacts/${artifactId}`
    });
  }

  function packageArtifact(workspace, outputBase, name) {
    if (platform === 'windows') {
      return { path: `${outputBase}.exe`, filename: `${name}.exe`, type: 'application/vnd.microsoft.portable-executable' };
    }
    if (platform === 'linux') {
      return { path: outputBase, filename: name, type: 'application/octet-stream' };
    }
    const appPath = `${outputBase}.app`;
    if (!fs.existsSync(appPath) || !fs.statSync(appPath).isDirectory()) {
      return { path: appPath, filename: `${name}.app.zip`, type: 'application/zip' };
    }
    const zipPath = path.join(workspace, `${name}.app.zip`);
    const archived = spawnSync('/usr/bin/ditto', ['-c', '-k', '--sequesterRsrc', '--keepParent', appPath, zipPath], {
      cwd: workspace,
      encoding: 'utf8',
      windowsHide: true,
      maxBuffer: 1024 * 1024
    });
    if (archived.error || archived.status !== 0) {
      throw buildFailure('The native macOS app was built, but the local packaging step could not create its .app ZIP.', boundedDiagnostics(archived));
    }
    return { path: zipPath, filename: `${name}.app.zip`, type: 'application/zip' };
  }

  function materializeCompiler() {
    if (compilerPath) return compilerPath;
    if (extractedCompiler && fs.existsSync(extractedCompiler)) return extractedCompiler;
    const hash = compilerSha256 || sha256Bytes(compilerBytes);
    const root = path.join(os.tmpdir(), `patch-studio-compiler-${platform}-${arch}-${hash.slice(0, 24)}`);
    const filename = platform === 'windows' ? 'patch.exe' : 'patch';
    const target = path.join(root, filename);
    const marker = path.join(root, '.ready');
    if (!fs.existsSync(marker)) {
      fs.rmSync(root, { recursive: true, force: true });
      fs.mkdirSync(root, { recursive: true });
      fs.writeFileSync(target, compilerBytes);
      if (platform !== 'windows') fs.chmodSync(target, 0o755);
      if (sha256File(target) !== hash) {
        fs.rmSync(root, { recursive: true, force: true });
        throw new Error('Extracted offline compiler failed SHA-256 verification.');
      }
      fs.writeFileSync(marker, `${hash}\n`, 'utf8');
    }
    extractedCompiler = target;
    return target;
  }

  function consumeArtifact(id) {
    const artifact = artifacts.get(String(id));
    if (!artifact) return null;
    const bytes = fs.readFileSync(artifact.path);
    releaseArtifact(String(id));
    return { ...artifact, bytes };
  }

  function releaseArtifact(id) {
    const artifact = artifacts.get(id);
    if (!artifact) return;
    artifacts.delete(id);
    fs.rmSync(artifact.workspace, { recursive: true, force: true });
  }

  function cleanupExpiredArtifacts() {
    const now = Date.now();
    for (const [id, artifact] of artifacts) {
      if (now - artifact.createdAt > ARTIFACT_TTL_MS) releaseArtifact(id);
    }
  }

  function trimArtifacts() {
    cleanupExpiredArtifacts();
    while (artifacts.size > MAX_ARTIFACTS) releaseArtifact(artifacts.keys().next().value);
  }

  function dispose() {
    for (const id of [...artifacts.keys()]) releaseArtifact(id);
  }
}

function validateBuildRequest(payload, hostPlatform) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw new Error('Build request must be a JSON object.');
  const allowed = new Set(['format', 'version', 'target', 'platform', 'kind', 'name', 'source', 'resources']);
  for (const key of Object.keys(payload)) if (!allowed.has(key)) throw new Error(`Unknown local-build request field '${key}'.`);
  if (payload.format !== REQUEST_FORMAT || payload.version !== 1) throw new Error(`Build request must use ${REQUEST_FORMAT} version 1.`);
  if (payload.target !== 'native-host') throw new Error("Local build target must be 'native-host'.");
  const platform = normalizePlatform(payload.platform);
  if (platform !== hostPlatform) throw new Error(`Cross-compiling is not enabled. This Offline Studio host builds ${hostPlatform} artifacts only.`);
  const kind = payload.kind === 'window' ? 'window' : payload.kind === 'console' ? 'console' : null;
  if (!kind) throw new Error("Project kind must be 'console' or 'window'.");
  const name = String(payload.name ?? '');
  if (!/^[A-Za-z][A-Za-z0-9_-]{0,63}$/.test(name)) throw new Error('Application name must start with a letter and contain only letters, digits, _ or - (64 characters maximum).');
  const source = typeof payload.source === 'string' ? payload.source : '';
  if (!source.trim()) throw new Error('Patch source is empty.');
  if (Buffer.byteLength(source, 'utf8') > MAX_REQUEST_BYTES) throw new Error(`Patch source exceeds the ${MAX_REQUEST_BYTES} byte local-build limit.`);
  const resources = payload.resources ?? [];
  if (!Array.isArray(resources)) throw new Error('Project resources must be an array.');
  if (resources.length) throw new Error('Local build bridge 0.1 does not transport Studio project resources yet. Remove resource-backed controls or use the existing Ready build path.');
  return Object.freeze({ platform, kind, name, source });
}

function normalizePlatform(value) {
  const raw = String(value ?? '').toLowerCase();
  if (raw === 'win32' || raw === 'windows') return 'windows';
  if (raw === 'darwin' || raw === 'macos' || raw === 'osx') return 'macos';
  if (raw === 'linux') return 'linux';
  if (raw === 'freebsd') return 'freebsd';
  throw new Error(`Unsupported local-build platform '${value}'.`);
}

function isLoopbackRequest(request) {
  const remote = String(request.socket?.remoteAddress ?? '');
  return remote === '127.0.0.1' || remote === '::ffff:127.0.0.1' || remote === '::1';
}

function isJsonContentType(value) {
  return /^application\/json(?:\s*;|$)/i.test(String(value ?? ''));
}

function timingSafeEqualText(left, right) {
  const a = Buffer.from(String(left));
  const b = Buffer.from(String(right));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function readBoundedBody(request, limit, callback) {
  const chunks = [];
  let size = 0;
  let done = false;
  request.on('data', chunk => {
    if (done) return;
    size += chunk.length;
    if (size > limit) {
      done = true;
      const error = new Error('Local build request body is too large.');
      error.code = 'TOO_LARGE';
      callback(error);
      request.destroy();
      return;
    }
    chunks.push(chunk);
  });
  request.on('end', () => {
    if (done) return;
    done = true;
    callback(null, Buffer.concat(chunks));
  });
  request.on('error', error => {
    if (done) return;
    done = true;
    callback(error);
  });
}

function boundedDiagnostics(result) {
  const text = `${String(result?.stdout ?? '')}${result?.stderr ? `${result?.stdout ? '\n' : ''}${String(result.stderr)}` : ''}`.trim();
  if (Buffer.byteLength(text, 'utf8') <= MAX_DIAGNOSTIC_BYTES) return text;
  return `${Buffer.from(text, 'utf8').subarray(0, MAX_DIAGNOSTIC_BYTES).toString('utf8')}\n… diagnostics truncated …`;
}

function buildFailure(message, diagnostics) {
  const error = new Error(message);
  error.diagnostics = diagnostics || null;
  return error;
}

function sha256Bytes(bytes) {
  return crypto.createHash('sha256').update(bytes).digest('hex');
}

function sha256File(file) {
  return sha256Bytes(fs.readFileSync(file));
}

function json(response, status, payload, securityHeaders, extra = {}) {
  const body = Buffer.from(`${JSON.stringify(payload)}\n`, 'utf8');
  response.writeHead(status, {
    ...securityHeaders(),
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': String(body.length),
    ...extra
  });
  response.end(body);
  return true;
}

function forbidden(response, securityHeaders) {
  response.writeHead(403, { ...securityHeaders(), 'Cache-Control': 'no-store' });
  response.end('Forbidden');
  return true;
}

function notFound(response, securityHeaders) {
  response.writeHead(404, { ...securityHeaders(), 'Cache-Control': 'no-store' });
  response.end('Not found');
  return true;
}

function methodNotAllowed(response, securityHeaders, allow) {
  response.writeHead(405, { ...securityHeaders(), Allow: allow, 'Cache-Control': 'no-store' });
  response.end();
  return true;
}

module.exports = {
  CONTRACT,
  REQUEST_FORMAT,
  MAX_REQUEST_BYTES,
  TOKEN_HEADER,
  createOfflineStudioBuildBridge,
  validateBuildRequest,
  normalizePlatform
};
