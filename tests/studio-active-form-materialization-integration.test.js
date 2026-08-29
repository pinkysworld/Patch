import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const playground = fs.readFileSync('web/playground.js', 'utf8');
const formsDesigner = fs.readFileSync('web/forms-designer.js', 'utf8');
const siteBuilder = fs.readFileSync('scripts/build-site.js', 'utf8');
const serviceWorker = fs.readFileSync('web/sw.js', 'utf8');

test('Designer renderer materializes controls only for the canonical active Form', () => {
  assert.match(playground, /createStudioFormMaterializationPlan/);
  assert.match(playground, /renderWindows\(designerCanvas, preview\.ui, false, \{ materialization \}\)/);
  assert.match(playground, /const deferDesignerForm = Boolean\(!interactive && materialization\?\.modes\?\.\[windowIndex\] === 'shell'\)/);
  assert.match(playground, /const deferForm = deferHiddenForm \|\| deferDesignerForm/);
  assert.match(playground, /if \(!deferForm\) \{/);
  assert.match(playground, /patchDesignerMaterializedForm/);
});

test('Form selector remains the active-Form owner and requests rematerialization when it changes', () => {
  assert.match(formsDesigner, /select\.addEventListener\('change',[\s\S]*requestActiveFormMaterialization\(\)/);
  assert.match(formsDesigner, /function requestActiveFormMaterialization\(\)/);
  assert.match(formsDesigner, /patch-designer-active-form-change/);
  assert.match(playground, /patch-designer-active-form-change/);
});

test('nested Designer tab switches preserve the current active-Form materialization plan', () => {
  const renderStart = playground.indexOf('function renderWindows(');
  const tabsStart = playground.indexOf('function createTabsElement(');
  assert.notEqual(renderStart, -1);
  assert.notEqual(tabsStart, -1);
  assert.match(playground.slice(renderStart, tabsStart), /materialization,\s*windowIndex/);
  assert.match(playground.slice(tabsStart), /renderWindows\(context\.container, context\.windows, context\.interactive, \{ materialization: context\.materialization \}\)/);
});

test('active Form materialization preserves lightweight shells for every source Form', () => {
  const renderStart = playground.indexOf('function renderWindows(');
  const renderEnd = playground.indexOf('function createControlElement(', renderStart);
  assert.notEqual(renderStart, -1);
  assert.notEqual(renderEnd, -1);
  const renderer = playground.slice(renderStart, renderEnd);
  assert.match(renderer, /windows\.forEach\(\(model, windowIndex\) => \{/);
  assert.match(renderer, /document\.createElement\('section'\)/);
  assert.match(renderer, /container\.appendChild\(shell\)/);
  assert.doesNotMatch(renderer, /windows\s*=\s*windows\.filter/);
});

test('hosted and Offline Studio package the shared materialization policy', () => {
  assert.ok(siteBuilder.includes("'studio-form-materialization.js'"));
  assert.ok(serviceWorker.includes('../src/studio-form-materialization.js'));
});
