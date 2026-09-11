import fs from 'node:fs';
import assert from 'node:assert/strict';

function read(path) { return fs.readFileSync(path, 'utf8'); }
function write(path, text) { fs.writeFileSync(path, text); }
function replaceOnce(path, before, after) {
  const text = read(path);
  const index = text.indexOf(before);
  assert.ok(index >= 0, `${path}: missing expected source anchor: ${before.slice(0, 100)}`);
  assert.equal(text.indexOf(before, index + before.length), -1, `${path}: expected anchor appears more than once`);
  write(path, text.slice(0, index) + after + text.slice(index + before.length));
}
function replaceAll(path, before, after, minimum = 1) {
  const text = read(path);
  const count = text.split(before).length - 1;
  assert.ok(count >= minimum, `${path}: expected at least ${minimum} matches for ${before.slice(0, 100)}, got ${count}`);
  write(path, text.split(before).join(after));
}
function replaceRegexOnce(path, regex, after) {
  const text = read(path);
  const matches = [...text.matchAll(new RegExp(regex.source, regex.flags.includes('g') ? regex.flags : regex.flags + 'g'))];
  assert.equal(matches.length, 1, `${path}: expected exactly one regex match for ${regex}, got ${matches.length}`);
  write(path, text.replace(regex, after));
}

// Input presentation contract v0.3: add time without changing Patch syntax or Change IR.
replaceOnce('src/input-presentation.js', "export const PATCH_INPUT_PRESENTATION_VERSION = '0.2';", "export const PATCH_INPUT_PRESENTATION_VERSION = '0.3';");
replaceOnce('src/input-presentation.js', "const MODES = Object.freeze(['plain', 'password', 'date']);", "const MODES = Object.freeze(['plain', 'password', 'date', 'time']);");
replaceOnce('src/input-presentation.js', `const DATE_TARGETS = Object.freeze({
  studio: 'supported',
  web: 'supported',
  windows: 'unsupported',
  macos: 'unsupported',
  linux: 'unsupported',
  freebsd: 'unsupported'
});

const PLAIN_TARGETS`, `const DATE_TARGETS = Object.freeze({
  studio: 'supported',
  web: 'supported',
  windows: 'unsupported',
  macos: 'unsupported',
  linux: 'unsupported',
  freebsd: 'unsupported'
});

const TIME_TARGETS = Object.freeze({
  studio: 'supported',
  web: 'supported',
  windows: 'unsupported',
  macos: 'unsupported',
  linux: 'unsupported',
  freebsd: 'unsupported'
});

const PLAIN_TARGETS`);
replaceOnce('src/input-presentation.js', "throw new Error(`Unsupported input presentation '${mode}'. Use plain, password or date.`);", "throw new Error(`Unsupported input presentation '${mode}'. Use plain, password, date or time.`);");
replaceOnce('src/input-presentation.js', "const match = text.match(/^\\s*#\\s*@input-mode\\s+(plain|password|date)\\s*$/i);", "const match = text.match(/^\\s*#\\s*@input-mode\\s+(plain|password|date|time)\\s*$/i);");
replaceOnce('src/input-presentation.js', "if (!match) throw new Error(`Invalid # @input-mode directive '${text.trim()}'. Use '# @input-mode password' or '# @input-mode date'.`);", "if (!match) throw new Error(`Invalid # @input-mode directive '${text.trim()}'. Use '# @input-mode password', '# @input-mode date' or '# @input-mode time'.`);");
replaceOnce('src/input-presentation.js', "return normalized === 'password' ? 'password' : normalized === 'date' ? 'date' : 'text';", "return normalized === 'password' ? 'password' : normalized === 'date' ? 'date' : normalized === 'time' ? 'time' : 'text';");
replaceOnce('src/input-presentation.js', "return normalized === 'password' ? PASSWORD_TARGETS : normalized === 'date' ? DATE_TARGETS : PLAIN_TARGETS;", "return normalized === 'password' ? PASSWORD_TARGETS : normalized === 'date' ? DATE_TARGETS : normalized === 'time' ? TIME_TARGETS : PLAIN_TARGETS;");
replaceOnce('src/input-presentation.js', `      (normalizedMode === 'password'
        ? 'PasswordEdit Stage 1 is Studio/Web only until a new explicit native GUI/runtime contract is promoted.'
        : normalizedMode === 'date'
          ? 'DatePicker Stage 1 is Studio/Web only until a new explicit native GUI/runtime contract is promoted.'
          : 'Select a supported Patch target.')`, `      (normalizedMode === 'password'
        ? 'PasswordEdit Stage 1 is Studio/Web only until a new explicit native GUI/runtime contract is promoted.'
        : normalizedMode === 'date'
          ? 'DatePicker Stage 1 is Studio/Web only until a new explicit native GUI/runtime contract is promoted.'
          : normalizedMode === 'time'
            ? 'TimePicker Stage 1 is Studio/Web only until a new explicit native GUI/runtime contract is promoted.'
            : 'Select a supported Patch target.')`);

