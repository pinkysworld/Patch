import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const workflow = fs.readFileSync(new URL('../.github/workflows/native-sealed-window-icon-runtime-v110.yml', import.meta.url), 'utf8');
const currentContract = fs.readFileSync(new URL('../src/native-current-contract.js', import.meta.url), 'utf8');

test('runtime v1.10 workflow builds on main and publishes the three promotion-candidate release tags', () => {
  assert.match(workflow, /\n  push:\n    branches: \[main\]/);
  assert.match(workflow, /publish:\n    if: github\.event_name == 'push' && github\.ref == 'refs\/heads\/main'/);
  assert.match(workflow, /native-win32-runtime-v1\.10/);
  assert.match(workflow, /native-macos-runtime-v1\.10/);
  assert.match(workflow, /native-linux-runtime-v1\.10/);
  assert.match(workflow, /--target "\$GITHUB_SHA"/);
  assert.match(workflow, /Refusing to replace immutable runtime release/);
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
  assert.match(workflow, /Published runtime tag .* is not bound to source commit/);
});

test('publishing runtime v1.10 does not silently promote the Current Ready product contract', () => {
  assert.match(currentContract, /PATCH_CURRENT_NATIVE_CONTRACT_ID = 'native-gui-1\.7\/payload-17\/runtime-1\.8'/);
  assert.match(currentContract, /PATCH_CURRENT_NATIVE_RUNTIME_VERSION = '1\.8'/);
  assert.match(currentContract, /windows: 'native-win32-runtime-v1\.8'/);
  assert.match(currentContract, /macos: 'native-macos-runtime-v1\.8'/);
  assert.match(currentContract, /linux: 'native-linux-runtime-v1\.8'/);
  assert.doesNotMatch(currentContract, /runtime-v1\.10/);
});
