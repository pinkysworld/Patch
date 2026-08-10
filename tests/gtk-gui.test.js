import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { compile } from '../src/compiler.js';
import { buildNativeGuiIR } from '../src/native-gui-ir.js';
import { emitGtkGuiCpp } from '../src/gtk-gui.js';

const source = fs.readFileSync(new URL('../examples/forms-navigation.patch', import.meta.url), 'utf8');
const counterSource = fs.readFileSync(new URL('../examples/counter-window.patch', import.meta.url), 'utf8');
const comboSource = fs.readFileSync(new URL('../examples/combo-window.patch', import.meta.url), 'utf8');
const inputSource = `create text name = ""\n\nwindow "Input" as main size 420, 180:\n  input name at 24, 24 size 240, 36\n\nwhen name changed:\n  change name:\n    set = value\n`;

test('GTK backend consumes Native GUI IR v0.2', () => {
  const ir = buildNativeGuiIR(compile(source, { kind: 'window', name: 'NativeGtkNavigation' }));
  assert.equal(ir.format, 'patch-native-gui-ir');
  assert.equal(ir.version, '0.2');
  assert.deepEqual(ir.forms.map(form => [form.id, form.visible]), [['main', true], ['settings', false]]);
  const cpp = emitGtkGuiCpp(ir);
  assert.match(cpp, /gtk_window_new/);
  assert.match(cpp, /gtk_button_new_with_label/);
  assert.match(cpp, /gtk_check_button_new_with_label/);
  assert.match(cpp, /gtk_widget_show_all/);
  assert.match(cpp, /gtk_widget_hide/);
  assert.match(cpp, /gtk_toggle_button_get_active/);
  assert.match(cpp, /g_signal_connect/);
  assert.doesNotMatch(cpp, /BrowserWindow|require\(['"]electron['"]\)|<html|document\.querySelector/);
});

test('GTK backend lowers native Input changed events with typed event-local value', () => {
  const ir = buildNativeGuiIR(compile(inputSource, { kind: 'window', name: 'NativeGtkInput' }));
  const cpp = emitGtkGuiCpp(ir);
  assert.deepEqual(ir.states, [{ name: 'name', type: 'text', initial: '' }]);
  assert.match(cpp, /gtk_entry_new/);
  assert.match(cpp, /g_signal_connect\(control, "changed"/);
  assert.match(cpp, /gtk_entry_get_text\(GTK_ENTRY\(editable\)\)/);
  assert.match(cpp, /patch_state_name = eventValue/);
});

test('GTK backend lowers native ComboBox selection to text changed events', () => {
  const ir = buildNativeGuiIR(compile(comboSource, { kind: 'window', name: 'NativeGtkCombo' }));
  const cpp = emitGtkGuiCpp(ir);
  assert.match(cpp, /gtk_combo_box_text_new/);
  assert.match(cpp, /gtk_combo_box_text_append_text\(GTK_COMBO_BOX_TEXT\(control\), "Small"\)/);
  assert.match(cpp, /gtk_combo_box_text_append_text\(GTK_COMBO_BOX_TEXT\(control\), "Medium"\)/);
  assert.match(cpp, /gtk_combo_box_text_append_text\(GTK_COMBO_BOX_TEXT\(control\), "Large"\)/);
  assert.match(cpp, /gtk_combo_box_text_get_active_text/);
  assert.match(cpp, /gtk_combo_box_set_active/);
  assert.match(cpp, /patch_state_size = eventValue/);
});

test('GTK backend lowers numeric Patch change and text interpolation', () => {
  const ir = buildNativeGuiIR(compile(counterSource, { kind: 'window', name: 'NativeGtkCounter' }));
  const cpp = emitGtkGuiCpp(ir);
  assert.match(cpp, /static double patch_state_count = 0/);
  assert.match(cpp, /patch_state_count \+= 1/);
  assert.match(cpp, /PatchNumber\(patch_state_count\)/);
  assert.match(cpp, /"Count: "/);
});

test('GTK build script emits auditable native source and metadata on every development OS', () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'patch-gtk-emit-'));
  try {
    const result = spawnSync(process.execPath, [
      'scripts/build-native-gtk.js',
      'examples/forms-navigation.patch',
      'NativeGtkSmoke',
      temp,
      '--emit-only'
    ], { cwd: path.resolve('.'), encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr || result.stdout);
    const cpp = fs.readFileSync(path.join(temp, 'NativeGtkSmoke.gtk.cpp'), 'utf8');
    const meta = JSON.parse(fs.readFileSync(path.join(temp, 'NativeGtkSmoke.gtk-build.json'), 'utf8'));
    assert.match(cpp, /Direct native GTK controls/);
    assert.equal(meta.shell, 'native-gtk3');
    assert.equal(meta.electron, false);
    assert.equal(meta.toolkit, 'GTK3');
    assert.equal(meta.nativeGuiIrVersion, '0.2');
    assert.equal(meta.changeIrVersion, '0.10');
    assert.equal(meta.forms, 2);
    assert.equal(meta.events, 3);
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
});
