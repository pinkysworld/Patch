import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { parse } from '../src/parser.js';
import { compile } from '../src/compiler.js';
import { PatchInterpreter } from '../src/interpreter.js';
import { triggerWindowEvent } from '../src/window-events.js';
import { addDesignerControl, listDesignerControls } from '../src/designer.js';
import { buildFormLayoutManifest } from '../src/form-layout.js';
import { validateWindowRuntimeSupport } from '../src/window-build.js';
import { buildStandaloneWebApp } from '../src/webapp.js';

const source = fs.readFileSync(new URL('../examples/checkbox-window.patch', import.meta.url), 'utf8');

test('checkbox syntax is source-backed and carries form geometry', () => {
  const ast = parse(source);
  const checkbox = ast.find(node => node.kind === 'window').body.find(node => node.control === 'checkbox');
  assert.equal(checkbox.id, 'subscribed');
  assert.equal(checkbox.textExpr, '"Receive updates"');
  assert.deepEqual(checkbox.layout, { x: 24, y: 72, width: 220, height: 36 });
  const manifest = buildFormLayoutManifest(ast);
  assert.deepEqual(manifest.windows[0].controls[1], { x: 24, y: 72, width: 220, height: 36 });
});

test('checkbox changed exposes a Boolean value and persists only through explicit change', () => {
  const runtime = new PatchInterpreter();
  const initial = runtime.run(source);
  const checkbox = initial.ui[0].controls.find(control => control.type === 'checkbox');
  assert.equal(checkbox.value, false);

  const changed = triggerWindowEvent(runtime, 'subscribed', 'changed', { value: true });
  assert.equal(runtime.state.get('subscribed'), true);
  assert.equal(changed.ui[0].controls.find(control => control.type === 'checkbox').value, true);

  const transientOnly = `create boolean enabled = false\nwindow "Test":\n  checkbox "Enabled" as enabled\nwhen enabled changed:\n  show value\n`;
  const transientRuntime = new PatchInterpreter();
  transientRuntime.run(transientOnly);
  const event = triggerWindowEvent(transientRuntime, 'enabled', 'changed', { value: true });
  assert.equal(transientRuntime.state.get('enabled'), false);
  assert.deepEqual(event.output, ['true']);
  assert.throws(
    () => triggerWindowEvent(transientRuntime, 'enabled', 'changed', { value: 'true' }),
    /Boolean event-local value/
  );
});

test('clear on Boolean state deterministically resets it to false', () => {
  const runtime = new PatchInterpreter();
  runtime.run(`create boolean enabled = true\nchange enabled:\n  clear\n`);
  assert.equal(runtime.state.get('enabled'), false);
});

test('Window build validation accepts checkbox changed and rejects checkbox clicked', () => {
  const compiled = compile(source, { kind: 'window', name: 'CheckboxApp' });
  assert.doesNotThrow(() => validateWindowRuntimeSupport(compiled));
  const invalid = source.replace('when subscribed changed:', 'when subscribed clicked:');
  assert.throws(() => validateWindowRuntimeSupport(compile(invalid, { kind: 'window' })), /changed.*inputs\/checkboxes|checkbox.*clicked/i);
});

test('Designer can create a positioned checkbox in Patch source', () => {
  const next = addDesignerControl('window "Form" size 500, 300:\n', 'checkbox');
  assert.match(next, /checkbox "Checkbox" as checkbox_1 at 24, 24 size 220, 36/);
  const control = listDesignerControls(next)[0];
  assert.equal(control.type, 'checkbox');
  assert.equal(control.id, 'checkbox_1');
  assert.equal(control.width, 220);
});

test('Standalone Window Web build renders checkbox and emits Boolean changed payload', () => {
  const built = buildStandaloneWebApp(source, { kind: 'window', name: 'CheckboxApp' });
  assert.equal(built.metadata.version, '0.9');
  assert.match(built.html, /control\.type==='checkbox'/);
  assert.match(built.html, /el\.type='checkbox'/);
  assert.match(built.html, /value:el\.checked/);
  assert.match(built.html, /Receive updates/);
});