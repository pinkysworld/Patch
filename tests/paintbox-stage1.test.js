import test from 'node:test';
import assert from 'node:assert/strict';
import { compile } from '../src/compiler.js';
import { parse, PatchSyntaxError } from '../src/parser.js';
import { PatchInterpreter } from '../src/interpreter.js';
import { validateWindowRuntimeSupport } from '../src/window-build.js';
import { patchComponent } from '../src/component-registry.js';
import {
  addDesignerPaintBox,
  listDesignerPaintBoxes,
  removeDesignerPaintBox,
  updateDesignerPaintBox
} from '../src/designer-paintbox.js';

const source = `create number count = 2

window "Canvas" as main size 640, 420:
  paintbox as canvas at 24, 24 size 320, 200

when canvas paint:
  draw clear #ffffff
  draw rectangle 10, 12 size 100, 50 fill #ff0000 stroke #000000 width 2
  if true:
    draw line 0, 0 to 100, 100 stroke #000000 width 1
  repeat 2:
    draw text "Tick" at 12, 20 color #111111 size 14
`;

test('PaintBox declaration and pure paint program are source-visible parser nodes', () => {
  const ast = parse(source);
  const window = ast.find(node => node.kind === 'window');
  const paintbox = window.body.find(node => node.kind === 'uiControl' && node.control === 'paintbox');
  assert.ok(paintbox);
  assert.equal(paintbox.id, 'canvas');
  assert.deepEqual(paintbox.layout, { x: 24, y: 24, width: 320, height: 200 });

  const event = ast.find(node => node.kind === 'event' && node.control === 'canvas');
  assert.equal(event.event, 'paint');
  assert.equal(event.body[0].kind, 'drawPaint');
  assert.deepEqual(event.body[0].command, { operation: 'clear', color: '#ffffff' });
  assert.equal(event.body[1].command.operation, 'rectangle');
  assert.equal(event.body[2].kind, 'if');
  assert.equal(event.body[2].thenBody[0].command.operation, 'line');
  assert.equal(event.body[3].kind, 'repeat');
  assert.equal(event.body[3].body[0].command.operation, 'text');
});

test('compiler lowers PaintBox drawing explicitly without changing Change IR version', () => {
  const compiled = compile(source, { name: 'PaintBoxStage1', kind: 'window' });
  assert.equal(compiled.ir.version, '0.10');
  assert.equal(compiled.ir.capabilities.includes('ui.paintbox'), true);
  assert.equal(compiled.ir.capabilities.includes('ui.paintbox-draw'), true);
  const event = compiled.ir.instructions.find(instruction => instruction.code === 'EVENT' && instruction.control === 'canvas');
  assert.equal(event.event, 'paint');
  assert.equal(event.body[0].code, 'DRAW_PAINT');
  assert.equal(event.body[0].command.operation, 'clear');
});

test('interpreter can inspect PaintBox UI without executing paint commands implicitly', () => {
  const result = new PatchInterpreter().run(source);
  const canvas = result.ui[0].controls.find(control => control.type === 'paintbox');
  assert.ok(canvas);
  assert.equal(canvas.id, 'canvas');
  assert.equal(result.state.count, 2);
});

test('draw commands fail closed outside an OnPaint handler', () => {
  assert.throws(
    () => parse('draw clear #ffffff\n'),
    error => error instanceof PatchSyntaxError && /draw command belongs only inside a PaintBox paint handler/i.test(error.message)
  );
});

test('PaintBox Stage 1 paint handlers cannot mutate persistent application state', () => {
  const invalid = `create number count = 0
window "Canvas" as main size 320, 240:
  paintbox as canvas at 20, 20 size 200, 120
when canvas paint:
  change count:
    add 1
`;
  assert.throws(
    () => parse(invalid),
    error => error instanceof PatchSyntaxError && /may contain only draw, if and repeat/i.test(error.message) && error.line === 5
  );
});

test('invalid PaintBox drawing keeps the original Patch source line', () => {
  const invalid = `window "Canvas" as main size 320, 240:
  paintbox as canvas at 20, 20 size 200, 120
when canvas paint:
  draw rectangle 0, 0 size 0, 10 fill #ffffff stroke #000000 width 1
`;
  assert.throws(
    () => parse(invalid),
    error => error instanceof PatchSyntaxError && error.line === 4 && /width must be greater than zero/i.test(error.message)
  );
});

test('PaintBox target support remains authoring-only until renderer contracts land', () => {
  const component = patchComponent('paintbox');
  assert.deepEqual(component.targetSupport, {
    studio: 'authoring', web: 'unsupported', windows: 'unsupported', macos: 'unsupported', linux: 'unsupported', freebsd: 'unsupported'
  });
  const compiled = compile(source, { name: 'PaintBoxBoundary', kind: 'window' });
  assert.throws(
    () => validateWindowRuntimeSupport(compiled, { allowTree: true, allowSlider: true, allowMenuDecorations: true }),
    /paintbox.*paint/i
  );
});

test('source-backed PaintBox Designer add update rename and delete preserve OnPaint source', () => {
  const initial = `window "Designer" as main size 640, 420:
  text "Header" at 24, 24 size 200, 30
`;
  const added = addDesignerPaintBox(initial, { id: 'canvas', x: 40, y: 80 });
  assert.match(added.source, /paintbox as canvas at 40, 80 size 320, 200/);
  assert.deepEqual(
    listDesignerPaintBoxes(added.source).map(item => ({ id: item.id, x: item.x, y: item.y, width: item.width, height: item.height })),
    [{ id: 'canvas', x: 40, y: 80, width: 320, height: 200 }]
  );

  const withPaint = `${added.source}\nwhen canvas paint:\n  draw clear #ffffff\n`;
  const current = listDesignerPaintBoxes(withPaint)[0];
  const updated = updateDesignerPaintBox(withPaint, current, { id: 'preview_canvas', width: 360, height: 220 });
  assert.match(updated.source, /paintbox as preview_canvas at 40, 80 size 360, 220/);
  assert.match(updated.source, /when preview_canvas paint:/);
  assert.doesNotMatch(updated.source, /when canvas paint:/);

  const removed = removeDesignerPaintBox(updated.source, updated.paintbox);
  assert.doesNotMatch(removed, /paintbox as preview_canvas/);
  assert.doesNotMatch(removed, /when preview_canvas paint:/);
  assert.doesNotThrow(() => parse(removed));
});

test('Designer PaintBox ids and dimensions fail closed', () => {
  const initial = `window "Designer" as main size 640, 420:\n`;
  assert.throws(() => addDesignerPaintBox(initial, { id: 'not-valid!', width: 320, height: 200 }), /valid Patch name/);
  assert.throws(() => addDesignerPaintBox(initial, { id: 'canvas', width: 8, height: 200 }), /at least 16/);

  const first = addDesignerPaintBox(initial, { id: 'canvas' });
  assert.throws(() => addDesignerPaintBox(first.source, { id: 'canvas' }), /already used/);
});
