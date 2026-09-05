import test from 'node:test';
import assert from 'node:assert/strict';
import { parse } from '../src/parser.js';
import { compile } from '../src/compiler.js';
import { validateWindowRuntimeSupport } from '../src/window-build.js';
import { buildStandaloneWebApp } from '../src/webapp.js';
import { buildCurrentNativeGuiIR } from '../src/native-current-contract.js';
import { addDesignerControl, listDesignerControls, updateDesignerControl } from '../src/designer.js';
import { addDesignerTabPageControl, supportedDesignerTabControlTypes } from '../src/designer-tabs-nested.js';
import { listDesignerTabOrder } from '../web/designer-layout-policy.js';

const SOURCE = `create text notes = "Line one"
create text title = "Title"
window "Memo Stage 1" as main size 640, 420:
  # @taborder 1
  memo notes at 24, 24 size 320, 140
  # @taborder 0
  input title at 24, 180 size 320, 36
when notes changed:
  change notes:
    set = value
`;

test('Memo Stage 1 parses as a positioned multiline control', () => {
  const ast = parse(SOURCE);
  const window = ast.find(node => node.kind === 'window');
  const memo = window.body.find(node => node.kind === 'uiControl' && node.control === 'memo');
  assert.ok(memo);
  assert.equal(memo.id, 'notes');
  assert.deepEqual(memo.layout, { x: 24, y: 24, width: 320, height: 140 });
});

test('Memo Stage 1 is explicit Web opt-in and remains fail-closed for generic/native Window targets', () => {
  const compiled = compile(SOURCE, { name: 'MemoStage1', kind: 'window' });
  assert.throws(
    () => validateWindowRuntimeSupport(compiled),
    /Memo Stage 1.*Studio.*Standalone Window Web.*no Memo contract/i
  );
  const web = validateWindowRuntimeSupport(compiled, { allowMemo: true });
  assert.equal(web.memos, 1);
  assert.equal(web.events, 1);
  assert.throws(() => buildCurrentNativeGuiIR(compiled), /Memo Stage 1|Memo contract/i);
});

test('Designer adds Memo with multiline geometry and preserves changed handlers when renamed', () => {
  const emptyForm = 'window "Memo Designer" as main size 640, 420:\n';
  const added = addDesignerControl(emptyForm, 'memo', { windowIndex: 0 });
  assert.match(added, /memo memo_1 at 24, 24 size 320, 140/);
  const memo = listDesignerControls(added).find(control => control.type === 'memo');
  assert.ok(memo);
  assert.deepEqual(
    { width: memo.width, height: memo.height },
    { width: 320, height: 140 }
  );

  const withHandler = `${added.trimEnd()}\nwhen memo_1 changed:\n  show value\n`;
  const renamed = updateDesignerControl(withHandler, memo, { id: 'notes' });
  assert.match(renamed, /memo notes at 24, 24 size 320, 140/);
  assert.match(renamed, /when notes changed:/);
  assert.doesNotMatch(renamed, /when memo_1 changed:/);
});

test('Memo Stage 1 remains outside nested Tabs Stage 1 authoring', () => {
  const tabsSource = `window "Tabs" as main size 640, 420:
  tabs as pages at 24, 24 size 480, 260:
    tab "One":
      text "One"
    tab "Two":
      text "Two"
`;
  const tabs = listDesignerControls(tabsSource).find(control => control.type === 'tabs');
  assert.ok(tabs);
  assert.equal(supportedDesignerTabControlTypes().includes('memo'), false);
  assert.throws(
    () => addDesignerTabPageControl(tabsSource, tabs, 0, 'memo'),
    /Tabs Designer cannot add 'memo' controls in this stage/
  );
  const handWrittenNestedMemo = tabsSource.replace('      text "One"', '      memo notes');
  assert.throws(
    () => parse(handWrittenNestedMemo),
    /Tabs Stage 1 pages cannot contain Panel, Timer, ImageList, StatusBar or Memo/
  );
});

test('Memo participates in independent Delphi-style TabOrder without moving source declarations', () => {
  const declarationOrder = listDesignerControls(SOURCE).map(control => control.id).filter(Boolean);
  assert.deepEqual(declarationOrder, ['notes', 'title']);
  const tabOrder = listDesignerTabOrder(SOURCE, 0);
  assert.deepEqual(tabOrder.map(control => control.id), ['title', 'notes']);
  assert.deepEqual(tabOrder.map(control => control.tabOrder), [0, 1]);
});

test('Standalone Window Web exports Memo as textarea with changed(value) semantics', () => {
  const built = buildStandaloneWebApp(SOURCE, { name: 'Memo Web', kind: 'window' });
  assert.equal(built.metadata.memoStage, 1);
  assert.equal(built.metadata.memoMode, 'multiline-text-changed-value');
  assert.match(built.html, /function patchMemoElement\(control\)/);
  assert.match(built.html, /createElement\('textarea'\)/);
  assert.match(built.html, /safeTrigger\(control\.id,'changed',\{value:memo\.value\}\)/);
  assert.match(built.html, /textarea.*focus-visible/);
});
