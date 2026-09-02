import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync('web/designer-focus-order.js', 'utf8');

test('Focus Order dialog exposes roving keyboard navigation without claiming independent TabOrder', () => {
  assert.match(source, /FOCUS_ORDER_NAVIGATION_KEYS = new Set\(\['ArrowUp', 'ArrowDown', 'Home', 'End'\]\)/);
  assert.match(source, /role="list" aria-label="Focusable controls in source order"/);
  assert.match(source, /role="listitem" tabindex=/);
  assert.match(source, /handleFocusOrderKeydown/);
  assert.match(source, /focusDesignerFocusOrderRow/);
  assert.match(source, /Independent Delphi-style TabOrder metadata is a later contract/);
});

test('Focus Order keyboard contract uses Ctrl or Cmd plus arrows for source-backed reorder', () => {
  assert.match(source, /const commandKey = event\.ctrlKey \|\| event\.metaKey/);
  assert.match(source, /event\.key === 'ArrowUp' \|\| event\.key === 'ArrowDown'/);
  assert.match(source, /event\.key === 'ArrowUp' \? 'earlier' : 'later'/);
  assert.match(source, /moveFocusOrderControl\(selector,/);
  assert.match(source, /Ctrl\/Cmd\+↑\/↓ reorders the focused control/);
});

test('Focus Order rerender restores the moved row as the roving focus target', () => {
  assert.match(source, /render\(dialog\);\n      selectControl\(/);
  assert.match(source, /focusDesignerFocusOrderRow\(focusOrderRow\(dialog, result\.control\)\)/);
  assert.match(source, /item\.tabIndex = item === row \? 0 : -1/);
  assert.match(source, /row\.scrollIntoView\?\.\(\{ block: 'nearest' \}\)/);
});
