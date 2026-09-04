import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export const PATCH_OFFLINE_STUDIO_LOCAL_BUILD_CONTRACT = 'patch-offline-studio-local-build/0.1';

export function offlineStudioLocalBuildMetadata(compilerFile, options = {}) {
  if (!compilerFile) return null;
  const absolute = path.resolve(compilerFile);
  if (!fs.existsSync(absolute) || !fs.statSync(absolute).isFile()) {
    throw new Error(`Offline Studio local-build compiler is missing: ${absolute}`);
  }
  const bytes = fs.readFileSync(absolute);
  const platform = normalizeOfflineStudioPlatform(options.platform ?? process.platform);
  const arch = String(options.arch ?? process.arch);
  return Object.freeze({
    contract: PATCH_OFFLINE_STUDIO_LOCAL_BUILD_CONTRACT,
    bridgeProtocol: 'patch-offline-build-bridge/0.1',
    snapshotProtocol: 'patch-offline-workspace-snapshot/0.1',
    platform,
    arch,
    compilerAsset: 'local-build/patch-offline-compiler.bin',
    compilerFile: platform === 'windows' ? 'local-build/patch-offline-compiler.exe' : 'local-build/patch-offline-compiler',
    compilerSize: bytes.length,
    compilerSha256: crypto.createHash('sha256').update(bytes).digest('hex')
  });
}

export function normalizeOfflineStudioPlatform(value) {
  const raw = String(value).toLowerCase();
  if (raw === 'win32' || raw === 'windows') return 'windows';
  if (raw === 'darwin' || raw === 'macos' || raw === 'osx') return 'macos';
  if (raw === 'linux') return 'linux';
  if (raw === 'freebsd') return 'freebsd';
  return raw;
}
