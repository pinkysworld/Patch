import test from 'node:test';
import assert from 'node:assert/strict';
import { parse } from '../src/parser.js';
import { compile } from '../src/compiler.js';
import {
  PATCH_INPUT_PRESENTATION_VERSION,
  assertPatchInputPresentationTarget,
  formatPatchInputPresentationDirective,
  normalizePatchInputPresentation,
  parsePatchInputPresentationDirective,
  patchInputDomType,
  patchInputPresentationModes,
  patchInputPresentationTargetSupport
} from '../src/input-presentation.js';
import {
  PATCH_WINDOW_INPUT_PRESENTATION_VERSION,
  attachWindowInputPresentations,
  buildWindowInputPresentationManifest,
  readWindowInputPresentation
} from '../src/window-input-presentation.js';

test('Input presentation contract is versioned and keeps plain/password modes explicit', () => {
  assert.equal(PATCH_INPUT_PRESENTATION_VERSION, '0.1');
  assert.deepEqual(patchInputPresentationModes(), ['plain', 'password']);
  assert.equal(normalizePatchInputPresentation(), 'plain');
  assert.equal(normalizePatchInputPresentation(' PASSWORD '), 'password');
  assert.throws(() => normalizePatchInputPresentation('secret'), /Use plain or password/);
});

test('PasswordEdit source metadata is transparent and round-trippable', () => {
  assert.equal(parsePatchInputPresentationDirective('  # @input-mode password'), 'password');
  assert.equal(parsePatchInputPresentationDirective('# @input-mode plain'), 'plain');
  assert.equal(parsePatchInputPresentationDirective('# ordinary comment'), null);
  assert.equal(formatPatchInputPresentationDirective('password'), '# @input-mode password');
  assert.equal(formatPatchInputPresentationDirective('plain'), null);
  assert.throws(
    () => parsePatchInputPresentationDirective('# @input-mode hidden'),
    /Invalid # @input-mode directive/
  );
});

test('PasswordEdit changes presentation only and maps to the browser password input type', () => {
  assert.equal(patchInputDomType('plain'), 'text');
  assert.equal(patchInputDomType('password'), 'password');
});

test('PasswordEdit Stage 1 support is explicit and native targets remain fail-closed', () => {
  assert.equal(patchInputPresentationTargetSupport('password').studio, 'supported');
  assert.equal(patchInputPresentationTargetSupport('password').web, 'supported');
  assert.equal(patchInputPresentationTargetSupport('password').windows, 'unsupported');
  assert.equal(patchInputPresentationTargetSupport('password').macos, 'unsupported');
  assert.equal(patchInputPresentationTargetSupport('password').linux, 'unsupported');
  assert.equal(assertPatchInputPresentationTarget('password', 'web'), true);
  assert.throws(
    () => assertPatchInputPresentationTarget('password', 'windows'),
    /PasswordEdit Stage 1 is Studio\/Web only/
  );
  assert.equal(assertPatchInputPresentationTarget('plain', 'linux'), true);
});

test('Window input presentation manifest binds metadata to the matching Input source line', () => {
  const source = `window "Login" as main size 520, 300:
  # @taborder 0
  input username at 24, 24 size 220, 36
  # @layout anchor left right top
  # @input-mode password
  # @taborder 1
  input secret at 24, 76 size 220, 36
`;
  const ast = parse(source);
  const manifest = buildWindowInputPresentationManifest(source, ast);
  assert.equal(PATCH_WINDOW_INPUT_PRESENTATION_VERSION, '0.1');
  assert.deepEqual(manifest.controls.map(control => control.mode), ['plain', 'password']);
  assert.equal(readWindowInputPresentation(source, 3), 'plain');
  assert.equal(readWindowInputPresentation(source, 7), 'password');
  attachWindowInputPresentations(ast, manifest);
  const controls = ast[0].body.filter(node => node.kind === 'uiControl');
  assert.equal(controls[0].inputPresentation, 'plain');
  assert.equal(controls[1].inputPresentation, 'password');
  assert.match(JSON.stringify(ast), /"inputPresentation":"password"/);
});

test('compile exposes PasswordEdit presentation as metadata without changing Change IR 0.10', () => {
  const source = `create text secret = ""
window "Login" as main size 520, 300:
  # @input-mode password
  input secret at 24, 24 size 220, 36
when secret changed:
  change secret:
    set = value
`;
  const compiled = compile(source, { name: 'Login', kind: 'window' });
  assert.equal(compiled.ir.version, '0.10');
  assert.equal(compiled.windowInputPresentation.version, '0.1');
  assert.deepEqual(compiled.windowInputPresentation.controls, [{ line: 4, mode: 'password' }]);
  const input = compiled.ast.find(node => node.kind === 'window').body.find(node => node.control === 'input');
  assert.equal(input.inputPresentation, 'password');
  assert.match(JSON.stringify(compiled.ast), /"inputPresentation":"password"/);
});

test('Input presentation metadata works inside Tabs and Panels and rejects non-Input controls', () => {
  const tabsSource = `window "Login" as main size 520, 300:
  tabs as pages at 24, 24 size 420, 220:
    tab "Credentials":
      # @input-mode password
      input secret
    tab "Other":
      text "Other"
`;
  const tabsAst = parse(tabsSource);
  const tabsManifest = buildWindowInputPresentationManifest(tabsSource, tabsAst);
  assert.deepEqual(tabsManifest.controls.map(control => control.mode), ['password']);
  attachWindowInputPresentations(tabsAst, tabsManifest);
  assert.equal(tabsAst[0].body[0].body[0].body[0].inputPresentation, 'password');

  const panelSource = `window "Panel Login" as main size 520, 300:
  panel as credentials at 24, 24 size 320, 140:
    # @input-mode password
    input secret at 16, 16 size 220, 36
`;
  const panelAst = parse(panelSource);
  const panelManifest = buildWindowInputPresentationManifest(panelSource, panelAst);
  assert.deepEqual(panelManifest.controls.map(control => control.mode), ['password']);
  attachWindowInputPresentations(panelAst, panelManifest);
  assert.equal(panelAst[0].body[0].body[0].inputPresentation, 'password');

  const invalid = `window "Bad" as main size 400, 240:
  # @input-mode password
  button "No" as no at 24, 24 size 120, 36
`;
  assert.throws(
    () => buildWindowInputPresentationManifest(invalid, parse(invalid)),
    /belongs only to Input controls/
  );
});
