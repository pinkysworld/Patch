import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const runner = fs.readFileSync('scripts/run-tests-ci.js', 'utf8');
const ci = fs.readFileSync('.github/workflows/ci.yml', 'utf8');

test('real-browser Studio smokes stay isolated from the full Node suite', () => {
  assert.match(runner, /stays responsive in Chrome\|Workshop Desk explicit load remains responsive in real Chrome/);
  assert.match(ci, /- name: Studio Chrome startup smoke[\s\S]*timeout-minutes: 2[\s\S]*tests\/studio-browser-startup\.test\.js/);
  assert.match(ci, /- name: Workshop Desk Chrome stress smoke[\s\S]*runner\.os == 'Linux' && matrix\.node == '24'[\s\S]*timeout-minutes: 2[\s\S]*tests\/workshop-desk-browser\.test\.js/);
});
