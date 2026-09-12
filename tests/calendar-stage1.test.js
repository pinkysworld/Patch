import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { parse } from '../src/parser.js';
import { compile } from '../src/compiler.js';
import { buildStandaloneWebApp } from '../src/webapp.js';
import { buildCurrentNativeGuiIR } from '../src/native-current-contract.js';
import {
  collectWindowCalendarInputIds,
  readWindowInputPresentation,
  setWindowInputMask,
  setWindowInputPresentation,
  setWindowNumberEdit
} from '../src/window-input-presentation.js';

const SOURCE = `create text selected_date = "2026-09-12"
window "Calendar" as main size 560, 420:
  # @input-mode calendar
  input selected_date at 24, 24 size 294, 240
when selected_date changed:
  change selected_date:
    set = value
`;

test('Calendar source mode round-trips as transparent Input presentation metadata', () => {
  const plain = `window "Calendar" as main size 560, 420:\n  input selected_date at 24, 24 size 294, 240\n`;
  const calendar = setWindowInputPresentation(plain, 2, 'calendar');
  assert.match(calendar, /# @input-mode calendar/);
  assert.equal(readWindowInputPresentation(calendar, 3), 'calendar');
  assert.equal(setWindowInputPresentation(calendar, 3, 'plain'), plain);
});

test('Calendar discovery follows Inputs through Tabs and Panels', () => {
  const source = `window "Nested" as main size 620, 440:
  # @input-mode calendar
  input top_calendar at 24, 24 size 294, 240
  tabs as pages at 340, 24 size 250, 180:
    tab "Calendar":
      # @input-mode calendar
      input tab_calendar
    tab "Other":
      text "Other"
  panel as holder at 340, 230 size 250, 180:
    # @input-mode calendar
    input panel_calendar
`;
  assert.deepEqual(collectWindowCalendarInputIds(source, parse(source)), ['top_calendar', 'tab_calendar', 'panel_calendar']);
});

test('Calendar is mutually exclusive with MaskedEdit and NumberEdit metadata', () => {
  assert.throws(() => compile(`window "Bad":\n  # @input-mode calendar\n  # @input-mask "0000"\n  input selected_date\n`, { kind: 'window' }), /cannot combine Calendar and MaskedEdit/);
  assert.throws(() => compile(`window "Bad":\n  # @input-mode calendar\n  # @number-edit\n  input selected_date\n`, { kind: 'window' }), /cannot combine NumberEdit and Calendar/);
  const calendar = `window "Calendar":\n  # @input-mode calendar\n  input selected_date\n`;
  assert.throws(() => setWindowInputMask(calendar, 3, '0000'), /Input mode is Calendar/);
  assert.throws(() => setWindowNumberEdit(calendar, 3, true), /Input mode is Calendar/);
});

test('Calendar compile metadata preserves ordinary Input and Change IR 0.10 semantics', () => {
  const compiled = compile(SOURCE, { name: 'Calendar', kind: 'window', entry: 'main.patch' });
  const input = compiled.ast.find(node => node.kind === 'window').body.find(node => node.control === 'input');
  assert.equal(compiled.ir.version, '0.10');
  assert.equal(compiled.windowInputPresentation.version, '0.4');
  assert.equal(input.control, 'input');
  assert.equal(input.inputPresentation, 'calendar');
});

test('Standalone Window Web renders inline month grid and ISO changed(value)', () => {
  const built = buildStandaloneWebApp(SOURCE, { name: 'Calendar', kind: 'window' });
  assert.equal(built.metadata.calendarStage, 1);
  assert.equal(built.metadata.calendarVersion, '0.4');
  assert.equal(built.metadata.calendarMode, 'source-backed-inline-month-grid');
  assert.equal(built.metadata.calendarEventValue, 'iso-date-text');
  assert.match(built.html, /patch-calendar-grid/);
  assert.match(built.html, /Previous month/);
  assert.match(built.html, /Next month/);
  assert.match(built.html, /safeTrigger\(control.id,'changed',\{value:iso\}\)/);
});

test('Current Ready native rejects Calendar explicitly', () => {
  const compiled = compile(SOURCE, { name: 'Calendar', kind: 'window', entry: 'main.patch' });
  assert.throws(() => buildCurrentNativeGuiIR(compiled), /Calendar Stage 1.*Studio\/Web only.*Current Ready native 1\.10/i);
});

test('Patch Studio exposes Calendar palette and Inspector mode', () => {
  const studio = fs.readFileSync('src/window-input-presentation.js', 'utf8');
  assert.match(studio, /button\.id = 'addCalendar'/);
  assert.match(studio, /button\.textContent = '\+ Calendar'/);
  assert.match(studio, /option value="calendar">Calendar<\/option>/);
  assert.match(studio, /calendarIds = new Set\(collectWindowCalendarInputIds/);
  assert.match(studio, /calendar \? 'calendar'/);
});
