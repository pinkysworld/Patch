import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const studio = fs.readFileSync('web/native-build.js', 'utf8');
const workflow = fs.readFileSync('.github/workflows/native-window-aot.yml', 'utf8');

test('Studio exposes direct native AOT Window builds for macOS and Linux', () => {
  assert.ok(studio.includes("const NATIVE_WINDOW_AOT_WORKFLOW = 'native-window-aot.yml'"));
  assert.ok(studio.includes("return NATIVE_WINDOW_AOT_WORKFLOW"));
  assert.ok(studio.includes('Native AOT app (GitHub Actions)'));
  assert.ok(studio.includes('Direct AppKit AOT GUI build'));
  assert.ok(studio.includes('Direct GTK3 AOT GUI build'));
});

test('Studio native AOT cloud preflight lowers Native GUI IR', () => {
  assert.ok(studio.includes("nativeBuildMode.value === 'cloud'"));
  assert.ok(studio.includes("['windows', 'macos', 'linux'].includes(platform)"));
  assert.ok(studio.includes('Native GUI IR ${nativeGui.version} lowered'));
});

test('native Window AOT workflow uses direct platform backends', () => {
  assert.ok(workflow.includes('scripts/build-native-gui.js'));
  assert.ok(workflow.includes('native-appkit'));
  assert.ok(workflow.includes('native-gtk3'));
  assert.ok(workflow.includes('patch-macos-${{ inputs.request_id }}'));
  assert.ok(workflow.includes('patch-linux-${{ inputs.request_id }}'));
  assert.equal(workflow.includes('build-native-window.js'), false);
  assert.equal(workflow.includes('chrome-sandbox'), false);
});
