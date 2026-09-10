from pathlib import Path
import json


def replace(path, old, new, count=1):
    p = Path(path)
    text = p.read_text(encoding='utf-8')
    actual = text.count(old)
    if actual != count:
        raise SystemExit(f"{path}: expected {count} occurrence(s), found {actual}: {old[:100]!r}")
    p.write_text(text.replace(old, new, count), encoding='utf-8')


# Shared Input presentation contract: add DatePicker as a versioned mode.
replace('src/input-presentation.js',
        "export const PATCH_INPUT_PRESENTATION_VERSION = '0.1';",
        "export const PATCH_INPUT_PRESENTATION_VERSION = '0.2';")
replace('src/input-presentation.js',
        "const MODES = Object.freeze(['plain', 'password']);",
        "const MODES = Object.freeze(['plain', 'password', 'date']);")
replace('src/input-presentation.js',
        "const PLAIN_TARGETS = Object.freeze({",
        "const DATE_TARGETS = Object.freeze({\n  studio: 'supported',\n  web: 'supported',\n  windows: 'unsupported',\n  macos: 'unsupported',\n  linux: 'unsupported',\n  freebsd: 'unsupported'\n});\n\nconst PLAIN_TARGETS = Object.freeze({")
replace('src/input-presentation.js',
        "throw new Error(`Unsupported input presentation '${mode}'. Use plain or password.`);",
        "throw new Error(`Unsupported input presentation '${mode}'. Use plain, password or date.`);")
replace('src/input-presentation.js',
        "const match = text.match(/^\\s*#\\s*@input-mode\\s+(plain|password)\\s*$/i);\n  if (!match) throw new Error(`Invalid # @input-mode directive '${text.trim()}'. Use '# @input-mode password'.`);",
        "const match = text.match(/^\\s*#\\s*@input-mode\\s+(plain|password|date)\\s*$/i);\n  if (!match) throw new Error(`Invalid # @input-mode directive '${text.trim()}'. Use '# @input-mode password' or '# @input-mode date'.`);")
replace('src/input-presentation.js',
        "export function patchInputDomType(mode) {\n  return normalizePatchInputPresentation(mode) === 'password' ? 'password' : 'text';\n}",
        "export function patchInputDomType(mode) {\n  const normalized = normalizePatchInputPresentation(mode);\n  return normalized === 'password' ? 'password' : normalized === 'date' ? 'date' : 'text';\n}")
replace('src/input-presentation.js',
        "export function patchInputPresentationTargetSupport(mode) {\n  return normalizePatchInputPresentation(mode) === 'password' ? PASSWORD_TARGETS : PLAIN_TARGETS;\n}",
        "export function patchInputPresentationTargetSupport(mode) {\n  const normalized = normalizePatchInputPresentation(mode);\n  return normalized === 'password' ? PASSWORD_TARGETS : normalized === 'date' ? DATE_TARGETS : PLAIN_TARGETS;\n}")
replace('src/input-presentation.js',
        "(normalizedMode === 'password'\n        ? 'PasswordEdit Stage 1 is Studio/Web only until a new explicit native GUI/runtime contract is promoted.'\n        : 'Select a supported Patch target.')",
        "(normalizedMode === 'password'\n        ? 'PasswordEdit Stage 1 is Studio/Web only until a new explicit native GUI/runtime contract is promoted.'\n        : normalizedMode === 'date'\n          ? 'DatePicker Stage 1 is Studio/Web only until a new explicit native GUI/runtime contract is promoted.'\n          : 'Select a supported Patch target.')")

# Window source binding and Studio authoring surface.
replace('src/window-input-presentation.js',
        "export const PATCH_WINDOW_INPUT_PRESENTATION_VERSION = '0.1';",
        "export const PATCH_WINDOW_INPUT_PRESENTATION_VERSION = '0.2';")
replace('src/window-input-presentation.js',
        "  if (normalized === 'password' && readNumberEditFromRows(rows, sourceLine)) {\n    throw new Error('PasswordEdit cannot be enabled while NumberEdit is active. Change the Input mode to Text first.');\n  }",
        "  if (normalized !== 'plain') {\n    const label = normalized === 'date' ? 'DatePicker' : 'PasswordEdit';\n    if (readNumberEditFromRows(rows, sourceLine)) {\n      throw new Error(`${label} cannot be enabled while NumberEdit is active. Change the Input mode to Text first.`);\n    }\n    if (readInputMaskFromRows(rows, sourceLine) !== null) {\n      throw new Error(`${label} cannot be enabled while MaskedEdit is active. Change the Input mode to Text first.`);\n    }\n  }")
