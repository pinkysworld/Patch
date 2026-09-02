import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { listPatchComponents } from '../src/component-registry.js';

const css = fs.readFileSync('web/designer-toolbox.css', 'utf8');

test('Form Designer layout 0.3 keeps the registry-backed component set in a compact two-column rail', () => {
  const components = listPatchComponents();
  assert.equal(components.length, 18);
  assert.match(css, /Form Designer layout 0\.3/);
  assert.match(css, /grid-template-columns: 86px minmax\(0, 1fr\)/);
  assert.match(css, /#designer\.designer-view::before[\s\S]*width: 86px/);

  for (const component of components) {
    assert.match(css, new RegExp(`#designer #${component.buttonId} \\{[^}]*left: (?:9|45)px;[^}]*top: \\d+px`, 's'), component.type);
  }

  const left = [...css.matchAll(/#designer #add\w+ \{ left: 9px; top: (\d+)px/g)].map(match => Number(match[1]));
  const right = [...css.matchAll(/#designer #add\w+ \{ left: 45px; top: (\d+)px/g)].map(match => Number(match[1]));
  assert.ok(left.length >= 9, 'left toolbox column should hold at least nine component slots');
  assert.ok(right.length >= 9, 'right toolbox column should hold at least nine component slots');
  assert.ok(Math.max(...left, ...right) <= 366, 'desktop toolbox should no longer require the former 600+ px vertical rail');
});

test('Form Designer layout 0.3 improves canvas workspace without replacing source-backed add-control actions', () => {
  assert.match(css, /scroll-padding: 28px/);
  assert.match(css, /overscroll-behavior: contain/);
  assert.match(css, /\.designer-canvas \.patch-window[\s\S]*box-shadow/);
  assert.match(css, /height: clamp\(520px, 68vh, 760px\)/);
  assert.match(css, /\.designer-component-palette[\s\S]*flex-basis: 480px/);
  assert.doesNotMatch(css, /addDesignerControl|code\.value|localStorage|sessionStorage/);
});

test('small screens keep the searchable component picker instead of the desktop icon rail', () => {
  assert.match(css, /@media \(max-width: 760px\)[\s\S]*button\[id\^="add"\][\s\S]*display: none/);
  assert.match(css, /@media \(max-width: 760px\)[\s\S]*\.designer-component-palette[\s\S]*flex: 1 1 100%/);
  assert.match(css, /\.designer-component-search input/);
  assert.match(css, /\.designer-add-control-picker select/);
});
