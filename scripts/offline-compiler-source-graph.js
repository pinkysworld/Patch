import fs from 'node:fs';
import path from 'node:path';

export const PATCH_OFFLINE_COMPILER_SOURCE_GRAPH_VERSION = '0.1';
export const PATCH_OFFLINE_COMPILER_SOURCE_ROOTS = Object.freeze([
  'src/cli-entry.js',
  // cli-entry intentionally launches cli.js through new URL(...), so cli.js is
  // an explicit graph root rather than a static ESM import from cli-entry.
  'src/cli.js'
]);

const STATIC_IMPORT = /(?:^|\n)\s*(?:import|export)\s+(?:[^'"\n]*?\s+from\s*)?['"]([^'"]+)['"]/g;
const DYNAMIC_IMPORT = /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g;

/**
 * Return the deterministic local ESM dependency closure required by the
 * standalone Patch CLI. Node built-ins and package imports are not embedded as
 * source assets; relative JavaScript modules under src/ are.
 */
export function collectOfflineCompilerSourceFiles(root = process.cwd(), roots = PATCH_OFFLINE_COMPILER_SOURCE_ROOTS) {
  const repositoryRoot = path.resolve(root);
  const sourceRoot = path.join(repositoryRoot, 'src');
  const pending = roots.map(file => normalizeRepositoryPath(file));
  const seen = new Set();

  while (pending.length) {
    const relative = pending.pop();
    if (seen.has(relative)) continue;
    const absolute = path.resolve(repositoryRoot, relative);
    assertInsideSourceRoot(absolute, sourceRoot, relative);
    if (!fs.existsSync(absolute) || !fs.statSync(absolute).isFile()) {
      throw new Error(`Offline compiler source dependency is missing: ${relative}`);
    }
    seen.add(relative);

    const source = fs.readFileSync(absolute, 'utf8');
    for (const specifier of localModuleSpecifiers(source)) {
      const dependency = resolveLocalModule(repositoryRoot, sourceRoot, absolute, specifier);
      if (!seen.has(dependency)) pending.push(dependency);
    }
  }

  return [...seen].sort().map(relative => path.join(repositoryRoot, ...relative.split('/')));
}

export function offlineCompilerSourceManifest(root = process.cwd()) {
  const repositoryRoot = path.resolve(root);
  return Object.freeze({
    version: PATCH_OFFLINE_COMPILER_SOURCE_GRAPH_VERSION,
    roots: PATCH_OFFLINE_COMPILER_SOURCE_ROOTS,
    files: Object.freeze(collectOfflineCompilerSourceFiles(repositoryRoot).map(file =>
      path.relative(repositoryRoot, file).split(path.sep).join('/')
    ))
  });
}

export function localModuleSpecifiers(source) {
  const found = new Set();
  for (const expression of [STATIC_IMPORT, DYNAMIC_IMPORT]) {
    expression.lastIndex = 0;
    let match;
    while ((match = expression.exec(String(source ?? '')))) {
      const specifier = match[1];
      if (specifier.startsWith('.')) found.add(specifier);
    }
  }
  return [...found].sort();
}

function resolveLocalModule(repositoryRoot, sourceRoot, importer, specifier) {
  let absolute = path.resolve(path.dirname(importer), specifier);
  if (!path.extname(absolute)) absolute += '.js';
  const relative = normalizeRepositoryPath(path.relative(repositoryRoot, absolute));
  assertInsideSourceRoot(absolute, sourceRoot, relative);
  if (path.extname(absolute) !== '.js') {
    throw new Error(`Offline compiler local dependency must be JavaScript: ${relative}`);
  }
  return relative;
}

function assertInsideSourceRoot(absolute, sourceRoot, display) {
  const relative = path.relative(sourceRoot, absolute);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) {
    if (path.resolve(absolute) === path.resolve(sourceRoot)) return;
    throw new Error(`Offline compiler source dependency escapes src/: ${display}`);
  }
}

function normalizeRepositoryPath(value) {
  return String(value).split(path.sep).join('/').replace(/^\.\//, '');
}
