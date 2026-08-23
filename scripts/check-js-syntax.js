#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const ROOTS = Object.freeze(['src', 'web', 'scripts', 'tests']);
const EXTENSIONS = new Set(['.js', '.mjs', '.cjs']);

export function discoverJavaScriptFiles(root = process.cwd()) {
  const files = [];
  for (const relativeRoot of ROOTS) walk(path.resolve(root, relativeRoot), root, files);
  return files.sort((a, b) => a.localeCompare(b));
}

export function checkJavaScriptSyntax(root = process.cwd()) {
  const files = discoverJavaScriptFiles(root);
  if (!files.length) throw new Error('No JavaScript files were discovered for syntax checking.');
  for (const file of files) {
    const result = spawnSync(process.execPath, ['--check', file], {
      cwd: root,
      encoding: 'utf8'
    });
    if (result.status !== 0) {
      process.stderr.write(result.stdout ?? '');
      process.stderr.write(result.stderr ?? '');
      throw new Error(`JavaScript syntax check failed: ${file}`);
    }
  }
  return files;
}

function walk(directory, root, files) {
  if (!fs.existsSync(directory)) return;
  for (const entry of fs.readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      walk(absolute, root, files);
      continue;
    }
    if (!entry.isFile() || !EXTENSIONS.has(path.extname(entry.name))) continue;
    files.push(path.relative(root, absolute).split(path.sep).join('/'));
  }
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : '';
if (invokedPath === fileURLToPath(import.meta.url)) {
  try {
    const files = checkJavaScriptSyntax();
    console.log(`JavaScript syntax check passed for ${files.length} file(s).`);
  } catch (error) {
    console.error(error?.message ?? String(error));
    process.exitCode = 1;
  }
}
