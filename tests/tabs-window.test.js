import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { parse } from '../src/parser.js';
import { compile } from '../src/compiler.js';
import { PatchInterpreter } from '../src/interpreter.js';
import { triggerWindowEvent } from '../src/window-events.js';
import { validateWindowRuntimeSupport } from '../src/window-build.js';
import { addDesignerControl, listDesignerControls, updateDesignerControl, removeDesignerControl } from '../src/designer.js';
import { buildStandaloneWebApp } from '../src/webapp.js';
import { buildNativeGuiIR, NativeGuiError } from '../src/native-gui-ir.js';

const source = fs.readFileSync('examples/tabs-window.patch', 'utf8');
const studioIndex = fs.readFileSync('web/index.html', 'utf8');
const studio = fs.readFileSync('web/playground.js', 'utf8');
const formsDesigner = fs.readFileSync('web/forms-designer.js', 'utf8');
const compatibilityBuilder = fs.readFileSync('scripts/build-native-window-template.js', 'utf8');

test('parser records a source-backed Tabs container with nested tab pages', () => {
  const ast = parse(source);
  const window = ast.find(node => node.kind === 'window');
  const tabs = window.body.find(node => node.kind === 'tabs');
  assert.ok(tabs);
  assert.equal(tabs.id, 'settings');
  assert.deepEqual(tabs.layout, { x: 24, y: 24, width: 540, height: 280 });
  assert.deepEqual(tabs.body.map(page => page.titleExpr), ['"General"', '"Advanced"']);
  assert.deepEqual(tabs.body[0].body.map(node => node.control), ['text', 'input']);
  assert.deepEqual(tabs.body[1].body.map(node => node.control), ['checkbox', 'button']);
});

test('Tabs Stage 1 requires at least two pages and flow-layout page controls', () => {
  assert.throws(
    () => parse('window "Demo":\n  tabs as settings:\n    tab "Only":\n      text "One"\n'),
    /Tabs needs at least two tab pages/
  );
  assert.throws(
    () => parse('window "Demo":\n  tabs as settings:\n    tab "One":\n      text "One" at 10, 10\n    tab "Two":\n      text "Two"\n'),
    /Controls inside a tab page use flow layout/
  );
});

test('Change IR preserves Tabs and page structure without changing Change IR 0.10', () => {
  const compiled = compile(source, { name: 'TabsDemo', kind: 'window' });
  assert.equal(compiled.ir.version, '0.10');
  assert.ok(compiled.ir.capabilities.includes('ui.tabs'));
  const window = compiled.ir.instructions.find(item => item.code === 'WINDOW');
  const tabs = window.body.find(item => item.code === 'TABS');
  assert.equal(tabs.id, 'settings');
  assert.deepEqual(tabs.body.map(page => page.code), ['TAB_PAGE', 'TAB_PAGE']);
  assert.equal(tabs.body[0].body[1].code, 'UI_CONTROL');
  assert.equal(tabs.body[0].body[1].id, 'name');
});

test('Window validation sees named nested controls while Tabs selection itself exposes no event', () => {
  const compiled = compile(source, { name: 'TabsDemo', kind: 'window' });
  const summary = validateWindowRuntimeSupport(compiled);
  assert.equal(summary.tabs, 1);
  assert.equal(summary.controls, 3);
  assert.equal(summary.events, 3);

  const invalid = compile(`window "Demo" as main:\n  tabs as settings:\n    tab "One":\n      text "One"\n    tab "Two":\n      text "Two"\n\nwhen settings changed:\n  show value\n`, { name: 'InvalidTabsEvent', kind: 'window' });
  assert.throws(
    () => validateWindowRuntimeSupport(invalid),
    /transient page selection and does not expose Patch events in Tabs Stage 1/
  );
});

test('interpreter UI model exposes nested pages but stores no persistent selected-tab state', () => {
  const runtime = new PatchInterpreter();
  const result = runtime.run(source);
  const tabs = result.ui[0].controls.find(control => control.type === 'tabs');
  assert.ok(tabs);
  assert.equal(tabs.id, 'settings');
  assert.deepEqual(tabs.pages.map(page => page.title), ['General', 'Advanced']);
  assert.deepEqual(tabs.pages[0].controls.map(control => control.type), ['text', 'input']);
  assert.deepEqual(tabs.pages[1].controls.map(control => control.type), ['checkbox', 'button']);
  assert.equal(Object.hasOwn(result.state, 'settings'), false);
  assert.equal(result.history.length, 0);
});

