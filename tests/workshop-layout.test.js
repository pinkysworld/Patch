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

test('Workshop Desk main Form uses a clean non-overlapping dashboard layout', () => {
  const main = listDesignerWindows(source).find(window => window.id === 'main');
  assert.ok(main);
  assert.equal(main.width, 1080);
  assert.equal(main.height, 720);

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

test('Workshop Desk separates ticket, workflow, data and action regions with deliberate whitespace', () => {
  const controls = listDesignerControls(source).filter(control => control.windowIndex === 0);
  const services = controls.find(control => control.id === 'services');
  const board = controls.find(control => control.id === 'board');
  const parts = controls.find(control => control.id === 'parts');
  const quote = controls.find(control => control.id === 'quote_button');
  const components = controls.find(control => control.id === 'components_button');
  const status = controls.find(control => control.id === 'desk_status');

  assert.equal(services?.y, 322);
  assert.equal(services?.height, 58);
  assert.equal(board?.y, 420);
  assert.equal(parts?.y, 420);
  assert.equal(board?.y - (services?.y + services?.height) >= 40, true);
  assert.deepEqual([quote?.x, quote?.y, quote?.width, quote?.height], [816, 420, 104, 36]);
  assert.deepEqual([components?.x, components?.y, components?.width, components?.height], [816, 596, 224, 36]);
  assert.equal((components?.y ?? 0) + (components?.height ?? 0) < (status?.y ?? 0), true);
});

test('Component Gallery keeps visible controls inside a compact non-overlapping surface', () => {
  const gallery = listDesignerWindows(source).find(window => window.id === 'components');
  assert.ok(gallery);
  assert.equal(gallery.width, 900);
  assert.equal(gallery.height, 640);

  const controls = listDesignerControls(source)
    .filter(control => control.windowIndex === gallery.windowIndex)
    .map(control => ({ control, rect: geometry(control) }))
    .filter(item => item.rect);

  for (const { control, rect } of controls) {
    assert.equal(rect.x >= 0 && rect.y >= 0, true, `${label(control)} starts outside Component Gallery`);
    assert.equal(rect.x + rect.width <= gallery.width, true, `${label(control)} exceeds Component Gallery width`);
    assert.equal(rect.y + rect.height <= gallery.height, true, `${label(control)} exceeds Component Gallery height`);
  }
});
