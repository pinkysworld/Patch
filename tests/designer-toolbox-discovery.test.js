import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { DESIGNER_TOOL_CATALOG, groupedDesignerTools } from '../web/designer-toolbox.js';

test('Designer control picker exposes every existing top-level toolbox control exactly once', () => {
  const expected = ['addText','addButton','addInput','addCheckbox','addRadio','addCombo','addListbox','addTable','addTree','addTabs'];
  assert.deepEqual(DESIGNER_TOOL_CATALOG.map(tool => tool.buttonId), expected);
  assert.equal(new Set(DESIGNER_TOOL_CATALOG.map(tool => tool.buttonId)).size, expected.length);
});

test('Designer control picker groups controls by user-facing purpose', () => {
  const groups = groupedDesignerTools();
  assert.deepEqual(groups.map(group => group.group), ['Basic','Choices','Data','Containers']);
  assert.deepEqual(groups.find(group => group.group === 'Basic').tools.map(tool => tool.label), ['Text','Button','Input','Checkbox']);
  assert.deepEqual(groups.find(group => group.group === 'Data').tools.map(tool => tool.label), ['Table','TreeView']);
});

test('Designer picker delegates additions to the existing source-backed toolbox buttons', () => {
  const source = fs.readFileSync('web/designer-toolbox.js', 'utf8');
  assert.match(source, /button\.click\(\)/);
  assert.doesNotMatch(source, /addDesignerControl/);
  assert.doesNotMatch(source, /code\.value\s*=/);
  assert.match(source, /Ctrl\/Cmd\+Shift\+A/);
});

test('mobile Designer replaces the long icon strip with the categorized picker', () => {
  const css = fs.readFileSync('web/designer-toolbox.css', 'utf8');
  assert.match(css, /@media \(max-width: 760px\)/);
  assert.match(css, /#designer \.designer-toolbar > button\[id\^="add"\][\s\S]*display: none/);
  assert.match(css, /\.designer-add-control-picker/);
  assert.match(css, /@media \(forced-colors: active\)/);
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