// Source-backed Studio authoring and DOM presentation.
replaceOnce('src/window-input-presentation.js', "export const PATCH_WINDOW_INPUT_PRESENTATION_VERSION = '0.2';", "export const PATCH_WINDOW_INPUT_PRESENTATION_VERSION = '0.3';");
replaceAll('src/window-input-presentation.js', "mode === 'date' ? 'DatePicker' : 'PasswordEdit'", "mode === 'date' ? 'DatePicker' : mode === 'time' ? 'TimePicker' : 'PasswordEdit'", 2);
replaceOnce('src/window-input-presentation.js', "normalized === 'date' ? 'DatePicker' : 'PasswordEdit'", "normalized === 'date' ? 'DatePicker' : normalized === 'time' ? 'TimePicker' : 'PasswordEdit'");
replaceAll('src/window-input-presentation.js', "presentation === 'date' ? 'Date' : 'Password'", "presentation === 'date' ? 'Date' : presentation === 'time' ? 'Time' : 'Password'", 2);
replaceOnce('src/window-input-presentation.js', `export function collectWindowDateInputIds(source, ast) {
  const rows = sourceRows(source);
  const ids = [];
  walkControls(ast, node => {
    if (node.control !== 'input' || !node.id) return;
    if ((readInputPresentationFromRows(rows, node.line) ?? 'plain') === 'date') ids.push(node.id);
  });
  return ids;
}
`, `export function collectWindowDateInputIds(source, ast) {
  const rows = sourceRows(source);
  const ids = [];
  walkControls(ast, node => {
    if (node.control !== 'input' || !node.id) return;
    if ((readInputPresentationFromRows(rows, node.line) ?? 'plain') === 'date') ids.push(node.id);
  });
  return ids;
}

export function collectWindowTimeInputIds(source, ast) {
  const rows = sourceRows(source);
  const ids = [];
  walkControls(ast, node => {
    if (node.control !== 'input' || !node.id) return;
    if ((readInputPresentationFromRows(rows, node.line) ?? 'plain') === 'time') ids.push(node.id);
  });
  return ids;
}
`);
replaceAll('src/window-input-presentation.js', "  ensureDatePickerButton();\n  ensureInputPresentationInspector();", "  ensureDatePickerButton();\n  ensureTimePickerButton();\n  ensureInputPresentationInspector();", 2);
replaceOnce('src/window-input-presentation.js', "    document.querySelector('#addDatePicker') &&\n    document.querySelector('#designerInspectorInputPresentationField')", "    document.querySelector('#addDatePicker') &&\n    document.querySelector('#addTimePicker') &&\n    document.querySelector('#designerInspectorInputPresentationField')");
replaceOnce('src/window-input-presentation.js', `function ensureDatePickerButton() {
  const toolbar = document.querySelector('#designer .designer-toolbar');
  const anchor = toolbar?.querySelector('#addNumberEdit') ?? toolbar?.querySelector('#addMaskedEdit') ?? toolbar?.querySelector('#addPasswordEdit') ?? toolbar?.querySelector('#addInput');
  if (!toolbar || !anchor || toolbar.querySelector('#addDatePicker')) return Boolean(toolbar?.querySelector('#addDatePicker'));
  const button = document.createElement('button');
  button.id = 'addDatePicker';
  button.className = 'secondary small';
  button.type = 'button';
  button.textContent = '+ Date';
  button.setAttribute('aria-label', 'Add DatePicker');
  button.title = 'Add a source-backed DatePicker preset. It remains an Input, uses # @input-mode date and changed(value) stays ISO date text.';
  anchor.insertAdjacentElement('afterend', button);
  button.addEventListener('click', addDatePickerFromStudio);
  return true;
}
`, `function ensureDatePickerButton() {
  const toolbar = document.querySelector('#designer .designer-toolbar');
  const anchor = toolbar?.querySelector('#addNumberEdit') ?? toolbar?.querySelector('#addMaskedEdit') ?? toolbar?.querySelector('#addPasswordEdit') ?? toolbar?.querySelector('#addInput');
  if (!toolbar || !anchor || toolbar.querySelector('#addDatePicker')) return Boolean(toolbar?.querySelector('#addDatePicker'));
  const button = document.createElement('button');
  button.id = 'addDatePicker';
  button.className = 'secondary small';
  button.type = 'button';
  button.textContent = '+ Date';
  button.setAttribute('aria-label', 'Add DatePicker');
  button.title = 'Add a source-backed DatePicker preset. It remains an Input, uses # @input-mode date and changed(value) stays ISO date text.';
  anchor.insertAdjacentElement('afterend', button);
  button.addEventListener('click', addDatePickerFromStudio);
  return true;
}

function ensureTimePickerButton() {
  const toolbar = document.querySelector('#designer .designer-toolbar');
  const anchor = toolbar?.querySelector('#addDatePicker') ?? toolbar?.querySelector('#addNumberEdit') ?? toolbar?.querySelector('#addInput');
  if (!toolbar || !anchor || toolbar.querySelector('#addTimePicker')) return Boolean(toolbar?.querySelector('#addTimePicker'));
  const button = document.createElement('button');
  button.id = 'addTimePicker';
  button.className = 'secondary small';
  button.type = 'button';
  button.textContent = '+ Time';
  button.setAttribute('aria-label', 'Add TimePicker');
  button.title = 'Add a source-backed TimePicker preset. It remains an Input, uses # @input-mode time and changed(value) stays local HH:MM text.';
  anchor.insertAdjacentElement('afterend', button);
  button.addEventListener('click', addTimePickerFromStudio);
  return true;
}
`);
replaceOnce('src/window-input-presentation.js', `async function addDatePickerFromStudio(event) {
  event?.preventDefault?.();
  await addInputPreset('date');
}
`, `async function addDatePickerFromStudio(event) {
  event?.preventDefault?.();
  await addInputPreset('date');
}

async function addTimePickerFromStudio(event) {
  event?.preventDefault?.();
  await addInputPreset('time');
}
`);
replaceOnce('src/window-input-presentation.js', "    else if (kind === 'date') next = setWindowInputPresentation(next, input.line, 'date');\n    else next = setWindowNumberEdit(next, input.line, true);", "    else if (kind === 'date') next = setWindowInputPresentation(next, input.line, 'date');\n    else if (kind === 'time') next = setWindowInputPresentation(next, input.line, 'time');\n    else next = setWindowNumberEdit(next, input.line, true);");
replaceOnce('src/window-input-presentation.js', "        <option value=\"date\">Date</option>\n      </select>", "        <option value=\"date\">Date</option>\n        <option value=\"time\">Time</option>\n      </select>");
replaceOnce('src/window-input-presentation.js', "Password, Masked, Number and Date are Studio/Web Stage 1; Current Ready native 1.10 fails closed.", "Password, Masked, Number, Date and Time are Studio/Web Stage 1; Current Ready native 1.10 fails closed.");
replaceOnce('src/window-input-presentation.js', `    if (select && !select.querySelector('option[value="date"]')) {
      const option = document.createElement('option');
      option.value = 'date';
      option.textContent = 'Date';
      select.appendChild(option);
    }
    if (select) {`, `    if (select && !select.querySelector('option[value="date"]')) {
      const option = document.createElement('option');
      option.value = 'date';
      option.textContent = 'Date';
      select.appendChild(option);
    }
    if (select && !select.querySelector('option[value="time"]')) {
      const option = document.createElement('option');
      option.value = 'time';
      option.textContent = 'Time';
      select.appendChild(option);
    }
    if (select) {`);
