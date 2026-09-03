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

test('Workshop Desk compiles, runs and Studio upgrades its compatibility sample to canonical v0.6', () => {
  assert.equal(WORKSHOP_DESK_CURRENT_SAMPLE_VERSION, '0.6');
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
  assert.equal(result.state.gallery_text, 'Workshop sample');
  assert.equal(result.state.gallery_level, 60);
  assert.equal(result.state.gallery_ticks, 0);
  assert.equal(result.ui.length, 7);
  assert.equal(result.ui.find(window => window.id === 'main')?.visible, true);
  for (const id of ['settings', 'details', 'inventory', 'customer_profile', 'diagnostics', 'components']) {
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

test('Workshop Desk exercises the seven-Form workflow and Component Gallery events', () => {
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
  assert.equal(result.state.status, 'Queue selection changed · open Details to continue');

  result = triggerWindowEvent(runtime, 'parts', 'changed', { value: ['Parts', 'Input', 'Keyboard'] });
  assert.equal(result.state.status, 'Parts selection changed · open Inventory to continue');

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

  result = triggerWindowEvent(runtime, 'components_button', 'clicked');
  assert.equal(result.ui.find(window => window.id === 'components')?.visible, true);
  assert.equal(result.state.gallery_status, 'Complete Component Registry 0.9 gallery opened');

  result = triggerWindowEvent(runtime, 'gallery_text', 'changed', { value: 'Edited sample' });
  assert.equal(result.state.gallery_text, 'Edited sample');
  result = triggerWindowEvent(runtime, 'gallery_enabled', 'changed', { value: false });
  assert.equal(result.state.gallery_enabled, false);
  result = triggerWindowEvent(runtime, 'gallery_mode', 'changed', { value: 'Review' });
  assert.equal(result.state.gallery_mode, 'Review');
  result = triggerWindowEvent(runtime, 'gallery_color', 'changed', { value: 'Green' });
  assert.equal(result.state.gallery_color, 'Green');
  result = triggerWindowEvent(runtime, 'gallery_features', 'changed', { value: ['Designer', 'Runtime'] });
  assert.deepEqual(result.state.gallery_features, ['Designer', 'Runtime']);
  result = triggerWindowEvent(runtime, 'gallery_level', 'changed', { value: 80 });
  assert.equal(result.state.gallery_level, 80);
  result = triggerWindowEvent(runtime, 'gallery_table', 'changed', { value: ['Table', 'changed', 'Ready'] });
  assert.equal(result.state.gallery_status, 'Table selection handled');
  result = triggerWindowEvent(runtime, 'gallery_tree', 'changed', { value: ['Registry 0.9', 'Data', 'TreeView'] });
  assert.equal(result.state.gallery_status, 'TreeView selection handled');
  result = triggerWindowEvent(runtime, 'gallery_picture', 'clicked');
  assert.equal(result.state.gallery_status, 'Picture click handled');
  result = triggerWindowEvent(runtime, 'gallery_clock', 'ticked');
  assert.equal(result.state.gallery_ticks, 1);
  result = triggerWindowEvent(runtime, 'gallery_refresh', 'clicked');
  assert.equal(result.state.gallery_ticks, 2);
  assert.equal(result.state.gallery_status, 'Gallery refreshed');

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
  assert.equal(result.state.gallery_text, 'Workshop sample');
  assert.equal(result.state.gallery_enabled, true);
  assert.equal(result.state.gallery_mode, 'Ready');
  assert.equal(result.state.gallery_color, 'Blue');
  assert.deepEqual(result.state.gallery_features, ['Designer']);
  assert.equal(result.state.gallery_level, 60);
  assert.equal(result.state.gallery_ticks, 0);
  assert.equal(result.state.status, 'Ticket reset');
});

test('Workshop Desk covers every Component Registry 0.9 control without hidden app state', () => {
  for (const marker of [
    'window "Workshop Desk" as main',
    'window "Workshop settings" as settings',
    'window "Job details" as details',
    'window "Inventory Center" as inventory',
    'window "Customer Profile" as customer_profile',
    'window "Workshop Diagnostics" as diagnostics',
    'window "Component Gallery" as components',
    'text "Workshop Desk"', 'input item', 'combo "', 'radio "', 'checkbox "', 'slider ', 'listbox "',
    'table "Ticket", "Customer", "Bench", "State" as board',
    'table "Component", "Event", "State" as gallery_table',
    'tree as parts', 'tree as inventory_tree', 'tree as gallery_tree', 'tabs as prefs', 'tabs as diagnostic_tabs',
    'statusbar "{status}" as desk_status', 'statusbar "{gallery_status}" as gallery_statusbar',
    'picture as workshop_logo from "data:image/png;base64,', 'picture as gallery_picture from "data:image/png;base64,',
    'panel as runtime_panel', 'panel as gallery_panel', 'shape rounded as runtime_shape', 'shape rounded as gallery_shape',
    'paintbox as ticket_canvas', 'paintbox as gallery_canvas',
    'timer as workshop_clock interval 5000', 'timer as diagnostics_clock interval 3000', 'timer as gallery_clock interval 2000',
    'imagelist as gallery_images size 20, 20:', 'image mark from "patch-resource:workshop.mark"',
    'when ticket_canvas paint:', 'when gallery_canvas paint:',
    'draw clear #f8fafc', 'draw rectangle 12, 12', 'draw ellipse 146, 12', 'draw image "data:image/png;base64,',
    'button "Components" as components_button', 'button "Refresh" as gallery_refresh',
    'create number ticket_total = 40', 'create text gallery_text = "Workshop sample"',
    'open settings', 'open details', 'open inventory', 'open customer_profile', 'open diagnostics', 'open components',
    'close settings', 'close details', 'close inventory', 'close customer_profile', 'close diagnostics', 'close components',
    'Current desktop Ready runtime contract: v1.10.',
    'Seven-Form RAD showcase · every Component Registry 0.9 control is represented',
    '# @layout anchor left right bottom'
  ]) assert.ok(example.includes(marker), marker);
  assert.doesNotMatch(example, /\.frm|\.dfm|localStorage/);
  assert.doesNotMatch(example, /change selected_(?:job|part)/);
  assert.doesNotMatch(example, /create thing ticket:|do quote\(|allow quote:|change ticket:/);
  assert.doesNotMatch(example, /button\s+.+\s+image\s+gallery_images\./, 'single-file Workshop keeps project-resource Button images in their dedicated project-v4 fixture');
  assert.doesNotMatch(example, /\bicon\s+"patch-resource:/, 'single-file Workshop does not pretend to package a project-v4 application icon');
});

test('Workshop Desk builds as a Standalone Window Web App with the seven-Form showcase', () => {
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
      'Workshop Desk', 'Workshop settings', 'Job details', 'Inventory Center', 'Customer Profile', 'Workshop Diagnostics', 'Component Gallery',
      'runtime_shape', 'gallery_shape', 'workshop_clock', 'diagnostics_clock', 'gallery_clock', 'workshop_logo', 'gallery_picture', 'ticket_canvas', 'gallery_canvas'
    ]) assert.match(built, new RegExp(marker));
    assert.match(built, /data:image\/png;base64/);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});
