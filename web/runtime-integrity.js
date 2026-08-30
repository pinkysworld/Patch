import './smart-diagnostics.js';

const MANIFEST_URL = './runtimes/runtime-manifest.json';
const RUNTIME_FILES = new Set([
  'patch-windows-native-gui-runtime.exe',
  'patch-linux-native-gui-runtime.bin',
  'patch-macos-native-gui-runtime.bin',
  'patch-windows-console-runtime.bin',
  'patch-macos-console-runtime.bin',
  'patch-linux-console-runtime.bin',
  'patch-windows-window-runtime.zip',
  'patch-macos-window-runtime.zip',
  'patch-linux-window-runtime.zip'
]);
const baseFetch = window.fetch.bind(window);
let manifestPromise = null;

window.fetch = async function patchIntegrityFetch(input, init) {
  const url = requestUrl(input);
  const filename = url?.pathname.split('/').pop() ?? '';
  if (!url || url.origin !== window.location.origin || !RUNTIME_FILES.has(filename)) {
    return baseFetch(input, init);
  }

  const response = await baseFetch(input, init);
  if (!response.ok) return response;

  const manifest = await loadManifest();
  const entry = manifest.assets.find(asset => asset.file === filename);
  if (!entry) throw new Error(`Patch Studio runtime integrity manifest does not contain ${filename}.`);

  const bytes = new Uint8Array(await response.arrayBuffer());
  const actual = `sha256:${await sha256Hex(bytes)}`;
  if (actual !== entry.sha256) {
    throw new Error(`Patch Studio stopped because ${filename} failed SHA-256 verification.`);
  }

  const headers = new Headers(response.headers);
  headers.set('x-patch-runtime-integrity', 'verified');
  return new Response(bytes, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
};

async function loadManifest() {
  if (!manifestPromise) {
    manifestPromise = baseFetch(MANIFEST_URL, { cache: 'no-store' })
      .then(async response => {
        if (!response.ok) throw new Error(`Patch Studio runtime integrity manifest is unavailable (${response.status}).`);
        const manifest = await response.json();
        validateManifest(manifest);
        return manifest;
      })
      .catch(error => {
        manifestPromise = null;
        throw error;
      });
  }
  return manifestPromise;
}

function validateManifest(manifest) {
  if (!manifest || manifest.schema !== 'patch-studio-runtime-integrity' || manifest.schemaVersion !== 1 || !Array.isArray(manifest.assets)) {
    throw new Error('Patch Studio runtime integrity manifest is invalid.');
  }
  const seen = new Set();
  for (const asset of manifest.assets) {
    if (!RUNTIME_FILES.has(asset?.file) || seen.has(asset.file) || typeof asset.releaseTag !== 'string' || !asset.releaseTag.trim() || !/^sha256:[a-f0-9]{64}$/.test(asset.sha256 ?? '')) {
      throw new Error('Patch Studio runtime integrity manifest contains an invalid runtime entry.');
    }
    seen.add(asset.file);
  }
  for (const file of RUNTIME_FILES) {
    if (!seen.has(file)) throw new Error(`Patch Studio runtime integrity manifest is missing ${file}.`);
  }
}

async function sha256Hex(bytes) {
  if (!globalThis.crypto?.subtle) throw new Error('This browser cannot verify Patch runtime integrity with SHA-256.');
  const digest = new Uint8Array(await globalThis.crypto.subtle.digest('SHA-256', bytes));
  return [...digest].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

function requestUrl(input) {
  try {
    const value = input instanceof Request ? input.url : input;
    return new URL(value, window.location.href);
  } catch {
    return null;
  }
}