replaceOnce('src/window-input-presentation.js', `    } else if (select.value === 'date') {
      next = mutateInputById(next, control.id, line => setWindowNumberEdit(next, line, false));
      next = mutateInputById(next, control.id, line => setWindowInputMask(next, line, null));
      next = mutateInputById(next, control.id, line => setWindowInputPresentation(next, line, 'date'));
    } else {`, `    } else if (select.value === 'date') {
      next = mutateInputById(next, control.id, line => setWindowNumberEdit(next, line, false));
      next = mutateInputById(next, control.id, line => setWindowInputMask(next, line, null));
      next = mutateInputById(next, control.id, line => setWindowInputPresentation(next, line, 'date'));
    } else if (select.value === 'time') {
      next = mutateInputById(next, control.id, line => setWindowNumberEdit(next, line, false));
      next = mutateInputById(next, control.id, line => setWindowInputMask(next, line, null));
      next = mutateInputById(next, control.id, line => setWindowInputPresentation(next, line, 'time'));
    } else {`);
replaceOnce('src/window-input-presentation.js', "  let dateIds;\n  let numberIds;", "  let dateIds;\n  let timeIds;\n  let numberIds;");
replaceOnce('src/window-input-presentation.js', "    dateIds = new Set(collectWindowDateInputIds(code.value, ast));\n    numberIds = new Set(collectWindowNumberEditInputIds(code.value, ast));", "    dateIds = new Set(collectWindowDateInputIds(code.value, ast));\n    timeIds = new Set(collectWindowTimeInputIds(code.value, ast));\n    numberIds = new Set(collectWindowNumberEditInputIds(code.value, ast));");
replaceOnce('src/window-input-presentation.js', "      const date = dateIds.has(id);\n      const password = passwordIds.has(id);", "      const date = dateIds.has(id);\n      const time = timeIds.has(id);\n      const password = passwordIds.has(id);");
replaceOnce('src/window-input-presentation.js', "      input.type = numberEdit ? 'number' : date ? 'date' : password ? 'password' : 'text';\n      input.dataset.patchInputPresentation = numberEdit ? 'number' : date ? 'date' : password ? 'password' : mask ? 'masked' : 'plain';", "      input.type = numberEdit ? 'number' : date ? 'date' : time ? 'time' : password ? 'password' : 'text';\n      input.dataset.patchInputPresentation = numberEdit ? 'number' : date ? 'date' : time ? 'time' : password ? 'password' : mask ? 'masked' : 'plain';");
replaceOnce('src/window-input-presentation.js', `      } else if (date) {
        clearMaskFromStudioInput(input);
        input.setAttribute('aria-label', `${id || 'Date'} date input`);
      } else if (mask && !password)`, `      } else if (date) {
        clearMaskFromStudioInput(input);
        input.setAttribute('aria-label', `${id || 'Date'} date input`);
      } else if (time) {
        clearMaskFromStudioInput(input);
        input.setAttribute('aria-label', `${id || 'Time'} time input`);
      } else if (mask && !password)`.replaceAll('\u001f', '`'));

