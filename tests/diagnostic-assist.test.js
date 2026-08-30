import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PATCH_DIAGNOSTIC_ASSIST_FORMAT,
  PATCH_DIAGNOSTIC_ASSIST_VERSION,
  buildDiagnosticAssist,
  applyDiagnosticFix
} from '../src/diagnostics.js';

function diagnostic(message, line = 1, code = 'PATCH2900') {
  return { code, message, location: { entry: 'main.patch', line, column: 1 } };
}

test('diagnostic assist explains that Window is the GUI project type, not Windows', () => {
  const assist = buildDiagnosticAssist(
    diagnostic('TreeView is not enabled for this Window target. Select a TreeView-capable target or enable its versioned TreeView runtime contract; validation fails closed otherwise.'),
    { platform: 'macos', buildTarget: 'native-macos' }
  );
  assert.equal(assist.format, PATCH_DIAGNOSTIC_ASSIST_FORMAT);
  assert.equal(assist.version, PATCH_DIAGNOSTIC_ASSIST_VERSION);
  assert.match(assist.why, /not Microsoft Windows/i);
  assert.match(assist.recommendation, /current macOS native build path/i);
  assert.deepEqual(assist.fix, {
    kind: 'select-build-target',
    value: 'native-macos',
    label: 'Use current macOS native target'
  });
});

test('diagnostic assist proposes one unambiguous near-miss Form repair', () => {
  const source = [
    'window "Main" as main size 400, 300:',
    '  button "Settings" as settings_button at 20, 20 size 120, 36',
    'window "Settings" as settings size 400, 300:',
    '  text "Settings"',
    'when settings_button clicked:',
    '  open form setings'
  ].join('\n');
  const assist = buildDiagnosticAssist(
    diagnostic("Form 'setings' is not defined. Name a window with 'as setings' or use the correct Form name.", 6),
    { source }
  );
  assert.match(assist.recommendation, /settings/);
  assert.equal(assist.fix.kind, 'replace-token-on-line');
  assert.equal(applyDiagnosticFix(source, assist.fix).split('\n')[5], '  open form settings');
});

test('diagnostic assist proposes a unique Patch keyword spelling repair', () => {
  const source = 'create number score = 0\nchnage score:\n  add 1';
  const assist = buildDiagnosticAssist(
    diagnostic("I do not understand 'chnage score:'", 2, 'PATCH1001'),
    { source }
  );
  assert.equal(assist.fix?.to, 'change');
  assert.equal(applyDiagnosticFix(source, assist.fix).split('\n')[1], 'change score:');
});

test('diagnostic assist can make an untyped literal declaration explicit', () => {
  const source = 'create score = 0\nshow score';
  const assist = buildDiagnosticAssist(
    diagnostic("I do not understand 'create score = 0'", 1, 'PATCH1001'),
    { source }
  );
  assert.equal(assist.fix?.kind, 'replace-line');
  assert.equal(applyDiagnosticFix(source, assist.fix).split('\n')[0], 'create number score = 0');
});

test('diagnostic assist does not invent a source repair when nearest names are ambiguous', () => {
  const source = [
    'window "One" as settinga size 400, 300:',
    '  text "One"',
    'window "Two" as settingb size 400, 300:',
    '  text "Two"',
    'open form setting'
  ].join('\n');
  const assist = buildDiagnosticAssist(
    diagnostic("Form 'setting' is not defined. Name a window with 'as setting' or use the correct Form name.", 5),
    { source }
  );
  assert.equal(assist.fix, null);
});
