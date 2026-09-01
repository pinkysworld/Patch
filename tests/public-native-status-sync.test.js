import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = path => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

const currentContract = read('src/native-current-contract.js');
const surfaces = {
  nativeGui: read('docs/NATIVE_GUI.md'),
  nativeApps: read('docs/NATIVE_APPS.md'),
  offlineCompiler: read('docs/OFFLINE_COMPILER.md'),
  targets: read('docs/TARGETS.md'),
  studio: read('docs/PATCH_STUDIO.md'),
  beta36: read('docs/BETA36.md'),
  studioWeb: read('web/index.html'),
  languageWeb: read('web/language.html')
};

test('public native status keeps Current Ready at IR 1.9 payload v19 runtime v1.10', () => {
  assert.match(currentContract, /native-gui-1\.9\/payload-19\/runtime-1\.10/);

  for (const [name, text] of Object.entries(surfaces)) {
    assert.match(text, /1\.9/, `${name} does not name Current Ready IR 1.9`);
    assert.match(text, /v19|payload \*\*v19\*\*|payload v19/, `${name} does not name Current Ready payload v19`);
    assert.match(text, /v1\.10|runtime \*\*v1\.10\*\*|runtime v1\.10/, `${name} does not name Current Ready runtime v1.10`);
  }
});

test('public surfaces distinguish Current Ready v1.10 from explicit v1.8 compatibility', () => {
  for (const [name, text] of Object.entries(surfaces)) {
    assert.doesNotMatch(text, /1\.9[^\n]{0,180}(not promoted|not Current Ready|awaits? .*promotion|awaiting .*promotion)/i,
      `${name} still describes Current Ready v1.10 as awaiting promotion`);
  }
  for (const [name, text] of Object.entries({
    nativeGui: surfaces.nativeGui,
    nativeApps: surfaces.nativeApps,
    offlineCompiler: surfaces.offlineCompiler,
    targets: surfaces.targets,
    studio: surfaces.studio,
    beta36: surfaces.beta36,
    studioWeb: surfaces.studioWeb,
    languageWeb: surfaces.languageWeb
  })) {
    assert.match(text, /v1\.8|runtime \*\*v1\.8\*\*|runtime v1\.8/, `${name} should retain the explicit v1.8 compatibility history`);
  }
});

test('Studio homepage advertises promoted native R1 features instead of fail-closing them', () => {
  assert.doesNotMatch(surfaces.studioWeb, /Current Ready IR 1\.7 still fails closed/);
  assert.doesNotMatch(surfaces.studioWeb, /awaits release\/digest\/Offline-Compiler promotion/i);
  assert.match(surfaces.studioWeb, /Button ImageList and application\/Form icons are supported on the Current Ready desktop line/);
  assert.match(surfaces.studioWeb, /Native GUI IR 1\.9 \/ payload v19 \/ runtime v1\.10 is the current Ready desktop line/);
});

test('offline and target docs do not regress to old current runtime release tags', () => {
  for (const text of [surfaces.offlineCompiler, surfaces.targets, surfaces.nativeApps]) {
    assert.doesNotMatch(text, /Current native Ready runtime release tags are:[\s\S]*native-win32-runtime-v1\.6/);
    assert.doesNotMatch(text, /current Ready Window path[^\n]*payload \*\*v15\*\*[^\n]*runtime \*\*v1\.6\*\*/i);
  }
});
