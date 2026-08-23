import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { discoverJavaScriptFiles, checkJavaScriptSyntax } from '../scripts/check-js-syntax.js';

test('syntax discovery covers all maintained JavaScript roots automatically', () => {
  const files = discoverJavaScriptFiles();
  for (const marker of [
    'src/parser.js',
    'src/interpreter.js',
    'web/studio-bootstrap.js',
    'scripts/check-js-syntax.js',
    'tests/syntax-discovery.test.js'
  ]) assert.ok(files.includes(marker), marker);
  assert.deepEqual(files, [...files].sort((a, b) => a.localeCompare(b)));
  assert.ok(files.every(file => /^(?:src|web|scripts|tests)\//.test(file)));
});

test('syntax checker fails closed for a newly discovered invalid file', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'patch-syntax-discovery-'));
  try {
    for (const directory of ['src', 'web', 'scripts', 'tests']) fs.mkdirSync(path.join(root, directory), { recursive: true });
    fs.writeFileSync(path.join(root, 'src', 'valid.js'), 'export const ok = true;\n');
    fs.writeFileSync(path.join(root, 'web', 'new-module.js'), 'export const broken = ;\n');
    assert.throws(() => checkJavaScriptSyntax(root), /new-module\.js/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
