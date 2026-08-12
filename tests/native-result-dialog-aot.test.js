import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { compile } from '../src/compiler.js';
import { buildNativeGuiIR } from '../src/native-gui-ir.js';
import { emitWin32GuiCpp, PATCH_WIN32_GUI_BACKEND_VERSION } from '../src/win32-gui-v07.js';
import { emitAppKitGuiObjCpp, PATCH_APPKIT_GUI_BACKEND_VERSION } from '../src/appkit-gui-v07.js';
import { emitGtkGuiCpp, PATCH_GTK_GUI_BACKEND_VERSION } from '../src/gtk-gui-v07.js';

const source = fs.readFileSync('examples/result-dialog-window.patch', 'utf8');
const ir = buildNativeGuiIR(compile(source, { name: 'ResultDialogAot', kind: 'window' }));

test('Win32 AOT v0.7 uses native confirmation and common file dialogs', () => {
  assert.equal(PATCH_WIN32_GUI_BACKEND_VERSION, '0.7');
  const code = emitWin32GuiCpp(ir);
  assert.match(code, /MessageBoxW/);
  assert.match(code, /MB_YESNO/);
  assert.match(code, /GetOpenFileNameW/);
  assert.match(code, /GetSaveFileNameW/);
  assert.match(code, /comdlg32\.lib/);
  assert.match(code, /PatchResult_open_result_chosen/);
  assert.match(code, /PatchResult_reset_confirm_confirmed/);
  assert.match(code, /C:\\\\Patch\\\\opened\.patch/);
});

test('AppKit AOT v0.7 uses NSAlert and native Open/Save panels', () => {
  assert.equal(PATCH_APPKIT_GUI_BACKEND_VERSION, '0.7');
  const code = emitAppKitGuiObjCpp(ir);
  assert.match(code, /NSAlert/);
  assert.match(code, /NSOpenPanel/);
  assert.match(code, /NSSavePanel/);
  assert.match(code, /NSModalResponseOK/);
  assert.match(code, /PatchResult_open_result_chosen/);
  assert.match(code, /\/tmp\/patch-opened\.patch/);
});

test('GTK AOT v0.7 uses GtkMessageDialog and GtkFileChooserDialog', () => {
  assert.equal(PATCH_GTK_GUI_BACKEND_VERSION, '0.7');
  const code = emitGtkGuiCpp(ir);
  assert.match(code, /gtk_message_dialog_new/);
  assert.match(code, /GTK_BUTTONS_YES_NO/);
  assert.match(code, /gtk_file_chooser_dialog_new/);
  assert.match(code, /GTK_FILE_CHOOSER_ACTION_OPEN/);
  assert.match(code, /GTK_FILE_CHOOSER_ACTION_SAVE/);
  assert.match(code, /PatchResult_open_result_chosen/);
  assert.match(code, /\/tmp\/patch-opened\.patch/);
});
