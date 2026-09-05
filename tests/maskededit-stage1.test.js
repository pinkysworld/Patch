import test from 'node:test';
import assert from 'node:assert/strict';
import { parse } from '../src/parser.js';
import { compile } from '../src/compiler.js';
import { buildStandaloneWebApp } from '../src/webapp.js';
import { buildCurrentNativeGuiIR } from '../src/native-current-contract.js';
import { collectMaskedInputDescriptors } from '../src/window-web-paintbox.js';
import {
  PATCH_INPUT_MASK_VERSION,
  applyPatchInputMask,
  assertPatchInputMaskTarget,
  compilePatchInputMask,
  formatPatchInputMaskDirective,
  normalizePatchInputMask,
  parsePatchInputMaskDirective,
  patchInputMaskInputMode,
  patchInputMaskPlaceholder,
  patchInputMaskTargetSupport
} from '../src/input-presentation.js';
import {
  PATCH_WINDOW_INPUT_MASK_VERSION,
  attachWindowInputMasks,
  buildWindowInputMaskManifest,
  collectWindowInputMasks,
  readWindowInputMask,
  setWindowInputMask
} from '../src/window-input-presentation.js';

test('MaskedEdit input-mask contract is versioned and uses explicit token semantics', () => {
  assert.equal(PATCH_INPUT_MASK_VERSION, '0.1');
  assert.equal(normalizePatchInputMask('(000) 000-0000'), '(000) 000-0000');
  assert.equal(patchInputMaskPlaceholder('(000) 000-0000'), '(___) ___-____');
  assert.equal(patchInputMaskInputMode('(000) 000-0000'), 'numeric');
  assert.equal(patchInputMaskInputMode('AA-000'), 'text');
  assert.deepEqual(
    compilePatchInputMask('0A*').map(slot => slot.kind),
    ['digit', 'letter', 'alphanumeric']
  );
  assert.throws(() => normalizePatchInputMask('---'), /at least one token/);
  assert.throws(() => normalizePatchInputMask('0\\'), /cannot end with an escape/);
});

test('MaskedEdit source directive is quoted, transparent and round-trippable', () => {
  const directive = formatPatchInputMaskDirective('(000) 000-0000');
  assert.equal(directive, '# @input-mask "(000) 000-0000"');
  assert.equal(parsePatchInputMaskDirective(`  ${directive}`), '(000) 000-0000');
  assert.equal(parsePatchInputMaskDirective('# ordinary comment'), null);
  assert.throws(() => parsePatchInputMaskDirective('# @input-mask 000-000'), /quoted string/);
});

test('MaskedEdit formatter filters input and inserts literal separators deterministically', () => {
  assert.equal(applyPatchInputMask('(000) 000-0000', '1234567890'), '(123) 456-7890');
  assert.equal(applyPatchInputMask('(000) 000-0000', '(123) 456-7890'), '(123) 456-7890');
  assert.equal(applyPatchInputMask('(000) 000-0000', '12x34 y56--7890'), '(123) 456-7890');
  assert.equal(applyPatchInputMask('AA-000', 'a1b-12x3'), 'ab-123');
  assert.equal(applyPatchInputMask('\\0-000', '123'), '0-123');
  assert.equal(applyPatchInputMask('(000) 000-0000', '12'), '(12');
});

test('MaskedEdit Stage 1 target support is explicit and native targets remain fail-closed', () => {
  assert.equal(patchInputMaskTargetSupport().studio, 'supported');
  assert.equal(patchInputMaskTargetSupport().web, 'supported');
  assert.equal(patchInputMaskTargetSupport().windows, 'unsupported');
  assert.equal(assertPatchInputMaskTarget('web'), true);
  assert.throws(() => assertPatchInputMaskTarget('linux'), /Studio\/Web only/);
});