replace('src/window-input-presentation.js',
        "export function buildWindowInputMaskManifest(source, ast) {",
        "export function collectWindowDateInputIds(source, ast) {\n  const rows = sourceRows(source);\n  const ids = [];\n  walkControls(ast, node => {\n    if (node.control !== 'input' || !node.id) return;\n    if ((readInputPresentationFromRows(rows, node.line) ?? 'plain') === 'date') ids.push(node.id);\n  });\n  return ids;\n}\n\nexport function buildWindowInputMaskManifest(source, ast) {")
replace('src/window-input-presentation.js',
        "    if (mode === 'password') {\n      throw new Error(`Input '${node.id ?? '?'}' cannot combine PasswordEdit and MaskedEdit presentation metadata.`);\n    }",
        "    if (mode !== 'plain') {\n      const label = mode === 'date' ? 'DatePicker' : 'PasswordEdit';\n      throw new Error(`Input '${node.id ?? '?'}' cannot combine ${label} and MaskedEdit presentation metadata.`);\n    }")
replace('src/window-input-presentation.js',
        "  if ((readInputPresentationFromRows(rows, sourceLine) ?? 'plain') === 'password') {\n    throw new Error('MaskedEdit cannot be enabled while Input mode is Password. Change the Input mode to Text first.');\n  }",
        "  const presentation = readInputPresentationFromRows(rows, sourceLine) ?? 'plain';\n  if (presentation !== 'plain') {\n    throw new Error(`MaskedEdit cannot be enabled while Input mode is ${presentation === 'date' ? 'Date' : 'Password'}. Change the Input mode to Text first.`);\n  }")
replace('src/window-input-presentation.js',
        "    if (mode === 'password') {\n      throw new Error(`Input '${node.id ?? '?'}' cannot combine NumberEdit and PasswordEdit presentation metadata.`);\n    }",
        "    if (mode !== 'plain') {\n      const label = mode === 'date' ? 'DatePicker' : 'PasswordEdit';\n      throw new Error(`Input '${node.id ?? '?'}' cannot combine NumberEdit and ${label} presentation metadata.`);\n    }")
replace('src/window-input-presentation.js',
        "  if ((readInputPresentationFromRows(rows, sourceLine) ?? 'plain') === 'password') {\n    throw new Error('NumberEdit cannot be enabled while Input mode is Password. Change the Input mode to Text first.');\n  }",
        "  const presentation = readInputPresentationFromRows(rows, sourceLine) ?? 'plain';\n  if (presentation !== 'plain') {\n    throw new Error(`NumberEdit cannot be enabled while Input mode is ${presentation === 'date' ? 'Date' : 'Password'}. Change the Input mode to Text first.`);\n  }")
replace('src/window-input-presentation.js',
        "  ensureNumberEditButton();\n  ensureInputPresentationInspector();",
        "  ensureNumberEditButton();\n  ensureDatePickerButton();\n  ensureInputPresentationInspector();",
        count=2)
replace('src/window-input-presentation.js',
        "    document.querySelector('#addNumberEdit') &&\n    document.querySelector('#designerInspectorInputPresentationField')",
        "    document.querySelector('#addNumberEdit') &&\n    document.querySelector('#addDatePicker') &&\n    document.querySelector('#designerInspectorInputPresentationField')")
replace('src/window-input-presentation.js',
        "async function addPasswordEditFromStudio(event) {",
        "function ensureDatePickerButton() {\n  const toolbar = document.querySelector('#designer .designer-toolbar');\n  const anchor = toolbar?.querySelector('#addNumberEdit') ?? toolbar?.querySelector('#addMaskedEdit') ?? toolbar?.querySelector('#addPasswordEdit') ?? toolbar?.querySelector('#addInput');\n  if (!toolbar || !anchor || toolbar.querySelector('#addDatePicker')) return Boolean(toolbar?.querySelector('#addDatePicker'));\n  const button = document.createElement('button');\n  button.id = 'addDatePicker';\n  button.className = 'secondary small';\n  button.type = 'button';\n  button.textContent = '+ Date';\n  button.setAttribute('aria-label', 'Add DatePicker');\n  button.title = 'Add a source-backed DatePicker preset. It remains an Input, uses # @input-mode date and changed(value) stays ISO date text.';\n  anchor.insertAdjacentElement('afterend', button);\n  button.addEventListener('click', addDatePickerFromStudio);\n  return true;\n}\n\nasync function addPasswordEditFromStudio(event) {")
replace('src/window-input-presentation.js',
        "async function addNumberEditFromStudio(event) {\n  event?.preventDefault?.();\n  await addInputPreset('number');\n}\n",
        "async function addNumberEditFromStudio(event) {\n  event?.preventDefault?.();\n  await addInputPreset('number');\n}\n\nasync function addDatePickerFromStudio(event) {\n  event?.preventDefault?.();\n  await addInputPreset('date');\n}\n")
