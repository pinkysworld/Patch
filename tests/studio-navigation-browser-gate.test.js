import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const browserRoundTrip = fs.readFileSync('tests/studio-navigation-browser-roundtrip.test.js', 'utf8');
const runner = fs.readFileSync('scripts/run-tests-ci.js', 'utf8');
const ci = fs.readFileSync('.github/workflows/ci.yml', 'utf8');

test('Designer navigation real-browser round trip stays isolated from the full Node suite', () => {
  assert.match(browserRoundTrip, /Designer Source Event navigation round trip stays responsive in Chrome/);
  assert.match(runner, /stays responsive in Chrome/);
  assert.match(ci, /- name: Designer navigation Chrome round trip/);
  assert.match(ci, /Designer navigation Chrome round trip[\s\S]*runner\.os == 'Linux' && matrix\.node == '24'/);
  assert.match(ci, /Designer navigation Chrome round trip[\s\S]*timeout-minutes: 2/);
  assert.match(ci, /node --test tests\/studio-navigation-browser-roundtrip\.test\.js/);
});

test('round trip verifies source sync F12 Designer focus and canonical event-handler return', () => {
  for (const marker of [
    "marker = 'when add_button clicked:'",
    "code.dispatchEvent(new Event('select', { bubbles: true }))",
    "dataset.controlId ?? ''",
    "new KeyboardEvent('keydown', { key: 'F12'",
    "document.querySelector('#designerEventsTab')?.click()",
    "document.querySelector('#designerEventHandlerAction')",
    "assert.equal(handlerReturn?.action, 'Open handler'",
    "assert.match(handlerReturn?.selected ?? '', /when add_button clicked:/)",
    "assert.equal(handlerReturn?.smoke, 'ready'"
  ]) assert.ok(browserRoundTrip.includes(marker), marker);
});
