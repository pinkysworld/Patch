import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

function read(path) { return fs.readFileSync(path, 'utf8'); }

test('Slider Stage 1 remains reproducible while Studio exposes the current native v1.5 contract', () => {
  const index = read('web/index.html');
  const language = read('web/language.html');
  const docs = read('web/docs.html');
  const slider = read('web/slider-stage1.js');
  const buildSite = read('scripts/build-site.js');
  const sw = read('web/sw.js');
  const contract = read('docs/SLIDER_STAGE1.md');

  assert.match(index, /id="addSlider"/);
  assert.match(index, /value="sliderWindow">Slider app<\/option>/);
  assert.match(index, /native Slider/i);
  assert.match(index, /Native GUI IR 1\.4 \/ payload v14 \/ runtime v1\.5/i);
  assert.match(index, /frozen payload v12 \/ runtime v1\.3 compatibility line remains Slider fail-closed/i);
  assert.match(language, /data-slider-language-support="native-v14"/);
  assert.match(language, /slider 0\.\.100 as volume step 5/);
  assert.match(language, /native Slider support/i);
  assert.match(language, /frozen compatibility/i);
  assert.match(docs, /docs\/SLIDER_STAGE1\.md/);
  assert.match(contract, /Slider Stage 1/);
  assert.match(contract, /Window event adapter \*\*0\.9\*\*/);
  assert.match(contract, /Change IR remains \*\*0\.10\*\*/);
  assert.match(contract, /Native GUI IR \*\*1\.3\*\*/);
  assert.match(contract, /sealed payload \*\*v13\*\*/);
  assert.match(contract, /native runtime \*\*v1\.4\*\*/);
  assert.match(slider, /addDesignerControl\(code\.value, 'slider'/);
  assert.match(buildSite, /'slider-stage1\.js'/);
  assert.match(sw, /'\.\/slider-stage1\.js'/);
});

test('Standalone Web and current native Ready/offline paths opt into Slider while frozen v1.3 remains fail-closed', () => {
  const webRuntime = read('src/window-webapp.js');
  const nativeBuild = read('web/native-build.js');
  const offlineLinker = read('src/offline-linker.js');
  const currentNative = read('src/native-current-contract.js');
  const windowBuild = read('src/window-build.js');
  const nativeV12 = read('src/native-gui-ir-v12.js');

  assert.match(webRuntime, /allowSlider:\s*true/);
  assert.match(nativeBuild, /allowSlider:\s*true/);
  assert.match(nativeBuild, /native-current-contract\.js/);
  assert.match(nativeBuild, /buildCurrentNativeGuiIR as buildNativeGuiIR/);
  assert.match(nativeBuild, /sealCurrentNativeGuiRuntime/);
  assert.match(nativeBuild, /PATCH_CURRENT_NATIVE_PAYLOAD_VERSION/);
  assert.doesNotMatch(nativeBuild, /from ['"]\.\.\/src\/native-gui-ir-v13\.js['"]/);
  assert.doesNotMatch(nativeBuild, /from ['"]\.\.\/src\/sealed-native-gui-v13\.js['"]/);
  assert.match(offlineLinker, /allowSlider:\s*guiPayloadVersion >= 13/);
  assert.match(offlineLinker, /buildCurrentNativeGuiIR/);
  assert.match(offlineLinker, /sealCurrentNativeGuiRuntime/);
  assert.match(currentNative, /PATCH_CURRENT_NATIVE_CONTRACT_ID = 'native-gui-1\.4\/payload-14\/runtime-1\.5'/);
  assert.match(currentNative, /buildNativeGuiIRV14/);
  assert.match(currentNative, /sealNativeGuiRuntimeV14/);
  assert.match(windowBuild, /if \(sliders && !options\.allowSlider\)/);
  assert.match(windowBuild, /Slider is not enabled for this Window target/);
  assert.doesNotMatch(nativeV12, /control\.type === 'slider'|control==='slider'|control === 'slider'/);
});

test('Slider is available in both top-level and nested Tabs Designer insertion paths', () => {
  const core = read('web/designer-core-selection.js');
  const tabs = read('src/designer-tabs-nested.js');
  assert.match(core, /\['addSlider', 'slider'\]/);
  assert.match(tabs, /SUPPORTED_TAB_CONTROLS = new Set\(\[[^\]]*'slider'/s);
  assert.match(tabs, /slider 0\.\.100 as \$\{uniqueId\('slider', usedIds\)\} step 1/);
});

test('Slider browser modules remain syntactically valid', () => {
  for (const path of [
    'src/parser.js','src/compiler.js','src/designer.js','src/designer-tabs-nested.js','src/window-build.js','src/window-events.js','src/window-webapp.js','src/window-web-accessibility.js','src/native-current-contract.js','web/playground.js','web/designer-core-selection.js','web/slider-stage1.js'
  ]) execFileSync(process.execPath, ['--check', path], { stdio: 'pipe' });
});
