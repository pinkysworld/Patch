import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

test('runtime v1.5 sources wrap v1.4 and decode payload 14 / PCHC', () => {
  const win32 = readFileSync('native-runtime/win32-sealed-gui-v15.cpp', 'utf8');
  const gtk = readFileSync('native-runtime/gtk-sealed-gui-v15.cpp', 'utf8');
  const appkit = readFileSync('native-runtime/appkit-sealed-gui-v15.mm', 'utf8');
  const header = readFileSync('native-runtime/sealed-chrome-v15.hpp', 'utf8');
  for (const source of [win32, gtk, appkit]) {
    assert.match(source, /version != 14/);
    assert.match(source, /PatchConvertPayloadV14ToV13/);
    assert.match(source, /PATCH_CHROME_TIMER_V15/);
    assert.match(source, /RunPatchChromeSmokeV15/);
  }
  assert.match(win32, /BS_GROUPBOX/);
  assert.match(win32, /SetTimer/);
  assert.match(gtk, /gtk_frame_new/);
  assert.match(appkit, /NSTimer/);
  assert.match(header, /"PCHC"/);
});
