import { PatchInterpreter } from '../src/interpreter.js';
import { compile } from '../src/compiler.js';
import { buildPatchApp, serializePatchApp } from '../src/bundle.js';
import { compileToWasm } from '../src/wasm.js';
import { compileToDirectWasm } from '../src/wasm-direct.js';
import { buildStandaloneWebApp } from '../src/webapp.js';
import {
  addDesignerControl,
  listDesignerControls,
  removeDesignerControl,
  updateDesignerControl
} from '../src/designer.js';
import { triggerWindowEvent } from '../src/window-events.js';

const samples = {
  counterWindow: `create number count = 0

window "Counter":
  text "Count: {count}"
  button "Add" as add_button

when add_button clicked:
  change count:
    add 1`,
  capabilities: `create thing player:
  name = "Mia"
  score = 0

allow reward:
  player.score may increase up to 10

make reward(player, bonus number 0..10):
  change player:
    add bonus to score

do reward(player, 7)
show player.score
why player.score`,
  score: `create number score = 0
watch score

change score:
  add 1

change score called bonus:
  add 10

show score
history score
why score > 5`,
  fruits: `create list fruits = apple, banana

change fruits:
  add orange
  remove banana

show fruits`,
  player: `create thing player:
  name = "Sam"
  score = 0
  lives = 3

change player:
  add 10 to score
  remove 1 from lives

show player`,
  undo: `create number score = 5

change score called bonus:
  add 10
show score

undo bonus
show score
redo
show score
history score`,
  story: `create number courage = 2
create text hero = "Mia"

repeat 3:
  change courage:
    add 1

if courage >= 5:
  show hero + " opens the mysterious door."
else:
  show hero + " waits outside."

preview:
  change courage:
    add 100

show courage`
};

installDesignerInspectorStylesheet();

const code = document.querySelector('#code');
const output = document.querySelector('#output');
const changesView = document.querySelector('#changes');
const irView = document.querySelector('#ir');
const appView = document.querySelector('#app');
const designerView = document.querySelector('#designer');
const designerCanvas = document.querySelector('#designerCanvas');
const designerInspector = installDesignerInspector();
const sample = document.querySelector('#sample');
const projectName = document.querySelector('#projectName');
const projectKind = document.querySelector('#projectKind');
const buildTarget = document.querySelector('#buildTarget');
const saveState = document.querySelector('#saveState');
let runtime = null;
let designerTimer = null;
let designerSelection = null;
let designerControls = [];

const saved = loadProject();
code.value = saved?.code ?? samples.counterWindow;
projectName.value = saved?.name ?? 'MyPatchApp';
projectKind.value = saved?.kind ?? (saved ? 'console' : 'window');

sample.addEventListener('change', () => {
  code.value = samples[sample.value];
  projectKind.value = sample.value === 'counterWindow' ? 'window' : 'console';
  designerSelection = null;
  saveProject();
  refreshDesigner();
  showTab(sample.value === 'capabilities' ? 'changes' : (projectKind.value === 'window' ? 'designer' : 'output'));
  if (sample.value === 'capabilities') refreshChangeContract();
});

for (const input of [code, projectName, projectKind]) {
  input.addEventListener('input', () => { saveProject(); scheduleDesigner(); scheduleChangeContract(); });
  input.addEventListener('change', () => { saveProject(); refreshDesigner(); refreshChangeContract(); });
}

document.querySelector('#run').addEventListener('click', runProject);
document.querySelector('#addText').addEventListener('click', () => addControl('text'));
document.querySelector('#addButton').addEventListener('click', () => addControl('button'));
document.querySelector('#addInput').addEventListener('click', () => addControl('input'));
designerInspector.apply.addEventListener('click', applyDesignerProperties);
designerInspector.remove.addEventListener('click', removeSelectedDesignerControl);
designerInspector.source.addEventListener('click', revealSelectedDesignerSource);
for (const field of [designerInspector.idInput, designerInspector.textInput]) {
  field.addEventListener('keydown', event => {
    if (event.key === 'Enter') { event.preventDefault(); applyDesignerProperties(); }
  });
}

