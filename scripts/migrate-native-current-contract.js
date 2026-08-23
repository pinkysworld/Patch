#!/usr/bin/env node
import fs from 'node:fs';

const read = path => fs.readFileSync(path, 'utf8').replace(/\r\n/g, '\n');
const write = (path, content) => fs.writeFileSync(path, content);

function replaceOnce(path, from, to) {
  const source = read(path);
  if (!source.includes(from)) throw new Error(`${path}: expected migration marker not found: ${from}`);
  const first = source.indexOf(from);
  if (source.indexOf(from, first + from.length) !== -1) throw new Error(`${path}: migration marker is not unique: ${from}`);
  write(path, source.replace(from, to));
}

replaceOnce(
  'web/native-build.js',
  "import { buildNativeGuiIRV13 as buildNativeGuiIR } from '../src/native-gui-ir-v13.js';\nimport { PATCH_SEALED_NATIVE_GUI_SLIDER_VERSION, sealNativeGuiRuntimeV13 } from '../src/sealed-native-gui-v13.js';",
  "import {\n  PATCH_CURRENT_NATIVE_PAYLOAD_VERSION,\n  buildCurrentNativeGuiIR as buildNativeGuiIR,\n  sealCurrentNativeGuiRuntime\n} from '../src/native-current-contract.js';"
);
replaceOnce('web/native-build.js', 'sealNativeGuiRuntimeV13(runtimeBytes, nativeGui', 'sealCurrentNativeGuiRuntime(runtimeBytes, nativeGui');
{
  const source = read('web/native-build.js');
  write('web/native-build.js', source.replaceAll('PATCH_SEALED_NATIVE_GUI_SLIDER_VERSION', 'PATCH_CURRENT_NATIVE_PAYLOAD_VERSION'));
}

replaceOnce(
  'src/offline-linker.js',
  "import { buildNativeGuiIRV13 } from './native-gui-ir-v13.js';",
  "import { buildCurrentNativeGuiIR, sealCurrentNativeGuiRuntime } from './native-current-contract.js';"
);
replaceOnce('src/offline-linker.js', "import { sealNativeGuiRuntimeV13 } from './sealed-native-gui-v13.js';\n", '');
replaceOnce('src/offline-linker.js', '? buildNativeGuiIRV13(compiled)', '? buildCurrentNativeGuiIR(compiled)');
replaceOnce('src/offline-linker.js', ': sealNativeGuiRuntimeV13(runtime, nativeGui, { platform });', ': sealCurrentNativeGuiRuntime(runtime, nativeGui, { platform });');

replaceOnce(
  'src/native-gui-build-plan.js',
  "import { buildNativeGuiIRV13, flattenNativeGuiControlsV13 } from './native-gui-ir-v13.js';",
  "import { buildCurrentNativeGuiIR, flattenCurrentNativeGuiControls } from './native-current-contract.js';"
);
replaceOnce('src/native-gui-build-plan.js', 'const gui = buildNativeGuiIRV13(compiled);', 'const gui = buildCurrentNativeGuiIR(compiled);');
replaceOnce('src/native-gui-build-plan.js', 'flattenNativeGuiControlsV13(gui).length', 'flattenCurrentNativeGuiControls(gui).length');

replaceOnce(
  'scripts/build-site.js',
  "'native-gui-ir-v12.js','native-gui-ir-v13.js','native-tree-backend-adapter.js'",
  "'native-gui-ir-v12.js','native-gui-ir-v13.js','native-current-contract.js','native-tree-backend-adapter.js'"
);
replaceOnce(
  'web/sw.js',
  "'../src/native-gui-ir-v12.js', '../src/native-gui-ir-v13.js', '../src/native-tree-backend-adapter.js'",
  "'../src/native-gui-ir-v12.js', '../src/native-gui-ir-v13.js', '../src/native-current-contract.js', '../src/native-tree-backend-adapter.js'"
);
replaceOnce(
  '.github/workflows/pages.yml',
  '      - src/native-gui-ir-v13.js\n',
  '      - src/native-gui-ir-v13.js\n      - src/native-current-contract.js\n'
);