replace('src/window-input-presentation.js',
        "    if (kind === 'password') next = setWindowInputPresentation(next, input.line, 'password');\n    else if (kind === 'masked') next = setWindowInputMask(next, input.line, DEFAULT_MASK);\n    else next = setWindowNumberEdit(next, input.line, true);",
        "    if (kind === 'password') next = setWindowInputPresentation(next, input.line, 'password');\n    else if (kind === 'masked') next = setWindowInputMask(next, input.line, DEFAULT_MASK);\n    else if (kind === 'date') next = setWindowInputPresentation(next, input.line, 'date');\n    else next = setWindowNumberEdit(next, input.line, true);")
replace('src/window-input-presentation.js',
        "        <option value=\"number\">Number</option>\n      </select>\n      <small id=\"designerInspectorInputPresentationHint\" class=\"inspector-hint\">Source-backed presentation. Password, Masked and Number are Studio/Web Stage 1; Current Ready native 1.10 fails closed.</small>",
        "        <option value=\"number\">Number</option>\n        <option value=\"date\">Date</option>\n      </select>\n      <small id=\"designerInspectorInputPresentationHint\" class=\"inspector-hint\">Source-backed presentation. Password, Masked, Number and Date are Studio/Web Stage 1; Current Ready native 1.10 fails closed.</small>")
replace('src/window-input-presentation.js',
        "    if (select && !select.querySelector('option[value=\"number\"]')) {\n      const option = document.createElement('option');\n      option.value = 'number';\n      option.textContent = 'Number';\n      select.appendChild(option);\n    }\n    if (select) {",
        "    if (select && !select.querySelector('option[value=\"number\"]')) {\n      const option = document.createElement('option');\n      option.value = 'number';\n      option.textContent = 'Number';\n      select.appendChild(option);\n    }\n    if (select && !select.querySelector('option[value=\"date\"]')) {\n      const option = document.createElement('option');\n      option.value = 'date';\n      option.textContent = 'Date';\n      select.appendChild(option);\n    }\n    if (select) {")
replace('src/window-input-presentation.js',
        "    } else if (select.value === 'number') {\n      next = mutateInputById(next, control.id, line => setWindowInputMask(next, line, null));\n      next = mutateInputById(next, control.id, line => setWindowInputPresentation(next, line, 'plain'));\n      next = mutateInputById(next, control.id, line => setWindowNumberEdit(next, line, true));\n    } else {",
        "    } else if (select.value === 'number') {\n      next = mutateInputById(next, control.id, line => setWindowInputMask(next, line, null));\n      next = mutateInputById(next, control.id, line => setWindowInputPresentation(next, line, 'plain'));\n      next = mutateInputById(next, control.id, line => setWindowNumberEdit(next, line, true));\n    } else if (select.value === 'date') {\n      next = mutateInputById(next, control.id, line => setWindowNumberEdit(next, line, false));\n      next = mutateInputById(next, control.id, line => setWindowInputMask(next, line, null));\n      next = mutateInputById(next, control.id, line => setWindowInputPresentation(next, line, 'date'));\n    } else {")
replace('src/window-input-presentation.js',
        "  let passwordIds;\n  let numberIds;\n  let masks;",
        "  let passwordIds;\n  let dateIds;\n  let numberIds;\n  let masks;")
replace('src/window-input-presentation.js',
        "    passwordIds = new Set(collectWindowPasswordInputIds(code.value, ast));\n    numberIds = new Set(collectWindowNumberEditInputIds(code.value, ast));",
        "    passwordIds = new Set(collectWindowPasswordInputIds(code.value, ast));\n    dateIds = new Set(collectWindowDateInputIds(code.value, ast));\n    numberIds = new Set(collectWindowNumberEditInputIds(code.value, ast));")
replace('src/window-input-presentation.js',
        "      const numberEdit = numberIds.has(id);\n      const password = passwordIds.has(id);\n      const mask = masks.get(id) ?? null;\n      input.type = numberEdit ? 'number' : password ? 'password' : 'text';\n      input.dataset.patchInputPresentation = numberEdit ? 'number' : password ? 'password' : mask ? 'masked' : 'plain';\n      input.removeAttribute('step');\n      if (numberEdit) {\n        clearMaskFromStudioInput(input);\n        input.step = 'any';\n        input.inputMode = 'decimal';\n        input.setAttribute('aria-label', `${id || 'Number'} number input`);\n      } else if (mask && !password) applyMaskToStudioInput(input, id, mask);\n      else clearMaskFromStudioInput(input);",
        "      const numberEdit = numberIds.has(id);\n      const date = dateIds.has(id);\n      const password = passwordIds.has(id);\n      const mask = masks.get(id) ?? null;\n      input.type = numberEdit ? 'number' : date ? 'date' : password ? 'password' : 'text';\n      input.dataset.patchInputPresentation = numberEdit ? 'number' : date ? 'date' : password ? 'password' : mask ? 'masked' : 'plain';\n      input.removeAttribute('step');\n      if (numberEdit) {\n        clearMaskFromStudioInput(input);\n        input.step = 'any';\n        input.inputMode = 'decimal';\n        input.setAttribute('aria-label', `${id || 'Number'} number input`);\n      } else if (date) {\n        clearMaskFromStudioInput(input);\n        input.setAttribute('aria-label', `${id || 'Date'} date input`);\n      } else if (mask && !password) applyMaskToStudioInput(input, id, mask);\n      else clearMaskFromStudioInput(input);")

