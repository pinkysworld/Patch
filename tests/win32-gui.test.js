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

test('native GUI IR v0.3 lowers simple Patch Forms without changing source syntax', () => {
  const compiled = compile(source, { kind: 'window', name: 'NativeNavigation', entry: 'forms-navigation.patch' });
  const ir = buildNativeGuiIR(compiled);
  assert.equal(ir.format, 'patch-native-gui-ir');
  assert.equal(ir.version, '0.3');
  assert.deepEqual(ir.forms.map(form => [form.id, form.visible]), [['main', true], ['settings', false]]);
  assert.deepEqual(ir.states, [{ name: 'notifications', type: 'boolean', initial: false }]);
  assert.equal(ir.forms[1].controls.find(control => control.id === 'notifications').type, 'checkbox');
  assert.deepEqual(ir.events.map(event => [event.control, event.event]), [
    ['open_settings', 'clicked'],
    ['close_settings', 'clicked'],
    ['notifications', 'changed']
  ]);
  assert.deepEqual(ir.events[0].actions, [{ kind: 'openForm', form: 'settings' }]);
  assert.deepEqual(ir.events[1].actions, [{ kind: 'closeForm', form: 'settings' }]);
  assert.equal(ir.events[2].actions[0].kind, 'change');
  assert.deepEqual(ir.events[2].actions[0].ops, [{ op: 'set', value: { kind: 'eventValue' } }]);
});

test('Win32 backend emits native windows and controls without Electron runtime code', () => {
  const ir = buildNativeGuiIR(compile(source, { kind: 'window', name: 'NativeNavigation' }));
  const cpp = emitWin32GuiCpp(ir);
  assert.match(cpp, /CreateWindowExW/);
  assert.match(cpp, /WS_OVERLAPPEDWINDOW/);
  assert.match(cpp, /BS_AUTOCHECKBOX/);
  assert.match(cpp, /WM_COMMAND/);
  assert.match(cpp, /ShowWindow\(gForms\[1\], SW_SHOW\)/);
  assert.match(cpp, /ShowWindow\(gForms\[1\], SW_HIDE\)/);
  assert.match(cpp, /BM_GETCHECK/);
  assert.match(cpp, /\/SUBSYSTEM:WINDOWS|Direct native Win32 controls/);
  assert.doesNotMatch(cpp, /BrowserWindow|require\(['"]electron['"]\)|<html|document\.querySelector/);
});

test('Win32 backend lowers native ComboBox selection to text changed events', () => {
  const ir = buildNativeGuiIR(compile(comboSource, { kind: 'window', name: 'NativeWinCombo' }));
  const cpp = emitWin32GuiCpp(ir);
  assert.match(cpp, /L"COMBOBOX"/);
  assert.match(cpp, /CBS_DROPDOWNLIST/);
  assert.match(cpp, /CB_ADDSTRING/);
  assert.match(cpp, /L"Small"/);
  assert.match(cpp, /L"Medium"/);
  assert.match(cpp, /L"Large"/);
  assert.match(cpp, /CBN_SELCHANGE/);
  assert.match(cpp, /CB_GETCURSEL/);
  assert.match(cpp, /CB_GETLBTEXT/);
  assert.match(cpp, /CB_SETCURSEL/);
  assert.match(cpp, /patch_state_size = eventValue/);
});

test('Win32 backend lowers native ListBox selection to text changed events', () => {
  const ir = buildNativeGuiIR(compile(listboxSource, { kind: 'window', name: 'NativeWinListBox' }));
  const cpp = emitWin32GuiCpp(ir);
  assert.match(cpp, /L"LISTBOX"/);
  assert.match(cpp, /LBS_NOTIFY/);
  assert.match(cpp, /LB_ADDSTRING/);
  assert.match(cpp, /L"Apple"/);
  assert.match(cpp, /L"Banana"/);
  assert.match(cpp, /L"Cherry"/);
  assert.match(cpp, /L"Mango"/);
  assert.match(cpp, /LBN_SELCHANGE/);
  assert.match(cpp, /LB_GETCURSEL/);
  assert.match(cpp, /LB_GETTEXT/);
  assert.match(cpp, /LB_SETCURSEL/);
  assert.match(cpp, /patch_state_fruit = eventValue/);
});

test('Win32 backend lowers numeric Patch change and interpolation directly', () => {
  const ir = buildNativeGuiIR(compile(counterSource, { kind: 'window', name: 'NativeCounter' }));
  const cpp = emitWin32GuiCpp(ir);
  assert.deepEqual(ir.states, [{ name: 'count', type: 'number', initial: 0 }]);
  assert.match(cpp, /static double patch_state_count = 0/);
  assert.match(cpp, /patch_state_count \+= 1/);
  assert.match(cpp, /PatchNumber\(patch_state_count\)/);
  assert.match(cpp, /L"Count: "/);
});

test('native GUI lowering fails closed on event behavior the backend does not implement', () => {
  const unsupported = `window "Main" as main:\n  button "Go" as go\nwhen go clicked:\n  show "hello"\n`;
  assert.throws(
    () => buildNativeGuiIR(compile(unsupported, { kind: 'window', name: 'Unsupported' })),
    error => error instanceof NativeGuiError && /support change, open and close only/.test(error.message)
  );
});

test('Win32 build script can emit auditable native source and metadata on every development OS', () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'patch-win32-emit-'));
  try {
    const result = spawnSync(process.execPath, [
      'scripts/build-native-win32.js',
      'examples/forms-navigation.patch',
      'NativeSmoke',
      temp,
      '--emit-only'
    ], { cwd: path.resolve('.'), encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr || result.stdout);
    const cpp = fs.readFileSync(path.join(temp, 'NativeSmoke.win32.cpp'), 'utf8');
    const meta = JSON.parse(fs.readFileSync(path.join(temp, 'NativeSmoke.win32-build.json'), 'utf8'));
    assert.match(cpp, /PatchNativeWindowV1/);
    assert.equal(cpp.includes('\0'), false, 'emitted C++ must not contain embedded NUL bytes');
    assert.match(cpp, /L'\\0'/);
    assert.equal(meta.shell, 'native-win32');
    assert.equal(meta.electron, false);
    assert.equal(meta.crt, 'static');
    assert.equal(meta.nativeGuiIrVersion, '0.3');
    assert.equal(meta.changeIrVersion, '0.10');
    assert.equal(meta.forms, 2);
    assert.equal(meta.events, 3);
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
});