replaceOnce(
  'scripts/check-project-surface.js',
  "  gui13: read('src/native-gui-ir-v13.js'),\n",
  "  gui13: read('src/native-gui-ir-v13.js'),\n  nativeCurrent: read('src/native-current-contract.js'),\n"
);
replaceOnce(
  'scripts/check-project-surface.js',
  "requireAll('Native payload v13 implementation', files.sealed13, ['PATCH_SEALED_NATIVE_GUI_SLIDER_VERSION','sealNativeGuiRuntimeV13']);\n",
  "requireAll('Native payload v13 implementation', files.sealed13, ['PATCH_SEALED_NATIVE_GUI_SLIDER_VERSION','sealNativeGuiRuntimeV13']);\nrequireAll('Stable current native product entry point', files.nativeCurrent, [\n  'PATCH_CURRENT_NATIVE_GUI_IR_VERSION','PATCH_CURRENT_NATIVE_PAYLOAD_VERSION','PATCH_CURRENT_NATIVE_RUNTIME_VERSION',\n  'native-win32-runtime-v1.4','native-macos-runtime-v1.4','native-linux-runtime-v1.4','buildCurrentNativeGuiIR','sealCurrentNativeGuiRuntime'\n]);\n"
);
replaceOnce(
  'scripts/check-project-surface.js',
  "'call-site-validation.js','independent-range-expression.js','independent-guard-expression.js','native-gui-ir-v13.js','sealed-native-gui-v13.js'",
  "'call-site-validation.js','independent-range-expression.js','independent-guard-expression.js','native-current-contract.js','native-gui-ir-v13.js','sealed-native-gui-v13.js'"
);
replaceOnce(
  'scripts/check-project-surface.js',
  "'./src/independent-guard-expression.js','./src/native-gui-ir-v13.js','./src/sealed-native-gui-v13.js'",
  "'./src/independent-guard-expression.js','./src/native-current-contract.js','./src/native-gui-ir-v13.js','./src/sealed-native-gui-v13.js'"
);

replaceOnce(
  'docs/NATIVE_GUI.md',
  'Current token-free Ready/offline Window builds use **Native GUI IR 1.3**, **sealed payload v13** and **runtime v1.4**.\n',
  'Current token-free Ready/offline Window builds use **Native GUI IR 1.3**, **sealed payload v13** and **runtime v1.4**. Product-facing JavaScript imports this line through `src/native-current-contract.js`; version-numbered IR/sealer modules are retained behind that facade for frozen compatibility and regression evidence.\n'
);

write('docs/NATIVE_COMPATIBILITY.md', `# Native compatibility boundary\n\nPatch has one product-facing native desktop contract and several frozen compatibility contracts.\n\n## Current product contract\n\nCurrent Ready/offline Window builds use **Native GUI IR 1.3 / sealed payload v13 / runtime v1.4**. JavaScript product consumers import \`src/native-current-contract.js\`, which exposes the current builder, validator, payload encoder/sealer and the three current runtime release tags.\n\nThe facade exists so a future native version update changes one product boundary instead of spreading a new version suffix through Studio, offline linking and build planning.\n\n## Frozen compatibility contracts\n\nVersion-numbered files such as \`native-gui-ir-v08.js\` through \`native-gui-ir-v12.js\`, their sealed payload implementations, backend adapters and compatibility fixtures remain executable because older Table, list, Menu and TreeView contracts are intentionally preserved rather than redefined. They are not the default product import surface.\n\nHistorical direct-native smoke workflows are manual compatibility audits. Current v1.4 release workflows remain automatic for changes to the active runtime implementation.\n\n## Maintenance rule\n\n- New product code imports \`native-current-contract.js\`.\n- A version-numbered module is imported directly only when implementing or testing that exact frozen format.\n- Compatibility files are removed only when their executable consumers and documented support boundary are retired together.\n- The beta.32 formal assurance boundary is independent of this packaging facade and is unchanged.\n`);

