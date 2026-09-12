import fs from 'node:fs';

function edit(path, transform) {
  const before = fs.readFileSync(path, 'utf8');
  const after = transform(before);
  if (after === before) throw new Error(`No change made to ${path}`);
  fs.writeFileSync(path, after);
}

function once(source, before, after, label) {
  if (!source.includes(before)) throw new Error(`Missing anchor: ${label}`);
  return source.replace(before, after);
}

function all(source, before, after, minimum, label) {
  const count = source.split(before).length - 1;
  if (count < minimum) throw new Error(`Missing repeated anchor ${label}; found ${count}`);
  return source.split(before).join(after);
}

edit('src/input-presentation.js', source => {
  let s = source;
  s = once(s, "export const PATCH_INPUT_PRESENTATION_VERSION = '0.3';", "export const PATCH_INPUT_PRESENTATION_VERSION = '0.4';", 'input presentation version');
  s = once(s, "const MODES = Object.freeze(['plain', 'password', 'date', 'time']);", "const MODES = Object.freeze(['plain', 'password', 'date', 'time', 'calendar']);", 'input presentation modes');
  s = once(s,
    "const TIME_TARGETS = Object.freeze({\n  studio: 'supported',\n  web: 'supported',\n  windows: 'unsupported',\n  macos: 'unsupported',\n  linux: 'unsupported',\n  freebsd: 'unsupported'\n});",
    "const TIME_TARGETS = Object.freeze({\n  studio: 'supported',\n  web: 'supported',\n  windows: 'unsupported',\n  macos: 'unsupported',\n  linux: 'unsupported',\n  freebsd: 'unsupported'\n});\n\nconst CALENDAR_TARGETS = Object.freeze({\n  studio: 'supported',\n  web: 'supported',\n  windows: 'unsupported',\n  macos: 'unsupported',\n  linux: 'unsupported',\n  freebsd: 'unsupported'\n});",
    'Calendar targets');
  s = once(s, "throw new Error(`Unsupported input presentation '${mode}'. Use plain, password, date or time.`);", "throw new Error(`Unsupported input presentation '${mode}'. Use plain, password, date, time or calendar.`);", 'mode validation text');
  s = once(s, "const match = text.match(/^\\s*#\\s*@input-mode\\s+(plain|password|date|time)\\s*$/i);", "const match = text.match(/^\\s*#\\s*@input-mode\\s+(plain|password|date|time|calendar)\\s*$/i);", 'input-mode parser');
  s = once(s, "if (!match) throw new Error(`Invalid # @input-mode directive '${text.trim()}'. Use '# @input-mode password', '# @input-mode date' or '# @input-mode time'.`);", "if (!match) throw new Error(`Invalid # @input-mode directive '${text.trim()}'. Use '# @input-mode password', '# @input-mode date', '# @input-mode time' or '# @input-mode calendar'.`);", 'directive validation text');
  s = once(s, "return normalized === 'password' ? PASSWORD_TARGETS : normalized === 'date' ? DATE_TARGETS : normalized === 'time' ? TIME_TARGETS : PLAIN_TARGETS;", "return normalized === 'password' ? PASSWORD_TARGETS : normalized === 'date' ? DATE_TARGETS : normalized === 'time' ? TIME_TARGETS : normalized === 'calendar' ? CALENDAR_TARGETS : PLAIN_TARGETS;", 'target support');
  s = once(s,
    ": normalizedMode === 'time'\n            ? 'TimePicker Stage 1 is Studio/Web only until a new explicit native GUI/runtime contract is promoted.'\n            : 'Select a supported Patch target.')",
    ": normalizedMode === 'time'\n            ? 'TimePicker Stage 1 is Studio/Web only until a new explicit native GUI/runtime contract is promoted.'\n            : normalizedMode === 'calendar'\n              ? 'Calendar Stage 1 is Studio/Web only until a new explicit native GUI/runtime contract is promoted.'\n              : 'Select a supported Patch target.')",
    'target failure message');
  return s;
});

