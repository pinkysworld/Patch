import test from 'node:test';
import assert from 'node:assert/strict';
import { buildStandaloneWebApp } from '../src/webapp.js';
import { collectPaintBoxDescriptors } from '../src/window-web-paintbox.js';
import { parse } from '../src/parser.js';
import { patchComponent } from '../src/component-registry.js';

const source = `create text label = "Patch"

window "Canvas" as main size 640, 420:
  paintbox as canvas at 24, 24 size 320, 200

when canvas paint:
  draw clear transparent
  draw line 0, 0 to 100, 40 stroke #112233 width 2
  draw rectangle 10, 20 size 80, 40 fill #dbeafe stroke #2563eb width 3
  draw ellipse 120, 20 size 60, 40 fill transparent stroke #334455 width 2
  if true:
    draw text label at 20, 90 color #111827 size 16
  repeat 2:
    draw text count at 20, 120 color #445566 size 12
`;

test('PaintBox descriptors retain pure drawing source and logical source-backed size', () => {
  const descriptors = collectPaintBoxDescriptors(parse(source));
  assert.deepEqual(Object.keys(descriptors), ['canvas']);
  assert.equal(descriptors.canvas.width, 320);
  assert.equal(descriptors.canvas.height, 200);
  assert.equal(descriptors.canvas.body[0].kind, 'drawPaint');
  assert.equal(descriptors.canvas.body[0].command.operation, 'clear');
  assert.equal(descriptors.canvas.body[4].kind, 'if');
  assert.equal(descriptors.canvas.body[4].thenBody[0].command.operation, 'text');
  assert.equal(descriptors.canvas.body[5].kind, 'repeat');
  assert.equal(descriptors.canvas.body[5].body[0].command.textExpr, 'count');
  assert.equal(Object.isFrozen(descriptors), true);
  assert.equal(Object.isFrozen(descriptors.canvas.body), true);
});

test('PaintBox without OnPaint remains a deterministic empty drawing surface', () => {
  const ast = parse(`window "Canvas" as main size 400, 260:\n  paintbox as empty_canvas at 20, 20 size 200, 120\n`);
  const descriptors = collectPaintBoxDescriptors(ast);
  assert.deepEqual(descriptors.empty_canvas.body, []);
  assert.equal(descriptors.empty_canvas.width, 200);
  assert.equal(descriptors.empty_canvas.height, 120);
});

test('Standalone Window Web embeds the pure Canvas2D PaintBox renderer', () => {
  const built = buildStandaloneWebApp(source, { name: 'PaintBoxWeb', kind: 'window' });
  assert.equal(built.metadata.paintBoxStage, 1);
  assert.equal(built.metadata.paintBoxVersion, '0.1');
  assert.equal(built.metadata.paintBoxMode, 'pure-source-backed-canvas2d');
  assert.equal(built.metadata.paintBoxCoordinates, 'source-control-logical-size');
  assert.match(built.html, /data-patch-window-paintbox/);
  assert.match(built.html, /PATCH_PAINTBOX_DESCRIPTORS/);
  assert.match(built.html, /createElement\('canvas'\)/);
  assert.match(built.html, /canvas\.width=Math\.max\(16,Number\(descriptor\.width\)\|\|320\)/);
  assert.match(built.html, /ctx\.clearRect/);
  assert.match(built.html, /ctx\.moveTo/);
  assert.match(built.html, /ctx\.strokeRect/);
  assert.match(built.html, /ctx\.ellipse/);
  assert.match(built.html, /ctx\.fillText/);
  assert.match(built.html, /evaluateExpression\(node\.expr,locals\)/);
  assert.match(built.html, /evaluateLoose\(command\.textExpr,locals\)/);
  assert.match(built.html, /count:index\+1/);
  assert.match(built.html, /renderControl=function\(control,windowId,controlIndex\)/);
  assert.match(built.html, /if\(control\?\.type==='paintbox'\)return patchPaintBoxElement\(control\)/);
  assert.match(built.html, /render\(\);/);
});

test('PaintBox Web support is explicit while native targets remain fail closed', () => {
  assert.deepEqual(patchComponent('paintbox').targetSupport, {
    studio: 'authoring', web: 'supported', windows: 'unsupported', macos: 'unsupported', linux: 'unsupported', freebsd: 'unsupported'
  });
  const built = buildStandaloneWebApp(source, { name: 'PaintBoxBoundary', kind: 'window' });
  assert.equal(built.compiled.ir.capabilities.includes('ui.paintbox'), true);
  assert.equal(built.compiled.ir.capabilities.includes('ui.paintbox-draw'), true);
});

test('PaintBox descriptor JSON is script-safe for text expressions', () => {
  const hostile = `create text label = "safe"
window "Canvas" as main size 400, 260:
  paintbox as canvas at 20, 20 size 200, 120
when canvas paint:
  draw text "</script><script>bad()</script>" at 10, 10 color #000000 size 14
`;
  const built = buildStandaloneWebApp(hostile, { name: 'PaintBoxSafe', kind: 'window' });
  const paintScript = built.html.match(/<script data-patch-window-paintbox>([\s\S]*?)<\/script>/)?.[1] ?? '';
  assert.equal(paintScript.includes('</script><script>bad()'), false);
  assert.match(paintScript, /\\u003c\/script>/);
});
