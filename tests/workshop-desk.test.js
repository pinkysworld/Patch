import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { compile } from '../src/compiler.js';
import { PatchInterpreter } from '../src/interpreter.js';
import { triggerWindowEvent } from '../src/window-events.js';
import { upgradeWorkshopDeskSource, WORKSHOP_DESK_CURRENT_SAMPLE_VERSION } from '../web/studio-dom-sync.js';

const example = fs.readFileSync('examples/workshop-desk.patch', 'utf8');
const studioModule = fs.readFileSync('web/beta35-studio.js', 'utf8');
const html = fs.readFileSync('web/index.html', 'utf8');

function embeddedWorkshopBaseline() {
  const match = studioModule.match(/const WORKSHOP_DESK_SAMPLE = `([\s\S]*?)`;\n\nconst MULTISELECT_SAMPLE/);
  assert.ok(match, 'Studio must retain the beta35 Workshop Desk compatibility source block');
  return match[1];
}

test('Workshop Desk compiles, runs and Studio upgrades its compatibility sample to the canonical current example', () => {
  assert.equal(WORKSHOP_DESK_CURRENT_SAMPLE_VERSION, '0.5');
  assert.match(html, /value="workshopDesk">Workshop desk<\/option>/);
  assert.match(studioModule, /sample\.value === 'workshopDesk'/);
  assert.equal(
    upgradeWorkshopDeskSource(embeddedWorkshopBaseline()),
    example,
    'Studio Workshop Desk upgrade must resolve to examples/workshop-desk.patch exactly'
  );
  assert.equal(upgradeWorkshopDeskSource(example), example, 'Workshop upgrade must be idempotent');

  const compiled = compile(example, { name: 'workshop-desk', kind: 'window' });
  assert.ok(compiled.ast);
  const runtime = new PatchInterpreter();
  const result = runtime.run(example);
  assert.equal(result.state.ticket_total, 40);
  assert.equal(result.state.ticket_bench, 'Bench A');
  assert.equal(result.state.ticket_state, 'Open');
  assert.equal(result.state.heartbeat, 0);
  assert.equal(result.state.inventory_zone, 'Main store');
  assert.equal(result.state.reorder_qty, 5);
  assert.equal(result.state.customer_email, 'ada@example.com');
  assert.equal(result.state.customer_tier, 'Gold');
  assert.equal(result.state.diagnostic_mode, 'Runtime');
  assert.equal(result.state.diagnostic_runs, 0);
  assert.equal(result.ui.length, 6);
  assert.equal(result.ui.find(window => window.id === 'main')?.visible, true);
  for (const id of ['settings', 'details', 'inventory', 'customer_profile', 'diagnostics']) {
    assert.equal(result.ui.find(window => window.id === id)?.visible, false, `${id} should start closed`);
  }
});

test('Workshop Desk can execute the compiler AST without reparsing source', () => {
  const compiled = compile(example, { name: 'workshop-desk', kind: 'window' });
  const sourceResult = new PatchInterpreter().run(example);
  const astResult = new PatchInterpreter().runAst(compiled.ast);
  assert.deepEqual(astResult.state, sourceResult.state);
  assert.deepEqual(astResult.history, sourceResult.history);
  assert.deepEqual(astResult.ui, sourceResult.ui);
  assert.deepEqual(astResult.output, sourceResult.output);
});