# Native fail-closed boundary.
replace('src/native-current-contract.js',
        "      if (node.inputMask) {",
        "      if (node.inputPresentation === 'date') {\n        throw new NativeGuiError(`DatePicker Stage 1 Input${name} is Studio/Web only. Current Ready native ${PATCH_CURRENT_NATIVE_RUNTIME_VERSION} has no date-input presentation contract; validation fails closed rather than lowering it as a plain text Input.`);\n      }\n      if (node.inputMask) {")

# Standalone Window Web rendering and metadata.
replace('src/window-webapp.js',
        "  const numberEditCount = compiled?.windowNumberEdit?.controls?.length ?? 0;",
        "  const numberEditCount = compiled?.windowNumberEdit?.controls?.length ?? 0;\n  const datePickerCount = compiled?.windowInputPresentation?.controls?.filter(control => control.mode === 'date').length ?? 0;")
replace('src/window-webapp.js',
        "      numberEditEventValue: 'text'\n    } : {})",
        "      numberEditEventValue: 'text'\n    } : {}),\n    ...(datePickerCount ? {\n      datePickerStage: 1,\n      datePickerVersion: '0.2',\n      datePickerMode: 'source-backed-date-input',\n      datePickerEventValue: 'iso-date-text'\n    } : {})")
replace('src/window-webapp.js',
        "value:node.id&&state.has(node.id)?clone(state.get(node.id)):'',numberEdit:node.control==='input'&&node.numberEdit===true,imageListId:",
        "value:node.id&&state.has(node.id)?clone(state.get(node.id)):'',inputPresentation:node.control==='input'?(node.inputPresentation||'plain'):null,numberEdit:node.control==='input'&&node.numberEdit===true,imageListId:")
replace('src/window-webapp.js',
        "if(control.type==='input'){const el=document.createElement('input');if(control.numberEdit){el.type='number';el.step='any';el.inputMode='decimal';el.dataset.patchInputPresentation='number';el.setAttribute('aria-label',String(control.id||'Number')+' number input');}el.value=control.value??'';el.placeholder=control.text||control.id||'';el.addEventListener('input',()=>safeTrigger(control.id,'changed',{value:el.value}));return el;}",
        "if(control.type==='input'){const el=document.createElement('input');if(control.numberEdit){el.type='number';el.step='any';el.inputMode='decimal';el.dataset.patchInputPresentation='number';el.setAttribute('aria-label',String(control.id||'Number')+' number input');}else if(control.inputPresentation==='date'){el.type='date';el.dataset.patchInputPresentation='date';el.setAttribute('aria-label',String(control.id||'Date')+' date input');}el.value=control.value??'';el.placeholder=control.text||control.id||'';el.addEventListener('input',()=>safeTrigger(control.id,'changed',{value:el.value}));return el;}")

# Existing generic presentation tests move to contract v0.2.
replace('tests/input-presentation.test.js',
        "test('Input presentation contract is versioned and keeps plain/password modes explicit', () => {\n  assert.equal(PATCH_INPUT_PRESENTATION_VERSION, '0.1');\n  assert.deepEqual(patchInputPresentationModes(), ['plain', 'password']);\n  assert.equal(normalizePatchInputPresentation(), 'plain');\n  assert.equal(normalizePatchInputPresentation(' PASSWORD '), 'password');\n  assert.throws(() => normalizePatchInputPresentation('secret'), /Use plain or password/);\n});",
        "test('Input presentation contract v0.2 keeps plain/password/date modes explicit', () => {\n  assert.equal(PATCH_INPUT_PRESENTATION_VERSION, '0.2');\n  assert.deepEqual(patchInputPresentationModes(), ['plain', 'password', 'date']);\n  assert.equal(normalizePatchInputPresentation(), 'plain');\n  assert.equal(normalizePatchInputPresentation(' PASSWORD '), 'password');\n  assert.equal(normalizePatchInputPresentation(' DATE '), 'date');\n  assert.throws(() => normalizePatchInputPresentation('secret'), /Use plain, password or date/);\n});")