edit('src/window-input-presentation.js', source => {
  let s = source;
  s = once(s, "export const PATCH_WINDOW_INPUT_PRESENTATION_VERSION = '0.3';", "export const PATCH_WINDOW_INPUT_PRESENTATION_VERSION = '0.4';", 'window presentation version');
  s = all(s, "normalized === 'date' ? 'DatePicker' : normalized === 'time' ? 'TimePicker' : 'PasswordEdit'", "normalized === 'date' ? 'DatePicker' : normalized === 'time' ? 'TimePicker' : normalized === 'calendar' ? 'Calendar' : 'PasswordEdit'", 1, 'set mode labels');
  s = all(s, "mode === 'date' ? 'DatePicker' : mode === 'time' ? 'TimePicker' : 'PasswordEdit'", "mode === 'date' ? 'DatePicker' : mode === 'time' ? 'TimePicker' : mode === 'calendar' ? 'Calendar' : 'PasswordEdit'", 1, 'manifest mode labels');
  s = all(s, "presentation === 'date' ? 'Date' : presentation === 'time' ? 'Time' : 'Password'", "presentation === 'date' ? 'Date' : presentation === 'time' ? 'Time' : presentation === 'calendar' ? 'Calendar' : 'Password'", 2, 'conflict labels');
  s = once(s, "export function buildWindowInputMaskManifest(source, ast) {", "export function collectWindowCalendarInputIds(source, ast) {\n  const rows = sourceRows(source);\n  const ids = [];\n  walkControls(ast, node => {\n    if (node.control !== 'input' || !node.id) return;\n    if ((readInputPresentationFromRows(rows, node.line) ?? 'plain') === 'calendar') ids.push(node.id);\n  });\n  return ids;\n}\n\nexport function buildWindowInputMaskManifest(source, ast) {", 'Calendar collector');
  s = once(s, "document.querySelector('#addTimePicker') &&\n    document.querySelector('#designerInspectorInputPresentationField')", "document.querySelector('#addTimePicker') &&\n    document.querySelector('#addCalendar') &&\n    document.querySelector('#designerInspectorInputPresentationField')", 'palette readiness');
  s = all(s, "ensureTimePickerButton();\n  ensureInputPresentationInspector();", "ensureTimePickerButton();\n  ensureCalendarButton();\n  ensureInputPresentationInspector();", 1, 'initial Calendar palette install');
  s = all(s, "ensureTimePickerButton();\n      ensureInputPresentationInspector();", "ensureTimePickerButton();\n      ensureCalendarButton();\n      ensureInputPresentationInspector();", 1, 'observed Calendar palette install');
  s = once(s, "function ensureInputPresentationInspector() {", "function ensureCalendarButton() {\n  const toolbar = document.querySelector('#designer .designer-toolbar');\n  const anchor = toolbar?.querySelector('#addTimePicker') ?? toolbar?.querySelector('#addDatePicker') ?? toolbar?.querySelector('#addInput');\n  if (!toolbar || !anchor || toolbar.querySelector('#addCalendar')) return Boolean(toolbar?.querySelector('#addCalendar'));\n  const button = document.createElement('button');\n  button.id = 'addCalendar';\n  button.className = 'secondary small';\n  button.type = 'button';\n  button.textContent = '+ Calendar';\n  button.setAttribute('aria-label', 'Add Calendar');\n  button.title = 'Add a source-backed Calendar preset. It remains an Input, uses # @input-mode calendar and changed(value) stays ISO date text.';\n  anchor.insertAdjacentElement('afterend', button);\n  button.addEventListener('click', addCalendarFromStudio);\n  return true;\n}\n\nfunction ensureInputPresentationInspector() {", 'Calendar palette button');
  s = once(s, "        <option value=\"time\">Time</option>\n      </select>", "        <option value=\"time\">Time</option>\n        <option value=\"calendar\">Calendar</option>\n      </select>", 'Calendar Inspector option');
  s = once(s, "Password, Masked, Number, Date and Time are Studio/Web Stage 1", "Password, Masked, Number, Date, Time and Calendar are Studio/Web Stage 1", 'Inspector hint');
  s = once(s, "async function addInputPreset(kind) {", "async function addCalendarFromStudio(event) {\n  event?.preventDefault?.();\n  await addInputPreset('calendar');\n}\n\nasync function addInputPreset(kind) {", 'Calendar add handler');
  s = once(s, "else if (kind === 'time') next = setWindowInputPresentation(next, input.line, 'time');\n    else next = setWindowNumberEdit(next, input.line, true);", "else if (kind === 'time') next = setWindowInputPresentation(next, input.line, 'time');\n    else if (kind === 'calendar') next = setWindowInputPresentation(next, input.line, 'calendar');\n    else next = setWindowNumberEdit(next, input.line, true);", 'Calendar preset creation');
  s = once(s,
    "    } else if (select.value === 'time') {\n      next = mutateInputById(next, control.id, line => setWindowNumberEdit(next, line, false));\n      next = mutateInputById(next, control.id, line => setWindowInputMask(next, line, null));\n      next = mutateInputById(next, control.id, line => setWindowInputPresentation(next, line, 'time'));\n    } else {",
    "    } else if (select.value === 'time') {\n      next = mutateInputById(next, control.id, line => setWindowNumberEdit(next, line, false));\n      next = mutateInputById(next, control.id, line => setWindowInputMask(next, line, null));\n      next = mutateInputById(next, control.id, line => setWindowInputPresentation(next, line, 'time'));\n    } else if (select.value === 'calendar') {\n      next = mutateInputById(next, control.id, line => setWindowNumberEdit(next, line, false));\n      next = mutateInputById(next, control.id, line => setWindowInputMask(next, line, null));\n      next = mutateInputById(next, control.id, line => setWindowInputPresentation(next, line, 'calendar'));\n    } else {",
    'Calendar Inspector apply');
  s = once(s, "  let timeIds;\n  let numberIds;", "  let timeIds;\n  let calendarIds;\n  let numberIds;", 'Calendar sync variable');
  s = once(s, "    timeIds = new Set(collectWindowTimeInputIds(code.value, ast));\n    numberIds = new Set(collectWindowNumberEditInputIds(code.value, ast));", "    timeIds = new Set(collectWindowTimeInputIds(code.value, ast));\n    calendarIds = new Set(collectWindowCalendarInputIds(code.value, ast));\n    numberIds = new Set(collectWindowNumberEditInputIds(code.value, ast));", 'Calendar sync discovery');
  s = once(s, "      const time = timeIds.has(id);\n      const password = passwordIds.has(id);", "      const time = timeIds.has(id);\n      const calendar = calendarIds.has(id);\n      const password = passwordIds.has(id);", 'Calendar sync flag');
  s = once(s, "input.dataset.patchInputPresentation = numberEdit ? 'number' : date ? 'date' : time ? 'time' : password ? 'password' : mask ? 'masked' : 'plain';", "input.dataset.patchInputPresentation = numberEdit ? 'number' : date ? 'date' : time ? 'time' : calendar ? 'calendar' : password ? 'password' : mask ? 'masked' : 'plain';", 'Calendar DOM dataset');
  s = once(s, "input.setAttribute('aria-label', `${id || 'Input'} ${numberEdit ? 'number' : date ? 'date' : time ? 'time' : password ? 'password' : mask ? 'masked' : 'text'} input`);", "input.setAttribute('aria-label', `${id || 'Input'} ${numberEdit ? 'number' : date ? 'date' : time ? 'time' : calendar ? 'calendar' : password ? 'password' : mask ? 'masked' : 'text'} input`);", 'Calendar DOM aria');
  return s;
});

