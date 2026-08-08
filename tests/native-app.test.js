import test from 'node:test';
import assert from 'node:assert/strict';
import { createNativeBuildPlan } from '../src/native-app.js';
import { buildStandaloneWebApp } from '../src/webapp.js';

const source = `create number score = 1\nchange score:\n  add 4\nshow score`;

test('native build plan embeds directly executable Patch Wasm in a Rust host', () => {
  const plan = createNativeBuildPlan(source, { name: 'Counter', platform: 'linux' });
  assert.equal(WebAssembly.validate(plan.module), true);
  assert.match(plan.cargoToml, /wasmtime = "47\.0\.2"/);
  assert.match(plan.mainRs, /include_bytes!\("app\.wasm"\)/);
  assert.match(plan.mainRs, /func_wrap\("patch", "show_number"/);
  assert.match(plan.mainRs, /get_typed_func::<\(\), \(\)>/);
});

test('native app plan can request a desktop shell', () => {
  const plan = createNativeBuildPlan(source, { name: 'Counter', platform: 'darwin', desktopShell: true });
  assert.match(plan.mainRs, /const DESKTOP_SHELL: bool = true/);
  assert.match(plan.mainRs, /osascript/);
});

test('standalone web app contains the direct Wasm module and self-hosting ABI', () => {
  const built = buildStandaloneWebApp(source, { name: 'Counter' });
  assert.equal(WebAssembly.validate(built.module), true);
  assert.match(built.html, /Standalone single-file Patch Web App/);
  assert.match(built.html, /show_number/);
  assert.match(built.html, /change_number/);
  assert.match(built.html, /instance\.exports\.run\(\)/);
  assert.doesNotMatch(built.html, /<script src=/);
});
