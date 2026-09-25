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
const nativeFixture = fs.readFileSync('examples/workshop-desk-native.patch', 'utf8');
const studioModule = fs.readFileSync('web/beta35-studio.js', 'utf8');
const html = fs.readFileSync('web/index.html', 'utf8');

function embeddedWorkshopBaseline() {
  const match = studioModule.match(/const WORKSHOP_DESK_SAMPLE = `([\s\S]*?)`;\n\nconst MULTISELECT_SAMPLE/);
  assert.ok(match, 'Studio must retain the beta35 Workshop Desk compatibility source block');
  return match[1];
}

function normalizeRetainedSampleSpacing(source) {
  return String(source).replace(
    '  statusbar "{status}" as desk_status at 0, 692 size 1080, 28\nwindow "Workshop settings"',
    '  statusbar "{status}" as desk_status at 0, 692 size 1080, 28\n\nwindow "Workshop settings"'
  );
}

function workshopV06Fixture() {
  return nativeFixture
    .replace(
      'create number ticket_total = 40\ncreate number base_rate = 25\ncreate number inspection_fee = 15\ncreate number rush_fee = 20\ncreate number quote_revision = 0',
      'create number ticket_total = 40'
    )
    .replace(
      '  text "Quote {ticket_total} · {ticket_state} · rev {quote_revision}" at 620, 20 size 420, 28',
      '  text "Quote {ticket_total} · {ticket_state}" at 620, 20 size 420, 28'
    )
    .replace(
      '  text "Seven-Form RAD showcase · Current Ready subset of Component Registry 0.10 is represented; ImageList is demonstrated as a nonvisual component." at 16, 660 size 1048, 22',
      '  text "Seven-Form RAD showcase · every Component Registry 0.9 control is represented; ImageList is demonstrated as a nonvisual component." at 16, 660 size 1048, 22'
    )
    .replace(
      '      text "It covers the Current Ready subset of Component Registry 0.10, including nonvisual Timer and ImageList authoring."',
      '      text "It covers the complete Component Registry 0.9 surface, including nonvisual Timer and ImageList authoring."'
    )
    .replace(
      '  panel as runtime_panel at 340, 260 size 268, 168:\n    text "Native runtime pulse {heartbeat}"\n    text "Rate {base_rate} · inspection {inspection_fee} · rush {rush_fee}"\n    text "Quote revision {quote_revision}"\n    shape rounded as runtime_shape fill #dcfce7 stroke #16a34a stroke-width 2 radius 14 opacity 1',
      '  panel as runtime_panel at 340, 260 size 268, 168:\n    text "Native runtime pulse {heartbeat}"\n    shape rounded as runtime_shape fill #dcfce7 stroke #16a34a stroke-width 2 radius 14 opacity 1'
    )
    .replace(
      '      text "Workshop Desk exercises seven Forms and the Current Ready subset of Component Registry 0.10."',
      '      text "Workshop Desk exercises seven Forms and the complete Component Registry 0.9 surface."'
    )
    .replace('    node "Registry 0.10 native subset"', '    node "Registry 0.9"')
    .replace(
      'when quote_button clicked:\n  change ticket_total:\n    add 25\n    add 15\n  change quote_revision:\n    add 1\n  change ticket_state:\n    set = "Quoted"\n  change status:\n    set = "Base rate and inspection added"',
      'when quote_button clicked:\n  change ticket_total:\n    add 25\n  change ticket_state:\n    set = "Quoted"\n  change status:\n    set = "Quote increased by 25"'
    )
    .replace(
      'when details_quote clicked:\n  change ticket_total:\n    add 15\n  change quote_revision:\n    add 1\n  change ticket_state:\n    set = "Quoted"\n  change status:\n    set = "Inspection fee added to quote"',
      'when details_quote clicked:\n  change ticket_total:\n    add 10\n  change ticket_state:\n    set = "Quoted"\n  change status:\n    set = "Inspection added to quote"'
    )
    .replace(
      '    set = "Current Ready Component Registry 0.10 subset opened"',
      '    set = "Complete Component Registry 0.9 gallery opened"'
    )
    .replace(
      '  change ticket_total:\n    set = 40\n  change quote_revision:\n    set = 0\n',
      '  change ticket_total:\n    set = 40\n'
    );
}