edit('src/native-current-contract.js', source => once(source,
  "      if (node.inputPresentation === 'time') {\n        throw new NativeGuiError(`TimePicker Stage 1 Input${name} is Studio/Web only. Current Ready native ${PATCH_CURRENT_NATIVE_RUNTIME_VERSION} has no time-input presentation contract; validation fails closed rather than lowering it as a plain text Input.`);\n      }",
  "      if (node.inputPresentation === 'time') {\n        throw new NativeGuiError(`TimePicker Stage 1 Input${name} is Studio/Web only. Current Ready native ${PATCH_CURRENT_NATIVE_RUNTIME_VERSION} has no time-input presentation contract; validation fails closed rather than lowering it as a plain text Input.`);\n      }\n      if (node.inputPresentation === 'calendar') {\n        throw new NativeGuiError(`Calendar Stage 1 Input${name} is Studio/Web only. Current Ready native ${PATCH_CURRENT_NATIVE_RUNTIME_VERSION} has no calendar presentation contract; validation fails closed rather than lowering it as a plain text Input.`);\n      }",
  'native Calendar fail-closed'));

edit('src/window-webapp.js', source => {
  let s = source;
  s = once(s, "export const PATCH_WINDOW_WEB_VERSION = '0.9';", "export const PATCH_WINDOW_WEB_VERSION = '0.10';", 'Window Web version');
  s = once(s, "  const timePickerCount = compiled?.windowInputPresentation?.controls?.filter(control => control.mode === 'time').length ?? 0;", "  const timePickerCount = compiled?.windowInputPresentation?.controls?.filter(control => control.mode === 'time').length ?? 0;\n  const calendarCount = compiled?.windowInputPresentation?.controls?.filter(control => control.mode === 'calendar').length ?? 0;", 'Calendar count');
  s = once(s, "      datePickerVersion: '0.3',", "      datePickerVersion: '0.4',", 'DatePicker metadata version');
  s = once(s, "      timePickerVersion: '0.3',", "      timePickerVersion: '0.4',", 'TimePicker metadata version');
  s = once(s, "    } : {})\n  };", "    } : {}),\n    ...(calendarCount ? {\n      calendarStage: 1,\n      calendarVersion: '0.4',\n      calendarMode: 'source-backed-inline-month-grid',\n      calendarEventValue: 'iso-date-text'\n    } : {})\n  };", 'Calendar Web metadata');
  s = once(s, ".patch-tree li{margin:2px 0}", ".patch-tree li{margin:2px 0}.patch-calendar{width:294px;border:1px solid #d4d4d8;border-radius:10px;background:#fff;padding:10px;color:#18181b}.patch-calendar-head{display:grid;grid-template-columns:36px 1fr 36px;align-items:center;gap:6px;margin-bottom:8px}.body .patch-calendar-nav{min-height:32px;padding:4px 8px}.patch-calendar-title{text-align:center;font-size:13px;font-weight:750}.patch-calendar-grid{display:grid;grid-template-columns:repeat(7,1fr);gap:3px}.patch-calendar-weekday{text-align:center;font-size:10px;font-weight:750;color:#71717a;padding:3px 0}.body .patch-calendar-day{min-width:0;min-height:34px;padding:4px;border-radius:7px;background:transparent;color:#18181b;font-weight:600}.body .patch-calendar-day:hover,.body .patch-calendar-day:focus-visible{background:#f4f4f5}.body .patch-calendar-day[aria-pressed=\"true\"]{background:#18181b;color:#fff}.body .patch-calendar-day:disabled{opacity:.22;cursor:default}", 'Calendar CSS');
  s = once(s, ".patch-tree{background:#1b1d22;border-color:#41444e}", ".patch-tree{background:#1b1d22;border-color:#41444e}.patch-calendar{background:#1b1d22;border-color:#41444e;color:#f4f4f5}.body .patch-calendar-day{color:#f4f4f5}.body .patch-calendar-day:hover,.body .patch-calendar-day:focus-visible{background:#24262d}.body .patch-calendar-day[aria-pressed=\"true\"]{background:#f4f4f5;color:#18181b}.patch-calendar-weekday{color:#a1a1aa}", 'Calendar dark CSS');
  s = once(s, "const tabSelections=new Map();", "const tabSelections=new Map();\nconst calendarViews=new Map();", 'Calendar transient view state');
  s = once(s, "function renderControl(control,windowId,controlIndex){", "function calendarIso(year,month,day){return String(year).padStart(4,'0')+'-'+String(month+1).padStart(2,'0')+'-'+String(day).padStart(2,'0');}\nfunction calendarSeed(value){const m=/^(\\d{4})-(\\d{2})-(\\d{2})$/.exec(String(value??''));if(m)return {year:Number(m[1]),month:Number(m[2])-1,day:Number(m[3])};const now=new Date();return {year:now.getFullYear(),month:now.getMonth(),day:now.getDate()};}\nfunction renderCalendar(control){const root=document.createElement('div');root.className='patch-calendar';root.dataset.patchInputPresentation='calendar';root.setAttribute('role','group');root.setAttribute('aria-label',String(control.id||'Calendar')+' calendar');const selected=calendarSeed(control.value);const key=String(control.id||'calendar');const view=calendarViews.get(key)??{year:selected.year,month:selected.month};calendarViews.set(key,view);const head=document.createElement('div');head.className='patch-calendar-head';const prev=document.createElement('button');prev.type='button';prev.className='patch-calendar-nav';prev.textContent='‹';prev.setAttribute('aria-label','Previous month');prev.addEventListener('click',()=>{const d=new Date(view.year,view.month-1,1);calendarViews.set(key,{year:d.getFullYear(),month:d.getMonth()});render();});const title=document.createElement('div');title.className='patch-calendar-title';title.textContent=new Intl.DateTimeFormat(undefined,{month:'long',year:'numeric'}).format(new Date(view.year,view.month,1));const next=document.createElement('button');next.type='button';next.className='patch-calendar-nav';next.textContent='›';next.setAttribute('aria-label','Next month');next.addEventListener('click',()=>{const d=new Date(view.year,view.month+1,1);calendarViews.set(key,{year:d.getFullYear(),month:d.getMonth()});render();});head.append(prev,title,next);const grid=document.createElement('div');grid.className='patch-calendar-grid';grid.setAttribute('role','grid');for(const label of ['Mon','Tue','Wed','Thu','Fri','Sat','Sun']){const weekday=document.createElement('div');weekday.className='patch-calendar-weekday';weekday.textContent=label;weekday.setAttribute('role','columnheader');grid.appendChild(weekday);}const first=new Date(view.year,view.month,1);const offset=(first.getDay()+6)%7;const days=new Date(view.year,view.month+1,0).getDate();for(let i=0;i<offset;i++){const blank=document.createElement('button');blank.type='button';blank.className='patch-calendar-day';blank.disabled=true;blank.tabIndex=-1;grid.appendChild(blank);}for(let day=1;day<=days;day++){const iso=calendarIso(view.year,view.month,day);const button=document.createElement('button');button.type='button';button.className='patch-calendar-day';button.textContent=String(day);button.setAttribute('role','gridcell');button.setAttribute('aria-label',iso);button.setAttribute('aria-pressed',String(String(control.value??'')===iso));button.addEventListener('click',()=>safeTrigger(control.id,'changed',{value:iso}));grid.appendChild(button);}root.append(head,grid);return root;}\nfunction renderControl(control,windowId,controlIndex){", 'Calendar renderer');
  s = once(s, "if(control.type==='input'){const el=document.createElement('input');", "if(control.type==='input'){if(control.inputPresentation==='calendar')return renderCalendar(control);const el=document.createElement('input');", 'Calendar render dispatch');
  return s;
});

