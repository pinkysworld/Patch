import test from 'node:test';
import assert from 'node:assert/strict';
import { compile } from '../src/compiler.js';
import { createNativeBuildPlan } from '../src/native-app.js';
import { buildStandaloneWebApp } from '../src/webapp.js';
import { countWindowInstructions, validateWindowBuild } from '../src/window-build.js';

const source = `create number score = 1\nchange score:\n  add 4\nshow score`;
const windowSource = `create number count = 0\n\nwindow "Counter":\n  text "Count: {count}"\n  button "Add" as add_button\n\nwhen add_button clicked:\n  change count:\n    add 1`;

test('native build plan embeds directly executable Patch Wasm in a Rust host', () => {
  const plan = createNativeBuildPlan(source, { name: 'Counter', platform: 'linux' });
  assert.equal(WebAssembly.validate(plan.module), true);
  assert.equal(plan.runtime, 'wasmtime-47.0.3');
  assert.match(plan.cargoToml, /wasmtime = "=47\.0\.3"/);
  assert.match(plan.mainRs, /include_bytes!\("app\.wasm"\)/);
  assert.match(plan.mainRs, /func_wrap\("patch", "show_number"/);
  assert.match(plan.mainRs, /get_typed_func::<\(\), \(\)>/);
});

test('native app plan can request a desktop shell', () => {
  const plan = createNativeBuildPlan(source, { name: 'Counter', platform: 'darwin', desktopShell: true });
  assert.match(plan.mainRs, /const DESKTOP_SHELL: bool = true/);
  assert.match(plan.mainRs, /osascript/);
});

test('normalized Window IR is detected by the shared desktop preflight helper', () => {
  const compiled = compile(windowSource, { name: 'Counter', kind: 'window' });
  assert.equal(compiled.ir.instructions.some(instruction => instruction.code === 'WINDOW'), true);
  assert.equal(countWindowInstructions(compiled.ir.instructions), 1);
  assert.equal(validateWindowBuild(compiled), 1);
});

test('standalone console web app contains the direct Wasm module and self-hosting ABI', () => {
  const built = buildStandaloneWebApp(source, { name: 'Counter', kind: 'console' });
  assert.equal(WebAssembly.validate(built.module), true);
  assert.match(built.html, /Standalone single-file Patch Console Web App/);
  assert.match(built.html, /show_number/);
  assert.match(built.html, /change_number/);
  assert.match(built.html, /instance\.exports\.run\(\)/);
  assert.doesNotMatch(built.html, /<script src=/);
});

test('standalone Window Web App routes around the console-only direct Wasm backend', () => {
  const built = buildStandaloneWebApp(windowSource, { name: 'Counter', kind: 'window' });
  assert.equal(built.module, null);
  assert.equal(built.metadata.projectKind, 'window');
  assert.equal(built.metadata.windows, 1);
  assert.match(built.html, /Standalone single-file Patch Window Web App/);
  assert.match(built.html, /const PROGRAM=/);
  assert.match(built.html, /add_button/);
  assert.match(built.html, /safeTrigger\(control\.id,'clicked'\)/);
  assert.doesNotMatch(built.html, /<script src=/);
  assert.doesNotMatch(built.html, /WASM_BASE64/);
});

test('standalone Web App infers Window projects when kind is omitted', () => {
  const built = buildStandaloneWebApp(windowSource, { name: 'Counter' });
  assert.equal(built.metadata.projectKind, 'window');
  assert.equal(built.metadata.windows, 1);
});