replace('tests/input-presentation.test.js',
        "  assert.equal(parsePatchInputPresentationDirective('# @input-mode plain'), 'plain');\n  assert.equal(parsePatchInputPresentationDirective('# ordinary comment'), null);\n  assert.equal(formatPatchInputPresentationDirective('password'), '# @input-mode password');\n  assert.equal(formatPatchInputPresentationDirective('plain'), null);",
        "  assert.equal(parsePatchInputPresentationDirective('# @input-mode plain'), 'plain');\n  assert.equal(parsePatchInputPresentationDirective('# @input-mode date'), 'date');\n  assert.equal(parsePatchInputPresentationDirective('# ordinary comment'), null);\n  assert.equal(formatPatchInputPresentationDirective('password'), '# @input-mode password');\n  assert.equal(formatPatchInputPresentationDirective('date'), '# @input-mode date');\n  assert.equal(formatPatchInputPresentationDirective('plain'), null);")
replace('tests/input-presentation.test.js',
        "  assert.equal(patchInputDomType('plain'), 'text');\n  assert.equal(patchInputDomType('password'), 'password');",
        "  assert.equal(patchInputDomType('plain'), 'text');\n  assert.equal(patchInputDomType('password'), 'password');\n  assert.equal(patchInputDomType('date'), 'date');")
replace('tests/input-presentation.test.js',
        "  assert.equal(assertPatchInputPresentationTarget('password', 'web'), true);\n  assert.throws(\n    () => assertPatchInputPresentationTarget('password', 'windows'),\n    /PasswordEdit Stage 1 is Studio\\/Web only/\n  );\n  assert.equal(assertPatchInputPresentationTarget('plain', 'linux'), true);",
        "  assert.equal(assertPatchInputPresentationTarget('password', 'web'), true);\n  assert.throws(\n    () => assertPatchInputPresentationTarget('password', 'windows'),\n    /PasswordEdit Stage 1 is Studio\\/Web only/\n  );\n  assert.equal(patchInputPresentationTargetSupport('date').web, 'supported');\n  assert.equal(patchInputPresentationTargetSupport('date').windows, 'unsupported');\n  assert.equal(assertPatchInputPresentationTarget('date', 'web'), true);\n  assert.throws(\n    () => assertPatchInputPresentationTarget('date', 'windows'),\n    /DatePicker Stage 1 is Studio\\/Web only/\n  );\n  assert.equal(assertPatchInputPresentationTarget('plain', 'linux'), true);")
replace('tests/input-presentation.test.js',
        "assert.equal(PATCH_WINDOW_INPUT_PRESENTATION_VERSION, '0.1');",
        "assert.equal(PATCH_WINDOW_INPUT_PRESENTATION_VERSION, '0.2');")
replace('tests/input-presentation.test.js',
        "assert.equal(compiled.windowInputPresentation.version, '0.1');",
        "assert.equal(compiled.windowInputPresentation.version, '0.2');")