edit('tests/input-presentation.test.js', source => {
  let s = source;
  s = once(s, "Input presentation contract v0.3 keeps plain/password/date/time modes explicit", "Input presentation contract v0.4 keeps plain/password/date/time/calendar modes explicit", 'contract test title');
  s = all(s, "'0.3'", "'0.4'", 2, 'contract version assertions');
  s = once(s, "['plain', 'password', 'date', 'time']", "['plain', 'password', 'date', 'time', 'calendar']", 'contract mode list');
  s = once(s, "  assert.equal(normalizePatchInputPresentation(' TIME '), 'time');", "  assert.equal(normalizePatchInputPresentation(' TIME '), 'time');\n  assert.equal(normalizePatchInputPresentation(' CALENDAR '), 'calendar');", 'Calendar normalize assertion');
  s = once(s, "/Use plain, password, date or time/", "/Use plain, password, date, time or calendar/", 'contract error assertion');
  s = once(s, "  assert.equal(parsePatchInputPresentationDirective('# @input-mode time'), 'time');", "  assert.equal(parsePatchInputPresentationDirective('# @input-mode time'), 'time');\n  assert.equal(parsePatchInputPresentationDirective('# @input-mode calendar'), 'calendar');", 'Calendar parse assertion');
  s = once(s, "  assert.equal(formatPatchInputPresentationDirective('time'), '# @input-mode time');", "  assert.equal(formatPatchInputPresentationDirective('time'), '# @input-mode time');\n  assert.equal(formatPatchInputPresentationDirective('calendar'), '# @input-mode calendar');", 'Calendar format assertion');
  s = once(s, "  assert.equal(patchInputDomType('time'), 'time');", "  assert.equal(patchInputDomType('time'), 'time');\n  assert.equal(patchInputDomType('calendar'), 'text');", 'Calendar generic DOM type');
  s = once(s, "  assert.equal(assertPatchInputPresentationTarget('plain', 'linux'), true);", "  assert.equal(patchInputPresentationTargetSupport('calendar').web, 'supported');\n  assert.equal(patchInputPresentationTargetSupport('calendar').windows, 'unsupported');\n  assert.equal(assertPatchInputPresentationTarget('calendar', 'web'), true);\n  assert.throws(() => assertPatchInputPresentationTarget('calendar', 'windows'), /Calendar Stage 1 is Studio\\/Web only/);\n  assert.equal(assertPatchInputPresentationTarget('plain', 'linux'), true);", 'Calendar target assertions');
  return s;
});

