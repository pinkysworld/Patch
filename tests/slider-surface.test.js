import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

function read(path) { return fs.readFileSync(path, 'utf8'); }

test('Slider Stage 1 stays visible across Studio, public docs and the PWA bundle', () => {
  const index = read('web/index.html');
  const language = read('web/language.html');
  const docs = read('web/docs.html');
  const slider = read('web/slider-stage1.js');
  const buildSite = read('scripts/build-site.js');
  const sw = read('web/sw.js');
  const contract = read('docs/SLIDER_STAGE1.md');

  assert.match(index, /id="addSlider"/);
  assert.match(index, /Slider Stage 1/);
  assert.match(index, /browser-only until a later versioned native contract/i);
  assert.match(language, /data-slider-language-support="browser-stage1"/);
  assert.match(language, /slider 0\.\.100 as volume step 5/);
  assert.match(language, /Native GUI IR 1\.2 \/ payload v12 \/ runtime v1\.3.*does <strong>not<\/strong> claim Slider support/s);
  assert.match(docs, /docs\/SLIDER_STAGE1\.md/);
  assert.match(docs, /Slider Stage 1 is not part of this frozen native line/);
  assert.match(contract, /Window event adapter \*\*0\.9\*\*/);
  assert.match(contract, /Change IR remains \*\*0\.10\*\*/);
  assert.match(slider, /addDesignerControl\(code\.value, 'slider'/);
  assert.match(buildSite, /'slider-stage1\.js'/);
  assert.match(sw, /'\.\/slider-stage1\.js'/);
});

test('Standalone Web opts into Slider while current native Ready/offline paths remain fail-closed', () => {
  const webRuntime = read('src/window-webapp.js');
  const nativeBuild = read('web/native-build.js');
  const offlineLinker = read('src/offline-linker.js');
  const windowBuild = read('src/window-build.js');
  const nativeV12 = read('src/native-gui-ir-v12.js');

  assert.match(webRuntime, /allowSlider:\s*true/);
  assert.doesNotMatch(nativeBuild, /allowSlider:\s*true/);
  assert.doesNotMatch(offlineLinker, /allowSlider:\s*true/);
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
    'src/parser.js',
    'src/compiler.js',
    'src/designer.js',
    'src/designer-tabs-nested.js',
    'src/window-build.js',
    'src/window-events.js',
    'src/window-webapp.js',
    'src/window-web-accessibility.js',
    'web/playground.js',
    'web/designer-core-selection.js',
    'web/slider-stage1.js'
  ]) {
    execFileSync(process.execPath, ['--check', path], { stdio: 'pipe' });
  }
});
