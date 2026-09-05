import test from 'node:test';
import assert from 'node:assert/strict';
import { parse } from '../src/parser.js';
import { compile } from '../src/compiler.js';
import { buildStandaloneWebApp } from '../src/webapp.js';
import { buildCurrentNativeGuiIR } from '../src/native-current-contract.js';
import {
  collectWindowPasswordInputIds,
  readWindowInputPresentation,
  setWindowInputPresentation
} from '../src/window-input-presentation.js';

const SOURCE = `create text secret = "swordfish"
window "Login" as main size 520, 300:
  # @input-mode password
  input secret at 24, 24 size 220, 36
`;

test('PasswordEdit Designer setter round-trips the transparent source directive', () => {
  const plain = `window "Login" as main size 520, 300:
  input secret at 24, 24 size 220, 36
`;
  const password = setWindowInputPresentation(plain, 2, 'password');
  assert.match(password, /  # @input-mode password\n  input secret/);
  assert.equal(readWindowInputPresentation(password, 3), 'password');
  const restored = setWindowInputPresentation(password, 3, 'plain');
  assert.equal(restored, plain);
  assert.throws(
    () => setWindowInputPresentation('window "Bad":\n  button "No" as no\n', 2, 'password'),
    /only be changed on an Input control/
  );
});

test('PasswordEdit discovery follows Inputs through Tabs and Panels', () => {
  const source = `window "Nested" as main size 620, 420:
  # @input-mode password
  input top_secret at 24, 24 size 220, 36
  tabs as pages at 24, 80 size 500, 160:
    tab "Login":
      # @input-mode password
      input tab_secret
    tab "Other":
      input ordinary
  panel as credentials at 24, 260 size 320, 120:
    # @input-mode password
    input panel_secret at 12, 12 size 220, 36
`;
  assert.deepEqual(
    collectWindowPasswordInputIds(source, parse(source)),
    ['top_secret', 'tab_secret', 'panel_secret']
  );
});

test('Standalone Window Web renders PasswordEdit as a masked browser input', () => {
  const built = buildStandaloneWebApp(SOURCE, { name: 'Login', kind: 'window' });
  assert.equal(built.metadata.passwordEditStage, 1);
  assert.equal(built.metadata.passwordEditVersion, '0.1');
  assert.equal(built.metadata.passwordEditMode, 'source-backed-masked-input');
  assert.match(built.html, /data-patch-window-passwordedit/);
  assert.match(built.html, /PATCH_PASSWORD_INPUT_IDS=new Set\(\["secret"\]\)/);
  assert.match(built.html, /element\.type='password'/);
  assert.match(built.html, /dataset\.patchInputPresentation='password'/);
});

test('PasswordEdit leaves Input semantics intact while Current Ready native fails closed', () => {
  const compiled = compile(SOURCE, { name: 'Login', kind: 'window', entry: 'main.patch' });
  const input = compiled.ast.find(node => node.kind === 'window').body.find(node => node.control === 'input');
  assert.equal(input.control, 'input');
  assert.equal(input.inputPresentation, 'password');
  assert.equal(compiled.ir.version, '0.10');
  assert.throws(
    () => buildCurrentNativeGuiIR(compiled),
    /PasswordEdit Stage 1.*Studio\/Web only.*Current Ready native 1\.10/i
  );

  const plain = compile(`create text value = "plain"
window "Plain" as main size 420, 240:
  input value at 24, 24 size 220, 36
`, { name: 'Plain', kind: 'window', entry: 'main.patch' });
  assert.equal(buildCurrentNativeGuiIR(plain).version, '1.9');
});
