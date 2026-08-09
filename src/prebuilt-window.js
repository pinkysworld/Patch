import {
  PATCH_PREBUILT_NATIVE_VERSION,
  PrebuiltNativeError,
  appendStoredFilesToZip
} from './prebuilt-native.js';
import { validateCompiledWindowArtifact } from './window-compiled.js';

export const PATCH_PREBUILT_WINDOW_PAYLOAD_VERSION = '0.4';

export function buildPrebuiltCompiledWindowPackage(templateBytes, options = {}) {
  const platform = normalizePlatform(options.platform);
  const name = safeName(options.name ?? 'PatchApp');
  const compiled = validateCompiledWindowArtifact(options.compiledWindow);
  const payload = {
    format: 'patch-prebuilt-native-payload',
    version: PATCH_PREBUILT_WINDOW_PAYLOAD_VERSION,
    name,
    kind: 'window',
    execution: 'compiled-window-program',
    compiled
  };
  return {
    format: 'patch-prebuilt-native-package',
    version: PATCH_PREBUILT_NATIVE_VERSION,
    platform,
    kind: 'window',
    name,
    sealed: false,
    compiled: true,
    filename: `${safeFileName(name)}-${platform}-window.zip`,
    bytes: appendStoredFilesToZip(toBytes(templateBytes), [
      { name: 'patch-app.json', data: new TextEncoder().encode(JSON.stringify(payload)) }
    ])
  };
}

function normalizePlatform(platform) {
  const value = String(platform ?? '').toLowerCase();
  if (!['windows', 'macos', 'linux'].includes(value)) {
    throw new PrebuiltNativeError(`No prebuilt Window runtime is available for '${platform ?? '?'}'.`);
  }
  return value;
}

function safeName(name) {
  const value = String(name).trim().replace(/[^A-Za-z0-9 _.-]/g, '').replace(/\s+/g, ' ').slice(0, 80);
  return value || 'PatchApp';
}

function safeFileName(name) {
  return safeName(name).replace(/[^A-Za-z0-9._-]/g, '_') || 'PatchApp';
}

function toBytes(value) {
  if (value instanceof Uint8Array) return value;
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  if (ArrayBuffer.isView(value)) return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  throw new PrebuiltNativeError('Prebuilt Window runtime template must be binary data.');
}