test('controls nested in Tabs remain normal Patch event controls with explicit mutation', () => {
  const runtime = new PatchInterpreter();
  runtime.run(source);
  const renamed = triggerWindowEvent(runtime, 'name', 'changed', { value: 'Ada' });
  assert.equal(renamed.state.name, 'Ada');
  assert.equal(renamed.history.length, 1);
  assert.equal(renamed.history[0].target, 'name');

  const notified = triggerWindowEvent(runtime, 'notifications', 'changed', { value: true });
  assert.equal(notified.state.notifications, true);
  assert.equal(notified.history.length, 2);

  const reset = triggerWindowEvent(runtime, 'reset_name', 'clicked');
  assert.equal(reset.state.name, 'Mia');
  assert.equal(reset.history.length, 3);
});

test('Designer inserts, selects, moves, renames and removes Tabs without rewriting page bodies', () => {
  let edited = addDesignerControl('window "Demo" as main size 620, 380:\n', 'tabs');
  let tabs = listDesignerControls(edited)[0];
  assert.equal(tabs.type, 'tabs');
  assert.equal(tabs.id, 'tabs_1');
  assert.deepEqual(tabs.pages, ['"General"', '"Advanced"']);
  assert.match(edited, /tabs as tabs_1 at 24, 24 size 420, 240:/);
  assert.match(edited, /tab "General":\n      text "General"/);

  edited = updateDesignerControl(edited, tabs, { id: 'settings', x: 40, y: 56, width: 500, height: 260 });
  tabs = listDesignerControls(edited)[0];
  assert.equal(tabs.id, 'settings');
  assert.deepEqual([tabs.x, tabs.y, tabs.width, tabs.height], [40, 56, 500, 260]);
  assert.match(edited, /tabs as settings at 40, 56 size 500, 260:/);
  assert.match(edited, /tab "Advanced":\n      text "Advanced"/);

  edited = removeDesignerControl(edited, tabs);
  assert.equal(listDesignerControls(edited).length, 0);
  assert.doesNotMatch(edited, /tabs as settings/);
  assert.doesNotMatch(edited, /tab "General"/);
});

test('Patch Studio exposes Tabs in the toolbox and renders a real tablist/tabpanel', () => {
  assert.match(studioIndex, /id="addTabs"/);
  assert.match(studioIndex, /value="tabsWindow"/);
  assert.match(studio, /addControl\('tabs'\)/);
  assert.match(studio, /control\.type === 'tabs'/);
  assert.match(studio, /patch-tabs-list/);
  assert.match(studio, /patch-tab-button/);
  assert.match(studio, /aria-selected/);
  assert.match(studio, /patch-tab-panel/);
  assert.match(formsDesigner, /\['#addTabs', 'tabs'\]/);
  assert.match(formsDesigner, /control\.type === 'tabs'/);
});

test('Standalone Window Web runtime v0.8 renders Tabs and nested controls', () => {
  const built = buildStandaloneWebApp(source, { name: 'TabsDemo', kind: 'window' });
  assert.equal(built.metadata.version, '0.8');
  assert.match(built.html, /patch-tabs-list/);
  assert.match(built.html, /patch-tab-button/);
  assert.match(built.html, /patch-tab-panel/);
  assert.match(built.html, /tabSelections=new Map/);
  assert.match(built.html, /function buildUIItems/);
  assert.match(built.html, /function findControl/);
  assert.match(built.html, /General/);
  assert.match(built.html, /Advanced/);
});

test('compatibility desktop renderer cannot silently omit Tabs', () => {
  assert.match(compatibilityBuilder, /const tabSelections=new Map/);
  assert.match(compatibilityBuilder, /control\.type==='tabs'/);
  assert.match(compatibilityBuilder, /patch-tabs-list/);
  assert.match(compatibilityBuilder, /patch-tab-panel/);
  assert.match(compatibilityBuilder, /runtime\.result\(\)\.ui/);
});

test('direct native GUI v0.3 fails closed on Tabs until native container parity exists', () => {
  const compiled = compile(source, { name: 'TabsDemo', kind: 'window' });
  assert.throws(
    () => buildNativeGuiIR(compiled),
    error => error instanceof NativeGuiError && /native GUI v0\.3 does not support Tabs containers yet/.test(error.message)
  );
});