Path('tests/datepicker-stage1.test.js').write_text(r'''import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { parse } from '../src/parser.js';
import { compile } from '../src/compiler.js';
import { buildStandaloneWebApp } from '../src/webapp.js';
import { buildCurrentNativeGuiIR } from '../src/native-current-contract.js';
import {
  collectWindowDateInputIds,
  readWindowInputPresentation,
  setWindowInputMask,
  setWindowInputPresentation,
  setWindowNumberEdit
} from '../src/window-input-presentation.js';

const SOURCE = `create text appointment = "2026-09-10"
window "Schedule" as main size 520, 300:
  # @input-mode date
  input appointment at 24, 24 size 220, 36
when appointment changed:
  change appointment:
    set = value
`;

test('DatePicker source mode round-trips as transparent Input presentation metadata', () => {
  const plain = `window "Schedule" as main size 520, 300:\n  input appointment at 24, 24 size 220, 36\n`;
  const date = setWindowInputPresentation(plain, 2, 'date');
  assert.match(date, /  # @input-mode date\n  input appointment/);
  assert.equal(readWindowInputPresentation(date, 3), 'date');
  assert.equal(setWindowInputPresentation(date, 3, 'plain'), plain);
});

test('DatePicker discovery follows Inputs through Tabs and Panels', () => {
  const source = `window "Nested" as main size 620, 420:
  # @input-mode date
  input top_date at 24, 24 size 220, 36
  tabs as pages at 24, 80 size 500, 160:
    tab "Date":
      # @input-mode date
      input tab_date
    tab "Other":
      input ordinary
  panel as dates at 24, 260 size 320, 120:
    # @input-mode date
    input panel_date at 12, 12 size 220, 36
`;
  assert.deepEqual(collectWindowDateInputIds(source, parse(source)), ['top_date', 'tab_date', 'panel_date']);
});

test('DatePicker is mutually exclusive with MaskedEdit and NumberEdit metadata', () => {
  const masked = `window "Bad" as main:\n  # @input-mode date\n  # @input-mask "0000"\n  input appointment\n`;
  assert.throws(() => compile(masked, { kind: 'window' }), /cannot combine DatePicker and MaskedEdit/);

  const numbered = `window "Bad" as main:\n  # @input-mode date\n  # @number-edit\n  input appointment\n`;
  assert.throws(() => compile(numbered, { kind: 'window' }), /cannot combine NumberEdit and DatePicker/);

  const date = `window "Date":\n  # @input-mode date\n  input appointment\n`;
  assert.throws(() => setWindowInputMask(date, 3, '0000'), /Input mode is Date/);
  assert.throws(() => setWindowNumberEdit(date, 3, true), /Input mode is Date/);

  const number = `window "Number":\n  # @number-edit\n  input appointment\n`;
  assert.throws(() => setWindowInputPresentation(number, 3, 'date'), /DatePicker cannot be enabled while NumberEdit is active/);
});

test('DatePicker compile metadata preserves ordinary Input and Change IR 0.10 semantics', () => {
  const compiled = compile(SOURCE, { name: 'Schedule', kind: 'window', entry: 'main.patch' });
  const input = compiled.ast.find(node => node.kind === 'window').body.find(node => node.control === 'input');
  assert.equal(compiled.ir.version, '0.10');
  assert.equal(compiled.windowInputPresentation.version, '0.2');
  assert.equal(input.control, 'input');
  assert.equal(input.inputPresentation, 'date');
});

test('Standalone Window Web renders DatePicker as browser date input while changed(value) stays text', () => {
  const built = buildStandaloneWebApp(SOURCE, { name: 'Schedule', kind: 'window' });
  assert.equal(built.metadata.datePickerStage, 1);
  assert.equal(built.metadata.datePickerVersion, '0.2');
  assert.equal(built.metadata.datePickerMode, 'source-backed-date-input');
  assert.equal(built.metadata.datePickerEventValue, 'iso-date-text');
  assert.match(built.html, /inputPresentation:node\.control==='input'/);
  assert.match(built.html, /control\.inputPresentation==='date'/);
  assert.match(built.html, /el\.type='date'/);
  assert.match(built.html, /dataset\.patchInputPresentation='date'/);
  assert.match(built.html, /safeTrigger\(control\.id,'changed',\{value:el\.value\}\)/);
});

test('Current Ready native rejects DatePicker explicitly while plain Input remains compatible', () => {
  const compiled = compile(SOURCE, { name: 'Schedule', kind: 'window', entry: 'main.patch' });
  assert.throws(
    () => buildCurrentNativeGuiIR(compiled),
    /DatePicker Stage 1.*Studio\/Web only.*Current Ready native 1\.10/i
  );

  const plain = compile(`create text value = "plain"\nwindow "Plain" as main size 420, 240:\n  input value at 24, 24 size 220, 36\n`, { name: 'Plain', kind: 'window', entry: 'main.patch' });
  assert.equal(buildCurrentNativeGuiIR(plain).version, '1.9');
});

test('Patch Studio exposes DatePicker palette, Inspector and date DOM presentation', () => {
  const studio = fs.readFileSync('src/window-input-presentation.js', 'utf8');
  assert.match(studio, /button\.id = 'addDatePicker'/);
  assert.match(studio, /button\.textContent = '\+ Date'/);
  assert.match(studio, /option value="date">Date<\/option>/);
  assert.match(studio, /input\.type = numberEdit \? 'number' : date \? 'date'/);
  assert.match(studio, /dataset\.patchInputPresentation = numberEdit \? 'number' : date \? 'date'/);
  assert.match(studio, /date input/);
});
''', encoding='utf-8')

# Canonical Showcase: represent both NumberEdit and DatePicker properly.
replace('examples/patch-studio-showcase/main.patch',
        'create text nested_code = ""\n',
        'create text nested_number = "42"\ncreate text review_date = "2026-09-10"\n')
replace('examples/patch-studio-showcase/main.patch',
        '      text "Tabs Stage 1 keeps supported flow controls source-backed."\n      # @input-mask "AA-000"\n      input nested_code\n      button "Apply nested code" as nested_apply',
        '      text "Tabs Stage 1 keeps NumberEdit and DatePicker source-backed as Input presentations."\n      # @number-edit\n      input nested_number\n      # @input-mode date\n      input review_date\n      button "Apply nested values" as nested_apply')
