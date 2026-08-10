import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const studio = fs.readFileSync('web/native-build.js', 'utf8');
const workflow = fs.readFileSync('.github/workflows/windows-single-exe.yml', 'utf8');

test('Studio routes Windows Window cloud builds to the native single-EXE workflow', () => {
  assert.match(studio, /const WINDOWS_SINGLE_EXE_WORKFLOW = 'windows-single-exe\.yml'/);
  assert.match(studio, /platform === 'windows' && kind === 'window'/);
  assert.match(studio, /return WINDOWS_SINGLE_EXE_WORKFLOW/);
  assert.match(studio, /Native single EXE \(GitHub Actions, recommended\)/);
  assert.match(studio, /Compatibility package \(Electron, no token\)/);
  assert.match(studio, /const expectedName = directWin32 \? 'patch-windows-single-exe'/);
});

test('Studio Windows native request sends source without legacy Window packaging inputs', () => {
  assert.match(studio, /directWin32\s*\? \{ source_b64: sourceBase64, source_path: '', app_name: name, request_id: requestId \}/);
  assert.match(studio, /Direct Win32\/MSVC native GUI build/);
  assert.match(studio, /No patch-app\.json, Electron, Chromium or Node runtime is shipped/);
});

test('Windows single-EXE workflow accepts Studio source and preserves one-file contract', () => {
  assert.match(workflow, /source_b64:/);
  assert.match(workflow, /request_id:/);
  assert.match(workflow, /FromBase64String/);
  assert.match(workflow, /build-native-win32\.js/);
  assert.match(workflow, /patch-app\.json must never be shipped/);
  assert.match(workflow, /Deliverable must contain exactly one \.exe file/);
  assert.match(workflow, /name: patch-windows-single-exe/);
});