document.querySelector('#build').addEventListener('click', () => {
  try {
    const name = safeName(projectName.value);
    if (buildTarget.value === 'web') {
      const built = buildStandaloneWebApp(code.value, projectOptions());
      download(`${name}.html`, built.html, 'text/html');
      irView.textContent = JSON.stringify(built.compiled.ir, null, 2);
      changesView.textContent = formatChangeAnalysis(built.compiled.ir);
      if (built.metadata?.projectKind === 'window') {
        output.textContent = `Built ${name}.html\n\nStandalone single-file Patch Window Web App. Open it directly in a modern browser. The Window UI and event logic execute through Patch's generated browser Window runtime; this target no longer routes Window projects through the Console-only Direct Wasm backend.`;
      } else {
        output.textContent = `Built ${name}.html\n\nStandalone single-file Patch Console Web App. Open it directly in a modern browser; the direct Patch Wasm module and its tiny host are embedded in the HTML file.`;
      }
    } else if (buildTarget.value === 'wasm-direct') {
      if (projectKind.value === 'window') {
        throw new Error('Direct WebAssembly currently supports Console projects only. For a Window project choose Standalone Web App or a Windows/macOS/Linux App target.');
      }
      const built = compileToDirectWasm(code.value, projectOptions());
      download(`${name}.direct.wasm`, built.module, 'application/wasm');
      irView.textContent = JSON.stringify(built.compiled.ir, null, 2);
      changesView.textContent = formatChangeAnalysis(built.compiled.ir);
      output.textContent = `Built ${name}.direct.wasm\n\nThis contains directly lowered Patch Console instructions. It imports patch.show_number and patch.change_number, so use the Patch CLI host, a Console Standalone Web App, or a native Patch console host to run it.`;
    } else if (buildTarget.value === 'wasm-bootstrap') {
      const built = compileToWasm(code.value, projectOptions());
      download(`${name}.bootstrap.wasm`, built.module, 'application/wasm');
      irView.textContent = JSON.stringify(built.compiled.ir, null, 2);
      changesView.textContent = formatChangeAnalysis(built.compiled.ir);
      output.textContent = `Built ${name}.bootstrap.wasm\n\nAdvanced compatibility artifact: valid Wasm carrying Patch source + Change IR for a Patch host. For a ready-to-run Window build choose Standalone Web App or a Windows/macOS/Linux App target.`;
    } else if (buildTarget.value === 'native-info') {
      output.textContent = `Desktop builds run through Patch's platform builders. Window projects use the dedicated Window application path; Console projects use the direct-Wasm console host.\n\nFrom Patch Studio choose Windows App, macOS App or Linux App and press Build.`;
    } else {
      const bundle = buildPatchApp(code.value, { ...projectOptions(), targets: ['portable'] });
      download(`${name}.patchapp`, serializePatchApp(bundle), 'application/json');
      irView.textContent = JSON.stringify(bundle.ir, null, 2);
      changesView.textContent = formatChangeAnalysis(bundle.ir);
      output.textContent = `Built ${name}.patchapp\n\nPortable Patch bundle containing the manifest, source and Change IR.`;
    }
    showTab('output');
  } catch (err) {
    output.textContent = `Build stopped:\n${err.message}`;
    showTab('output');
  }
});

for (const tab of document.querySelectorAll('.tab')) {
  tab.addEventListener('click', () => {
    if (tab.dataset.tab === 'changes') refreshChangeContract();
    showTab(tab.dataset.tab);
  });
}

function addControl(type) {
  try {
    code.value = addDesignerControl(code.value, type);
    projectKind.value = 'window';
    designerControls = listDesignerControls(code.value);
    const firstWindow = designerControls.filter(item => item.windowIndex === 0);
    const added = firstWindow[firstWindow.length - 1];
    designerSelection = added ? selectionOf(added) : null;
    saveProject();
    refreshDesigner();
    refreshChangeContract();
    showTab('designer');
  } catch (err) {
    output.textContent = `Designer stopped:\n${err.message}`;
    showTab('output');
  }
}

