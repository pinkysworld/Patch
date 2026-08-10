import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { nativeGuiHostPlan, buildNativeGuiForHost, NativeGuiHostError } from '../src/native-gui-host.js';

test('native GUI host plan hides platform backend details behind one operation', () => {
  assert.deepEqual(
    pick(nativeGuiHostPlan('win32')),
    { platform: 'windows', backend: 'win32', shell: 'native-win32', outputKind: 'Windows .exe' }
  );
  assert.deepEqual(
    pick(nativeGuiHostPlan('darwin')),
    { platform: 'macOS', backend: 'appkit', shell: 'native-appkit', outputKind: 'macOS .app' }
  );
  assert.deepEqual(
    pick(nativeGuiHostPlan('linux')),
    { platform: 'Linux', backend: 'gtk3', shell: 'native-gtk3', outputKind: 'Linux executable' }
  );
  assert.throws(() => nativeGuiHostPlan('freebsd'), error => error instanceof NativeGuiHostError && /Windows, macOS and Linux/.test(error.message));
});

test('unified native GUI dispatcher can emit host backend source without changing Patch syntax', () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'patch-native-gui-host-'));
  try {
    const built = buildNativeGuiForHost('examples/forms-navigation.patch', {
      name: 'UnifiedNativeSmoke',
      outDir: temp,
      emitOnly: true,
      capture: true
    });
    assert.equal(built.platform, process.platform === 'win32' ? 'windows' : process.platform === 'darwin' ? 'macOS' : 'Linux');
    const entries = fs.readdirSync(temp);
    assert.ok(entries.some(name => /\.(win32\.cpp|appkit\.mm|gtk\.cpp)$/.test(name)), entries.join(', '));
    assert.ok(entries.some(name => /-build\.json$/.test(name)), entries.join(', '));
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
});

function pick(plan) {
  return {
    platform: plan.platform,
    backend: plan.backend,
    shell: plan.shell,
    outputKind: plan.outputKind
  };
}