// Current Ready native remains intentionally fail-closed.
replaceOnce('src/native-current-contract.js', `      if (node.inputPresentation === 'date') {
        throw new NativeGuiError(`DatePicker Stage 1 Input${name} is Studio/Web only. Current Ready native ${PATCH_CURRENT_NATIVE_RUNTIME_VERSION} has no date-input presentation contract; validation fails closed rather than lowering it as a plain text Input.`);
      }
      if (node.inputMask) {`.replaceAll('\u001f', '`'), `      if (node.inputPresentation === 'date') {
        throw new NativeGuiError(`DatePicker Stage 1 Input${name} is Studio/Web only. Current Ready native ${PATCH_CURRENT_NATIVE_RUNTIME_VERSION} has no date-input presentation contract; validation fails closed rather than lowering it as a plain text Input.`);
      }
      if (node.inputPresentation === 'time') {
        throw new NativeGuiError(`TimePicker Stage 1 Input${name} is Studio/Web only. Current Ready native ${PATCH_CURRENT_NATIVE_RUNTIME_VERSION} has no time-input presentation contract; validation fails closed rather than lowering it as a plain text Input.`);
      }
      if (node.inputMask) {`.replaceAll('\u001f', '`'));

// Standalone Web contract and renderer.
replaceOnce('src/window-webapp.js', "  const datePickerCount = compiled?.windowInputPresentation?.controls?.filter(control => control.mode === 'date').length ?? 0;", "  const datePickerCount = compiled?.windowInputPresentation?.controls?.filter(control => control.mode === 'date').length ?? 0;\n  const timePickerCount = compiled?.windowInputPresentation?.controls?.filter(control => control.mode === 'time').length ?? 0;");
replaceOnce('src/window-webapp.js', `    ...(datePickerCount ? {
      datePickerStage: 1,
      datePickerVersion: '0.2',
      datePickerMode: 'source-backed-date-input',
      datePickerEventValue: 'iso-date-text'
    } : {})`, `    ...(datePickerCount ? {
      datePickerStage: 1,
      datePickerVersion: '0.3',
      datePickerMode: 'source-backed-date-input',
      datePickerEventValue: 'iso-date-text'
    } : {}),
    ...(timePickerCount ? {
      timePickerStage: 1,
      timePickerVersion: '0.3',
      timePickerMode: 'source-backed-time-input',
      timePickerEventValue: 'local-time-text'
    } : {})`);
replaceOnce('src/window-webapp.js', "}else if(control.inputPresentation==='date'){el.type='date';el.dataset.patchInputPresentation='date';el.setAttribute('aria-label',String(control.id||'Date')+' date input');}el.value=control.value??'';", "}else if(control.inputPresentation==='date'){el.type='date';el.dataset.patchInputPresentation='date';el.setAttribute('aria-label',String(control.id||'Date')+' date input');}else if(control.inputPresentation==='time'){el.type='time';el.dataset.patchInputPresentation='time';el.setAttribute('aria-label',String(control.id||'Time')+' time input');}el.value=control.value??'';");