function applyDesignerProperties() {
  const selected = currentDesignerControl();
  if (!selected) return;
  try {
    const changes = {};
    if (selected.type !== 'text') changes.id = designerInspector.idInput.value;
    if (selected.type !== 'input') changes.textExpr = designerInspector.textInput.value;
    code.value = updateDesignerControl(code.value, designerSelection, changes);
    saveProject();
    refreshDesigner();
    refreshChangeContract();
    showTab('designer');
  } catch (err) {
    designerInspector.error.textContent = err.message;
    designerInspector.error.hidden = false;
  }
}

function removeSelectedDesignerControl() {
  if (!currentDesignerControl()) return;
  try {
    code.value = removeDesignerControl(code.value, designerSelection);
    designerSelection = null;
    saveProject();
    refreshDesigner();
    refreshChangeContract();
    showTab('designer');
  } catch (err) {
    designerInspector.error.textContent = err.message;
    designerInspector.error.hidden = false;
  }
}

function revealSelectedDesignerSource() {
  const selected = currentDesignerControl();
  if (!selected) return;
  const lines = code.value.replace(/\r\n/g, '\n').split('\n');
  let start = 0;
  for (let i = 0; i < selected.line - 1; i += 1) start += lines[i].length + 1;
  const end = start + (lines[selected.line - 1]?.length ?? 0);
  code.focus();
  code.setSelectionRange(start, end);
}

function runProject() {
  try {
    const compiled = compile(code.value, projectOptions());
    runtime = new PatchInterpreter();
    const result = runtime.run(code.value);
    output.textContent = result.output.length ? result.output.join('\n') : '(program finished with no console output)';
    irView.textContent = JSON.stringify(compiled.ir, null, 2);
    changesView.textContent = formatChangeAnalysis(compiled.ir);
    renderWindows(appView, result.ui, true);
    showTab(result.ui.length ? 'app' : 'output');
  } catch (err) {
    output.textContent = `Patch stopped:\n${err.message}`;
    appView.innerHTML = '<p class="empty-preview">The app could not start.</p>';
    changesView.textContent = `Change contract unavailable:\n${err.message}`;
    showTab('output');
  }
}

function refreshChangeContract() {
  try {
    const compiled = compile(code.value, projectOptions());
    changesView.textContent = formatChangeAnalysis(compiled.ir);
  } catch (err) {
    changesView.textContent = `Change contract stopped:\n${err.message}`;
  }
}

function scheduleChangeContract() { setTimeout(refreshChangeContract, 220); }

function formatChangeAnalysis(ir) {
  const lines = [];
  const names = Object.keys(ir.changeSignatures ?? {}).filter(name => name !== '$program');
  if (!names.length) lines.push('No recipe change signatures yet.');
  for (const name of names) {
    const signature = ir.changeSignatures[name];
    const params = signature.params.map(param => {
      const range = signature.paramRanges?.[param];
      return range ? `${param} number ${range.min}..${range.max}` : param;
    });
    lines.push(`${name}(${params.join(', ')})`);
    if (!signature.changes.length) lines.push('  changes: none');
    for (const change of signature.changes) {
      let amount = '';
      if (change.staticAmount) amount = ` by ${change.amount}`;
      else if (change.amountRange) amount = ` by ${change.amountRange.min}..${change.amountRange.max} [proved]`;
      const via = change.via ? ` via ${change.via}` : '';
      const preview = change.committed === false ? ' [preview only]' : '';
      lines.push(`  produces: ${change.path} -> ${change.operation}${amount}${via}${preview}`);
    }
    const rules = ir.changeCapabilities?.[name];
    if (rules?.length) {
      lines.push('  allowed:');
      for (const rule of rules) {
        const path = rule.field ? `${rule.target}.${rule.field}` : rule.target;
        const bound = rule.maxAmount === null ? '' : ` up to ${rule.maxAmount}`;
        lines.push(`    ${path} may ${rule.operation}${bound}`);
      }
      lines.push('  proof: produced changes are inside the declared policy ✓');
    }
    lines.push('');
  }
  return lines.join('\n').trimEnd();
}

