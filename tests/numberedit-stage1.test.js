import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { compile } from '../src/compiler.js';
import { PatchInterpreter } from '../src/interpreter.js';
import { triggerWindowEvent } from '../src/window-events.js';
import { buildCurrentNativeGuiIR } from '../src/native-current-contract.js';
import { buildStandaloneWebApp } from '../src/webapp.js';
import { PATCH_COMPONENT_REGISTRY_VERSION } from '../src/component-registry.js';
import { removeDesignerControl } from '../src/designer.js';
import {
  PATCH_INPUT_NUMBER_VERSION,
  PATCH_WINDOW_INPUT_NUMBER_VERSION,
  assertPatchInputNumberTarget,
  formatPatchInputNumberDirective,
  parsePatchInputNumberDirective,
  readWindowInputNumber,
  setWindowInputNumber
} from '../src/input-number.js';
import { duplicateDesignerControl } from '../web/designer-control-duplicate-model.js';
import {
  copyDesignerControlClipboard,
  pasteDesignerControlClipboard
} from '../web/designer-control-clipboard-model.js';

const SOURCE = `create number quantity = 4

window "NumberEdit" as main size 640, 420:
  # @input-number min 0 max 20 step 1
  input quantity at 24, 24 size 180, 36

when quantity changed:
  change quantity:
    set = value
`;

function inputOf(compiled) {
  return compiled.ast[1].body.find(node => node.kind === 'uiControl' && node.control === 'input');
}

test('NumberEdit Stage 1 is a versioned Input presentation without IR or Registry bump', () => {
  assert.equal(PATCH_INPUT_NUMBER_VERSION, '0.1');
  assert.equal(PATCH_WINDOW_INPUT_NUMBER_VERSION, '0.1');
  assert.equal(PATCH_COMPONENT_REGISTRY_VERSION, '0.10');
  const compiled = compile(SOURCE, { name: 'NumberEditStage1', kind: 'window', entry: 'main.patch' });
  assert.equal(compiled.ir.version, '0.10');
  assert.equal(compiled.windowInputNumber.version, '0.1');
  assert.deepEqual(compiled.windowInputNumber.controls, [{ line: 5, id: 'quantity', min: 0, max: 20, step: 1 }]);
  assert.deepEqual(inputOf(compiled).inputNumber, { min: 0, max: 20, step: 1 });
  const lowered = compiled.ir.instructions.find(instruction => instruction.code === 'WINDOW').body
    .find(node => node.code === 'UI_CONTROL' && node.control === 'input');
  assert.equal(lowered.inputNumber, undefined);
});

