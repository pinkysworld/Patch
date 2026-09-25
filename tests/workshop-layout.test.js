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

function contains(outer, inner) {
  return inner.x >= outer.x
    && inner.y >= outer.y
    && inner.x + inner.width <= outer.x + outer.width
    && inner.y + inner.height <= outer.y + outer.height;
}

function label(control) {
  return control.id || control.label || control.type + '@' + control.line;
}

function controlsFor(windowIndex) {
  return listDesignerControls(source)
    .filter(control => control.windowIndex === windowIndex)
    .map(control => ({ control, rect: geometry(control) }))
    .filter(item => item.rect);
}

test('every Workshop Form keeps positioned top-level controls inside its declared bounds', () => {
  const windows = listDesignerWindows(source);
  assert.equal(windows.length, 7);

  for (const form of windows) {
    for (const { control, rect } of controlsFor(form.windowIndex)) {
      assert.equal(rect.x >= 0 && rect.y >= 0, true, form.id + ': ' + label(control) + ' starts outside the Form');
      assert.equal(rect.x + rect.width <= form.width, true, form.id + ': ' + label(control) + ' exceeds Form width');
      assert.equal(rect.y + rect.height <= form.height, true, form.id + ': ' + label(control) + ' exceeds Form height');
    }
  }
});

test('every Workshop Form is free of accidental top-level overlaps', () => {
  for (const form of listDesignerWindows(source)) {
    const controls = controlsFor(form.windowIndex);
    for (let left = 0; left < controls.length; left += 1) {
      for (let right = left + 1; right < controls.length; right += 1) {
        const a = controls[left];
        const b = controls[right];
        const decorationContainsControl = (a.control.type === 'shape' && contains(a.rect, b.rect))
          || (b.control.type === 'shape' && contains(b.rect, a.rect));
        assert.equal(
          overlaps(a.rect, b.rect) && !decorationContainsControl,
          false,
          form.id + ': controls overlap: ' + label(a.control) + ' and ' + label(b.control)
        );
      }
    }
  }
});

test('Workshop Desk separates ticket, queue and action regions with deliberate whitespace', () => {
  const controls = listDesignerControls(source).filter(control => control.windowIndex === 0);
  const services = controls.find(control => control.id === 'services');
  const board = controls.find(control => control.id === 'board');
  const parts = controls.find(control => control.id === 'parts');
  const quote = controls.find(control => control.id === 'quote_button');
  const components = controls.find(control => control.id === 'components_button');
  const status = controls.find(control => control.id === 'desk_status');

  assert.equal(services?.y, 244);
  assert.equal(services?.height, 84);
  assert.equal(board?.y, 402);
  assert.equal(parts?.y, 400);
  assert.equal(board?.y - (services?.y + services?.height) >= 40, true);
  assert.deepEqual([quote?.x, quote?.y, quote?.width, quote?.height], [864, 400, 180, 32]);
  assert.deepEqual([components?.x, components?.y, components?.width, components?.height], [864, 622, 180, 28]);
  assert.equal((components?.y ?? 0) + (components?.height ?? 0) < (status?.y ?? 0), true);
});

test('presentation-only Workshop card Shapes are explicitly locked', () => {
  for (const id of [
    'desk_header', 'ticket_card', 'queue_card', 'side_card',
    'details_header', 'details_card', 'canvas_card', 'rates_card',
    'gallery_header'
  ]) {
    assert.match(source, new RegExp('# @locked\\n\\s*shape rounded as ' + id + '\\b'), id + ' must remain Designer-locked');
  }
});
