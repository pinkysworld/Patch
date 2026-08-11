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
const listboxSource = fs.readFileSync(new URL('../examples/listbox-window.patch', import.meta.url), 'utf8');
const tabsSource = fs.readFileSync(new URL('../examples/tabs-window.patch', import.meta.url), 'utf8');
const inputSource = `create text name = ""\n\nwindow "Input" as main size 420, 180:\n  input name at 24, 24 size 240, 36\n\nwhen name changed:\n  change name:\n    set = value\n`;

test('GTK backend consumes Native GUI IR v0.5', () => {
  const ir = buildNativeGuiIR(compile(source, { kind: 'window', name: 'NativeGtkNavigation' }));
  assert.equal(ir.format, 'patch-native-gui-ir');
  assert.equal(ir.version, '0.5');
  assert.deepEqual(ir.forms.map(form => [form.id, form.visible]), [['main', true], ['settings', false]]);
  const cpp = emitGtkGuiCpp(ir);
  assert.match(cpp, /gtk_window_new/);
  assert.match(cpp, /gtk_button_new_with_label/);
  assert.match(cpp, /gtk_check_button_new_with_label/);
  assert.match(cpp, /gtk_toggle_button_get_active/);
  assert.doesNotMatch(cpp, /BrowserWindow|require\(['"]electron['"]\)|<html|document\.querySelector/);
});

test('GTK backend lowers native Input changed events with typed event-local value', () => {
  const cpp = emitGtkGuiCpp(buildNativeGuiIR(compile(inputSource, { kind: 'window', name: 'NativeGtkInput' })));
  assert.match(cpp, /gtk_entry_new/);
  assert.match(cpp, /g_signal_connect\(control, "changed"/);
  assert.match(cpp, /patch_state_name = eventValue/);
});

test('GTK backend lowers native ComboBox selection to text changed events', () => {
  const cpp = emitGtkGuiCpp(buildNativeGuiIR(compile(comboSource, { kind: 'window', name: 'NativeGtkCombo' })));
  for (const marker of ['gtk_combo_box_text_new', 'gtk_combo_box_text_get_active_text', 'gtk_combo_box_set_active', 'patch_state_size = eventValue']) assert.ok(cpp.includes(marker));
});

test('GTK backend lowers native ListBox selection to text changed events', () => {
  const cpp = emitGtkGuiCpp(buildNativeGuiIR(compile(listboxSource, { kind: 'window', name: 'NativeGtkListBox' })));
  for (const marker of ['gtk_list_box_new', 'GTK_SELECTION_SINGLE', 'row-selected', 'gtk_list_box_get_row_at_index', 'gtk_list_box_select_row', 'patch_state_fruit = eventValue']) assert.ok(cpp.includes(marker));
});

test('GTK backend maps Tabs to GtkNotebook with real page containers', () => {
  const cpp = emitGtkGuiCpp(buildNativeGuiIR(compile(tabsSource, { kind: 'window', name: 'NativeGtkTabs' })));
  for (const marker of ['gtk_notebook_new', 'gtk_notebook_append_page', 'gTabPages', 'gtk_notebook_set_current_page', '"General"', '"Advanced"']) assert.ok(cpp.includes(marker));
  assert.match(cpp, /patch_state_name = eventValue/);
  assert.match(cpp, /patch_state_notifications = eventValue/);
  assert.doesNotMatch(cpp, /patch_state_settings/);
});

test('GTK backend lowers numeric Patch change and text interpolation', () => {
  const cpp = emitGtkGuiCpp(buildNativeGuiIR(compile(counterSource, { kind: 'window', name: 'NativeGtkCounter' })));
  assert.match(cpp, /static double patch_state_count = 0/);
  assert.match(cpp, /patch_state_count \+= 1/);
});

test('GTK build script emits auditable v0.5 native source and metadata', () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'patch-gtk-emit-'));
  try {
    const result = spawnSync(process.execPath, ['scripts/build-native-gtk.js', 'examples/tabs-window.patch', 'NativeGtkTabs', temp, '--emit-only'], { cwd: path.resolve('.'), encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr || result.stdout);
    const cpp = fs.readFileSync(path.join(temp, 'NativeGtkTabs.gtk.cpp'), 'utf8');
    const meta = JSON.parse(fs.readFileSync(path.join(temp, 'NativeGtkTabs.gtk-build.json'), 'utf8'));
    assert.match(cpp, /gtk_notebook_new/);
    assert.equal(meta.shell, 'native-gtk3');
    assert.equal(meta.electron, false);
    assert.equal(meta.toolkit, 'GTK3');
    assert.equal(meta.nativeGuiIrVersion, '0.5');
    assert.equal(meta.changeIrVersion, '0.10');
    assert.equal(meta.forms, 1);
    assert.equal(meta.events, 3);
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
});