function refreshDesigner() {
  clearTimeout(designerTimer);
  try {
    designerControls = listDesignerControls(code.value);
    if (designerSelection && !currentDesignerControl()) designerSelection = null;
    const preview = new PatchInterpreter().run(code.value);
    renderWindows(designerCanvas, preview.ui, false);
    if (!preview.ui.length) designerCanvas.innerHTML = '<p class="empty-preview">This is a console project. Use the Toolbox to add a window control, or select the Window app sample.</p>';
    renderDesignerInspector();
  } catch (err) {
    designerControls = [];
    designerSelection = null;
    designerCanvas.innerHTML = `<p class="empty-preview">Designer is waiting for valid Patch code.<br>${escapeHtml(err.message)}</p>`;
    renderDesignerInspector();
  }
}

function scheduleDesigner() {
  clearTimeout(designerTimer);
  designerTimer = setTimeout(refreshDesigner, 220);
}

function renderWindows(container, windows, interactive) {
  container.innerHTML = '';
  if (!windows?.length) {
    container.innerHTML = '<p class="empty-preview">No Patch window is defined.</p>';
    return;
  }
  windows.forEach((model, windowIndex) => {
    const shell = document.createElement('section');
    shell.className = 'patch-window';
    const title = document.createElement('div');
    title.className = 'patch-window-title';
    title.textContent = model.title;
    const body = document.createElement('div');
    body.className = 'patch-window-body';
    model.controls.forEach((control, controlIndex) => {
      let el;
      if (control.type === 'text') {
        el = document.createElement('p');
        el.className = 'patch-text';
        el.textContent = control.text;
      } else if (control.type === 'button') {
        el = document.createElement('button');
        el.className = 'patch-button';
        el.textContent = control.text;
        if (interactive) el.addEventListener('click', () => trigger(control.id, 'clicked'));
        else el.type = 'button';
      } else if (control.type === 'input') {
        el = document.createElement('input');
        el.className = 'patch-input';
        el.value = control.value ?? '';
        el.placeholder = control.id ?? '';
        if (interactive) el.addEventListener('input', () => trigger(control.id, 'changed', { value: el.value }));
        else el.readOnly = true;
      }
      if (!el) return;
      if (!interactive) decorateDesignerControl(el, windowIndex, controlIndex, control);
      body.appendChild(el);
    });
    shell.append(title, body);
    container.appendChild(shell);
  });
}

function decorateDesignerControl(el, windowIndex, controlIndex, control) {
  el.classList.add('designer-control');
  if (designerSelection?.windowIndex === windowIndex && designerSelection?.controlIndex === controlIndex) {
    el.classList.add('designer-selected');
  }
  if (el.tagName !== 'BUTTON' && el.tagName !== 'INPUT') el.tabIndex = 0;
  el.setAttribute('aria-label', `Select ${control.type} control ${control.id ?? controlIndex + 1}`);
  const select = event => {
    event.preventDefault();
    event.stopPropagation();
    selectDesignerControl(windowIndex, controlIndex);
  };
  el.addEventListener('click', select);
  el.addEventListener('keydown', event => {
    if (event.key === 'Enter' || event.key === ' ') select(event);
  });
}

function selectDesignerControl(windowIndex, controlIndex) {
  designerSelection = { windowIndex, controlIndex };
  refreshDesigner();
}

function currentDesignerControl() {
  if (!designerSelection) return null;
  return designerControls.find(item => item.windowIndex === designerSelection.windowIndex && item.controlIndex === designerSelection.controlIndex) ?? null;
}

function selectionOf(control) {
  return { windowIndex: control.windowIndex, controlIndex: control.controlIndex };
}

function renderDesignerInspector() {
  const selected = currentDesignerControl();
  designerInspector.error.hidden = true;
  designerInspector.error.textContent = '';
  designerInspector.empty.hidden = Boolean(selected);
  designerInspector.form.hidden = !selected;
  if (!selected) return;

  designerInspector.type.textContent = selected.type[0].toUpperCase() + selected.type.slice(1);
  designerInspector.location.textContent = `Window ${selected.windowIndex + 1} · control ${selected.controlIndex + 1} · line ${selected.line}`;
  designerInspector.idField.hidden = selected.type === 'text';
  designerInspector.textField.hidden = selected.type === 'input';
  designerInspector.idInput.value = selected.id ?? '';
  designerInspector.textInput.value = selected.textExpr ?? '';
}