test('Window input-mask manifest binds top-level, Tabs and Panel Inputs only', () => {
  const source = `window "Masked" as main size 620, 420:
  # @input-mask "000-000"
  input account at 24, 24 size 220, 36
  tabs as pages at 24, 80 size 500, 160:
    tab "Codes":
      # @input-mask "AA-000"
      input code
    tab "Other":
      input ordinary
  panel as details at 24, 260 size 320, 120:
    # @input-mask "0000"
    input pin at 12, 12 size 220, 36
`;
  const ast = parse(source);
  const manifest = buildWindowInputMaskManifest(source, ast);
  assert.equal(PATCH_WINDOW_INPUT_MASK_VERSION, '0.1');
  assert.deepEqual(manifest.controls.map(control => [control.id, control.mask]), [
    ['account', '000-000'], ['code', 'AA-000'], ['pin', '0000']
  ]);
  attachWindowInputMasks(ast, manifest);
  assert.deepEqual(collectWindowInputMasks(source, ast).map(control => control.id), ['account', 'code', 'pin']);
  assert.equal(ast[0].body[0].inputMask, '000-000');
  assert.equal(ast[0].body[1].body[0].body[0].inputMask, 'AA-000');
  assert.equal(ast[0].body[2].body[0].inputMask, '0000');
});

test('MaskedEdit setter adds, updates and removes source-backed mask metadata', () => {
  const plain = `window "Masked" as main size 420, 240:
  input phone at 24, 24 size 220, 36
`;
  const masked = setWindowInputMask(plain, 2, '000-000');
  assert.match(masked, /  # @input-mask "000-000"\n  input phone/);
  assert.equal(readWindowInputMask(masked, 3), '000-000');
  const changed = setWindowInputMask(masked, 3, '0000-0000');
  assert.equal(readWindowInputMask(changed, 3), '0000-0000');
  assert.equal(setWindowInputMask(changed, 3, null), plain);
});

const APP_SOURCE = `create text phone = ""
window "Masked" as main size 420, 240:
  # @input-mask "(000) 000-0000"
  input phone at 24, 24 size 220, 36
when phone changed:
  change phone:
    set = value
`;

test('compile exposes MaskedEdit metadata without changing Input semantics or Change IR 0.10', () => {
  const compiled = compile(APP_SOURCE, { name: 'Masked', kind: 'window' });
  assert.equal(compiled.ir.version, '0.10');
  assert.equal(compiled.windowInputMask.version, '0.1');
  assert.deepEqual(compiled.windowInputMask.controls, [{ line: 4, id: 'phone', mask: '(000) 000-0000' }]);
  const input = compiled.ast.find(node => node.kind === 'window').body.find(node => node.control === 'input');
  assert.equal(input.control, 'input');
  assert.equal(input.inputPresentation, 'plain');
  assert.equal(input.inputMask, '(000) 000-0000');
  assert.deepEqual(collectMaskedInputDescriptors(compiled.ast), {
    phone: { mask: '(000) 000-0000', placeholder: '(___) ___-____', inputMode: 'numeric' }
  });
});

test('Standalone Window Web emits the MaskedEdit capture filter before ordinary changed semantics', () => {
  const built = buildStandaloneWebApp(APP_SOURCE, { name: 'Masked', kind: 'window' });
  assert.equal(built.metadata.maskedEditStage, 1);
  assert.equal(built.metadata.maskedEditVersion, '0.1');
  assert.equal(built.metadata.maskedEditMode, 'source-backed-token-mask');
  assert.match(built.html, /data-patch-window-maskededit/);
  assert.match(built.html, /PATCH_MASKED_INPUTS/);
  assert.match(built.html, /patchApplyInputMask/);
  assert.match(built.html, /addEventListener\('input'.*true\)/s);
  assert.match(built.html, /dataset\.patchInputPresentation='masked'/);
});

test('Current Ready native fails closed for MaskedEdit rather than dropping the mask', () => {
  const compiled = compile(APP_SOURCE, { name: 'Masked', kind: 'window' });
  assert.throws(
    () => buildCurrentNativeGuiIR(compiled),
    /MaskedEdit Stage 1.*Studio\/Web only.*no input-mask contract/i
  );
});

test('MaskedEdit rejects non-Input targets and PasswordEdit conflicts', () => {
  const invalidTarget = `window "Bad" as main size 400, 240:
  # @input-mask "000"
  button "No" as no at 24, 24 size 120, 36
`;
  assert.throws(() => buildWindowInputMaskManifest(invalidTarget, parse(invalidTarget)), /belongs only to Input controls/);

  const conflict = `window "Bad" as main size 400, 240:
  # @input-mode password
  # @input-mask "0000"
  input secret at 24, 24 size 220, 36
`;
  assert.throws(() => compile(conflict, { name: 'Bad', kind: 'window' }), /cannot combine PasswordEdit and MaskedEdit/);
});
