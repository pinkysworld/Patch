'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const zlib = require('node:zlib');
const { spawnSync } = require('node:child_process');

const LINUX_ICON_SIZES = Object.freeze([16, 32, 64, 128, 256]);

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
    const outputName = platform === 'linux' ? fileStem(name) : name;
    const outputBase = path.join(outDir, outputName);
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
      outputKind: artifact.outputKind ?? platformOutputKind(platform),
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
      return packageLinuxDesktopArtifact(outputBase, name, outDir) ?? {
        path: outputBase,
        type: 'application/octet-stream',
        outputKind: 'Linux executable'
      };
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

function packageLinuxDesktopArtifact(outputBase, name, outDir) {
  assertRegularFile(outputBase);
  const stem = fileStem(name);
  const desktopRelative = `share/applications/${stem}.desktop`;
  const desktopPath = path.join(outDir, ...desktopRelative.split('/'));
  const desktopExists = regularFileExists(desktopPath);
  const icons = LINUX_ICON_SIZES.map(size => {
    const relative = `share/icons/hicolor/${size}x${size}/apps/${stem}.png`;
    return { size, relative, file: path.join(outDir, ...relative.split('/')) };
  }).filter(item => regularFileExists(item.file));

  if (!desktopExists && icons.length === 0) return null;
  if (!desktopExists || icons.length !== 1) {
    throw new Error(`Patch offline compiler produced an incomplete Linux desktop package for ${name}. Expected one hicolor PNG and one .desktop file.`);
  }

  const executableName = path.basename(outputBase);
  if (executableName !== stem) {
    throw new Error(`Linux desktop package executable '${executableName}' does not match desktop entry stem '${stem}'.`);
  }

  const archivePath = path.join(outDir, `${stem}-linux.tar.gz`);
  const archive = createDeterministicTarGzip([
    { name: executableName, file: outputBase, mode: 0o755 },
    { name: icons[0].relative, file: icons[0].file, mode: 0o644 },
    { name: desktopRelative, file: desktopPath, mode: 0o644 }
  ]);
  fs.writeFileSync(archivePath, archive, { mode: 0o600 });
  assertRegularFile(archivePath);
  return Object.freeze({
    path: archivePath,
    type: 'application/gzip',
    outputKind: 'Linux desktop package (.tar.gz)',
    entries: Object.freeze([executableName, icons[0].relative, desktopRelative])
  });
}

function createDeterministicTarGzip(entries) {
  if (!Array.isArray(entries) || entries.length < 1) throw new Error('Linux desktop bundle requires at least one file.');
  const chunks = [];
  const seen = new Set();
  for (const entry of entries) {
    const name = normalizeArchiveName(entry?.name);
    if (seen.has(name)) throw new Error(`Linux desktop bundle contains duplicate entry '${name}'.`);
    seen.add(name);
    const file = path.resolve(String(entry?.file ?? ''));
    assertRegularFile(file);
    const bytes = fs.readFileSync(file);
    const mode = Number.isInteger(entry?.mode) ? (entry.mode & 0o777) : 0o644;
    chunks.push(createTarHeader(name, bytes.length, mode), bytes);
    const remainder = bytes.length % 512;
    if (remainder) chunks.push(Buffer.alloc(512 - remainder));
  }
  chunks.push(Buffer.alloc(1024));
  const gzip = zlib.gzipSync(Buffer.concat(chunks), { level: 9, mtime: 0 });
  if (gzip.length >= 10) {
    gzip.writeUInt32LE(0, 4);
    gzip[9] = 255;
  }
  return gzip;
}

function createTarHeader(name, size, mode) {
  const header = Buffer.alloc(512);
  writeTarString(header, 0, 100, name);
  writeTarOctal(header, 100, 8, mode);
  writeTarOctal(header, 108, 8, 0);
  writeTarOctal(header, 116, 8, 0);
  writeTarOctal(header, 124, 12, size);
  writeTarOctal(header, 136, 12, 0);
  header.fill(0x20, 148, 156);
  header[156] = '0'.charCodeAt(0);
  writeTarString(header, 257, 6, 'ustar\0');
  writeTarString(header, 263, 2, '00');
  let checksum = 0;
  for (const byte of header) checksum += byte;
  const checksumText = checksum.toString(8).padStart(6, '0');
  header.write(checksumText, 148, 6, 'ascii');
  header[154] = 0;
  header[155] = 0x20;
  return header;
}

function writeTarString(buffer, offset, length, value) {
  const bytes = Buffer.from(String(value), 'utf8');
  if (bytes.length > length) throw new Error(`Linux desktop bundle entry '${value}' exceeds the tar header path limit.`);
  bytes.copy(buffer, offset);
}

function writeTarOctal(buffer, offset, length, value) {
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < 0) throw new Error('Linux desktop bundle contains an invalid tar numeric field.');
  const text = number.toString(8);
  if (text.length > length - 1) throw new Error('Linux desktop bundle exceeds the tar numeric field limit.');
  buffer.write(text.padStart(length - 1, '0'), offset, length - 1, 'ascii');
  buffer[offset + length - 1] = 0;
}

function normalizeArchiveName(value) {
  const name = String(value ?? '').replaceAll('\\', '/');
  if (!name || name.length > 99 || name.startsWith('/') || name.includes('\0') || name.split('/').some(part => !part || part === '.' || part === '..')) {
    throw new Error(`Linux desktop bundle entry '${name || '?'}' is not a safe relative tar path.`);
  }
  return name;
}

function fileStem(value) {
  return String(value ?? 'PatchApp').trim().replace(/[^A-Za-z0-9_-]/g, '_') || 'PatchApp';
}

function regularFileExists(file) {
  try {
    const stat = fs.statSync(file);
    return stat.isFile() && stat.size > 0;
  } catch {
    return false;
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

module.exports = {
  createOfflineStudioCompilerBuilder,
  normalizePlatform,
  packageLinuxDesktopArtifact,
  createDeterministicTarGzip
};
