import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { compile } from '../src/compiler.js';
import { PatchInterpreter } from '../src/interpreter.js';
import { triggerWindowEvent } from '../src/window-events.js';

const example = fs.readFileSync('examples/workshop-desk.patch', 'utf8');
const playground = fs.readFileSync('web/playground.js', 'utf8');
const html = fs.readFileSync('web/index.html', 'utf8');

test('Harbor Desk example compiles, runs and stays in the Studio Example list', () => {
  assert.match(html, /value="workshopDesk">Workshop desk<\/option>/);
  assert.match(playground, /workshopDesk:/);
  assert.match(playground, /Harbor Desk/);
  const compiled = compile(example, { name: 'workshop-desk' });
  assert.ok(compiled.ast);
  const runtime = new PatchInterpreter();
  const result = runtime.run(example);
  assert.equal(result.state.ticket.total, 40);
  assert.equal(result.ui.length, 2);
});

test('Harbor Desk quote, settings and board events keep semantic change', () => {
  const runtime = new PatchInterpreter();
  runtime.run(example);
  const quoted = triggerWindowEvent(runtime, 'quote_button', 'clicked');
  assert.equal(quoted.state.ticket.total, 65);
  assert.match(quoted.state.status, /Quoted total 65/);
  const opened = triggerWindowEvent(runtime, 'settings_button', 'clicked');
  assert.equal(opened.ui.find(window => window.id === 'settings')?.visible, true);
  const selected = triggerWindowEvent(runtime, 'board', 'changed', { value: ['HD-105', 'Bench B', 'Quoted'] });
  assert.match(selected.state.status, /Board row selected/);
});

test('Harbor Desk covers the current Studio control surface without a second form model', () => {
  for (const marker of [
    'combo "', 'radio "', 'checkbox "', 'slider ', 'listbox "', 'table "',
    'tree as parts', 'tabs as prefs', 'make quote', 'create thing ticket',
    'open settings', 'close settings'
  ]) assert.ok(example.includes(marker), marker);
  assert.doesNotMatch(example, /\.frm|\.dfm|localStorage/);
});

test('Harbor Desk builds as a Standalone Window Web App', () => {
  const out = execFileSync(process.execPath, [
    'src/cli.js', 'build', 'examples/workshop-desk.patch',
    '--kind', 'window', '--target', 'web', '--out', '/tmp/HarborDesk-test.html'
  ], { encoding: 'utf8' });
  assert.match(out, /standalone single-file Web App/);
  assert.match(fs.readFileSync('/tmp/HarborDesk-test.html', 'utf8'), /Harbor Desk/);
});
