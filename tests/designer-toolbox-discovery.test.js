import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { DESIGNER_TOOL_CATALOG, groupedDesignerTools } from '../web/designer-toolbox.js';

test('Designer control picker exposes every existing top-level toolbox control exactly once', () => {
  const expected = ['addText','addButton','addInput','addCheckbox','addRadio','addCombo','addListbox','addSlider','addTable','addTree','addTabs','addPanel','addPicture','addStatusbar','addTimer'];
  assert.deepEqual(DESIGNER_TOOL_CATALOG.map(tool => tool.buttonId), expected);
  assert.equal(new Set(DESIGNER_TOOL_CATALOG.map(tool => tool.buttonId)).size, expected.length);
});

test('Designer control picker groups controls by user-facing purpose', () => {
  const groups = groupedDesignerTools();
  assert.deepEqual(groups.map(group => group.group), ['Basic','Choices','Data','Containers','Graphics','Chrome','Nonvisual']);
  assert.deepEqual(groups.find(group => group.group === 'Basic').tools.map(tool => tool.label), ['Text','Button','Input','Checkbox']);
  assert.deepEqual(groups.find(group => group.group === 'Choices').tools.map(tool => tool.label), ['Radio group','ComboBox','ListBox','Slider']);
  assert.deepEqual(groups.find(group => group.group === 'Data').tools.map(tool => tool.label), ['Table','TreeView']);
  assert.deepEqual(groups.find(group => group.group === 'Containers').tools.map(tool => tool.label), ['Tabs','Panel']);
  assert.deepEqual(groups.find(group => group.group === 'Graphics').tools.map(tool => tool.label), ['Picture']);
  assert.deepEqual(groups.find(group => group.group === 'Chrome').tools.map(tool => tool.label), ['StatusBar']);
  assert.deepEqual(groups.find(group => group.group === 'Nonvisual').tools.map(tool => tool.label), ['Timer']);
});

test('Designer picker still activates controls through source-backed toolbox buttons', () => {
  const source = fs.readFileSync('web/designer-toolbox.js', 'utf8');
  assert.match(source, /button\.click\(\)/);
  assert.match(source, /addDesignerControl\(code\.value, 'picture'/);
  assert.match(source, /designerInspectorPictureSource/);
  assert.match(source, /addDesignerControl\(code\.value, 'statusbar'/);
  assert.match(source, /addDesignerControl\(source, 'timer'/);
  assert.match(source, /stripDesignerTimerLayout/);
  assert.match(source, /Ctrl\/Cmd\+Shift\+A/);
});

test('mobile Designer replaces the long icon strip with the categorized picker', () => {
  const css = fs.readFileSync('web/designer-toolbox.css', 'utf8');
  assert.match(css, /@media \(max-width: 760px\)/);
  assert.match(css, /#designer \.designer-toolbar > button\[id\^="add"\][\s\S]*display: none/);
  assert.match(css, /\.designer-add-control-picker/);
  assert.match(css, /@media \(forced-colors: active\)/);
});

test('desktop Designer rail gives Slider, Tabs, Panel, Picture, StatusBar and Timer stable source-backed slots', () => {
  const inspectorCss = fs.readFileSync('web/designer-inspector.css', 'utf8');
  const toolboxCss = fs.readFileSync('web/designer-toolbox.css', 'utf8');
  assert.match(inspectorCss, /#designer #addSlider \{ top: 287px; \}/);
  assert.match(inspectorCss, /#designer #addTable \{ top: 321px; \}/);
  assert.match(inspectorCss, /#designer #addTree \{ top: 355px; \}/);
  assert.match(inspectorCss, /#designer #addTabs \{ top: 389px; \}/);
  assert.match(inspectorCss, /#designer #addSlider::before \{ content: "↔";/);
  assert.match(toolboxCss, /#designer #addPanel \{ top: 423px; \}/);
  assert.match(toolboxCss, /#designer #addPanel::before \{ content: "▣"; \}/);
  assert.match(toolboxCss, /#designer #addPicture \{ top: 457px; \}/);
  assert.match(toolboxCss, /#designer #addPicture::before \{ content: "▧"; \}/);
  assert.match(toolboxCss, /#designer #addStatusbar \{ top: 491px; \}/);
  assert.match(toolboxCss, /#designer #addStatusbar::before \{ content: "▰"; \}/);
  assert.match(toolboxCss, /#designer #addTimer \{ top: 525px; \}/);
  assert.match(toolboxCss, /#designer #addTimer::before \{ content: "◷"; \}/);
});

test('public Studio and offline PWA package Designer toolbox discovery assets', () => {
  const workspace = fs.readFileSync('web/designer-workspace.js', 'utf8');
  const buildSite = fs.readFileSync('scripts/build-site.js', 'utf8');
  const sw = fs.readFileSync('web/sw.js', 'utf8');
  assert.match(workspace, /import '\.\/designer-toolbox\.js'/);
  assert.match(buildSite, /'designer-toolbox\.js'/);
  assert.match(buildSite, /'designer-toolbox\.css'/);
  assert.match(sw, /'\.\/designer-toolbox\.js'/);
  assert.match(sw, /'\.\/designer-toolbox\.css'/);
});