test('legacy Workshop compatibility source still upgrades cached canonical v0.6 projects to v0.7', () => {
  const v06 = workshopV06Fixture();
  assert.match(v06, /Component Registry 0\.9/);
  assert.doesNotMatch(v06, /quote_revision/);
  assert.equal(upgradeWorkshopDeskSource(v06), nativeFixture);
});

test('legacy Workshop upgrader leaves user-modified v0.6 projects untouched', () => {
  const customized = workshopV06Fixture().replace(
    '    set = "Quote increased by 25"',
    '    set = "Custom quote workflow"'
  );
  assert.match(customized, /Custom quote workflow/);
  assert.equal(upgradeWorkshopDeskSource(customized), customized);
});

test('Studio retains the v0.7 compatibility block while canonical Workshop is the richer app', () => {
  assert.equal(WORKSHOP_DESK_CURRENT_SAMPLE_VERSION, '0.7');
  assert.match(html, /value="workshopDesk">Workshop desk<\/option>/);
  assert.match(studioModule, /sample\.value === 'workshopDesk'/);
  assert.equal(
    normalizeRetainedSampleSpacing(upgradeWorkshopDeskSource(embeddedWorkshopBaseline())),
    nativeFixture,
    'cached beta35 Workshop source must resolve to the isolated Current Ready fixture'
  );
  assert.notEqual(example, nativeFixture, 'canonical Workshop must be free to demonstrate richer Studio/Web semantics');
});

