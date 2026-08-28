import test from 'node:test';
import assert from 'node:assert/strict';
import { parse, PatchSyntaxError } from '../src/parser.js';
import { compile } from '../src/compiler.js';
import { PatchInterpreter } from '../src/interpreter.js';
import { addDesignerControl, addDesignerWindow, listDesignerWindows, updateDesignerWindow } from '../src/designer.js';
import { buildCurrentNativeGuiIR } from '../src/native-current-contract.js';
import { NativeGuiError } from '../src/native-gui-frozen-lower.js';
import { buildStandaloneWebApp } from '../src/webapp.js';
import { validateWindowRuntimeSupport } from '../src/window-build.js';

const SOURCE = `window "Counter" as main size 520, 360 icon "patch-resource:app.icon":
  text "Hello"
`;

const RESOURCE = Object.freeze({
  id: 'app.icon',
  path: 'resources/app-icon.png',
  mediaType: 'image/png',
  size: 1,
  sha256: '0'.repeat(64),
  data: 'AA=='
});

test('Window icons parse through ordinary Patch source', () => {
  const windowNode = parse(SOURCE)[0];
  assert.equal(windowNode.kind, 'window');
  assert.equal(windowNode.id, 'main');
  assert.equal(windowNode.iconExpr, '"patch-resource:app.icon"');
  assert.equal(Object.hasOwn(parse('window "Plain" as main size 520, 360:\n  text "Hi"\n')[0], 'iconExpr'), false);
});

test('Window icon diagnostics retain the exact offending Patch source line', () => {
  assert.throws(
    () => parse(`window "Counter" as main icon:\n  text "Hi"\n`),
    error => error instanceof PatchSyntaxError && error.line === 1 && /quoted source/.test(error.message)
  );
});

test('compiler transports Window icons on Change IR 0.10 without a native IR bump', () => {
  const compiled = compile(SOURCE, { name: 'Counter', kind: 'window' });
  assert.equal(compiled.ir.version, '0.10');
  assert.ok(compiled.ir.capabilities.includes('ui.window-icon'));
  const window = compiled.ir.instructions.find(instruction => instruction.code === 'WINDOW');
  assert.equal(window.iconExpr, '"patch-resource:app.icon"');
});

test('interpreter exposes Window icon metadata on the shared Studio UI model', () => {
  const result = new PatchInterpreter().run(SOURCE);
  assert.equal(result.ui[0].title, 'Counter');
  assert.equal(result.ui[0].icon, 'patch-resource:app.icon');
});

test('Designer round-trips Window icons as ordinary source and omits them by default', () => {
  const added = addDesignerWindow('', { titleExpr: '"Main Form"', width: 700, height: 460 });
  assert.match(added, /window "Main Form" as form_1 size 700, 460:/);
  assert.doesNotMatch(added, / icon /);
  const listed = listDesignerWindows(added)[0];
  assert.equal(listed.iconExpr, null);
  const next = updateDesignerWindow(added, 0, { icon: 'patch-resource:app.icon' });
  assert.match(next, /window "Main Form" as form_1 size 700, 460 icon "patch-resource:app.icon":/);
  const cleared = updateDesignerWindow(next, 0, { iconExpr: '' });
  assert.match(cleared, /window "Main Form" as form_1 size 700, 460:/);
  assert.doesNotMatch(cleared, / icon /);
});

test('Designer preserves Window icons when growing a Form to fit controls', () => {
  const source = `window "Main" as main size 200, 120 icon "patch-resource:app.icon":
  text "Visible" at 24, 24 size 180, 28
`;
  const next = addDesignerControl(source, 'button', { windowIndex: 0 });
  assert.match(next, /icon "patch-resource:app.icon":/);
});

test('Window validation counts Window icons without treating them as ImageList', () => {
  const compiled = compile(SOURCE, { name: 'Counter', kind: 'window' });
  const report = validateWindowRuntimeSupport(compiled, { allowTree: true, allowSlider: true, allowPaintBox: true, allowImageList: true });
  assert.equal(report.windowIcons, 1);
  assert.equal(report.imageLists, 0);
});

test('Standalone Web packages the first Window icon as the application favicon', () => {
  const built = buildStandaloneWebApp(SOURCE, { name: 'Counter', kind: 'window', resources: [RESOURCE] });
  assert.match(built.html, /rel="icon"/);
  assert.match(built.html, /data:image\/png;base64,AA==/);
  assert.match(built.html, /patch-window-icon/);
  assert.equal(built.metadata.windowIconStage, 1);
  assert.equal(built.metadata.windowIconPolicy, 'window-icon/1.0');
});

test('Standalone Web fails closed when a Window icon names a missing project resource', () => {
  assert.throws(
    () => buildStandaloneWebApp(SOURCE, { name: 'Counter', kind: 'window', resources: [] }),
    /missing project resource 'app\.icon'/
  );
});

test('current native GUI fail-closes Window icons instead of dropping them', () => {
  const compiled = compile(SOURCE, { name: 'Counter', kind: 'window' });
  assert.throws(
    () => buildCurrentNativeGuiIR(compiled),
    error => error instanceof NativeGuiError && /native GUI Form 'main' does not transport icon/.test(error.message)
  );
});