write('tests/native-current-contract.test.js', `import test from 'node:test';\nimport assert from 'node:assert/strict';\nimport fs from 'node:fs';\nimport { compile } from '../src/compiler.js';\nimport {\n  PATCH_CURRENT_NATIVE_GUI_IR_VERSION,\n  PATCH_CURRENT_NATIVE_PAYLOAD_VERSION,\n  PATCH_CURRENT_NATIVE_RUNTIME_VERSION,\n  PATCH_CURRENT_NATIVE_RUNTIME_TAGS,\n  buildCurrentNativeGuiIR,\n  validateCurrentNativeGuiIR,\n  encodeCurrentNativeGuiPayload,\n  currentNativeContract\n} from '../src/native-current-contract.js';\n\ntest('current native facade pins the product contract to IR 1.3 / payload 13 / runtime 1.4', () => {\n  assert.equal(PATCH_CURRENT_NATIVE_GUI_IR_VERSION, '1.3');\n  assert.equal(PATCH_CURRENT_NATIVE_PAYLOAD_VERSION, 13);\n  assert.equal(PATCH_CURRENT_NATIVE_RUNTIME_VERSION, '1.4');\n  assert.deepEqual(PATCH_CURRENT_NATIVE_RUNTIME_TAGS, {\n    windows: 'native-win32-runtime-v1.4',\n    macos: 'native-macos-runtime-v1.4',\n    linux: 'native-linux-runtime-v1.4'\n  });\n  assert.deepEqual(currentNativeContract(), {\n    guiIr: '1.3', payload: 13, runtime: '1.4', runtimeTags: PATCH_CURRENT_NATIVE_RUNTIME_TAGS\n  });\n});\n\ntest('current native facade builds and encodes a Slider-capable Window without changing the versioned implementation', () => {\n  const source = fs.readFileSync('examples/slider-window.patch', 'utf8');\n  const compiled = compile(source, { name: 'CurrentNative', kind: 'window' });\n  const ir = buildCurrentNativeGuiIR(compiled);\n  assert.equal(ir.version, '1.3');\n  assert.equal(validateCurrentNativeGuiIR(ir), ir);\n  const payload = encodeCurrentNativeGuiPayload(ir);\n  assert.ok(payload instanceof Uint8Array);\n  assert.ok(payload.byteLength > 0);\n});\n`);

write('tests/native-current-surface.test.js', `import test from 'node:test';\nimport assert from 'node:assert/strict';\nimport fs from 'node:fs';\n\nconst read = path => fs.readFileSync(path, 'utf8');\n\ntest('current product consumers use the stable native contract facade', () => {\n  const studio = read('web/native-build.js');\n  const offline = read('src/offline-linker.js');\n  const plan = read('src/native-gui-build-plan.js');\n  for (const [label, source] of [['Studio', studio], ['offline linker', offline], ['native build plan', plan]]) {\n    assert.match(source, /native-current-contract\\.js/, label);\n    assert.doesNotMatch(source, /from ['\"](?:\\.\\.\\/)?(?:src\\/)?native-gui-ir-v13\\.js['\"]/, label);\n  }\n  assert.doesNotMatch(studio, /sealed-native-gui-v13\\.js/);\n  assert.doesNotMatch(offline, /sealed-native-gui-v13\\.js/);\n});\n\ntest('browser packaging contains the stable facade while versioned compatibility modules remain available', () => {\n  const buildSite = read('scripts/build-site.js');\n  const sw = read('web/sw.js');\n  assert.match(buildSite, /native-current-contract\\.js/);\n  assert.match(sw, /native-current-contract\\.js/);\n  for (const version of ['v08','v09','v10','v11','v12','v13']) assert.match(buildSite, new RegExp('native-gui-ir-' + version + '\\\\.js'));\n});\n\ntest('native compatibility documentation makes current versus frozen ownership explicit', () => {\n  const docs = read('docs/NATIVE_COMPATIBILITY.md');\n  for (const marker of ['Native GUI IR 1.3 / sealed payload v13 / runtime v1.4','native-current-contract.js','Frozen compatibility contracts','beta.32']) assert.ok(docs.includes(marker), marker);\n});\n`);

console.log('Native current-contract migration applied.');
