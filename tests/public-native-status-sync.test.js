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

test('public native status keeps Current Ready at IR 1.7 payload v17 runtime v1.8', () => {
  assert.match(currentContract, /1\.7/);
  assert.match(currentContract, /17/);
  assert.match(currentContract, /1\.8/);

  for (const [name, text] of Object.entries(surfaces)) {
    assert.match(text, /1\.7/, `${name} does not name Current Ready IR 1.7`);
    assert.match(text, /v17|payload \*\*v17\*\*|payload v17/, `${name} does not name Current Ready payload v17`);
    assert.match(text, /v1\.8|runtime \*\*v1\.8\*\*|runtime v1\.8/, `${name} does not name Current Ready runtime v1.8`);
  }
});

test('technical and public status surfaces expose implemented v1.10 as not yet promoted', () => {
  for (const [name, text] of Object.entries(surfaces)) {
    assert.match(text, /1\.9/, `${name} does not name experimental IR 1.9`);
    assert.match(text, /v19|payload \*\*v19\*\*|payload v19/, `${name} does not name experimental payload v19`);
    assert.match(text, /v1\.10|runtime \*\*v1\.10\*\*|runtime v1\.10/, `${name} does not name experimental runtime v1.10`);
    assert.match(text, /not promoted|not Current Ready|awaits? .*promotion|promotion gate|awaiting .*promotion/i,
      `${name} does not preserve the implementation-versus-promotion boundary`);
  }
});

test('Studio homepage no longer describes implemented native R1 features as generic follow-ups', () => {
  assert.doesNotMatch(surfaces.studioWeb, /Native ImageList\/Button-image and application\/window icon transport remain explicit fail-closed follow-ups/i);
  assert.match(surfaces.studioWeb, /Current Ready IR 1\.7 still fails closed/);
  assert.match(surfaces.studioWeb, /implemented IR 1\.9 \/ payload v19 \/ runtime v1\.10/);
});

test('offline and target docs do not regress to old current runtime release tags', () => {
  for (const text of [surfaces.offlineCompiler, surfaces.targets, surfaces.nativeApps]) {
    assert.doesNotMatch(text, /Current native Ready runtime release tags are:[\s\S]*native-win32-runtime-v1\.6/);
    assert.doesNotMatch(text, /current Ready Window path[^\n]*payload \*\*v15\*\*[^\n]*runtime \*\*v1\.6\*\*/i);
  }
});