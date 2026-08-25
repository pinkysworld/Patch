import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

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
  for (const source of [studio, offline, plan]) {
    assert.doesNotMatch(source, /native-gui-ir-v1[01]\.js|native-gui-ir-v0[89]\.js|from ['"](?:\.\.\/)?(?:src\/)?native-gui-ir\.js['"]|sealed-native-gui-v11\.js/);
  }
});

test('browser packaging ships current and frozen contracts without retired v07-v11 copies', () => {
  const buildSite = read('scripts/build-site.js');
  const sw = read('web/sw.js');
  assert.match(buildSite, /native-current-contract\.js/);
  assert.match(buildSite, /native-frozen-contract\.js/);
  assert.match(buildSite, /native-gui-frozen-lower\.js/);
  assert.match(buildSite, /native-gui-frozen-seal\.js/);
  assert.match(sw, /native-current-contract\.js/);
  assert.match(sw, /native-frozen-contract\.js/);
  assert.match(sw, /native-gui-frozen-lower\.js/);
  for (const version of ['v12','v13','v14']) assert.match(buildSite, new RegExp('native-gui-ir-' + version + '\\.js'));
  for (const retired of ['native-gui-ir.js','native-gui-ir-v08.js','native-gui-ir-v09.js','native-gui-ir-v10.js','native-gui-ir-v11.js','sealed-native-gui.js','sealed-native-gui-v11.js']) {
    assert.equal(buildSite.includes(`'${retired}'`), false, `site builder still copies ${retired}`);
    assert.equal(sw.includes(`../src/${retired}`), false, `service worker still caches ${retired}`);
  }
});

test('native compatibility documentation makes current versus frozen ownership explicit', () => {
  const docs = read('docs/NATIVE_COMPATIBILITY.md');
  for (const marker of [
    'Native GUI IR 1.4 / sealed payload v14 / runtime v1.5',
    'native-current-contract.js',
    'native-gui-1.4/payload-14/runtime-1.5',
    'native-frozen-contract.js',
    'native-gui-1.2/payload-12/runtime-1.3',
    'Historical include chain',
    'IR **0.7**',
    'do not gate Ready/Pages',
    'Frozen TreeView contract',
    'beta.32'
  ]) assert.ok(docs.includes(marker), marker);
  assert.equal(docs.includes('The remaining work is keeping unversioned historical bases'), false);
});

test('README and public website name both live native contracts', () => {
  const readme = read('README.md');
  const docsPage = read('web/docs.html');
  const downloads = read('web/downloads.html');
  assert.match(readme, /native-current-contract\.js/);
  assert.match(readme, /native-frozen-contract\.js/);
  assert.match(docsPage, /docs\/NATIVE_COMPATIBILITY\.md/);
  assert.match(docsPage, /two live native product contracts/);
  assert.match(downloads, /Those two live contracts are the product import surface/);
});

function relativeImports(source) {
  const found = [];
  const patterns = [
    /from\s+['"](\.{1,2}\/[^'"]+)['"]/g,
    /\bimport\s*\(\s*['"](\.{1,2}\/[^'"]+)['"]\s*\)/g
  ];
  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern)) found.push(match[1].split(/[?#]/, 1)[0]);
  }
  return found;
}

function importGraph(entry) {
  const seen = new Set();
  const queue = [path.resolve(entry)];
  while (queue.length) {
    const file = queue.pop();
    if (seen.has(file) || !fs.existsSync(file)) continue;
    seen.add(file);
    for (const specifier of relativeImports(fs.readFileSync(file, 'utf8'))) {
      queue.push(path.resolve(path.dirname(file), specifier));
    }
  }
  return [...seen].map(file => path.relative(process.cwd(), file).split(path.sep).join('/'));
}

test('current and frozen facades no longer import the versioned v11-to-v07 include chain', () => {
  const forbidden = new Set([
    'src/native-gui-ir.js',
    'src/native-gui-ir-v08.js',
    'src/native-gui-ir-v09.js',
    'src/native-gui-ir-v10.js',
    'src/native-gui-ir-v11.js',
    'src/sealed-native-gui.js',
    'src/sealed-native-gui-v11.js'
  ]);
  for (const entry of ['src/native-current-contract.js', 'src/native-frozen-contract.js']) {
    const graph = importGraph(entry);
    assert.ok(graph.includes('src/native-gui-frozen-lower.js'), `${entry} must use frozen lowering snapshot`);
    if (entry.endsWith('native-frozen-contract.js')) {
      assert.ok(graph.includes('src/native-gui-frozen-seal.js'), `${entry} must use frozen sealer snapshot`);
    }
    for (const file of graph) assert.equal(forbidden.has(file), false, `${entry} still imports ${file}`);
  }
});
