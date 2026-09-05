import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PATCH_LISTBOX_PRESENTATION_VERSION,
  PATCH_WINDOW_LISTBOX_PRESENTATION_FORMAT,
  PATCH_WINDOW_LISTBOX_PRESENTATION_VERSION,
  assertPatchListboxPresentationTarget,
  formatPatchListboxPresentationDirective,
  normalizePatchListboxPresentation,
  parsePatchListboxPresentationDirective,
  patchListboxPresentationModes,
  patchListboxPresentationTargetSupport,
  readWindowListboxPresentation,
  setWindowListboxPresentation
} from '../src/input-presentation.js';
import { compile } from '../src/compiler.js';
import { buildCurrentNativeGuiIR } from '../src/native-current-contract.js';

test('CheckedListBox Stage 1 presentation vocabulary is versioned and fail-closed by target', () => {
  assert.equal(PATCH_LISTBOX_PRESENTATION_VERSION, '0.1');
  assert.equal(PATCH_WINDOW_LISTBOX_PRESENTATION_FORMAT, 'patch-window-listbox-presentation');
  assert.equal(PATCH_WINDOW_LISTBOX_PRESENTATION_VERSION, '0.1');
  assert.deepEqual(patchListboxPresentationModes(), ['plain', 'checked']);
  assert.equal(normalizePatchListboxPresentation(' CHECKED '), 'checked');
  assert.equal(parsePatchListboxPresentationDirective('  # @listbox-mode checked'), 'checked');
  assert.equal(formatPatchListboxPresentationDirective('checked'), '# @listbox-mode checked');
  assert.equal(formatPatchListboxPresentationDirective('plain'), null);
  assert.equal(patchListboxPresentationTargetSupport('checked').studio, 'supported');
  assert.equal(patchListboxPresentationTargetSupport('checked').web, 'supported');
  assert.equal(patchListboxPresentationTargetSupport('checked').windows, 'unsupported');
  assert.doesNotThrow(() => assertPatchListboxPresentationTarget('checked', 'web'));
  assert.throws(() => assertPatchListboxPresentationTarget('checked', 'windows'), /CheckedListBox Stage 1 is Studio\/Web only/);
  assert.throws(() => normalizePatchListboxPresentation('mystery'), /Use plain or checked/);
});

test('source-backed CheckedListBox metadata round-trips without disturbing other Designer metadata', () => {
  const source = `create list services = ["Diagnostics"]

window "Checklist" as main size 520, 320:
  # @layout anchor left right
  # @taborder 2
  # @locked
  listbox "Diagnostics", "Warranty", "Install" as services at 24, 64 size 280, 140
`;
  const line = 7;
  const checked = setWindowListboxPresentation(source, line, 'checked');
  assert.match(checked, /# @layout anchor left right\n  # @taborder 2\n  # @locked\n  # @listbox-mode checked\n  listbox/);
  assert.equal(readWindowListboxPresentation(checked, line + 1), 'checked');
  const plain = setWindowListboxPresentation(checked, line + 1, 'plain');
  assert.doesNotMatch(plain, /@listbox-mode/);
  assert.match(plain, /# @layout anchor left right\n  # @taborder 2\n  # @locked\n  listbox/);
});

test('compiler attaches enumerable checked presentation while preserving Change IR 0.10', () => {
  const source = `create list services = ["Diagnostics", "Install"]

window "Checklist" as main size 520, 320:
  # @listbox-mode checked
  listbox "Diagnostics", "Warranty", "Install" as services at 24, 64 size 280, 140

when services changed:
  change services:
    set = value
`;
  const compiled = compile(source, { name: 'CheckedListBox Demo', kind: 'window' });
  assert.equal(compiled.ir.version, '0.10');
  assert.equal(compiled.windowListboxPresentation.format, PATCH_WINDOW_LISTBOX_PRESENTATION_FORMAT);
  assert.deepEqual(compiled.windowListboxPresentation.controls, [{ line: 5, id: 'services', mode: 'checked' }]);
  const listbox = compiled.ast.find(node => node.kind === 'window').body.find(node => node.kind === 'uiControl' && node.control === 'listbox');
  assert.equal(listbox.listboxPresentation, 'checked');
  assert.match(JSON.stringify(compiled.ast), /"listboxPresentation":"checked"/);
});

test('CheckedListBox requires list-backed state so changed(value) keeps one unambiguous list contract', () => {
  const textBacked = `create text service = "Diagnostics"
window "Bad" as main size 420, 260:
  # @listbox-mode checked
  listbox "Diagnostics", "Warranty" as service
`;
  assert.throws(() => compile(textBacked), /needs a matching 'create list service/);

  const missing = `window "Bad" as main size 420, 260:
  # @listbox-mode checked
  listbox "Diagnostics", "Warranty" as services
`;
  assert.throws(() => compile(missing), /needs a matching 'create list services/);
});

test('CheckedListBox metadata follows supported Tabs and Panel source paths', () => {
  const tabsSource = `create list checks = []
window "Tabs" as main size 520, 320:
  tabs as pages:
    tab "One":
      # @listbox-mode checked
      listbox "A", "B", "C" as checks
`;
  const tabsCompiled = compile(tabsSource);
  const nested = tabsCompiled.ast.find(node => node.kind === 'window').body.find(node => node.kind === 'tabs').body[0].body.find(node => node.control === 'listbox');
  assert.equal(nested.listboxPresentation, 'checked');

  const panelSource = `create list checks = []
window "Panel" as main size 520, 320:
  panel as group:
    # @listbox-mode checked
    listbox "A", "B", "C" as checks
`;
  const panelCompiled = compile(panelSource);
  const panel = panelCompiled.ast.find(node => node.kind === 'window').body.find(node => node.control === 'panel');
  assert.equal(panel.body.find(node => node.control === 'listbox').listboxPresentation, 'checked');
});

test('Current Ready native fails closed instead of silently lowering CheckedListBox as ordinary ListBox', () => {
  const source = `create list services = ["Diagnostics"]
window "Checklist" as main size 520, 320:
  # @listbox-mode checked
  listbox "Diagnostics", "Warranty", "Install" as services
`;
  const compiled = compile(source);
  assert.throws(
    () => buildCurrentNativeGuiIR(compiled),
    /CheckedListBox Stage 1 'services' is Studio\/Web only.*fails closed/
  );
});

test('# @listbox-mode on another control is rejected rather than becoming orphan metadata', () => {
  const source = `create list services = []
window "Bad metadata" as main size 420, 260:
  # @listbox-mode checked
  button "Wrong" as wrong
`;
  assert.throws(() => compile(source), /belongs only to ListBox controls/);
});
