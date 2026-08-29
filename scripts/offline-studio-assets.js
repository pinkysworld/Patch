import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export const PATCH_OFFLINE_STUDIO_MANIFEST_FORMAT = 'patch-offline-studio-manifest';
export const PATCH_OFFLINE_STUDIO_MANIFEST_VERSION = 1;

export function collectOfflineStudioFiles(siteRoot) {
  const root = path.resolve(siteRoot);
  if (!fs.existsSync(root) || !fs.statSync(root).isDirectory()) {
    throw new Error(`Patch Offline Studio site directory does not exist: ${root}`);
  }
  return walk(root)
    .map(file => ({ file, path: path.relative(root, file).split(path.sep).join('/') }))
    .sort((a, b) => a.path.localeCompare(b.path));
}

export function buildOfflineStudioManifest(siteRoot, options = {}) {
  const files = collectOfflineStudioFiles(siteRoot);
  const entries = files.map(({ file, path: relativePath }) => {
    const bytes = fs.readFileSync(file);
    return Object.freeze({
      path: relativePath,
      size: bytes.length,
      sha256: crypto.createHash('sha256').update(bytes).digest('hex')
    });
  });
  const closure = crypto.createHash('sha256');
  for (const entry of entries) {
    closure.update(entry.path);
    closure.update('\0');
    closure.update(entry.sha256);
    closure.update('\0');
  }
  const required = ['index.html', 'manifest.webmanifest', 'sw.js', 'playground.js', 'src/interpreter.js'];
  const available = new Set(entries.map(entry => entry.path));
  const missing = required.filter(name => !available.has(name));
  if (missing.length) {
    throw new Error(`Patch Offline Studio site is incomplete; missing ${missing.join(', ')}.`);
  }
  return Object.freeze({
    format: PATCH_OFFLINE_STUDIO_MANIFEST_FORMAT,
    manifestVersion: PATCH_OFFLINE_STUDIO_MANIFEST_VERSION,
    patchVersion: String(options.patchVersion ?? 'unknown'),
    entrypoint: 'index.html',
    fileCount: entries.length,
    closureSha256: closure.digest('hex'),
    files: Object.freeze(entries)
  });
}

export function offlineStudioAssetMap(siteRoot, manifestFile) {
  const root = path.resolve(siteRoot);
  const assets = { 'offline-studio-manifest.json': path.resolve(manifestFile) };
  for (const { file, path: relativePath } of collectOfflineStudioFiles(root)) {
    assets[`site/${relativePath}`] = file;
  }
  return assets;
}

function walk(dir) {
  const result = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const target = path.join(dir, entry.name);
    if (entry.isDirectory()) result.push(...walk(target));
    else if (entry.isFile()) result.push(target);
  }
  return result;
}
