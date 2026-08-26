import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { compile } from '../src/compiler.js';
import { PatchInterpreter } from '../src/interpreter.js';
import { buildStandaloneWebApp } from '../src/webapp.js';
import { buildCurrentNativeGuiIR } from '../src/native-current-contract.js';

const source = fs.readFileSync('examples/harbor-desk.patch', 'utf8');

function mainControls(ui) {
  return ui.find(window => window.id === 'main')?.controls ?? [];
}

test('Harbor Desk parses and runs as the current large source-backed Window showcase', () => {
  const compiled = compile(source, { name: 'HarborDesk', kind: 'window', entry: 'examples/harbor-desk.patch' });
  assert.equal(compiled.project.kind, 'window');
  assert.equal(compiled.ast.filter(node => node.kind === 'window').length, 2);

  const result = new PatchInterpreter().run(source);
  const controls = mainControls(result.ui);
  const types = new Set(controls.map(control => control.type));
  for (const type of ['text', 'combo', 'radio', 'checkbox', 'slider', 'input', 'listbox', 'table', 'tree', 'button', 'picture', 'statusbar']) {
    assert.equal(types.has(type), true, `Harbor Desk should exercise ${type}`);
  }
  const picture = controls.find(control => control.type === 'picture');
  assert.match(picture?.source ?? '', /^data:image\/png;base64,/);
  assert.equal(result.ui.some(window => window.id === 'settings'), true);
});

test('Harbor Desk builds as a standalone Window Web App with Picture and StatusBar output', () => {
  const built = buildStandaloneWebApp(source, { name: 'HarborDesk', kind: 'window', entry: 'examples/harbor-desk.patch' });
  assert.equal(built.metadata.projectKind, 'window');
  assert.equal(built.metadata.pictureStage, 1);
  assert.equal(built.metadata.statusBarStage, 1);
  assert.match(built.html, /data:image\/png;base64,/);
  assert.match(built.html, /patch-picture/);
  assert.match(built.html, /patch-statusbar/);
});

test('Harbor Desk lowers through the current Native GUI 1.4 contract', () => {
  const compiled = compile(source, { name: 'HarborDesk', kind: 'window', entry: 'examples/harbor-desk.patch' });
  const nativeGui = buildCurrentNativeGuiIR(compiled);
  const encoded = JSON.stringify(nativeGui);
  assert.match(encoded, /"picture"/);
  assert.match(encoded, /data:image\\?\/png;base64,/);
  assert.match(encoded, /"statusbar"/);
  assert.match(encoded, /"slider"/);
  assert.match(encoded, /"table"/);
  assert.match(encoded, /"tree"/);
});
