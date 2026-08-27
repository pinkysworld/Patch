import test from 'node:test';
import assert from 'node:assert/strict';
import { parse, PatchSyntaxError } from '../src/parser.js';
import { compile } from '../src/compiler.js';
import {
  addDesignerControl,
  listDesignerControls,
  removeDesignerControl,
  updateDesignerControl
} from '../src/designer.js';
import { buildFormLayoutManifest, isNonvisualFormControl } from '../src/form-layout.js';
import { patchComponent } from '../src/component-registry.js';
import { validateWindowRuntimeSupport } from '../src/window-build.js';

const source = `window "Images" as main size 520, 260:
  imagelist as app_images size 16, 16:
    image open from "patch-resource:icons.open"
    image save from "patch-resource:icons.save"
  button "Open" as open_button
`;

test('ImageList Stage 1 parses named project resources and logical size as a nonvisual UI control', () => {
  const ast = parse(source);
  const list = ast[0].body[0];
  assert.equal(list.kind, 'uiControl');
  assert.equal(list.control, 'imagelist');
  assert.equal(list.id, 'app_images');
  assert.equal(list.logicalWidth, 16);
  assert.equal(list.logicalHeight, 16);
  assert.deepEqual(list.items.map(item => ({ name: item.name, resourceId: item.resourceId, sourceExpr: item.sourceExpr })), [
    { name: 'open', resourceId: 'icons.open', sourceExpr: '"patch-resource:icons.open"' },
    { name: 'save', resourceId: 'icons.save', sourceExpr: '"patch-resource:icons.save"' }
  ]);
  assert.equal(isNonvisualFormControl('imagelist'), true);
});

test('ImageList compiler transport keeps Change IR 0.10 and advertises ui.imagelist explicitly', () => {
  const compiled = compile(source, { name: 'Images', kind: 'window' });
  assert.equal(compiled.ir.version, '0.10');
  assert.ok(compiled.ir.capabilities.includes('ui.imagelist'));
  const window = compiled.ir.instructions.find(instruction => instruction.code === 'WINDOW');
  const list = window.body.find(instruction => instruction.code === 'UI_CONTROL' && instruction.control === 'imagelist');
  assert.equal(list.logicalWidth, 16);
  assert.equal(list.logicalHeight, 16);
  assert.deepEqual(list.items.map(item => [item.name, item.resourceId]), [['open', 'icons.open'], ['save', 'icons.save']]);
});

test('ImageList item diagnostics retain the exact offending Patch source line', () => {
  const invalid = `window "Images":
  imagelist as app_images size 16, 16:
    image open from "patch-resource:icons.open"
    image open from "patch-resource:icons.other"
`;
  assert.throws(
    () => parse(invalid),
    error => error instanceof PatchSyntaxError && error.line === 4 && /appears more than once/.test(error.message)
  );
});

test('ImageList is Form-level only and cannot be nested into Panel or Tabs Stage 1', () => {
  assert.throws(() => parse(`window "Panel":
  panel as host:
    imagelist as nested size 16, 16:
`), /cannot nest.*ImageList/i);
  assert.throws(() => parse(`window "Tabs":
  tabs as pages:
    tab "One":
      imagelist as nested size 16, 16:
    tab "Two":
      text "Two"
`), /cannot contain.*ImageList/i);
});

test('Designer adds ImageList without geometry or growing an explicitly sized Form', () => {
  const initial = `window "Designer" as main size 420, 120:
  text "Visible" at 24, 24 size 180, 28
`;
  const next = addDesignerControl(initial, 'imagelist', { windowIndex: 0 });
  assert.match(next, /imagelist as imagelist_1 size 16, 16:/);
  assert.doesNotMatch(next, /imagelist as imagelist_1.*\sat\s/);
  assert.match(next, /window "Designer" as main size 420, 120:/);
  const list = listDesignerControls(next).find(control => control.type === 'imagelist');
  assert.equal(list.x, null);
  assert.equal(list.y, null);
  assert.equal(list.logicalWidth, 16);
  assert.equal(list.logicalHeight, 16);
  assert.deepEqual(list.items, []);
});

test('Designer updates ImageList identity size and complete item block as ordinary Patch source', () => {
  const list = listDesignerControls(source).find(control => control.type === 'imagelist');
  const next = updateDesignerControl(source, list, {
    id: 'toolbar_images',
    logicalWidth: 24,
    logicalHeight: 20,
    items: [
      { name: 'new_file', sourceExpr: '"patch-resource:icons.new"' },
      { name: 'open_file', sourceExpr: '"patch-resource:icons.open"' }
    ]
  });
  assert.match(next, /imagelist as toolbar_images size 24, 20:/);
  assert.match(next, /image new_file from "patch-resource:icons\.new"/);
  assert.match(next, /image open_file from "patch-resource:icons\.open"/);
  assert.doesNotMatch(next, /image save from/);
  assert.doesNotThrow(() => parse(next));
});

test('Designer removes the complete ImageList block and leaves neighboring controls intact', () => {
  const list = listDesignerControls(source).find(control => control.type === 'imagelist');
  const next = removeDesignerControl(source, list);
  assert.doesNotMatch(next, /imagelist as app_images/);
  assert.doesNotMatch(next, /image open from/);
  assert.doesNotMatch(next, /image save from/);
  assert.match(next, /button "Open" as open_button/);
  assert.doesNotThrow(() => parse(next));
});

test('ImageList does not consume visible Form geometry or shift following controls', () => {
  const manifest = buildFormLayoutManifest(parse(source));
  assert.equal(manifest.windows[0].controls.length, 2);
  assert.equal(manifest.windows[0].controls[0], null);
  assert.deepEqual(manifest.windows[0].controls[1], { x: 24, y: 24, width: 120, height: 36 });
});

test('ImageList Stage 1 is authoring-only and every runtime target fails closed until a consumer contract exists', () => {
  const component = patchComponent('imagelist');
  assert.deepEqual(component.targetSupport, {
    studio: 'authoring', web: 'unsupported', windows: 'unsupported', macos: 'unsupported', linux: 'unsupported', freebsd: 'unsupported'
  });
  const compiled = compile(source, { name: 'ImageListBoundary', kind: 'window' });
  assert.throws(() => validateWindowRuntimeSupport(compiled), /ImageList is authoring-only in Stage 1/);
  const internal = validateWindowRuntimeSupport(compiled, { allowImageList: true });
  assert.equal(internal.imageLists, 1);
  assert.equal(internal.controls, 2);
});

test('ImageList exposes no events in Stage 1', () => {
  const invalid = `window "Images":
  imagelist as app_images size 16, 16:
when app_images changed:
  show value
`;
  const compiled = compile(invalid, { name: 'ImageListEvents', kind: 'window' });
  assert.throws(
    () => validateWindowRuntimeSupport(compiled, { allowImageList: true }),
    /nonvisual and exposes no Patch events/
  );
});
