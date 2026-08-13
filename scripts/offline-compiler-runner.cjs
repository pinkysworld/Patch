const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const zlib = require('node:zlib');
const { pathToFileURL } = require('node:url');
const { getAsset, getAssetKeys } = require('node:sea');

const manifest = JSON.parse(getAsset('patch-offline-manifest.json', 'utf8'));
const assetKeys = new Set(getAssetKeys());
const args = process.argv.slice(2);

if (args[0] === '--version' || args[0] === 'version') {
  console.log(`Patch ${manifest.version} offline compiler (${manifest.platform}/${manifest.arch})`);
  process.exit(0);
}

main().catch(error => {
  console.error(`Patch offline compiler stopped: ${error?.stack || error?.message || String(error)}`);
  process.exitCode = 2;
});

async function main() {
  const root = extractCompiler();
  const consoleRuntime = extractRuntime('runtime/console.bin.gz', 'runtime/console.bin', root);
  const guiRuntime = extractRuntime('runtime/gui.bin.gz', 'runtime/gui.bin', root);
  if (consoleRuntime) process.env.PATCH_OFFLINE_CONSOLE_RUNTIME = consoleRuntime;
  if (guiRuntime) process.env.PATCH_OFFLINE_GUI_RUNTIME = guiRuntime;
  process.env.PATCH_OFFLINE_COMPILER_IN_PROCESS = '1';
  process.env.PATCH_OFFLINE_COMPILER_PLATFORM = manifest.platform;
  await import(pathToFileURL(path.join(root, 'src', 'cli-entry.js')).href);
}

function extractCompiler() {
  const safeVersion = String(manifest.version).replace(/[^A-Za-z0-9._-]/g, '_');
  const safeHash = String(manifest.sourceHash).replace(/[^A-Fa-f0-9]/g, '').slice(0, 32);
  const root = path.join(os.tmpdir(), `patch-offline-${safeVersion}-${manifest.platform}-${manifest.arch}-${safeHash}`);
  const marker = path.join(root, '.ready');
  if (fs.existsSync(marker)) return root;

  fs.rmSync(root, { recursive: true, force: true });
  fs.mkdirSync(root, { recursive: true });
  fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ type: 'module' }), 'utf8');
  for (const key of assetKeys) {
    if (!key.startsWith('src/')) continue;
    const target = safeAssetPath(root, key);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, new Uint8Array(getAsset(key)));
  }
  fs.writeFileSync(marker, `${manifest.version}\n${manifest.sourceHash}\n${manifest.runtimeEncoding || 'raw'}\n`, 'utf8');
  return root;
}

function extractRuntime(assetKey, outputKey, root) {
  if (!assetKeys.has(assetKey)) return null;
  const target = safeAssetPath(root, outputKey);
  if (!fs.existsSync(target)) {
    fs.mkdirSync(path.dirname(target), { recursive: true });
    const embedded = Buffer.from(getAsset(assetKey));
    const raw = manifest.runtimeEncoding === 'gzip' ? zlib.gunzipSync(embedded) : embedded;
    fs.writeFileSync(target, raw);
    if (process.platform !== 'win32') fs.chmodSync(target, 0o755);
  }
  return target;
}

function safeAssetPath(root, key) {
  const normalized = path.posix.normalize(String(key));
  if (normalized.startsWith('../') || normalized === '..' || path.posix.isAbsolute(normalized)) {
    throw new Error(`Unsafe embedded asset path '${key}'.`);
  }
  const target = path.resolve(root, ...normalized.split('/'));
  const resolvedRoot = path.resolve(root) + path.sep;
  if (!target.startsWith(resolvedRoot)) throw new Error(`Embedded asset escapes compiler cache: '${key}'.`);
  return target;
}