test('Workshop Desk exercises stateful controls, six Forms, transient structural selection, Picture and Timer events', () => {
  const runtime = new PatchInterpreter();
  runtime.run(example);

  let result = triggerWindowEvent(runtime, 'customer', 'changed', { value: 'Grace' });
  assert.equal(result.state.customer, 'Grace');

  result = triggerWindowEvent(runtime, 'pay', 'changed', { value: 'Cash' });
  assert.equal(result.state.pay, 'Cash');

  result = triggerWindowEvent(runtime, 'qty', 'changed', { value: 4 });
  assert.equal(result.state.qty, 4);

  result = triggerWindowEvent(runtime, 'services', 'changed', { value: ['Diagnostics', 'Pickup'] });
  assert.deepEqual(result.state.services, ['Diagnostics', 'Pickup']);

  result = triggerWindowEvent(runtime, 'board', 'changed', { value: ['WD-105', 'Grace', 'Bench B', 'Quoted'] });
  assert.equal(result.state.status, 'Workshop board row selected');

  result = triggerWindowEvent(runtime, 'parts', 'changed', { value: ['Parts', 'Input', 'Keyboard'] });
  assert.equal(result.state.status, 'Inventory tree path selected');

  result = triggerWindowEvent(runtime, 'workshop_logo', 'clicked');
  assert.equal(result.state.status, 'Workshop mark clicked');

  result = triggerWindowEvent(runtime, 'workshop_clock', 'ticked');
  assert.equal(result.state.heartbeat, 1);

  result = triggerWindowEvent(runtime, 'quote_button', 'clicked');
  assert.equal(result.state.ticket_total, 65);
  assert.equal(result.state.ticket_state, 'Quoted');
  assert.equal(result.state.status, 'Quote increased by 25');

  result = triggerWindowEvent(runtime, 'settings_button', 'clicked');
  assert.equal(result.ui.find(window => window.id === 'settings')?.visible, true);

  result = triggerWindowEvent(runtime, 'default_bench', 'changed', { value: 'Overflow' });
  assert.equal(result.state.default_bench, 'Overflow');
  assert.equal(result.state.ticket_bench, 'Overflow');

  result = triggerWindowEvent(runtime, 'details_button', 'clicked');
  assert.equal(result.ui.find(window => window.id === 'details')?.visible, true);

  result = triggerWindowEvent(runtime, 'details_quote', 'clicked');
  assert.equal(result.state.ticket_total, 75);
  assert.equal(result.state.ticket_state, 'Quoted');

  result = triggerWindowEvent(runtime, 'details_ready', 'clicked');
  assert.equal(result.state.ticket_state, 'Ready');
  assert.equal(result.state.status, 'Ticket marked ready');

  result = triggerWindowEvent(runtime, 'inventory_button', 'clicked');
  assert.equal(result.ui.find(window => window.id === 'inventory')?.visible, true);
  assert.equal(result.state.inventory_status, 'Inventory opened from Workshop Desk');

  result = triggerWindowEvent(runtime, 'inventory_zone', 'changed', { value: 'Bench B' });
  assert.equal(result.state.inventory_zone, 'Bench B');
  result = triggerWindowEvent(runtime, 'reorder_qty', 'changed', { value: 9 });
  assert.equal(result.state.reorder_qty, 9);
  result = triggerWindowEvent(runtime, 'inventory_grid', 'changed', { value: ['PN-220', 'Display panel', 'Bench B', '2', 'Reorder'] });
  assert.equal(result.state.inventory_status, 'Inventory row selected');
  result = triggerWindowEvent(runtime, 'reorder_button', 'clicked');
  assert.equal(result.state.inventory_status, 'Reorder prepared');
  assert.equal(result.state.status, 'Inventory reorder prepared');

  result = triggerWindowEvent(runtime, 'customer_button', 'clicked');
  assert.equal(result.ui.find(window => window.id === 'customer_profile')?.visible, true);
  result = triggerWindowEvent(runtime, 'customer_email', 'changed', { value: 'grace@example.com' });
  assert.equal(result.state.customer_email, 'grace@example.com');
  result = triggerWindowEvent(runtime, 'customer_tier', 'changed', { value: 'Platinum' });
  assert.equal(result.state.customer_tier, 'Platinum');
  result = triggerWindowEvent(runtime, 'customer_channels', 'changed', { value: ['Email', 'Portal'] });
  assert.deepEqual(result.state.customer_channels, ['Email', 'Portal']);
  result = triggerWindowEvent(runtime, 'customer_save', 'clicked');
  assert.equal(result.state.customer_status, 'Customer profile saved');

  result = triggerWindowEvent(runtime, 'diagnostics_button', 'clicked');
  assert.equal(result.ui.find(window => window.id === 'diagnostics')?.visible, true);
  result = triggerWindowEvent(runtime, 'diagnostic_interval', 'changed', { value: 8 });
  assert.equal(result.state.diagnostic_interval, 8);
  result = triggerWindowEvent(runtime, 'diagnostic_run', 'clicked');
  assert.equal(result.state.diagnostic_runs, 1);
  assert.equal(result.state.diagnostic_status, 'Diagnostic checks completed');
  result = triggerWindowEvent(runtime, 'diagnostics_clock', 'ticked');
  assert.equal(result.state.diagnostic_runs, 2);

  result = triggerWindowEvent(runtime, 'reset_button', 'clicked');
  assert.equal(result.state.customer, 'Ada');
  assert.equal(result.state.item, 'Keyboard');
  assert.equal(result.state.pay, 'Card');
  assert.equal(result.state.ticket_state, 'Open');
  assert.equal(result.state.ticket_total, 40);
  assert.equal(result.state.ticket_bench, 'Bench A');
  assert.equal(result.state.qty, 1);
  assert.equal(result.state.heartbeat, 0);
  assert.deepEqual(result.state.services, ['Diagnostics']);
  assert.equal(result.state.inventory_zone, 'Main store');
  assert.equal(result.state.reorder_qty, 5);
  assert.equal(result.state.customer_email, 'ada@example.com');
  assert.equal(result.state.customer_tier, 'Gold');
  assert.deepEqual(result.state.customer_channels, ['Email']);
  assert.equal(result.state.diagnostic_interval, 5);
  assert.equal(result.state.diagnostic_runs, 0);
  assert.equal(result.state.status, 'Ticket reset');
});