function installDesignerInspector() {
  const surface = document.createElement('div');
  surface.className = 'designer-surface';
  const canvasParent = designerCanvas.parentElement;
  canvasParent.insertBefore(surface, designerCanvas);
  surface.appendChild(designerCanvas);

  const aside = document.createElement('aside');
  aside.id = 'designerInspector';
  aside.className = 'designer-inspector';
  aside.setAttribute('aria-label', 'Selected control properties');
  aside.innerHTML = `
    <div id="designerInspectorEmpty" class="designer-inspector-empty">Select a control on the canvas to edit its source-backed properties.</div>
    <div id="designerInspectorForm" hidden>
      <h3>Properties</h3>
      <p id="designerInspectorLocation" class="inspector-hint"></p>
      <label class="inspector-field">Type <span id="designerInspectorType" class="inspector-readonly"></span></label>
      <label id="designerInspectorIdField" class="inspector-field">Control id <input id="designerInspectorId" autocomplete="off" spellcheck="false"></label>
      <label id="designerInspectorTextField" class="inspector-field">Text expression <input id="designerInspectorText" autocomplete="off" spellcheck="false"></label>
      <p id="designerInspectorError" class="inspector-hint" hidden></p>
      <div class="inspector-actions">
        <button id="designerInspectorApply" type="button">Apply</button>
        <button id="designerInspectorSource" class="secondary" type="button">Source</button>
        <button id="designerInspectorDelete" class="danger" type="button">Delete</button>
      </div>
    </div>`;
  surface.appendChild(aside);

  return {
    root: aside,
    empty: aside.querySelector('#designerInspectorEmpty'),
    form: aside.querySelector('#designerInspectorForm'),
    type: aside.querySelector('#designerInspectorType'),
    location: aside.querySelector('#designerInspectorLocation'),
    idField: aside.querySelector('#designerInspectorIdField'),
    idInput: aside.querySelector('#designerInspectorId'),
    textField: aside.querySelector('#designerInspectorTextField'),
    textInput: aside.querySelector('#designerInspectorText'),
    error: aside.querySelector('#designerInspectorError'),
    apply: aside.querySelector('#designerInspectorApply'),
    source: aside.querySelector('#designerInspectorSource'),
    remove: aside.querySelector('#designerInspectorDelete')
  };
}

function installDesignerInspectorStylesheet() {
  if (document.querySelector('link[data-patch-designer-inspector]')) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = './designer-inspector.css';
  link.dataset.patchDesignerInspector = '1';
  document.head.appendChild(link);
}

function trigger(control, event, payload = {}) {
  if (!runtime) return;
  try {
    const result = triggerWindowEvent(runtime, control, event, payload);
    output.textContent = result.output.length ? result.output.join('\n') : '(event completed)';
    renderWindows(appView, result.ui, true);
  } catch (err) {
    output.textContent = `Patch stopped:\n${err.message}`;
    showTab('output');
  }
}

function showTab(name) {
  for (const tab of document.querySelectorAll('.tab')) tab.classList.toggle('active', tab.dataset.tab === name);
  designerView.hidden = name !== 'designer';
  appView.hidden = name !== 'app';
  output.hidden = name !== 'output';
  changesView.hidden = name !== 'changes';
  irView.hidden = name !== 'ir';
}

function projectOptions() { return { name: safeName(projectName.value), kind: projectKind.value, entry: 'main.patch' }; }
function safeName(name) { return (name || 'PatchApp').replace(/[^A-Za-z0-9_-]/g, '_'); }

function saveProject() {
  localStorage.setItem('patchStudio.project', JSON.stringify({ name: projectName.value, kind: projectKind.value, code: code.value }));
  saveState.textContent = 'Saved locally';
}
function loadProject() { try { return JSON.parse(localStorage.getItem('patchStudio.project')); } catch { return null; } }

function download(filename, data, type) {
  const blob = new Blob([data], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function escapeHtml(text) {
  return String(text).replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[char]);
}

refreshDesigner();
refreshChangeContract();
showTab(projectKind.value === 'window' ? 'designer' : 'output');

if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(() => {});
