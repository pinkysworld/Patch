import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const playground = fs.readFileSync('web/playground.js', 'utf8');
const workshopLayer = fs.readFileSync('web/beta35-studio.js', 'utf8');
const html = fs.readFileSync('web/index.html', 'utf8');

test('Workshop Desk current source is not duplicated by the legacy playground sample table', () => {
  assert.doesNotMatch(playground, /window "Harbor Desk"/);
  assert.doesNotMatch(playground, /workshopDesk:\s*`/);
  assert.match(playground, /if \(sample\.value === 'workshopDesk'\) return;/);

  assert.match(workshopLayer, /const WORKSHOP_DESK_SAMPLE = `/);
  assert.match(workshopLayer, /window "Workshop Desk" as main/);
  assert.match(workshopLayer, /sample\.value === 'workshopDesk'/);
  assert.match(workshopLayer, /loadWindowSample\(WORKSHOP_DESK_SAMPLE\)/);
});

test('Workshop compatibility layer still initializes after playground delegation', () => {
  const playgroundIndex = html.indexOf('./playground.js');
  const workshopIndex = html.indexOf('./beta35-studio.js');
  assert.ok(playgroundIndex >= 0, 'playground.js must remain loaded');
  assert.ok(workshopIndex > playgroundIndex, 'Workshop compatibility layer must initialize after playground.js');
});
