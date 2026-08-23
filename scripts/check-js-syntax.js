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
  for (const file of files) checkFileSyntax(root, file);
  return files;
}

function checkFileSyntax(root, file) {
  const absolute = path.resolve(root, file);
  const extension = path.extname(file);
  let result;

  if (extension === '.cjs') {
    result = spawnSync(process.execPath, ['--check', absolute], {
      cwd: root,
      encoding: 'utf8'
    });
  } else {
    // Do not rely on a surrounding package.json to tell Node that a discovered
    // .js file is ESM. `node --check file.js` can otherwise parse an isolated
    // file under CommonJS rules and miss module-only syntax failures. Parsing the
    // exact bytes as module stdin makes discovery fail closed in temp fixtures and
    // in the real type=module repository alike.
    result = spawnSync(process.execPath, ['--input-type=module', '--check'], {
      cwd: root,
      encoding: 'utf8',
      input: fs.readFileSync(absolute, 'utf8')
    });
  }

  if (result.error) throw new Error(`JavaScript syntax check could not run for ${file}: ${result.error.message}`);
  if (result.signal || result.status !== 0) {
    process.stderr.write(result.stdout ?? '');
    process.stderr.write(result.stderr ?? '');
    throw new Error(`JavaScript syntax check failed: ${file}`);
  }
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