test('Workshop Desk compiles and starts as a seven-Form working application', () => {
  const compiled = compile(example, { name: 'workshop-desk', kind: 'window' });
  assert.ok(compiled.ast);
  const runtime = new PatchInterpreter();
  const result = runtime.run(example);

  assert.equal(result.state.ticket_id, 'WD-104');
  assert.equal(result.state.ticket_total, 40);
  assert.equal(result.state.base_rate, 25);
  assert.equal(result.state.service_fee, 15);
  assert.equal(result.state.rush_fee, 20);
  assert.equal(result.state.quote_revision, 0);
  assert.deepEqual(result.state.selected_job, ['WD-104', 'Ada', 'Bench A', 'Open']);
  assert.deepEqual(result.state.selected_part, ['Parts', 'Input', 'Keyboard']);
  assert.equal(result.state.ticket.id, 'WD-104');
  assert.equal(result.state.ticket.item_name, 'Keyboard');
  assert.equal(result.state.ticket.quote, 40);
  assert.equal(result.state.saved_customer.name, 'Ada');
  assert.equal(result.state.reorder_request.prepared, false);
  assert.equal(result.state.diagnostic_runs, 0);
  assert.equal(result.state.diagnostic_ticks, 0);
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

test('Workshop quote is calculated from current ticket state and is idempotent', () => {
  const runtime = new PatchInterpreter();
  runtime.run(example);

  let result = triggerWindowEvent(runtime, 'qty', 'changed', { value: 4 });
  assert.equal(result.state.ticket_total, 115, '4 × 25 base + 15 diagnostics');

  result = triggerWindowEvent(runtime, 'services', 'changed', { value: ['Diagnostics', 'Pickup'] });
  assert.equal(result.state.ticket_total, 125, '4 × 25 base + 25 selected services');

  result = triggerWindowEvent(runtime, 'rush', 'changed', { value: true });
  assert.equal(result.state.ticket_total, 145, 'rush adds the configured 20');

  result = triggerWindowEvent(runtime, 'priority', 'changed', { value: 'High' });
  assert.equal(result.state.ticket_total, 155, 'High priority adds 10');

  result = triggerWindowEvent(runtime, 'quote_button', 'clicked');
  assert.equal(result.state.ticket_total, 155);
  assert.equal(result.state.quote_revision, 1);
  assert.equal(result.state.ticket.quote, 155);
  assert.equal(result.state.ticket.revision, 1);

  result = triggerWindowEvent(runtime, 'quote_button', 'clicked');
  assert.equal(result.state.ticket_total, 155, 're-quoting unchanged input must not compound fees');
  assert.equal(result.state.quote_revision, 2);
  assert.equal(result.state.ticket.quote, 155);
  assert.equal(result.state.ticket.revision, 2);
});

test('Workshop queue, parts, customer and inventory screens form one stateful workflow', () => {
  const runtime = new PatchInterpreter();
  runtime.run(example);

  let result = triggerWindowEvent(runtime, 'board', 'changed', { value: ['WD-105', 'Grace', 'Bench B', 'Quoted'] });
  assert.equal(result.state.ticket_id, 'WD-105');
  assert.equal(result.state.customer, 'Grace');
  assert.equal(result.state.item, 'Trackpad');
  assert.equal(result.state.qty, 2);
  assert.equal(result.state.ticket_bench, 'Bench B');
  assert.equal(result.state.ticket_state, 'Quoted');
  assert.equal(result.state.ticket_total, 85);
  assert.deepEqual(result.state.selected_job, ['WD-105', 'Grace', 'Bench B', 'Quoted']);
  assert.equal(result.state.ticket.id, 'WD-105');
  assert.equal(result.state.ticket.quote, 85);
  assert.equal(result.state.customer_email, 'grace@example.com');
  assert.equal(result.state.customer_tier, 'Platinum');

  result = triggerWindowEvent(runtime, 'parts', 'changed', { value: ['Parts', 'Displays', 'Panel'] });
  assert.equal(result.state.item, 'Display panel');
  assert.deepEqual(result.state.selected_part, ['Parts', 'Displays', 'Panel']);
  assert.equal(result.state.inventory_filter, 'Display panel');
  assert.equal(result.state.ticket.item_name, 'Display panel');

  result = triggerWindowEvent(runtime, 'details_button', 'clicked');
  assert.equal(result.ui.find(window => window.id === 'details')?.visible, true);

  result = triggerWindowEvent(runtime, 'details_quote', 'clicked');
  assert.equal(result.state.ticket_total, 85);
  assert.equal(result.state.quote_revision, 2);

  result = triggerWindowEvent(runtime, 'details_ready', 'clicked');
  assert.equal(result.state.ticket_state, 'Ready');
  assert.equal(result.state.ticket.state, 'Ready');

  result = triggerWindowEvent(runtime, 'inventory_button', 'clicked');
  assert.equal(result.ui.find(window => window.id === 'inventory')?.visible, true);
  assert.equal(result.state.inventory_status, 'Inventory opened for Display panel');

  result = triggerWindowEvent(runtime, 'inventory_zone', 'changed', { value: 'Bench B' });
  result = triggerWindowEvent(runtime, 'reorder_qty', 'changed', { value: 9 });
  result = triggerWindowEvent(runtime, 'reorder_button', 'clicked');
  assert.equal(result.state.reorder_request.part, 'Display panel');
  assert.equal(result.state.reorder_request.zone, 'Bench B');
  assert.equal(result.state.reorder_request.quantity, 9);
  assert.equal(result.state.reorder_request.prepared, true);
  assert.match(result.state.inventory_status, /Display panel · Bench B · qty 9/);

  result = triggerWindowEvent(runtime, 'customer_button', 'clicked');
  assert.equal(result.ui.find(window => window.id === 'customer_profile')?.visible, true);
  result = triggerWindowEvent(runtime, 'customer_note', 'changed', { value: 'Call on arrival' });
  result = triggerWindowEvent(runtime, 'customer_channels', 'changed', { value: ['Email', 'Portal'] });
  result = triggerWindowEvent(runtime, 'customer_save', 'clicked');
  assert.equal(result.state.saved_customer.name, 'Grace');
  assert.equal(result.state.saved_customer.note, 'Call on arrival');
  assert.deepEqual(result.state.saved_customer.channels, ['Email', 'Portal']);
  assert.equal(result.state.saved_customer.saves, 1);
  assert.equal(result.state.customer_saves, 1);
});

test('Workshop diagnostics distinguish user-requested checks from timer pulses', () => {
  const runtime = new PatchInterpreter();
  runtime.run(example);

  let result = triggerWindowEvent(runtime, 'diagnostics_button', 'clicked');
  assert.equal(result.ui.find(window => window.id === 'diagnostics')?.visible, true);

  result = triggerWindowEvent(runtime, 'diagnostic_run', 'clicked');
  assert.equal(result.state.diagnostic_runs, 1);
  assert.equal(result.state.diagnostic_ticks, 0);
  assert.match(result.state.diagnostic_status, /run 1/);

  result = triggerWindowEvent(runtime, 'diagnostics_clock', 'ticked');
  assert.equal(result.state.diagnostic_runs, 1, 'timer pulses must not pretend a user-requested diagnostic completed');
  assert.equal(result.state.diagnostic_ticks, 1);
});

test('Workshop Component Gallery remains interactive while the main workflow is stateful', () => {
  const runtime = new PatchInterpreter();
  runtime.run(example);

  let result = triggerWindowEvent(runtime, 'components_button', 'clicked');
  assert.equal(result.ui.find(window => window.id === 'components')?.visible, true);
  assert.equal(result.state.gallery_status, 'Current Ready Component Registry 0.10 subset opened');

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
  result = triggerWindowEvent(runtime, 'gallery_tree', 'changed', { value: ['Registry 0.10 native subset', 'Data', 'TreeView'] });
  assert.equal(result.state.gallery_status, 'TreeView selection handled');
  result = triggerWindowEvent(runtime, 'gallery_clock', 'ticked');
  assert.equal(result.state.gallery_ticks, 1);
  result = triggerWindowEvent(runtime, 'gallery_refresh', 'clicked');
  assert.equal(result.state.gallery_ticks, 2);
  assert.match(result.state.gallery_status, /pulse 2/);
});

test('Workshop reset restores the complete application model', () => {
  const runtime = new PatchInterpreter();
  runtime.run(example);
  triggerWindowEvent(runtime, 'board', 'changed', { value: ['WD-106', 'Linus', 'Bench A', 'Ready'] });
  triggerWindowEvent(runtime, 'reorder_qty', 'changed', { value: 12 });
  triggerWindowEvent(runtime, 'reorder_button', 'clicked');
  triggerWindowEvent(runtime, 'customer_save', 'clicked');
  triggerWindowEvent(runtime, 'diagnostic_run', 'clicked');

  const result = triggerWindowEvent(runtime, 'reset_button', 'clicked');
  assert.equal(result.state.ticket_id, 'WD-104');
  assert.equal(result.state.customer, 'Ada');
  assert.equal(result.state.item, 'Keyboard');
  assert.equal(result.state.pay, 'Card');
  assert.equal(result.state.ticket_state, 'Open');
  assert.equal(result.state.ticket_total, 40);
  assert.equal(result.state.quote_revision, 0);
  assert.equal(result.state.ticket_bench, 'Bench A');
  assert.equal(result.state.qty, 1);
  assert.equal(result.state.heartbeat, 0);
  assert.deepEqual(result.state.services, ['Diagnostics']);
  assert.deepEqual(result.state.selected_job, ['WD-104', 'Ada', 'Bench A', 'Open']);
  assert.deepEqual(result.state.selected_part, ['Parts', 'Input', 'Keyboard']);
  assert.equal(result.state.reorder_request.prepared, false);
  assert.equal(result.state.saved_customer.saves, 0);
  assert.equal(result.state.diagnostic_runs, 0);
  assert.equal(result.state.diagnostic_ticks, 0);
  assert.equal(result.state.gallery_ticks, 0);
  assert.equal(result.state.ticket.id, 'WD-104');
  assert.equal(result.state.ticket.quote, 40);
  assert.equal(result.state.status, 'Ticket reset to WD-104');
});

test('Workshop source marks presentation-only cards locked and keeps application state explicit', () => {
  for (const id of [
    'desk_header', 'ticket_card', 'queue_card', 'side_card',
    'details_header', 'details_card', 'canvas_card', 'rates_card',
    'gallery_header', 'inputs_card', 'graphics_card', 'data_card'
  ]) {
    assert.match(example, new RegExp(`# @locked\\n\\s*shape rounded as ${id}\\b`), `${id} must not become Designer selection noise`);
  }

  for (const marker of [
    'create thing ticket:', 'create thing saved_customer:', 'create thing reorder_request:',
    'make calculate_quote():', 'make load_ticket(row):', 'make quote_ticket():',
    'change selected_job:', 'change selected_part:',
    'do load_ticket(value)', 'do select_part(value)', 'do prepare_reorder()', 'do save_customer()'
  ]) assert.ok(example.includes(marker), marker);

  assert.doesNotMatch(example, /\.frm|\.dfm|localStorage/);
  assert.doesNotMatch(example, /when quote_button clicked:\n\s*change ticket_total:\n\s*add 25/);
});

test('Workshop Desk builds as a Standalone Window Web App with the working seven-Form workflow', () => {
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
      'runtime_shape', 'gallery_shape', 'workshop_clock', 'diagnostics_clock', 'gallery_clock', 'ticket_canvas', 'gallery_canvas',
      'calculate_quote', 'load_ticket', 'saved_customer', 'reorder_request'
    ]) assert.match(built, new RegExp(marker));
    assert.match(built, /data:image\/png;base64/);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});