test('NumberEdit directive parses formats and round-trips on Input metadata', () => {
  assert.deepEqual(parsePatchInputNumberDirective('# @input-number min -2.5 max 10 step 0.5'), { min: -2.5, max: 10, step: 0.5 });
  assert.equal(formatPatchInputNumberDirective({ min: -2.5, max: 10, step: 0.5 }), '# @input-number min -2.5 max 10 step 0.5');
  const inputLine = SOURCE.split('\n').findIndex(line => line.includes('input quantity')) + 1;
  assert.deepEqual(readWindowInputNumber(SOURCE, inputLine), { min: 0, max: 20, step: 1 });
  const changed = setWindowInputNumber(SOURCE, inputLine, { min: -10, max: 30, step: 2 });
  assert.match(changed, /# @input-number min -10 max 30 step 2\n  input quantity/);
  const changedLine = changed.split('\n').findIndex(line => line.includes('input quantity')) + 1;
  const plain = setWindowInputNumber(changed, changedLine, null);
  assert.doesNotMatch(plain, /@input-number/);
  assert.doesNotThrow(() => compile(plain, { kind: 'window' }));
});

test('NumberEdit validates numeric bounds and belongs only to number-backed Input', () => {
  assert.throws(() => parsePatchInputNumberDirective('# @input-number min 5 max 5 step 1'), /min must be smaller than max/i);
  assert.throws(() => parsePatchInputNumberDirective('# @input-number min 0 max 5 step 0'), /step must be greater than zero/i);
  assert.throws(() => parsePatchInputNumberDirective('# @input-number min nope max 5 step 1'), /Invalid # @input-number directive/i);
  assert.throws(
    () => compile(`create number amount = 1\nwindow "Bad":\n  # @input-number min 0 max 5 step 1\n  button "No" as amount\n`, { kind: 'window' }),
    /@input-number belongs only to Input controls/i
  );
  assert.throws(
    () => compile(`window "Bad":\n  # @input-number min 0 max 5 step 1\n  input amount\n`, { kind: 'window' }),
    /needs a matching 'create number amount/i
  );
  assert.throws(
    () => compile(`create text amount = "1"\nwindow "Bad":\n  # @input-number min 0 max 5 step 1\n  input amount\n`, { kind: 'window' }),
    /needs a matching 'create number amount/i
  );
});

test('NumberEdit refuses incompatible PasswordEdit and MaskedEdit composition', () => {
  assert.throws(
    () => compile(`create number secret = 1\nwindow "Bad":\n  # @input-mode password\n  # @input-number min 0 max 9 step 1\n  input secret\n`, { kind: 'window' }),
    /cannot combine PasswordEdit and NumberEdit/i
  );
  assert.throws(
    () => compile(`create number code = 1\nwindow "Bad":\n  # @input-mask "000"\n  # @input-number min 0 max 999 step 1\n  input code\n`, { kind: 'window' }),
    /cannot combine MaskedEdit and NumberEdit/i
  );
});

test('Interpreter UI model carries NumberEdit presentation while changed(value) stays transient until explicit change', () => {
  const compiled = compile(SOURCE, { kind: 'window' });
  const runtime = new PatchInterpreter();
  const initial = runtime.runAst(compiled.ast);
  const control = initial.ui[0].controls.find(item => item.id === 'quantity');
  assert.deepEqual(control.inputNumber, { min: 0, max: 20, step: 1 });
  assert.equal(initial.state.quantity, 4);

  const changed = triggerWindowEvent(runtime, 'quantity', 'changed', { value: 7 });
  assert.equal(changed.state.quantity, 7);
  assert.equal(changed.history.length, 1);
  assert.equal(changed.history[0].cause[0].event, 'changed');
  assert.throws(() => triggerWindowEvent(runtime, 'quantity', 'changed', { value: '8' }), /finite number event-local value/i);
  assert.throws(() => triggerWindowEvent(runtime, 'quantity', 'changed', { value: 21 }), /value from 0 to 20/i);
});

test('plain Input remains text-valued while NumberEdit specializes only explicit input-number controls', () => {
  const plain = `create text name = "Ada"\nwindow "Plain":\n  input name\nwhen name changed:\n  change name:\n    set = value\n`;
  const runtime = new PatchInterpreter();
  runtime.runAst(compile(plain, { kind: 'window' }).ast);
  assert.equal(triggerWindowEvent(runtime, 'name', 'changed', { value: 'Grace' }).state.name, 'Grace');
  assert.throws(() => triggerWindowEvent(runtime, 'name', 'changed', { value: 5 }), /text event-local value/i);
});

test('NumberEdit target support is Studio/Web only and Current Ready native fails closed', () => {
  assert.doesNotThrow(() => assertPatchInputNumberTarget('studio'));
  assert.doesNotThrow(() => assertPatchInputNumberTarget('web'));
  assert.throws(() => assertPatchInputNumberTarget('windows'), /NumberEdit Stage 1 is Studio\/Web only/i);
  assert.throws(
    () => buildCurrentNativeGuiIR(compile(SOURCE, { kind: 'window' })),
    /NumberEdit Stage 1 Input 'quantity'.*Studio\/Web only.*Current Ready native 1\.10/i
  );
});

test('Standalone Web renders NumberEdit with numeric bounds and numeric changed adapter', () => {
  const built = buildStandaloneWebApp(SOURCE, { name: 'NumberEditStage1', kind: 'window' });
  assert.equal(built.metadata.numberEditStage, 1);
  assert.equal(built.metadata.numberEditMode, 'source-backed-number-input');
  assert.equal(built.metadata.numberEditEventValue, 'finite-number');
  assert.match(built.html, /data-patch-window-numberedit/);
  assert.match(built.html, /PATCH_NUMBEREDITS/);
  assert.match(built.html, /element\.type='number'/);
  assert.match(built.html, /NumberEdit changed\(value\) needs a finite number/);
});

test('Designer duplicate and clipboard create explicit fresh NumberEdit backing states', () => {
  const duplicated = duplicateDesignerControl(SOURCE, { windowIndex: 0, controlIndex: 0 }, { offset: false });
  assert.match(duplicated.source, /create number input_1 = 4/);
  assert.equal((duplicated.source.match(/# @input-number min 0 max 20 step 1/g) ?? []).length, 2);
  assert.match(duplicated.source, /input input_1/);
  assert.doesNotThrow(() => compile(duplicated.source, { kind: 'window' }));

  const clipboard = copyDesignerControlClipboard(SOURCE, { windowIndex: 0, controlIndex: 0 });
  assert.deepEqual(clipboard.backingStates.map(state => [state.id, state.valueType]), [['quantity', 'number']]);
  const target = `window "Target" as target size 640, 420:\n  text "Target" at 24, 24 size 120, 28\n`;
  const pasted = pasteDesignerControlClipboard(target, clipboard, { windowIndex: 0, offset: false });
  assert.match(pasted.source, /create number quantity = 4/);
  assert.match(pasted.source, /# @input-number min 0 max 20 step 1\n  input quantity/);
  assert.doesNotThrow(() => compile(pasted.source, { kind: 'window' }));
});

test('Designer delete removes NumberEdit metadata with its Input while leaving explicit state alone', () => {
  const removed = removeDesignerControl(SOURCE, { windowIndex: 0, controlIndex: 0 });
  assert.doesNotMatch(removed, /@input-number/);
  assert.doesNotMatch(removed, /input quantity/);
  assert.match(removed, /create number quantity = 4/);
});

test('Studio and public/offline packaging expose the complete NumberEdit delivery graph', () => {
  const designer = fs.readFileSync('web/designer-numberedit.js', 'utf8');
  const workspace = fs.readFileSync('web/designer-workspace.js', 'utf8');
  const buildSite = fs.readFileSync('scripts/build-site.js', 'utf8');
  const serviceWorker = fs.readFileSync('web/sw.js', 'utf8');
  assert.match(designer, /PATCH_DESIGNER_NUMBEREDIT_VERSION = '0\.1'/);
  assert.match(designer, /id = 'addNumberEdit'/);
  assert.match(designer, /\+ NumberEdit/);
  assert.match(designer, /designerInspectorNumberEditField/);
  assert.match(designer, /setWindowInputNumber/);
  assert.match(workspace, /import '\.\/designer-numberedit\.js';/);
  assert.match(buildSite, /'input-number\.js'/);
  assert.match(buildSite, /'window-web-numberedit\.js'/);
  assert.match(buildSite, /'designer-numberedit\.js'/);
  assert.match(serviceWorker, /'\.\.\/src\/input-number\.js'/);
  assert.match(serviceWorker, /'\.\.\/src\/window-web-numberedit\.js'/);
  assert.match(serviceWorker, /'\.\/designer-numberedit\.js'/);
});
