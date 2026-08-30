#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { collectOfflineCompilerSourceFiles, offlineCompilerSourceManifest } from './offline-compiler-source-graph.js';

export function copyOfflineCompilerSource(destination, options = {}) {
  const root = path.resolve(options.root ?? process.cwd());
  const target = path.resolve(destination);
  if (!destination) throw new Error('Offline compiler source copy needs a destination directory.');
  fs.mkdirSync(target, { recursive: true });

  const files = collectOfflineCompilerSourceFiles(root);
  for (const source of files) {
    const relative = path.relative(root, source);
    const output = path.resolve(target, relative);
    const guard = path.relative(target, output);
    if (!guard || guard.startsWith('..') || path.isAbsolute(guard)) {
      throw new Error(`Offline compiler source output escapes destination: ${relative}`);
    }
    fs.mkdirSync(path.dirname(output), { recursive: true });
    fs.copyFileSync(source, output);
  }

  const manifest = offlineCompilerSourceManifest(root);
  fs.writeFileSync(
    path.join(target, 'offline-compiler-source-manifest.json'),
    `${JSON.stringify(manifest, null, 2)}\n`,
    'utf8'
  );
  return { destination: target, manifest };
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    const destination = process.argv[2];
    if (!destination || process.argv.length > 3) {
      throw new Error('Usage: node scripts/copy-offline-compiler-source.js <destination>');
    }
    const result = copyOfflineCompilerSource(destination);
    console.log(`copied ${result.manifest.files.length} Offline Compiler source modules to ${result.destination}`);
  } catch (error) {
    console.error(error?.message ?? String(error));
    process.exitCode = 2;
  }
}