replace('examples/patch-studio-showcase/main.patch',
        '      text "Layout, TabOrder, Locked, PasswordEdit, MaskedEdit, CheckedListBox, ProgressBar, GroupBox, ScrollBox and SplitContainer metadata stays source-backed."',
        '      text "Layout, TabOrder, Locked, PasswordEdit, MaskedEdit, NumberEdit, DatePicker and the current Panel/List/Slider presentations stay source-backed."')
replace('examples/patch-studio-showcase/logic.patch',
        'when nested_code changed:\n  change nested_code:\n    set = value\n  change status:\n    set = "Nested masked input updated"\n\nwhen nested_apply clicked:\n  change status:\n    set = "Nested code applied"',
        'when nested_number changed:\n  change nested_number:\n    set = value\n  change status:\n    set = "NumberEdit value updated"\n\nwhen review_date changed:\n  change review_date:\n    set = value\n  change status:\n    set = "DatePicker selection updated"\n\nwhen nested_apply clicked:\n  change status:\n    set = "Nested values applied"')
replace('examples/patch-studio-showcase/forms.patch',
        '    row "MaskedEdit", "Input mask", "Studio/Web"\n    row "CheckedListBox", "List presentation", "Studio/Web"',
        '    row "MaskedEdit", "Input mask", "Studio/Web"\n    row "NumberEdit", "Numeric Input presentation", "Studio/Web"\n    row "DatePicker", "Date Input presentation", "Studio/Web"\n    row "CheckedListBox", "List presentation", "Studio/Web"')

# Showcase acceptance tests.
replace('tests/studio-showcase.test.js',
        '  assert.match(composition.source, /# @input-mask "AA-000"/);',
        '  assert.match(composition.source, /# @number-edit/);\n  assert.match(composition.source, /# @input-mode date/);')
replace('tests/studio-showcase.test.js',
        "  assert.equal(compiled.windowInputPresentation.controls.some(control => control.mode === 'password'), true);",
        "  assert.equal(compiled.windowInputPresentation.controls.some(control => control.mode === 'password'), true);\n  assert.equal(compiled.windowInputPresentation.controls.some(control => control.mode === 'date'), true);\n  assert.equal(compiled.windowNumberEdit.controls.some(control => control.id === 'nested_number'), true);")
replace('tests/studio-showcase.test.js',
        "  assert.equal(built.metadata.passwordEditStage, 1);\n  assert.equal(built.metadata.maskedEditStage, 1);",
        "  assert.equal(built.metadata.passwordEditStage, 1);\n  assert.equal(built.metadata.datePickerStage, 1);\n  assert.equal(built.metadata.datePickerEventValue, 'iso-date-text');\n  assert.equal(built.metadata.numberEditStage, 1);\n  assert.equal(built.metadata.maskedEditStage, 1);")
replace('tests/studio-showcase.test.js',
        "  assert.match(built.html, /data-patch-window-passwordedit/);\n  assert.match(built.html, /data-patch-window-maskededit/);",
        "  assert.match(built.html, /data-patch-window-passwordedit/);\n  assert.match(built.html, /dataset\\.patchInputPresentation='date'/);\n  assert.match(built.html, /dataset\\.patchInputPresentation='number'/);\n  assert.match(built.html, /data-patch-window-maskededit/);")

# Backlog and authoring docs: close NumberEdit documentation gap and mark DatePicker Stage 1.
replace('docs/RAD_STUDIO_MASTER_BACKLOG.md',
        '- [ ] SpinEdit/NumberEdit;\n- [ ] DatePicker;',
        '- [x] SpinEdit/NumberEdit Stage 1: ordinary Input plus `# @number-edit`, Studio/Web numeric presentation with text `changed(value)`, Current Ready native unsupported/fail-closed;\n- [x] DatePicker Stage 1: ordinary Input plus `# @input-mode date`, Studio/Web browser date presentation with ISO date text `changed(value)`, Current Ready native unsupported/fail-closed;')
replace('docs/ROADMAP.md',
        '- [x] MaskedEdit as `# @input-mask "..."` presentation of ordinary Input, Studio/Web supported and Current Ready native fail-closed\n- [x] CheckedListBox',
        '- [x] MaskedEdit as `# @input-mask "..."` presentation of ordinary Input, Studio/Web supported and Current Ready native fail-closed\n- [x] NumberEdit as `# @number-edit` presentation of ordinary Input, Studio/Web numeric editor with text `changed(value)` and Current Ready native fail-closed\n- [x] DatePicker as `# @input-mode date` presentation of ordinary Input, Studio/Web browser date editor with ISO date text `changed(value)` and Current Ready native fail-closed\n- [x] CheckedListBox')
replace('docs/ROADMAP.md',
        '- [ ] SpinEdit/NumberEdit and Date/Time controls',
        '- [ ] TimePicker and Calendar')
