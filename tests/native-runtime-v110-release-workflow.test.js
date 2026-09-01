import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const workflow = fs.readFileSync(new URL('../.github/workflows/native-sealed-window-icon-runtime-v110.yml', import.meta.url), 'utf8');
const currentContract = fs.readFileSync(new URL('../src/native-current-contract.js', import.meta.url), 'utf8');

test('runtime v1.10 workflow keeps the three Current Ready release tags immutable after promotion', () => {
  assert.match(workflow, /\n  push:\n    branches: \[main\]/);
  assert.match(workflow, /PATCH_NATIVE_RUNTIME_V110_SOURCE_SHA: e31a426dc21cb0929241fe96ab96e270ad182b32/);
  assert.match(workflow, /publish:\n    if: github\.event_name == 'push' && github\.ref == 'refs\/heads\/main'/);
  assert.match(workflow, /native-win32-runtime-v1\.10/);
  assert.match(workflow, /native-macos-runtime-v1\.10/);
  assert.match(workflow, /native-linux-runtime-v1\.10/);
  assert.match(workflow, /Immutable runtime v1\.10 sources changed after the published release source/);
  assert.match(workflow, /Leaving immutable runtime release .* unchanged/);
  assert.match(workflow, /--target "\$PATCH_NATIVE_RUNTIME_V110_SOURCE_SHA"/);
  assert.doesNotMatch(workflow, /tag_sha" != "\$GITHUB_SHA/);
});

test('runtime v1.10 publication has an explicit checksum and release-asset digest round trip', () => {
  assert.match(workflow, /sha256sum patch-windows-native-gui-runtime\.exe > SHA256SUMS\.txt/);
  assert.match(workflow, /sha256sum patch-macos-native-gui-runtime\.bin > SHA256SUMS\.txt/);
  assert.match(workflow, /sha256sum patch-linux-native-gui-runtime\.bin > SHA256SUMS\.txt/);
  assert.match(workflow, /gh release download/);
  assert.match(workflow, /sha256sum -c SHA256SUMS\.txt/);
  assert.match(workflow, /\.assets\[\] \| select\(\.name ==/);
  assert.ok(workflow.includes('^sha256:[0-9a-f]{64}$'));
  assert.match(workflow, /Published GitHub digest mismatch/);
  assert.match(workflow, /Published runtime tag .* is not bound to immutable source commit/);
});

test('Current Ready contract is explicitly bound to the published runtime v1.10 line', () => {
  assert.match(currentContract, /PATCH_CURRENT_NATIVE_CONTRACT_ID = 'native-gui-1\.9\/payload-19\/runtime-1\.10'/);
  assert.match(currentContract, /PATCH_CURRENT_NATIVE_RUNTIME_VERSION = '1\.10'/);
  assert.match(currentContract, /windows: 'native-win32-runtime-v1\.10'/);
  assert.match(currentContract, /macos: 'native-macos-runtime-v1\.10'/);
  assert.match(currentContract, /linux: 'native-linux-runtime-v1\.10'/);
});
