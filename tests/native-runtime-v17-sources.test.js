import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

test('runtime v1.7 sources wrap v1.6 and decode payload 16 / PPBX', () => {
  const win32 = readFileSync('native-runtime/win32-sealed-gui-v17.cpp', 'utf8');
  const gtk = readFileSync('native-runtime/gtk-sealed-gui-v17.cpp', 'utf8');
  const appkit = readFileSync('native-runtime/appkit-sealed-gui-v17.mm', 'utf8');
  const header = readFileSync('native-runtime/sealed-paintbox-v17.hpp', 'utf8');
  const shapeHeader = readFileSync('native-runtime/sealed-shape-v16.hpp', 'utf8');
  const example = readFileSync('examples/paintbox-window.patch', 'utf8');
  for (const source of [win32, gtk, appkit]) {
    assert.match(source, /version != 16/);
    assert.match(source, /PatchConvertPayloadV16ToV15/);
    assert.match(source, /PATCH_PAINT_ELLIPSE_V17/);
    assert.match(source, /RunPatchPaintBoxSmokeV17/);
    assert.match(source, /sealed-paintbox-v17\.hpp/);
    assert.match(source, /int code = 400/);
  }
  assert.match(win32, /GdiplusStartup/);
  assert.match(win32, /PatchPaintBoxV17/);
  assert.match(gtk, /gtk_drawing_area_new/);
  assert.match(gtk, /cairo_t/);
  assert.match(appkit, /NSBezierPath/);
  assert.match(appkit, /PatchPaintBoxViewV17/);
  assert.match(header, /"PPBX"/);
  assert.match(header, /PATCH_PAINT_TEXT_V17/);
  assert.match(header, /PatchPaintRunProgramV17/);
  assert.match(shapeHeader, /PATCH_WIN32_RUNTIME_V17_RESTORE_ENTRY/);
  assert.match(shapeHeader, /PATCH_RUNTIME_V17_RESTORE_MAIN/);
  assert.match(example, /paintbox as canvas/);
  assert.match(example, /draw clear #ffffff/);
  assert.match(example, /draw rectangle/);
  assert.match(example, /draw ellipse/);
  assert.match(example, /draw line/);
  assert.match(example, /draw text "Tick"/);
  assert.doesNotMatch(example, /draw image/);
});