test('Workshop Desk covers every integrated cross-platform Ready component without hidden unsupported app state', () => {
  for (const marker of [
    'window "Workshop Desk" as main',
    'window "Workshop settings" as settings',
    'window "Job details" as details',
    'window "Inventory Center" as inventory',
    'window "Customer Profile" as customer_profile',
    'window "Workshop Diagnostics" as diagnostics',
    'text "Workshop Desk"', 'input item', 'combo "', 'radio "', 'checkbox "', 'slider ', 'listbox "',
    'table "Ticket", "Customer", "Bench", "State" as board',
    'table "SKU", "Part", "Zone", "Stock", "State" as inventory_grid',
    'table "Ticket", "Item", "State", "Quote" as customer_jobs',
    'table "Check", "Surface", "State" as diagnostic_checks',
    'tree as parts', 'tree as inventory_tree', 'tabs as prefs', 'tabs as diagnostic_tabs',
    'statusbar "{status}" as desk_status', 'statusbar "{inventory_status}" as inventory_statusbar',
    'statusbar "{customer_status}" as customer_statusbar', 'statusbar "{diagnostic_status}" as diagnostic_statusbar',
    'picture as workshop_logo from "data:image/png;base64,',
    'panel as runtime_panel', 'shape rounded as runtime_shape', 'paintbox as ticket_canvas',
    'timer as workshop_clock interval 5000', 'timer as diagnostics_clock interval 3000', 'when ticket_canvas paint:',
    'draw clear #f8fafc', 'draw rectangle 12, 12', 'draw ellipse 146, 12', 'draw line 12, 58',
    'draw text "Live quote"', 'draw text ticket_state',
    'button "Inventory" as inventory_button', 'button "Customer" as customer_button',
    'button "Diagnostics" as diagnostics_button', 'create number ticket_total = 40',
    'create text inventory_filter = "All stock"', 'create text customer_email = "ada@example.com"',
    'create text diagnostic_mode = "Runtime"',
    'open settings', 'open details', 'open inventory', 'open customer_profile', 'open diagnostics',
    'close settings', 'close details', 'close inventory', 'close customer_profile', 'close diagnostics',
    '# @layout anchor left right bottom'
  ]) assert.ok(example.includes(marker), marker);
  assert.doesNotMatch(example, /\.frm|\.dfm|localStorage/);
  assert.doesNotMatch(example, /change selected_(?:job|part)/);
  assert.doesNotMatch(example, /create thing ticket:|do quote\(|allow quote:|change ticket:/);
  assert.doesNotMatch(example, /imagelist as|\bicon\s+"patch-resource:/, 'native-fail-closed resource consumers stay out of the Ready acceptance source');
});

test('Workshop Desk builds as a Standalone Window Web App with the six-Form showcase', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'patch-workshop-web-'));
  const outputPath = path.join(tempDir, 'WorkshopDesk-test.html');
  try {
    const out = execFileSync(process.execPath, [
      'src/cli.js', 'build', 'examples/workshop-desk.patch',
      '--kind', 'window', '--target', 'web', '--out', outputPath
    ], { encoding: 'utf8' });
    assert.match(out, /standalone single-file Web App/);
    const built = fs.readFileSync(outputPath, 'utf8');
    for (const marker of [
      'Workshop Desk', 'Workshop settings', 'Job details', 'Inventory Center', 'Customer Profile', 'Workshop Diagnostics',
      'runtime_shape', 'workshop_clock', 'diagnostics_clock', 'workshop_logo', 'ticket_canvas'
    ]) assert.match(built, new RegExp(marker));
    assert.match(built, /data:image\/png;base64/);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});