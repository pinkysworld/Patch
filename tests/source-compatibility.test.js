import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { PatchInterpreter } from '../src/interpreter.js';
import { compile } from '../src/compiler.js';

const corpusDir = path.resolve('compat/source-0.2');
const manifest = JSON.parse(fs.readFileSync(path.join(corpusDir, 'manifest.json'), 'utf8'));

test('source compatibility corpus has a versioned manifest and unique cases', () => {
  assert.equal(manifest.schema, 'patch-source-compatibility-corpus');
  assert.equal(manifest.version, 1);
  assert.equal(manifest.languageLine, '0.2');
  assert.ok(manifest.cases.length >= 6);
  assert.equal(new Set(manifest.cases.map(item => item.file)).size, manifest.cases.length);
});

for (const item of manifest.cases) {
  test(`Patch 0.2 compatibility: ${item.file}`, () => {
    const source = fs.readFileSync(path.join(corpusDir, item.file), 'utf8');
    const compiled = compile(source, { name: 'Compat', entry: item.file });
    assert.equal(compiled.ir.version, '0.10');

    if (item.mode === 'run') {
      assert.equal(compiled.project.kind, 'console');
      const result = new PatchInterpreter().run(source);
      assert.deepEqual(result.output, item.expectedOutput);
      assert.deepEqual(JSON.parse(JSON.stringify(result.state)), item.expectedState);
      return;
    }

    assert.equal(item.mode, 'compile-window');
    assert.equal(compiled.project.kind, 'window');
    const windows = compiled.ast.filter(node => node.kind === 'window');
    const controls = windows.flatMap(window => window.body ?? []).filter(node => node.kind === 'uiControl');
    assert.equal(windows.length, item.expectedWindows);
    assert.equal(controls.length, item.expectedControls);
    assert.equal(controls.filter(control => Boolean(control.layout)).length, item.expectedPositionedControls);
  });
}