for (const path of ['tests/datepicker-stage1.test.js', 'tests/timepicker-stage1.test.js']) {
  edit(path, source => source.split("'0.3'").join("'0.4'"));
}

fs.writeFileSync('tests/calendar-stage1.test.js', `import test from 'node:test';
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

const SOURCE = \`create text selected_date = "2026-09-12"
window "Calendar" as main size 560, 420:
  # @input-mode calendar
  input selected_date at 24, 24 size 294, 240
when selected_date changed:
  change selected_date:
    set = value
\`;

test('Calendar source mode round-trips as transparent Input presentation metadata', () => {
  const plain = \`window "Calendar" as main size 560, 420:\\n  input selected_date at 24, 24 size 294, 240\\n\`;
  const calendar = setWindowInputPresentation(plain, 2, 'calendar');
  assert.match(calendar, /# @input-mode calendar/);
  assert.equal(readWindowInputPresentation(calendar, 3), 'calendar');
  assert.equal(setWindowInputPresentation(calendar, 3, 'plain'), plain);
});

test('Calendar discovery follows Inputs through Tabs and Panels', () => {
  const source = \`window "Nested" as main size 620, 440:
  # @input-mode calendar
  input top_calendar at 24, 24 size 294, 240
  tabs as pages at 340, 24 size 250, 180:
    tab "Calendar":
      # @input-mode calendar
      input tab_calendar
  panel as holder at 340, 230 size 250, 180:
    # @input-mode calendar
    input panel_calendar
\`;
  assert.deepEqual(collectWindowCalendarInputIds(source, parse(source)), ['top_calendar', 'tab_calendar', 'panel_calendar']);
});

test('Calendar is mutually exclusive with MaskedEdit and NumberEdit metadata', () => {
  assert.throws(() => compile(\`window "Bad":\\n  # @input-mode calendar\\n  # @input-mask "0000"\\n  input selected_date\\n\`, { kind: 'window' }), /cannot combine Calendar and MaskedEdit/);
  assert.throws(() => compile(\`window "Bad":\\n  # @input-mode calendar\\n  # @number-edit\\n  input selected_date\\n\`, { kind: 'window' }), /cannot combine NumberEdit and Calendar/);
  const calendar = \`window "Calendar":\\n  # @input-mode calendar\\n  input selected_date\\n\`;
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
  assert.match(built.html, /safeTrigger\\(control.id,'changed',\\{value:iso\\}\\)/);
});

test('Current Ready native rejects Calendar explicitly', () => {
  const compiled = compile(SOURCE, { name: 'Calendar', kind: 'window', entry: 'main.patch' });
  assert.throws(() => buildCurrentNativeGuiIR(compiled), /Calendar Stage 1.*Studio\\/Web only.*Current Ready native 1\\.10/i);
});

test('Patch Studio exposes Calendar palette and Inspector mode', () => {
  const studio = fs.readFileSync('src/window-input-presentation.js', 'utf8');
  assert.match(studio, /button\\.id = 'addCalendar'/);
  assert.match(studio, /button\\.textContent = '\\+ Calendar'/);
  assert.match(studio, /option value="calendar">Calendar<\\/option>/);
  assert.match(studio, /calendarIds = new Set\\(collectWindowCalendarInputIds/);
  assert.match(studio, /calendar \\? 'calendar'/);
});
`);

console.log('Calendar Stage 1 patch applied.');
