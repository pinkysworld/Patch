import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { compile } from '../src/compiler.js';
import { buildNativeGuiIR, NativeGuiError } from '../src/native-gui-ir.js';
import { emitWin32GuiCpp } from '../src/win32-gui.js';

const source = fs.readFileSync(new URL('../examples/forms-navigation.patch', import.meta.url), 'utf8');
const counterSource = fs.readFileSync(new URL('../examples/counter-window.patch', import.meta.url), 'utf8');
const comboSource = fs.readFileSync(new URL('../examples/combo-window.patch', import.meta.url), 'utf8');
const listboxSource = fs.readFileSync(new URL('../examples/listbox-window.patch', import.meta.url), 'utf8');
const tabsSource = fs.readFileSync(new URL('../examples/tabs-window.patch', import.meta.url), 'utf8');

test('native GUI IR v0.7 lowers simple Patch Forms without changing source syntax', () => {
  const compiled = compile(source, { kind: 'window', name: 'NativeNavigation', entry: 'forms-navigation.patch' });
  const ir = buildNativeGuiIR(compiled);
  assert.equal(ir.format, 'patch-native-gui-ir');
  assert.equal(ir.version, '0.7');
  assert.deepEqual(ir.forms.map(form => [form.id, form.visible]), [['main', true], ['settings', false]]);
  assert.deepEqual(ir.states, [{ name: 'notifications', type: 'boolean', initial: false }]);
  assert.equal(ir.forms[1].controls.find(control => control.id === 'notifications').type, 'checkbox');
  assert.deepEqual(ir.events.map(event => [event.control, event.event]), [['open_settings', 'clicked'], ['close_settings', 'clicked'], ['notifications', 'changed']]);
});

test('Win32 backend emits native windows and controls without Electron runtime code', () => {
  const cpp = emitWin32GuiCpp(buildNativeGuiIR(compile(source, { kind: 'window', name: 'NativeNavigation' })));
  assert.match(cpp, /CreateWindowExW/);
  assert.match(cpp, /WS_OVERLAPPEDWINDOW/);
  assert.match(cpp, /BS_AUTOCHECKBOX/);
  assert.match(cpp, /WM_COMMAND/);
  assert.match(cpp, /BM_GETCHECK/);
  assert.doesNotMatch(cpp, /BrowserWindow|require\(['"]electron['"]\)|<html|document\.querySelector/);
});

test('Win32 backend lowers native ComboBox selection to text changed events', () => {
  const cpp = emitWin32GuiCpp(buildNativeGuiIR(compile(comboSource, { kind: 'window', name: 'NativeWinCombo' })));
  for (const marker of ['L"COMBOBOX"', 'CBS_DROPDOWNLIST', 'CB_ADDSTRING', 'CBN_SELCHANGE', 'CB_GETCURSEL', 'CB_GETLBTEXT', 'CB_SETCURSEL', 'patch_state_size = eventValue']) assert.ok(cpp.includes(marker));
});

test('Win32 backend lowers native ListBox selection to text changed events', () => {
  const cpp = emitWin32GuiCpp(buildNativeGuiIR(compile(listboxSource, { kind: 'window', name: 'NativeWinListBox' })));
  for (const marker of ['L"LISTBOX"', 'LBS_NOTIFY', 'LB_ADDSTRING', 'LBN_SELCHANGE', 'LB_GETCURSEL', 'LB_GETTEXT', 'LB_SETCURSEL', 'patch_state_fruit = eventValue']) assert.ok(cpp.includes(marker));
});

test('Win32 backend maps Tabs to common controls with transient page selection', () => {
  const cpp = emitWin32GuiCpp(buildNativeGuiIR(compile(tabsSource, { kind: 'window', name: 'NativeWinTabs' })));
  for (const marker of ['WC_TABCONTROLW', 'TCM_INSERTITEMW', 'TCN_SELCHANGE', 'WM_NOTIFY', 'ICC_TAB_CLASSES', 'gTabSelection', 'RefreshTabVisibility', 'L"General"', 'L"Advanced"']) assert.ok(cpp.includes(marker));
  assert.match(cpp, /patch_state_name = eventValue/);
  assert.match(cpp, /patch_state_notifications = eventValue/);
  assert.doesNotMatch(cpp, /patch_state_settings/);
});

test('Win32 backend lowers numeric Patch change and interpolation directly', () => {
  const ir = buildNativeGuiIR(compile(counterSource, { kind: 'window', name: 'NativeCounter' }));
  const cpp = emitWin32GuiCpp(ir);
  assert.deepEqual(ir.states, [{ name: 'count', type: 'number', initial: 0 }]);
  assert.match(cpp, /static double patch_state_count = 0/);
  assert.match(cpp, /patch_state_count \+= 1/);
  assert.match(cpp, /PatchNumber\(patch_state_count\)/);
});

test('native GUI lowering fails closed on event behavior the backend does not implement', () => {
  const unsupported = `window "Main" as main:\n  button "Go" as go\nwhen go clicked:\n  show "hello"\n`;
  assert.throws(() => buildNativeGuiIR(compile(unsupported, { kind: 'window', name: 'Unsupported' })), error => error instanceof NativeGuiError && /support change, open, close and dialog actions only/.test(error.message));
});

test('Win32 build script emits auditable Native GUI IR v0.7 / backend v0.8 source and metadata on every development OS', () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'patch-win32-emit-'));
  try {
    const result = spawnSync(process.execPath, ['scripts/build-native-win32.js', 'examples/tabs-window.patch', 'NativeTabsSmoke', temp, '--emit-only'], { cwd: path.resolve('.'), encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr || result.stdout);
    const cpp = fs.readFileSync(path.join(temp, 'NativeTabsSmoke.win32.cpp'), 'utf8');
    const meta = JSON.parse(fs.readFileSync(path.join(temp, 'NativeTabsSmoke.win32-build.json'), 'utf8'));
    assert.equal(cpp.includes('\0'), false, 'emitted C++ must not contain embedded NUL bytes');
    assert.match(cpp, /L'\\0'/);
    assert.match(cpp, /WC_TABCONTROLW/);
    assert.equal(meta.shell, 'native-win32');
    assert.equal(meta.electron, false);
    assert.equal(meta.crt, 'static');
    assert.equal(meta.nativeGuiIrVersion, '0.7');
    assert.equal(meta.backendVersion, '0.8');
    assert.equal(meta.changeIrVersion, '0.10');
    assert.equal(meta.forms, 1);
    assert.equal(meta.controls, 5);
    assert.equal(meta.events, 3);
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
});
