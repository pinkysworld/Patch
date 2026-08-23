import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = path => fs.readFileSync(path, 'utf8');

test('current product consumers use the stable native contract facade', () => {
  const studio = read('web/native-build.js');
  const offline = read('src/offline-linker.js');
  const plan = read('src/native-gui-build-plan.js');
  for (const [label, source] of [['Studio', studio], ['offline linker', offline], ['native build plan', plan]]) {
    assert.match(source, /native-current-contract\.js/, label);
    assert.doesNotMatch(source, /from ['"](?:\.\.\/)?(?:src\/)?native-gui-ir-v13\.js['"]/, label);
  }
  assert.doesNotMatch(studio, /sealed-native-gui-v13\.js/);
  assert.doesNotMatch(offline, /sealed-native-gui-v13\.js/);
  assert.match(plan, /native-frozen-contract\.js/);
  assert.match(offline, /native-frozen-contract\.js/);
  assert.doesNotMatch(plan, /from ['"]\.\/native-gui-ir-v12\.js['"]/);
  assert.doesNotMatch(offline, /from ['"]\.\/native-gui-ir-v12\.js['"]/);
  assert.doesNotMatch(offline, /from ['"]\.\/sealed-native-gui-v12\.js['"]/);
});

test('browser packaging contains the stable facade while versioned compatibility modules remain available', () => {
  const buildSite = read('scripts/build-site.js');
  const sw = read('web/sw.js');
  assert.match(buildSite, /native-current-contract\.js/);
  assert.match(sw, /native-current-contract\.js/);
  for (const version of ['v08','v09','v10','v11','v12','v13']) assert.match(buildSite, new RegExp('native-gui-ir-' + version + '\\.js'));
});

test('native compatibility documentation makes current versus frozen ownership explicit', () => {
  const docs = read('docs/NATIVE_COMPATIBILITY.md');
  for (const marker of [
    'Native GUI IR 1.3 / sealed payload v13 / runtime v1.4',
    'native-current-contract.js',
    'native-gui-1.3/payload-13/runtime-1.4',
    'native-frozen-contract.js',
    'native-gui-1.2/payload-12/runtime-1.3',
    'Historical include chain',
    'IR **0.7**',
    'Frozen TreeView contract',
    'beta.32'
  ]) assert.ok(docs.includes(marker), marker);
});

test('README and public website name both live native contracts', () => {
  const readme = read('README.md');
  const docsPage = read('web/docs.html');
  const downloads = read('web/downloads.html');
  for (const marker of ['native-current-contract.js', 'native-frozen-contract.js', 'docs/NATIVE_COMPATIBILITY.md']) {
    assert.ok(readme.includes(marker), marker);
  }
  assert.match(docsPage, /docs\/NATIVE_COMPATIBILITY\.md/);
  assert.match(docsPage, /two live native product contracts/);
  assert.match(downloads, /Those two live contracts are the product import surface/);
});

