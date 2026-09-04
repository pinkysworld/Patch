'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

function createOfflineStudioCompilerBuilder(options = {}) {
  const platform = normalizePlatform(options.platform ?? process.platform);
  const arch = String(options.arch ?? process.arch);
  const expectedSha256 = String(options.compilerSha256 ?? '').toLowerCase();
  const compilerPath = options.compilerPath ? path.resolve(options.compilerPath) : null;
  const compilerBytes = options.compilerBytes ? Buffer.from(options.compilerBytes) : null;

  const compiler = materializeCompiler();

  return function buildWithOfflineCompiler(sourcePath, buildOptions = {}) {
    const name = String(buildOptions.name ?? 'PatchApp');
    const outDir = path.resolve(String(buildOptions.outDir ?? 'dist'));
    const outputBase = path.join(outDir, name);
    fs.mkdirSync(outDir, { recursive: true });

    const run = spawnSync(compiler, [
      'link', path.resolve(sourcePath),
      '--name', name,
      '--out', outputBase
    ], {
      cwd: outDir,
      stdio: 'pipe',
      encoding: 'utf8',
      windowsHide: true,
      maxBuffer: 4 * 1024 * 1024,
      env: {
        ...process.env,
        PATCH_STUDIO_LOCAL_BUILD: '1'
      }
    });
    if (run.error) throw new Error(`Could not start bundled Patch offline compiler: ${run.error.message}`);
    if (run.status !== 0) {
      const detail = String(run.stderr || run.stdout || '').trim();
      throw new Error(`Bundled Patch offline compiler exited with status ${run.status}${detail ? `: ${detail}` : '.'}`);
    }

    const artifact = locateArtifact(outputBase, name, outDir);
    return Object.freeze({
      platform: platformLabel(platform),
      backend: platformBackend(platform),
      outputKind: platformOutputKind(platform),
      name,
      outDir,
      stdout: [run.stdout, run.stderr].filter(Boolean).join('\n').trim(),
      stderr: run.stderr || '',
      artifactPath: artifact.path,
      artifactType: artifact.type
    });
  };

  function materializeCompiler() {
    if (compilerPath) {
      verifyCompiler(compilerPath);
      return compilerPath;
    }
    if (!compilerBytes?.length) throw new Error('Offline Studio local native build has no bundled Patch compiler.');
    const actualSha256 = sha256Bytes(compilerBytes);
    if (expectedSha256 && actualSha256 !== expectedSha256) throw new Error('Bundled Patch compiler failed SHA-256 verification.');
    const root = path.join(os.tmpdir(), `patch-studio-compiler-${platform}-${arch}-${actualSha256.slice(0, 24)}`);
    const target = path.join(root, platform === 'windows' ? 'patch.exe' : 'patch');
    const marker = path.join(root, '.ready');
    if (!fs.existsSync(marker)) {
      fs.rmSync(root, { recursive: true, force: true });
      fs.mkdirSync(root, { recursive: true, mode: 0o700 });
      fs.writeFileSync(target, compilerBytes, { mode: platform === 'windows' ? 0o600 : 0o700 });
      if (platform !== 'windows') fs.chmodSync(target, 0o700);
      verifyCompiler(target, actualSha256);
      fs.writeFileSync(marker, `${actualSha256}\n`, { encoding: 'utf8', mode: 0o600 });
    } else {
      verifyCompiler(target, actualSha256);
    }
    return target;
  }

  function verifyCompiler(file, knownSha256 = '') {
    if (!fs.existsSync(file) || !fs.statSync(file).isFile()) throw new Error(`Patch offline compiler is missing: ${file}`);
    const actual = knownSha256 || sha256File(file);
    if (expectedSha256 && actual !== expectedSha256) throw new Error('Patch offline compiler failed SHA-256 verification.');
  }

  function locateArtifact(outputBase, name, outDir) {
    if (platform === 'windows') {
      const exe = `${outputBase}.exe`;
      assertRegularFile(exe);
      return { path: exe, type: 'application/vnd.microsoft.portable-executable' };
    }
    if (platform === 'linux') {
      assertRegularFile(outputBase);
      return { path: outputBase, type: 'application/octet-stream' };
    }
    if (platform === 'macos') {
      const app = `${outputBase}.app`;
      if (!fs.existsSync(app) || !fs.statSync(app).isDirectory()) throw new Error(`Patch offline compiler did not produce ${name}.app.`);
      const zip = path.join(outDir, `${name}.app.zip`);
      const archived = spawnSync('/usr/bin/ditto', ['-c', '-k', '--sequesterRsrc', '--keepParent', app, zip], {
        cwd: outDir,
        stdio: 'pipe',
        encoding: 'utf8',
        maxBuffer: 1024 * 1024
      });
      if (archived.error) throw new Error(`Could not package native macOS app: ${archived.error.message}`);
      if (archived.status !== 0) throw new Error(`Could not package native macOS app: ${String(archived.stderr || archived.stdout || '').trim() || `ditto exited ${archived.status}`}`);
      assertRegularFile(zip);
      return { path: zip, type: 'application/zip' };
    }
    throw new Error(`Offline Studio local native builder does not support ${platform}/${arch}.`);
  }
}

function assertRegularFile(file) {
  if (!fs.existsSync(file) || !fs.statSync(file).isFile() || fs.statSync(file).size <= 0) {
    throw new Error(`Patch offline compiler did not produce the expected artifact: ${file}`);
  }
}

function normalizePlatform(value) {
  const raw = String(value).toLowerCase();
  if (raw === 'win32' || raw === 'windows') return 'windows';
  if (raw === 'darwin' || raw === 'macos' || raw === 'osx') return 'macos';
  if (raw === 'linux') return 'linux';
  throw new Error(`Unsupported Offline Studio local-build host '${value}'.`);
}

function platformLabel(platform) {
  if (platform === 'windows') return 'Windows';
  if (platform === 'macos') return 'macOS';
  if (platform === 'linux') return 'Linux';
  return platform;
}

function platformBackend(platform) {
  if (platform === 'windows') return 'offline-compiler/win32';
  if (platform === 'macos') return 'offline-compiler/appkit';
  if (platform === 'linux') return 'offline-compiler/gtk3';
  return 'offline-compiler';
}

function platformOutputKind(platform) {
  if (platform === 'windows') return 'Windows .exe';
  if (platform === 'macos') return 'macOS .app ZIP';
  if (platform === 'linux') return 'Linux executable';
  return 'native artifact';
}

function sha256Bytes(bytes) {
  return crypto.createHash('sha256').update(bytes).digest('hex');
}

function sha256File(file) {
  return sha256Bytes(fs.readFileSync(file));
}

module.exports = { createOfflineStudioCompilerBuilder, normalizePlatform };
