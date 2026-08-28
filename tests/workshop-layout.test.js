import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { listDesignerControls, listDesignerWindows } from '../src/designer.js';

const source = fs.readFileSync('examples/workshop-desk.patch', 'utf8');

function geometry(control) {
  if (![control.x, control.y, control.width, control.height].every(Number.isInteger)) return null;
  return { x: control.x, y: control.y, width: control.width, height: control.height };
}

function overlaps(a, b) {
  return a.x < b.x + b.width
    && a.x + a.width > b.x
    && a.y < b.y + b.height
    && a.y + a.height > b.y;
}

function label(control) {
  return control.id || control.label || `${control.type}@${control.line}`;
}

test('Workshop Desk main Form uses a clean non-overlapping showcase layout', () => {
  const main = listDesignerWindows(source).find(window => window.id === 'main');
  assert.ok(main);
  assert.equal(main.width, 1080);
  assert.equal(main.height, 700);

  const controls = listDesignerControls(source)
    .filter(control => control.windowIndex === main.windowIndex)
    .map(control => ({ control, rect: geometry(control) }))
    .filter(item => item.rect);

  for (let left = 0; left < controls.length; left += 1) {
    for (let right = left + 1; right < controls.length; right += 1) {
      const a = controls[left];
      const b = controls[right];
      assert.equal(
        overlaps(a.rect, b.rect),
        false,
        `Workshop controls overlap: ${label(a.control)} and ${label(b.control)}`
      );
    }
  }
});

test('Workshop Desk leaves deliberate whitespace between editor groups and data region', () => {
  const controls = listDesignerControls(source).filter(control => control.windowIndex === 0);
  const board = controls.find(control => control.id === 'board');
  const parts = controls.find(control => control.id === 'parts');
  const services = controls.find(control => control.id === 'services');
  assert.equal(board?.y, 320);
  assert.equal(parts?.y, 320);
  assert.equal(services?.y + services?.height <= 306, true);
  assert.equal(board?.y - (services?.y + services?.height) >= 14, true);
});