// Existing presentation tests now cover contract v0.3.
replaceAll('tests/input-presentation.test.js', "'0.2'", "'0.3'", 3);
replaceOnce('tests/input-presentation.test.js', "contract v0.2 keeps plain/password/date modes explicit", "contract v0.3 keeps plain/password/date/time modes explicit");
replaceOnce('tests/input-presentation.test.js', "['plain', 'password', 'date']", "['plain', 'password', 'date', 'time']");
replaceOnce('tests/input-presentation.test.js', "assert.equal(normalizePatchInputPresentation(' DATE '), 'date');\n  assert.throws(() => normalizePatchInputPresentation('secret'), /Use plain, password or date/);", "assert.equal(normalizePatchInputPresentation(' DATE '), 'date');\n  assert.equal(normalizePatchInputPresentation(' TIME '), 'time');\n  assert.throws(() => normalizePatchInputPresentation('secret'), /Use plain, password, date or time/);");
replaceOnce('tests/input-presentation.test.js', "  assert.equal(parsePatchInputPresentationDirective('# @input-mode date'), 'date');", "  assert.equal(parsePatchInputPresentationDirective('# @input-mode date'), 'date');\n  assert.equal(parsePatchInputPresentationDirective('# @input-mode time'), 'time');");
replaceOnce('tests/input-presentation.test.js', "  assert.equal(formatPatchInputPresentationDirective('date'), '# @input-mode date');", "  assert.equal(formatPatchInputPresentationDirective('date'), '# @input-mode date');\n  assert.equal(formatPatchInputPresentationDirective('time'), '# @input-mode time');");
replaceOnce('tests/input-presentation.test.js', "  assert.equal(patchInputDomType('date'), 'date');", "  assert.equal(patchInputDomType('date'), 'date');\n  assert.equal(patchInputDomType('time'), 'time');");
replaceOnce('tests/input-presentation.test.js', `  assert.throws(
    () => assertPatchInputPresentationTarget('date', 'windows'),
    /DatePicker Stage 1 is Studio\\/Web only/
  );
  assert.equal(assertPatchInputPresentationTarget('plain', 'linux'), true);`, `  assert.throws(
    () => assertPatchInputPresentationTarget('date', 'windows'),
    /DatePicker Stage 1 is Studio\\/Web only/
  );
  assert.equal(patchInputPresentationTargetSupport('time').web, 'supported');
  assert.equal(patchInputPresentationTargetSupport('time').windows, 'unsupported');
  assert.equal(assertPatchInputPresentationTarget('time', 'web'), true);
  assert.throws(
    () => assertPatchInputPresentationTarget('time', 'windows'),
    /TimePicker Stage 1 is Studio\\/Web only/
  );
  assert.equal(assertPatchInputPresentationTarget('plain', 'linux'), true);`);
replaceAll('tests/datepicker-stage1.test.js', "'0.2'", "'0.3'", 2);

// Keep the canonical Studio/Web project complete as R4 grows.
replaceOnce('examples/patch-studio-showcase/main.patch', 'create text review_date = "2026-09-10"\n', 'create text review_date = "2026-09-10"\ncreate text review_time = "14:30"\n');
replaceOnce('examples/patch-studio-showcase/main.patch', `      # @input-mode date
      input review_date
      button "Apply nested values" as nested_apply`, `      # @input-mode date
      input review_date
      # @input-mode time
      input review_time
      text "Review slot {review_date} at {review_time}"
      button "Apply nested values" as nested_apply`);
replaceOnce('examples/patch-studio-showcase/main.patch', 'Layout, TabOrder, Locked, PasswordEdit, MaskedEdit, NumberEdit, DatePicker and the current Panel/List/Slider presentations stay source-backed.', 'Layout, TabOrder, Locked, PasswordEdit, MaskedEdit, NumberEdit, DatePicker, TimePicker and the current Panel/List/Slider presentations stay source-backed.');
replaceOnce('examples/patch-studio-showcase/forms.patch', '    row "DatePicker", "Date Input presentation", "Studio/Web"\n', '    row "DatePicker", "Date Input presentation", "Studio/Web"\n    row "TimePicker", "Time Input presentation", "Studio/Web"\n');
replaceOnce('examples/patch-studio-showcase/logic.patch', `when review_date changed:
  change review_date:
    set = value
  change status:
    set = "DatePicker selection updated"
`, `when review_date changed:
  change review_date:
    set = value
  change status:
    set = "DatePicker selection updated"

when review_time changed:
  change review_time:
    set = value
  change status:
    set = "TimePicker selection updated"
`);
replaceOnce('examples/patch-studio-showcase/README.md', '- DatePicker as the source-backed `# @input-mode date` Input presentation with ISO date text;\n', '- DatePicker as the source-backed `# @input-mode date` Input presentation with ISO date text;\n- TimePicker as the source-backed `# @input-mode time` Input presentation with local `HH:MM` text;\n');
replaceAll('examples/patch-studio-showcase/README.md', 'Memo, PasswordEdit, MaskedEdit, NumberEdit, DatePicker, CheckedListBox', 'Memo, PasswordEdit, MaskedEdit, NumberEdit, DatePicker, TimePicker, CheckedListBox', 1);

