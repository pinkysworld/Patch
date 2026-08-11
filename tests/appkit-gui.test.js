import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { compile } from '../src/compiler.js';
import { buildNativeGuiIR } from '../src/native-gui-ir.js';
import { emitAppKitGuiObjCpp } from '../src/appkit-gui.js';

const source = fs.readFileSync(new URL('../examples/forms-navigation.patch', import.meta.url), 'utf8');
const counterSource = fs.readFileSync(new URL('../examples/counter-window.patch', import.meta.url), 'utf8');
const comboSource = fs.readFileSync(new URL('../examples/combo-window.patch', import.meta.url), 'utf8');
const listboxSource = fs.readFileSync(new URL('../examples/listbox-window.patch', import.meta.url), 'utf8');
const tabsSource = fs.readFileSync(new URL('../examples/tabs-window.patch', import.meta.url), 'utf8');

test('AppKit backend consumes Native GUI IR v0.5', () => {
  const ir = buildNativeGuiIR(compile(source, { kind: 'window', name: 'NativeMacNavigation' }));
  assert.equal(ir.format, 'patch-native-gui-ir');
  assert.equal(ir.version, '0.5');
  const mm = emitAppKitGuiObjCpp(ir);
  assert.match(mm, /NSWindow/);
  assert.match(mm, /NSButton/);
  assert.match(mm, /NSTextField/);
  assert.match(mm, /handleControl:/);
  assert.doesNotMatch(mm, /BrowserWindow|require\(['"]electron['"]\)|<html|document\.querySelector/);
});

test('AppKit backend lowers native ComboBox selection to text changed events', () => {
  const mm = emitAppKitGuiObjCpp(buildNativeGuiIR(compile(comboSource, { kind: 'window', name: 'NativeMacCombo' })));
  assert.match(mm, /NSPopUpButton/);
  assert.match(mm, /titleOfSelectedItem/);
  assert.match(mm, /selectItemWithTitle:patch_state_size/);
  assert.match(mm, /patch_state_size = \[eventValue copy\]/);
});

test('AppKit backend lowers native ListBox selection to text changed events', () => {
  const mm = emitAppKitGuiObjCpp(buildNativeGuiIR(compile(listboxSource, { kind: 'window', name: 'NativeMacListBox' })));
  for (const marker of ['NSScrollView', 'NSTableView', 'NSTableViewDataSource', 'NSTableViewDelegate', 'tableViewSelectionDidChange', 'selectedRow', 'selectRowIndexes']) assert.ok(mm.includes(marker));
  assert.match(mm, /patch_state_fruit = \[eventValue copy\]/);
});

test('AppKit backend maps Tabs to NSTabView with real page views', () => {
  const mm = emitAppKitGuiObjCpp(buildNativeGuiIR(compile(tabsSource, { kind: 'window', name: 'NativeMacTabs' })));
  for (const marker of ['NSTabView', 'NSTabViewItem', 'gTabPages', 'selectTabViewItemAtIndex', '@"General"', '@"Advanced"']) assert.ok(mm.includes(marker));
  assert.match(mm, /patch_state_name = \[eventValue copy\]/);
  assert.match(mm, /patch_state_notifications = eventValue/);
  assert.doesNotMatch(mm, /patch_state_settings/);
});

test('AppKit backend lowers numeric Patch change and text interpolation', () => {
  const mm = emitAppKitGuiObjCpp(buildNativeGuiIR(compile(counterSource, { kind: 'window', name: 'NativeMacCounter' })));
  assert.match(mm, /static double patch_state_count = 0/);
  assert.match(mm, /patch_state_count \+= 1/);
});

test('AppKit build script emits auditable v0.5 native source and metadata', () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'patch-appkit-emit-'));
  try {
    const result = spawnSync(process.execPath, ['scripts/build-native-appkit.js', 'examples/tabs-window.patch', 'NativeMacTabs', temp, '--emit-only'], { cwd: path.resolve('.'), encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr || result.stdout);
    const mm = fs.readFileSync(path.join(temp, 'NativeMacTabs.appkit.mm'), 'utf8');
    const meta = JSON.parse(fs.readFileSync(path.join(temp, 'NativeMacTabs.appkit-build.json'), 'utf8'));
    assert.match(mm, /NSTabView/);
    assert.equal(meta.shell, 'native-appkit');
    assert.equal(meta.electron, false);
    assert.equal(meta.framework, 'AppKit');
    assert.equal(meta.nativeGuiIrVersion, '0.5');
    assert.equal(meta.changeIrVersion, '0.10');
    assert.equal(meta.forms, 1);
    assert.equal(meta.events, 3);
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
});
