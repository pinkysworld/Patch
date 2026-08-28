import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { compile } from '../src/compiler.js';
import { PatchInterpreter } from '../src/interpreter.js';
import { triggerWindowEvent } from '../src/window-events.js';

const example = fs.readFileSync('examples/workshop-desk.patch', 'utf8');
const studioModule = fs.readFileSync('web/beta35-studio.js', 'utf8');
const html = fs.readFileSync('web/index.html', 'utf8');

function studioWorkshopSource() {
  const match = studioModule.match(/const WORKSHOP_DESK_SAMPLE = `([\s\S]*?)`;\n\nconst MULTISELECT_SAMPLE/);
  assert.ok(match, 'Studio must expose a canonical Workshop Desk source block');
  return match[1];
}

test('Workshop Desk compiles, runs and stays in the Studio Example list', () => {
  assert.match(html, /value="workshopDesk">Workshop desk<\/option>/);
  assert.match(studioModule, /sample\.value === 'workshopDesk'/);
  assert.equal(studioWorkshopSource(), example, 'Web Studio Workshop Desk must match examples/workshop-desk.patch exactly');

  const compiled = compile(example, { name: 'workshop-desk', kind: 'window' });
  assert.ok(compiled.ast);
  const runtime = new PatchInterpreter();
  const result = runtime.run(example);
  assert.equal(result.state.ticket.total, 40);
  assert.equal(result.state.ticket.bench, 'Bench A');
  assert.equal(result.state.ticket.payment, 'Card');
  assert.equal(result.state.ticket.state, 'Open');
  assert.equal(result.ui.length, 3);
  assert.equal(result.ui.find(window => window.id === 'main')?.visible, true);
  assert.equal(result.ui.find(window => window.id === 'settings')?.visible, false);
  assert.equal(result.ui.find(window => window.id === 'details')?.visible, false);
});

test('Workshop Desk exercises stateful controls, Forms and complete ticket events', () => {
  const runtime = new PatchInterpreter();
  runtime.run(example);

  let result = triggerWindowEvent(runtime, 'customer', 'changed', { value: 'Grace' });
  assert.equal(result.state.customer, 'Grace');
  assert.equal(result.state.ticket.customer, 'Grace');

  result = triggerWindowEvent(runtime, 'pay', 'changed', { value: 'Cash' });
  assert.equal(result.state.pay, 'Cash');
  assert.equal(result.state.ticket.payment, 'Cash');

  result = triggerWindowEvent(runtime, 'qty', 'changed', { value: 4 });
  assert.equal(result.state.qty, 4);
  assert.equal(result.state.ticket.qty, 4);

  result = triggerWindowEvent(runtime, 'services', 'changed', { value: ['Diagnostics', 'Pickup'] });
  assert.deepEqual(result.state.services, ['Diagnostics', 'Pickup']);

  result = triggerWindowEvent(runtime, 'board', 'changed', { value: ['WD-105', 'Grace', 'Bench B', 'Quoted'] });
  assert.deepEqual(result.state.selected_job, ['WD-105', 'Grace', 'Bench B', 'Quoted']);
  assert.equal(result.state.status, 'Workshop board row selected');

  result = triggerWindowEvent(runtime, 'parts', 'changed', { value: ['Parts', 'Input', 'Keyboard'] });
  assert.deepEqual(result.state.selected_part, ['Parts', 'Input', 'Keyboard']);

  result = triggerWindowEvent(runtime, 'quote_button', 'clicked');
  assert.equal(result.state.ticket.total, 65);
  assert.equal(result.state.ticket.state, 'Quoted');
  assert.equal(result.state.status, 'Quote increased by 25');

  result = triggerWindowEvent(runtime, 'settings_button', 'clicked');
  assert.equal(result.ui.find(window => window.id === 'settings')?.visible, true);

  result = triggerWindowEvent(runtime, 'default_bench', 'changed', { value: 'Overflow' });
  assert.equal(result.state.default_bench, 'Overflow');
  assert.equal(result.state.ticket.bench, 'Overflow');

  result = triggerWindowEvent(runtime, 'details_button', 'clicked');
  assert.equal(result.ui.find(window => window.id === 'details')?.visible, true);

  result = triggerWindowEvent(runtime, 'details_quote', 'clicked');
  assert.equal(result.state.ticket.total, 75);
  assert.equal(result.state.ticket.state, 'Quoted');

  result = triggerWindowEvent(runtime, 'details_ready', 'clicked');
  assert.equal(result.state.ticket.state, 'Ready');
  assert.equal(result.state.status, 'Ticket marked ready');

  result = triggerWindowEvent(runtime, 'reset_button', 'clicked');
  assert.equal(result.state.customer, 'Ada');
  assert.equal(result.state.item, 'Keyboard');
  assert.equal(result.state.pay, 'Card');
  assert.equal(result.state.ticket.customer, 'Ada');
  assert.equal(result.state.ticket.item, 'Keyboard');
  assert.equal(result.state.ticket.payment, 'Card');
  assert.equal(result.state.ticket.state, 'Open');
  assert.equal(result.state.ticket.total, 40);
  assert.equal(result.state.ticket.qty, 1);
  assert.equal(result.state.qty, 1);
  assert.deepEqual(result.state.selected_job, []);
  assert.deepEqual(result.state.selected_part, []);
  assert.deepEqual(result.state.services, ['Diagnostics']);
  assert.equal(result.state.status, 'Ticket reset');
});

test('Workshop Desk covers the stable current Studio RAD control surface without a hidden form model', () => {
  for (const marker of [
    'window "Workshop Desk" as main',
    'window "Workshop settings" as settings',
    'window "Job details" as details',
    'input item', 'combo "', 'radio "', 'checkbox "', 'slider ', 'listbox "',
    'table "Ticket", "Customer", "Bench", "State" as board',
    'tree as parts', 'tabs as prefs', 'statusbar "{status}" as desk_status',
    'button "Mark ready" as complete_button', 'make quote', 'allow quote:', 'create thing ticket',
    'open settings', 'open details', 'close settings', 'close details',
    '# @layout anchor left right bottom'
  ]) assert.ok(example.includes(marker), marker);
  assert.doesNotMatch(example, /\.frm|\.dfm|localStorage/);
});

test('Workshop Desk builds as a Standalone Window Web App', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'patch-workshop-web-'));
  const outputPath = path.join(tempDir, 'WorkshopDesk-test.html');
  try {
    const out = execFileSync(process.execPath, [
      'src/cli.js', 'build', 'examples/workshop-desk.patch',
      '--kind', 'window', '--target', 'web', '--out', outputPath
    ], { encoding: 'utf8' });
    assert.match(out, /standalone single-file Web App/);
    const built = fs.readFileSync(outputPath, 'utf8');
    assert.match(built, /Workshop Desk/);
    assert.match(built, /Workshop settings/);
    assert.match(built, /Job details/);
    assert.match(built, /Mark ready/);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});