replace('docs/STUDIO_AUTHORING_SURFACE.md',
        '- MaskedEdit as ordinary Input plus `# @input-mask "..."`;\n- CheckedListBox',
        '- MaskedEdit as ordinary Input plus `# @input-mask "..."`;\n- NumberEdit as ordinary Input plus `# @number-edit`;\n- DatePicker as ordinary Input plus `# @input-mode date`;\n- CheckedListBox')
replace('docs/STUDIO_AUTHORING_SURFACE.md',
        'These presentation contracts remain source-backed. PasswordEdit, MaskedEdit, CheckedListBox, ProgressBar, GroupBox, ScrollBox and SplitContainer are supported in Studio and Standalone Web.',
        'These presentation contracts remain source-backed. PasswordEdit, MaskedEdit, NumberEdit, DatePicker, CheckedListBox, ProgressBar, GroupBox, ScrollBox and SplitContainer are supported in Studio and Standalone Web.')
replace('docs/STUDIO_AUTHORING_SURFACE.md',
        'Layout, TabOrder, Locked, PasswordEdit, MaskedEdit, CheckedListBox, ProgressBar and GroupBox metadata move with their control',
        'Layout, TabOrder, Locked, PasswordEdit, MaskedEdit, NumberEdit, DatePicker, CheckedListBox, ProgressBar and GroupBox metadata move with their control')
replace('docs/STUDIO_AUTHORING_SURFACE.md',
        'Slider `changed` exposes a bounded finite numeric transient `value`. List-backed ListBox exposes a transient text-list selection, Table exposes the selected row as a transient text list, and TreeView exposes the selected root-to-node display path as a transient text list.',
        'Input presentations retain the ordinary Input `changed(value)` text contract: NumberEdit emits numeric text and DatePicker emits browser date text in `YYYY-MM-DD` form when a date is selected. Slider `changed` exposes a bounded finite numeric transient `value`. List-backed ListBox exposes a transient text-list selection, Table exposes the selected row as a transient text list, and TreeView exposes the selected root-to-node display path as a transient text list.')
replace('docs/STUDIO_AUTHORING_SURFACE.md',
        'Memo/TextArea, PasswordEdit, MaskedEdit, CheckedListBox, ProgressBar, GroupBox, ScrollBox, SplitContainer and positioned Panel-child Stage-2 semantics',
        'Memo/TextArea, PasswordEdit, MaskedEdit, NumberEdit, DatePicker, CheckedListBox, ProgressBar, GroupBox, ScrollBox, SplitContainer and positioned Panel-child Stage-2 semantics')
replace('docs/STUDIO_AUTHORING_SURFACE.md',
        '- Number/SpinEdit, date/time controls and richer shell controls from the RAD master backlog;',
        '- TimePicker, Calendar and richer date/time or shell controls from the RAD master backlog;')
replace('examples/patch-studio-showcase/README.md',
        '- PasswordEdit and MaskedEdit source-backed Input presentations;\n- CheckedListBox',
        '- PasswordEdit and MaskedEdit source-backed Input presentations;\n- NumberEdit as the source-backed `# @number-edit` Input presentation;\n- DatePicker as the source-backed `# @input-mode date` Input presentation with ISO date text;\n- CheckedListBox')
replace('examples/patch-studio-showcase/README.md',
        '- Memo, PasswordEdit, MaskedEdit, CheckedListBox, ProgressBar, GroupBox, ScrollBox and SplitContainer are Studio/Web Stage-1 surfaces',
        '- Memo, PasswordEdit, MaskedEdit, NumberEdit, DatePicker, CheckedListBox, ProgressBar, GroupBox, ScrollBox and SplitContainer are Studio/Web Stage-1 surfaces')

# Keep readable Showcase sources, canonical project bundle and embedded browser copy byte-identical.
project_path = Path('examples/patch-studio-showcase.patchproject')
bundle = json.loads(project_path.read_text(encoding='utf-8'))
source_dir = Path('examples/patch-studio-showcase')
for file in bundle['files']:
    file['content'] = (source_dir / file['path']).read_text(encoding='utf-8')
canonical = json.dumps(bundle, indent=2, ensure_ascii=False) + '\n'
project_path.write_text(canonical, encoding='utf-8')
if '`' in canonical or '${' in canonical:
    raise SystemExit('Showcase project cannot be embedded safely in String.raw template literal')
Path('web/studio-showcase-project.js').write_text(
    '// Generated canonical browser copy of examples/patch-studio-showcase.patchproject.\n'
    '// tests/studio-showcase-loader.test.js keeps the String.raw payload byte-for-byte synchronized.\n'
    'export const PATCH_STUDIO_SHOWCASE_PROJECT = String.raw`' + canonical + '`;\n',
    encoding='utf-8'
)
