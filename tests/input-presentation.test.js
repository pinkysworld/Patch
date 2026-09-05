import test from 'node:test';
import assert from 'node:assert/strict';
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