// Regenerate project-v4 canonical JSON and browser-embedded byte copy from readable sources.
{
  const projectPath = 'examples/patch-studio-showcase.patchproject';
  const bundle = JSON.parse(read(projectPath));
  for (const file of bundle.files) {
    const path = `examples/patch-studio-showcase/${file.path}`;
    assert.ok(fs.existsSync(path), `Missing Showcase source ${path}`);
    file.content = read(path);
  }
  const canonical = JSON.stringify(bundle, null, 2) + '\n';
  write(projectPath, canonical);
  write('web/studio-showcase-project.js', `// Generated canonical browser copy of examples/patch-studio-showcase.patchproject.\n// tests/studio-showcase-loader.test.js keeps the String.raw payload byte-for-byte synchronized.\nexport const PATCH_STUDIO_SHOWCASE_PROJECT = String.raw\`${canonical}\`;\n`);
}

// Strengthen Showcase acceptance tests for TimePicker coverage.
replaceOnce('tests/studio-showcase.test.js', "  assert.match(composition.source, /# @input-mode date/);", "  assert.match(composition.source, /# @input-mode date/);\n  assert.match(composition.source, /# @input-mode time/);");
replaceOnce('tests/studio-showcase.test.js', "  assert.equal(compiled.windowInputPresentation.controls.some(control => control.mode === 'date'), true);", "  assert.equal(compiled.windowInputPresentation.controls.some(control => control.mode === 'date'), true);\n  assert.equal(compiled.windowInputPresentation.controls.some(control => control.mode === 'time'), true);");
replaceOnce('tests/studio-showcase.test.js', "  assert.equal(built.metadata.datePickerEventValue, 'iso-date-text');", "  assert.equal(built.metadata.datePickerEventValue, 'iso-date-text');\n  assert.equal(built.metadata.timePickerStage, 1);\n  assert.equal(built.metadata.timePickerEventValue, 'local-time-text');");
replaceOnce('tests/studio-showcase.test.js', "  assert.match(built.html, /dataset\\.patchInputPresentation='date'/);", "  assert.match(built.html, /dataset\\.patchInputPresentation='date'/);\n  assert.match(built.html, /dataset\\.patchInputPresentation='time'/);");

// Make Workshop Desk a more realistic native-safe application flow and remove stale Registry 0.9 claims.
replaceOnce('examples/workshop-desk.patch', 'create number ticket_total = 40\n', 'create number ticket_total = 40\ncreate number base_rate = 25\ncreate number inspection_fee = 15\ncreate number rush_fee = 20\ncreate number quote_revision = 0\n');
replaceOnce('examples/workshop-desk.patch', '  text "Quote {ticket_total} · {ticket_state}" at 790, 18 size 260, 28', '  text "Quote {ticket_total} · {ticket_state} · rev {quote_revision}" at 750, 18 size 300, 28');
replaceOnce('examples/workshop-desk.patch', `  panel as runtime_panel at 326, 172 size 280, 170:
    text "Native runtime pulse {heartbeat}"
    shape rounded as runtime_shape fill #dcfce7 stroke #16a34a stroke-width 2 radius 14 opacity 1`, `  panel as runtime_panel at 326, 172 size 280, 170:
    text "Native runtime pulse {heartbeat}"
    text "Rate {base_rate} · inspection {inspection_fee} · rush {rush_fee}"
    text "Quote revision {quote_revision}"
    shape rounded as runtime_shape fill #dcfce7 stroke #16a34a stroke-width 2 radius 14 opacity 1`);
replaceOnce('examples/workshop-desk.patch', `when quote_button clicked:
  change ticket_total:
    add 25
  change ticket_state:
    set = "Quoted"
  change status:
    set = "Quote increased by 25"`, `when quote_button clicked:
  change ticket_total:
    set = qty * base_rate + inspection_fee
  if rush:
    change ticket_total:
      add rush_fee
  if priority == "Critical":
    change ticket_total:
      add 30
  change quote_revision:
    add 1
  if ticket_total > labor_limit:
    change ticket_state:
      set = "Approval"
  else:
    change ticket_state:
      set = "Quoted"
  change status:
    set = "Quote recalculated from ticket state"`);
