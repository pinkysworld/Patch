import test from 'node:test';
import assert from 'node:assert/strict';
import { parse, PatchSyntaxError } from '../src/parser.js';
import { compile } from '../src/compiler.js';
import { PatchInterpreter } from '../src/interpreter.js';
import { addDesignerControl, listDesignerControls, updateDesignerControl } from '../src/designer.js';
import { buildCurrentNativeGuiIR } from '../src/native-current-contract.js';
import { buildStandaloneWebApp } from '../src/webapp.js';
import { validateWindowRuntimeSupport } from '../src/window-build.js';
import { patchComponent } from '../src/component-registry.js';

const SOURCE = `window "Files" as main size 420, 220:
  imagelist as app_images size 16, 16:
    image open from "patch-resource:icons.open"
    image save from "patch-resource:icons.save"
  button "Open" as open_button image app_images.open at 24, 24 size 120, 36
`;

const RESOURCE = Object.freeze({
  id: 'icons.open',
  path: 'resources/open.png',
  mediaType: 'image/png',
  size: 1,
  sha256: '0'.repeat(64),
  data: 'AA=='
});

test('Button ImageList bindings parse through ordinary Patch source', () => {
  const button = parse(SOURCE)[0].body[1];
  assert.equal(button.control, 'button');
  assert.equal(button.id, 'open_button');
  assert.equal(button.textExpr, '"Open"');
  assert.equal(button.imageListId, 'app_images');
  assert.equal(button.imageItem, 'open');
});

test('Button image diagnostics retain the exact offending Patch source line', () => {
  assert.throws(
    () => parse(`window "Files":
  button "Open" as open_button image app_images
`),
    error => error instanceof PatchSyntaxError && error.line === 2 && /ImageList\.item/.test(error.message)
  );
});

test('compiler transports Button image bindings on Change IR 0.10 without a native IR bump', () => {
  const compiled = compile(SOURCE, { name: 'Files', kind: 'window' });
  assert.equal(compiled.ir.version, '0.10');
  assert.ok(compiled.ir.capabilities.includes('ui.imagelist'));
  assert.ok(compiled.ir.capabilities.includes('ui.button-image'));
  const window = compiled.ir.instructions.find(instruction => instruction.code === 'WINDOW');
  const button = window.body.find(instruction => instruction.code === 'UI_CONTROL' && instruction.control === 'button');
  assert.equal(button.imageListId, 'app_images');
  assert.equal(button.imageItem, 'open');
});

test('interpreter exposes resolved Button image metadata on the shared Studio UI model', () => {
  const result = new PatchInterpreter().run(SOURCE);
  const button = result.ui[0].controls.find(control => control.type === 'button');
  assert.equal(button.imageListId, 'app_images');
  assert.equal(button.imageItem, 'open');
  assert.equal(button.imageSource, 'patch-resource:icons.open');
  assert.equal(button.imageWidth, 16);
  assert.equal(button.imageHeight, 16);
});

test('Designer round-trips Button image bindings as ordinary source and omits them by default', () => {
  const added = addDesignerControl('window "Files" as form_1 size 640, 420:\n', 'button', { windowIndex: 0 });
  assert.match(added, /button "Button" as button_1 at 24, 24 size 120, 36/);
  assert.doesNotMatch(added, / image /);
  const button = listDesignerControls(added).find(control => control.type === 'button');
  assert.equal(button.imageListId, undefined);
  assert.equal(button.imageItem, undefined);
  const next = updateDesignerControl(added, button, { textExpr: '"Open"', image: 'app_images.open' });
  assert.match(next, /button "Open" as button_1 image app_images.open at 24, 24 size 120, 36/);
  const cleared = updateDesignerControl(next, listDesignerControls(next)[0], { image: '' });
  assert.match(cleared, /button "Open" as button_1 at 24, 24 size 120, 36/);
  assert.doesNotMatch(cleared, / image /);
});

test('Window validation resolves Button image bindings and fail-closes missing lists or items', () => {
  const compiled = compile(SOURCE, { name: 'Files', kind: 'window' });
  const web = validateWindowRuntimeSupport(compiled, { allowImageList: true });
  assert.equal(web.imageLists, 1);
  assert.equal(web.buttonImages, 1);
  assert.throws(() => validateWindowRuntimeSupport(compiled), /ImageList is not enabled for this Window target/);

  const missingList = compile(`window "Files":
  button "Open" as open_button image missing.open
`, { name: 'MissingList', kind: 'window' });
  assert.throws(
    () => validateWindowRuntimeSupport(missingList, { allowImageList: true }),
    /ImageList 'missing' that is not defined on this Form/
  );

  const missingItem = compile(`window "Files":
  imagelist as app_images size 16, 16:
    image open from "patch-resource:icons.open"
  button "Open" as open_button image app_images.save
`, { name: 'MissingItem', kind: 'window' });
  assert.throws(
    () => validateWindowRuntimeSupport(missingItem, { allowImageList: true }),
    /ImageList item 'save' that is not in 'app_images'/
  );
});

test('Standalone Web allows ImageList metadata and renders Button images', () => {
  const built = buildStandaloneWebApp(SOURCE, {
    name: 'Files',
    kind: 'window',
    resources: [RESOURCE]
  });
  assert.equal(built.metadata.buttonImageStage, 1);
  assert.match(built.html, /imageListId:node.control==='button'/);
  assert.match(built.html, /className='patch-button-image'/);
  assert.match(built.html, /patchPictureSource\(control.imageSource\)/);
  assert.match(built.html, /"icons.open":\{"mediaType":"image\/png","data":"AA=="\}/);
});

test('Standalone Web fails closed when a Button image names a missing project resource', () => {
  assert.throws(
    () => buildStandaloneWebApp(SOURCE, { name: 'Files', kind: 'window', resources: [] }),
    /Button 'open_button' image app_images.open references missing project resource 'icons.open'/
  );
});

test('Current Ready native GUI transports Button ImageList bindings on IR 1.9', () => {
  const ir = buildCurrentNativeGuiIR(compile(SOURCE, { name: 'Files', kind: 'window', entry: 'main.patch' }));
  assert.equal(ir.version, '1.9');
  const button = ir.forms[0].controls.find(control => control.type === 'button');
  assert.equal(button.id, 'open_button');
  assert.equal(button.image.resourceId, 'icons.open');
  assert.equal(button.image.imageListId, 'app_images');
  assert.equal(button.image.imageItem, 'open');

  const plain = compile(`window "Files":
  button "Open" as open_button
`, { name: 'Plain', kind: 'window', entry: 'main.patch' });
  const plainIr = buildCurrentNativeGuiIR(plain);
  assert.equal(plainIr.version, '1.9');
  assert.equal(plainIr.forms[0].controls.find(control => control.type === 'button').id, 'open_button');
});

test('ImageList is Ready on Web and the three desktop native targets', () => {
  const imagelist = patchComponent('imagelist');
  assert.deepEqual(imagelist.targetSupport, {
    studio: 'supported', web: 'supported', windows: 'supported', macos: 'supported', linux: 'supported', freebsd: 'unsupported'
  });
  const button = patchComponent('button');
  assert.deepEqual(button.properties.map(property => property.name), [
    'id', 'textExpr', 'imageListId', 'imageItem', 'x', 'y', 'width', 'height'
  ]);
});
