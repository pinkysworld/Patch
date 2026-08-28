import test from 'node:test';
import assert from 'node:assert/strict';
import { parse, PatchSyntaxError } from '../src/parser.js';
import { compile } from '../src/compiler.js';
import { PatchInterpreter } from '../src/interpreter.js';
import { addDesignerControl, listDesignerControls, updateDesignerControl } from '../src/designer.js';
import { buildCurrentNativeGuiIR } from '../src/native-current-contract.js';
import { NativeGuiError } from '../src/native-gui-frozen-lower.js';
import { buildStandaloneWebApp } from '../src/webapp.js';
import { patchComponent } from '../src/component-registry.js';

const DISPLAY = `window "Gallery" as main size 420, 260:
  picture as hero from "images/hero.png" fit cover center false opacity 0.5 description "Hero" at 24, 24 size 180, 120
`;

test('Picture display properties parse through ordinary Patch source', () => {
  const picture = parse(DISPLAY)[0].body[0];
  assert.equal(picture.control, 'picture');
  assert.equal(picture.id, 'hero');
  assert.equal(picture.sourceExpr, '"images/hero.png"');
  assert.equal(picture.fit, 'cover');
  assert.equal(picture.center, false);
  assert.equal(picture.opacity, 0.5);
  assert.equal(picture.description, 'Hero');
  assert.equal(picture.proportional, true);
  assert.equal(picture.textExpr, '"Hero"');
});

test('Picture display property diagnostics retain the exact offending Patch source line', () => {
  assert.throws(
    () => parse(`create number n = 1
window "Gallery":
  picture as bad fit stretch
`),
    error => error instanceof PatchSyntaxError && error.line === 3 && /contain, cover, fill or none/.test(error.message)
  );
});

test('compiler transports Picture display properties on Change IR 0.10 without a native IR bump', () => {
  const compiled = compile(DISPLAY, { name: 'Gallery', kind: 'window' });
  assert.equal(compiled.ir.version, '0.10');
  assert.ok(compiled.ir.capabilities.includes('ui.picture'));
  const window = compiled.ir.instructions.find(instruction => instruction.code === 'WINDOW');
  const picture = window.body.find(instruction => instruction.code === 'UI_CONTROL' && instruction.control === 'picture');
  assert.equal(picture.fit, 'cover');
  assert.equal(picture.center, false);
  assert.equal(picture.opacity, 0.5);
  assert.equal(picture.description, 'Hero');
  assert.equal(picture.sourceExpr, '"images/hero.png"');
});

test('interpreter exposes Picture display properties on the shared Studio UI model', () => {
  const result = new PatchInterpreter().run(DISPLAY);
  const picture = result.ui[0].controls[0];
  assert.equal(picture.type, 'picture');
  assert.equal(picture.source, 'images/hero.png');
  assert.equal(picture.fit, 'cover');
  assert.equal(picture.center, false);
  assert.equal(picture.opacity, 0.5);
  assert.equal(picture.description, 'Hero');
  assert.equal(picture.text, 'Hero');
});

test('Designer round-trips Picture display properties as ordinary source and keeps omitted defaults', () => {
  const added = addDesignerControl('window "Gallery" as form_1 size 640, 420:\n', 'picture', { windowIndex: 0 });
  assert.match(added, /picture as picture_1 at 24, 24 size 180, 120/);
  const picture = listDesignerControls(added).find(control => control.type === 'picture');
  const next = updateDesignerControl(added, picture, {
    sourceExpr: '"images/hero.png"',
    fit: 'cover',
    center: false,
    opacity: 0.5,
    description: 'Hero'
  });
  assert.match(next, /picture as picture_1 from "images\/hero\.png" fit cover center false opacity 0\.5 description "Hero" at 24, 24 size 180, 120/);
  const proportional = updateDesignerControl(next, listDesignerControls(next)[0], { proportional: false });
  assert.match(proportional, /fit fill center false opacity 0\.5 description "Hero"/);
  assert.doesNotMatch(proportional, /fit cover/);
});

test('Standalone Web applies source-backed Picture fit, center, opacity and accessible description', () => {
  const built = buildStandaloneWebApp(DISPLAY, { name: 'Gallery', kind: 'window' });
  assert.match(built.html, /fit:node\.control==='picture'/);
  assert.match(built.html, /el\.style\.objectFit=control\.fit\|\|'contain'/);
  assert.match(built.html, /el\.style\.objectPosition=control\.center===false\?'0% 0%':'50% 50%'/);
  assert.match(built.html, /el\.style\.opacity=/);
  assert.match(built.html, /setAttribute\('aria-label'/);
  assert.match(built.html, /control\.description/);
});

test('native GUI 1.4 keeps default Picture display and fail-closes non-default fit, center and opacity', () => {
  const defaults = compile(`window "Photos":\n  picture as logo from "images/logo.png" description "Logo"\n`, {
    name: 'Photos',
    kind: 'window',
    entry: 'main.patch'
  });
  const ir = buildCurrentNativeGuiIR(defaults);
  const picture = ir.forms[0].controls.find(control => control.type === 'picture');
  assert.equal(picture.source, 'images/logo.png');
  assert.equal(picture.text, 'Logo');
  assert.equal(picture.fit, undefined);
  assert.equal(ir.version, '1.8');

  assert.throws(
    () => buildCurrentNativeGuiIR(compile(DISPLAY, { name: 'Gallery', kind: 'window', entry: 'main.patch' })),
    error => error instanceof NativeGuiError && /does not transport fit cover, center false, opacity 0\.5/.test(error.message)
  );
});

test('Picture registry lists display properties without claiming native non-default transport', () => {
  const picture = patchComponent('picture');
  assert.deepEqual(picture.properties.map(property => property.name), [
    'id', 'sourceExpr', 'fit', 'center', 'opacity', 'description', 'x', 'y', 'width', 'height'
  ]);
  assert.equal(picture.properties.find(property => property.name === 'fit').kind, 'enum');
  assert.deepEqual(picture.targetSupport, {
    studio: 'supported', web: 'supported', windows: 'supported', macos: 'supported', linux: 'supported', freebsd: 'unsupported'
  });
});