replaceOnce('examples/workshop-desk.patch', `when details_quote clicked:
  change ticket_total:
    add 10
  change ticket_state:
    set = "Quoted"
  change status:
    set = "Inspection added to quote"`, `when details_quote clicked:
  change ticket_total:
    add inspection_fee
  change quote_revision:
    add 1
  change ticket_state:
    set = "Quoted"
  change status:
    set = "Inspection fee added to quote"`);
replaceOnce('examples/workshop-desk.patch', '  change ticket_total:\n    set = 40\n', '  change ticket_total:\n    set = 40\n  change quote_revision:\n    set = 0\n');
replaceAll('examples/workshop-desk.patch', 'Component Registry 0.9', 'Current Ready subset of Component Registry 0.10', 3);
replaceOnce('examples/workshop-desk.patch', 'node "Registry 0.9"', 'node "Registry 0.10 native subset"');
replaceOnce('examples/workshop-desk.patch', 'Complete Component Registry 0.9 gallery opened', 'Current Ready Component Registry 0.10 subset opened');

// README: expose both acceptance boundaries and current R4 presentation family.
replaceOnce('README.md', '- Text, Button, Input, Checkbox, Radio, ComboBox, ListBox, Slider, Table, TreeView, Tabs, Panel, Picture, Shape, PaintBox, StatusBar, Timer, ImageList, and Menu authoring;', '- Text, Button, Input, Memo, Checkbox, Radio, ComboBox, ListBox, Slider, Table, TreeView, Tabs, Panel, Picture, Shape, PaintBox, StatusBar, Timer, ImageList, and Menu authoring;');
replaceOnce('README.md', '- structural editors for Table, TreeView, Tabs, and Panel;', '- structural editors for Table, TreeView, Tabs, and Panel;\n- source-backed Studio/Web R4 presentations for PasswordEdit, MaskedEdit, NumberEdit, DatePicker, TimePicker, CheckedListBox, ProgressBar, GroupBox, ScrollBox, and SplitContainer, with unsupported Current Ready native combinations failing closed;');
replaceOnce('README.md', 'Open **Workshop desk** from Examples for the main RAD showcase and stress fixture.', 'Open **Patch Studio Showcase** for the complete current Studio/Web Project-v4 acceptance surface. Open **Workshop Desk** for the seven-Form Current Ready native acceptance and stress application.');

// Public Studio and examples pages advertise the current, tested boundary without widening native claims.
replaceOnce('web/index.html', 'content="Patch Studio beta.36+: source-backed RAD development with project bundle v4 resources, Button/ImageList, window icons and Native GUI IR 1.9 / runtime v1.10 Ready builds."', 'content="Patch Studio beta.36+: source-backed RAD development with Project v4, TimePicker and current R4 Studio/Web presentations, plus verified Native GUI IR 1.9 / runtime v1.10 Ready builds."');
replaceOnce('web/index.html', '<div class="studio-snapshot-card"><b>RAD R1 authoring</b><span>Picture, Shape, PaintBox, StatusBar, Timer, ImageList and Window icons extend the source-backed Designer; target capability boundaries remain explicit and fail closed.</span></div>', '<div class="studio-snapshot-card"><b>RAD authoring</b><span>Picture, Shape, PaintBox, TimePicker and the current R4 presentation family extend the source-backed Designer; target capability boundaries remain explicit and fail closed.</span></div>');
replaceOnce('web/index.html', 'multi-select ListBox, Table, TreeView, Tabs, Picture, Shape, PaintBox, StatusBar, Timer and ImageList R1 authoring;', 'multi-select ListBox, Table, TreeView, Tabs, Picture, Shape, PaintBox, StatusBar, Timer and ImageList R1 authoring; PasswordEdit, MaskedEdit, NumberEdit, DatePicker and TimePicker source-backed Input presentations on Studio/Web;');
replaceOnce('web/examples.html', '        <tr><td><strong>Combo Window</strong></td><td>ComboBox options and transient text selection.</td><td><a href="https://github.com/pinkysworld/Patch/blob/main/examples/combo-window.patch"><code>combo-window.patch</code></a></td></tr>', '        <tr><td><strong>Combo Window</strong></td><td>ComboBox options and transient text selection.</td><td><a href="https://github.com/pinkysworld/Patch/blob/main/examples/combo-window.patch"><code>combo-window.patch</code></a></td></tr>\n        <tr><td><strong>TimePicker Window</strong></td><td>Studio/Web source-backed <code># @input-mode time</code> with local <code>HH:MM</code> text and explicit native fail-closed behavior.</td><td><a href="https://github.com/pinkysworld/Patch/blob/main/examples/timepicker-window.patch"><code>timepicker-window.patch</code></a></td></tr>');
replaceOnce('web/examples.html', 'Seven Forms, Current Ready native controls, source-backed events, Designer stress and Native GUI IR 1.9 / runtime v1.10 acceptance.', 'Seven Forms, a state-derived quote workflow, Current Ready native controls, source-backed events, Designer stress and Native GUI IR 1.9 / runtime v1.10 acceptance.');
replaceOnce('web/examples.html', 'including Memo, PasswordEdit, MaskedEdit, CheckedListBox and passive ProgressBar.', 'including Memo, PasswordEdit, MaskedEdit, NumberEdit, DatePicker, TimePicker, CheckedListBox and passive ProgressBar.');
replaceOnce('web/examples.html', 'It includes PasswordEdit, MaskedEdit, CheckedListBox and a passive number-backed ProgressBar using <code># @slider-mode progress</code>.', 'It includes PasswordEdit, MaskedEdit, NumberEdit, DatePicker, TimePicker, CheckedListBox and a passive number-backed ProgressBar using <code># @slider-mode progress</code>.');

