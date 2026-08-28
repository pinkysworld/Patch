import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

test('runtime v1.6 sources wrap v1.5 and decode payload 15 / PSHP', () => {
  const win32 = readFileSync('native-runtime/win32-sealed-gui-v16.cpp', 'utf8');
  const gtk = readFileSync('native-runtime/gtk-sealed-gui-v16.cpp', 'utf8');
  const appkit = readFileSync('native-runtime/appkit-sealed-gui-v16.mm', 'utf8');
  const chromeHeader = readFileSync('native-runtime/sealed-chrome-v15.hpp', 'utf8');
  const header = readFileSync('native-runtime/sealed-shape-v16.hpp', 'utf8');
  const example = readFileSync('examples/shape-window.patch', 'utf8');
  for (const source of [win32, gtk, appkit]) {
    assert.match(source, /version != 15/);
    assert.match(source, /PatchConvertPayloadV15ToV14/);
    assert.match(source, /PATCH_SHAPE_ELLIPSE_V16/);
    assert.match(source, /RunPatchShapeSmokeV16/);
    assert.match(source, /sealed-shape-v16\.hpp/);
  }
  assert.match(win32, /PATCH_WIN32_RUNTIME_V16_RESTORE_ENTRY PatchRuntimeV15CompatibilityMain/);
  assert.match(gtk, /PATCH_RUNTIME_V16_RESTORE_MAIN PatchRuntimeV15CompatibilityMain/);
  assert.match(appkit, /PATCH_RUNTIME_V16_RESTORE_MAIN PatchRuntimeV15CompatibilityMain/);
  assert.match(chromeHeader, /#ifdef PATCH_WIN32_RUNTIME_V16_RESTORE_ENTRY\s+#define wWinMain PATCH_WIN32_RUNTIME_V16_RESTORE_ENTRY/);
  assert.match(chromeHeader, /#ifdef PATCH_RUNTIME_V16_RESTORE_MAIN\s+#define main PATCH_RUNTIME_V16_RESTORE_MAIN/);
  assert.match(win32, /GdiplusStartup/);
  assert.match(win32, /GraphicsPath/);
  assert.match(win32, /PatchShapeV16/);
  assert.match(gtk, /gtk_drawing_area_new/);
  assert.match(gtk, /cairo_t/);
  assert.match(appkit, /NSBezierPath/);
  assert.match(appkit, /PatchShapeViewV16/);
  assert.match(header, /"PSHP"/);
  assert.match(header, /PATCH_SHAPE_ROUNDED_V16/);
  assert.match(example, /shape rounded as card/);
  assert.match(example, /shape ellipse as badge/);
  assert.match(example, /shape line as divider/);
});

test('Win32 Shape geometry is type-safe and clamps rounded radii like Web, AppKit and GTK', () => {
  const win32 = readFileSync('native-runtime/win32-sealed-gui-v16.cpp', 'utf8');
  assert.match(win32, /std::max\(1, static_cast<int>\(points\[1\]\.x - points\[0\]\.x\)\)/);
  assert.match(win32, /std::max\(1, static_cast<int>\(points\[1\]\.y - points\[0\]\.y\)\)/);
  assert.match(win32, /std::min\(cornerRadius \* width \/ 100\.0, \(double\)w \/ 2\.0\)/);
  assert.match(win32, /std::min\(cornerRadius \* height \/ 100\.0, \(double\)h \/ 2\.0\)/);
});
