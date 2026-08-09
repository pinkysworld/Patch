import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { parse } from '../src/parser.js';
import { compile } from '../src/compiler.js';
import { PatchInterpreter } from '../src/interpreter.js';
import { triggerWindowEvent } from '../src/window-events.js';
import { validateWindowRuntimeSupport } from '../src/window-build.js';
import { addDesignerWindow, listDesignerWindows, updateDesignerWindow } from '../src/designer.js';
import { buildStandaloneWebApp } from '../src/webapp.js';
import { buildCompiledWindowArtifact, runCompiledWindow } from '../src/window-compiled.js';

const source = fs.readFileSync(new URL('../examples/forms-navigation.patch', import.meta.url), 'utf8');

function visibility(ui) {
  return Object.fromEntries(ui.map(form => [form.id, form.visible]));
}

test('parser keeps named Forms and simple open/close commands readable', () => {
  const ast = parse(source);
  const forms = ast.filter(node => node.kind === 'window');
  assert.deepEqual(forms.map(form => [form.id, form.titleExpr]), [
    ['main', '"Main"'],
    ['settings', '"Settings"']
  ]);
  const open = ast.find(node => node.kind === 'event' && node.control === 'open_settings').body[0];
  const close = ast.find(node => node.kind === 'event' && node.control === 'close_settings').body[0];
  assert.deepEqual({ kind: open.kind, form: open.form }, { kind: 'openForm', form: 'settings' });
  assert.deepEqual({ kind: close.kind, form: close.form }, { kind: 'closeForm', form: 'settings' });
});

test('first named Form starts visible and later named Forms open/close without persistent mutation', () => {
  const runtime = new PatchInterpreter();
  const initial = runtime.run(source);
  assert.deepEqual(visibility(initial.ui), { main: true, settings: false });
  assert.equal(initial.history.length, 0);
  assert.equal(initial.state.notifications, false);

  const opened = triggerWindowEvent(runtime, 'open_settings', 'clicked');
  assert.deepEqual(visibility(opened.ui), { main: true, settings: true });
  assert.equal(opened.history.length, 0);
  assert.equal(opened.state.notifications, false);

  const closed = triggerWindowEvent(runtime, 'close_settings', 'clicked');
  assert.deepEqual(visibility(closed.ui), { main: true, settings: false });
  assert.equal(closed.history.length, 0);
});

test('legacy unnamed multiple windows stay visible for compatibility', () => {
  const runtime = new PatchInterpreter();
  const result = runtime.run('window "One":\n  text "1"\nwindow "Two":\n  text "2"\n');
  assert.deepEqual(result.ui.map(form => form.visible), [true, true]);
});

test('Window build validates duplicate and unknown Form names before packaging', () => {
  const compiled = compile(source, { kind: 'window', name: 'Navigation' });
  const support = validateWindowRuntimeSupport(compiled);
  assert.equal(support.namedForms, 2);
  assert.equal(support.formActions, 2);
  assert.deepEqual(compiled.ir.capabilities.includes('ui.form-lifecycle'), true);
  assert.match(JSON.stringify(compiled.ir.instructions), /OPEN_FORM/);
  assert.match(JSON.stringify(compiled.ir.instructions), /CLOSE_FORM/);

  const unknown = source.replace('open settings', 'open setings');
  assert.throws(
    () => validateWindowRuntimeSupport(compile(unknown, { kind: 'window' })),
    /Form 'setings' is not defined/
  );
  const duplicate = source.replace('window "Settings" as settings', 'window "Settings" as main');
  assert.throws(
    () => validateWindowRuntimeSupport(compile(duplicate, { kind: 'window' })),
    /Form name 'main' is declared more than once/
  );
});

test('Designer auto-names new Forms and preserves/renames navigation references', () => {
  const first = addDesignerWindow('', { titleExpr: '"Main"' });
  const second = addDesignerWindow(first, { titleExpr: '"Settings"' });
  assert.deepEqual(listDesignerWindows(second).map(form => form.id), ['form_1', 'form_2']);

  const withAction = `${second}\nwhen button_1 clicked:\n  open form_2\n`;
  const renamed = updateDesignerWindow(withAction, 1, { id: 'settings', width: 500, height: 320 });
  assert.match(renamed, /window "Settings" as settings size 500, 320:/);
  assert.match(renamed, /open settings/);
});

test('compiled Window artifact keeps Form lifecycle executable without source parsing at app startup', () => {
  const artifact = buildCompiledWindowArtifact(compile(source, { kind: 'window', name: 'Navigation' }));
  assert.ok(artifact.program.some(node => node.kind === 'window' && node.id === 'settings'));
  assert.match(JSON.stringify(artifact.program), /openForm/);
  const runtime = new PatchInterpreter();
  const initial = runCompiledWindow(runtime, artifact);
  assert.deepEqual(visibility(initial.ui), { main: true, settings: false });
  const opened = triggerWindowEvent(runtime, 'open_settings', 'clicked');
  assert.equal(visibility(opened.ui).settings, true);
});

test('Standalone Window Web build contains named Form lifecycle runtime', () => {
  const built = buildStandaloneWebApp(source, { kind: 'window', name: 'Navigation' });
  assert.equal(built.metadata.version, '0.5');
  assert.match(built.html, /case 'openForm'/);
  assert.match(built.html, /case 'closeForm'/);
  assert.match(built.html, /shell\.hidden=model\.visible===false/);
  assert.match(built.html, /formVisibility/);
});