// Current docs and test-owned documentation contracts.
replaceOnce('docs/ROADMAP.md', '- [x] DatePicker as `# @input-mode date` presentation of ordinary Input, Studio/Web browser date editor with ISO date text `changed(value)` and Current Ready native fail-closed\n', '- [x] DatePicker as `# @input-mode date` presentation of ordinary Input, Studio/Web browser date editor with ISO date text `changed(value)` and Current Ready native fail-closed\n- [x] TimePicker as `# @input-mode time` presentation of ordinary Input, Studio/Web browser time editor with local `HH:MM` text `changed(value)` and Current Ready native fail-closed\n');
replaceOnce('docs/ROADMAP.md', '- [ ] TimePicker and Calendar', '- [ ] Calendar');
replaceOnce('docs/RAD_STUDIO_MASTER_BACKLOG.md', '- [ ] TimePicker;', '- [x] TimePicker Stage 1: ordinary Input plus `# @input-mode time`, Studio/Web browser time presentation with local `HH:MM` text `changed(value)`, Current Ready native unsupported/fail-closed;');
replaceOnce('docs/STUDIO_AUTHORING_SURFACE.md', '- DatePicker as ordinary Input plus `# @input-mode date`;\n', '- DatePicker as ordinary Input plus `# @input-mode date`;\n- TimePicker as ordinary Input plus `# @input-mode time`;\n');
replaceAll('docs/STUDIO_AUTHORING_SURFACE.md', 'NumberEdit, DatePicker, CheckedListBox', 'NumberEdit, DatePicker, TimePicker, CheckedListBox', 2);
replaceOnce('docs/STUDIO_AUTHORING_SURFACE.md', 'TimePicker, Calendar and richer date/time or shell controls from the RAD master backlog;', 'Calendar and richer date/time or shell controls from the RAD master backlog;');
replaceOnce('tests/docs-current-studio-surface.test.js', '  assert.match(roadmap, /DatePicker as `# @input-mode date`/);\n  assert.match(roadmap, /TimePicker and Calendar/);', '  assert.match(roadmap, /DatePicker as `# @input-mode date`/);\n  assert.match(roadmap, /TimePicker as `# @input-mode time`/);\n  assert.match(roadmap, /\[ \] Calendar/);');
replaceOnce('tests/studio-authoring-surface.test.js', 'assert.match(surface, /TimePicker, Calendar and richer date\\/time or shell controls/);', 'assert.match(surface, /Calendar and richer date\\/time or shell controls/);');

// Final invariants before tests run.
assert.match(read('src/input-presentation.js'), /plain', 'password', 'date', 'time/);
assert.match(read('src/window-input-presentation.js'), /addTimePicker/);
assert.match(read('src/native-current-contract.js'), /TimePicker Stage 1/);
assert.match(read('src/window-webapp.js'), /timePickerStage/);
assert.match(read('examples/patch-studio-showcase/main.patch'), /# @input-mode time/);
assert.match(read('examples/workshop-desk.patch'), /Quote recalculated from ticket state/);
assert.equal(read('web/studio-showcase-project.js').includes(read('examples/patch-studio-showcase.patchproject')), true);
console.log('TimePicker, showcase, Workshop Desk, README, website and docs updates applied.');
