import { PatchInterpreter } from '../src/interpreter.js';
import { compile } from '../src/compiler.js';
import { buildPatchApp, serializePatchApp } from '../src/bundle.js';
import { compileToWasm } from '../src/wasm.js';
import { addDesignerControl } from '../src/designer.js';

const samples = {
  counterWindow: `create number count = 0

window "Counter":
  text "Count: {count}"
  button "Add" as add_button

when add_button clicked:
  change count:
    add 1`,
  score: `create number score = 0
watch score

change score:
  add 1

change score called bonus:
  add 10

show score
history score`,
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

const code = document.querySelector('#code');
const output = document.querySelector('#output');
const irView = document.querySelector('#ir');
const appView = document.querySelector('#app');
const designerView = document.querySelector('#designer');
const designerCanvas = document.querySelector('#designerCanvas');
const sample = document.querySelector('#sample');
const projectName = document.querySelector('#projectName');
const projectKind = document.querySelector('#projectKind');
const buildTarget = document.querySelector('#buildTarget');
const saveState = document.querySelector('#saveState');
let runtime = null;
let designerTimer = null;

const saved = loadProject();
code.value = saved?.code ?? samples.counterWindow;
projectName.value = saved?.name ?? 'MyPatchApp';
projectKind.value = saved?.kind ?? (saved ? 'console' : 'window');

sample.addEventListener('change', () => {
  code.value = samples[sample.value];
  projectKind.value = sample.value === 'counterWindow' ? 'window' : 'console';
  saveProject();
  refreshDesigner();
  showTab(projectKind.value === 'window' ? 'designer' : 'output');
});

for (const input of [code, projectName, projectKind]) {
  input.addEventListener('input', () => { saveProject(); scheduleDesigner(); });
  input.addEventListener('change', () => { saveProject(); refreshDesigner(); });
}

document.querySelector('#run').addEventListener('click', runProject);
document.querySelector('#addText').addEventListener('click', () => addControl('text'));
document.querySelector('#addButton').addEventListener('click', () => addControl('button'));
document.querySelector('#addInput').addEventListener('click', () => addControl('input'));

document.querySelector('#build').addEventListener('click', () => {
  try {
    const name = safeName(projectName.value);
    if (buildTarget.value === 'wasm') {
      const built = compileToWasm(code.value, projectOptions());
      download(`${name}.wasm`, built.module, 'application/wasm');
      irView.textContent = JSON.stringify(built.compiled.ir, null, 2);
      output.textContent = `Built ${name}.wasm\n\nThis is Patch's 0.2 bootstrap WebAssembly backend. The module is valid Wasm and embeds Patch source + Change IR for a Patch host. Direct Change IR-to-Wasm execution is the next compiler-backend stage.`;
    } else {
      const bundle = buildPatchApp(code.value, { ...projectOptions(), targets: ['portable'] });
      download(`${name}.patchapp`, serializePatchApp(bundle), 'application/json');
      irView.textContent = JSON.stringify(bundle.ir, null, 2);
      output.textContent = `Built ${name}.patchapp\n\nThis portable Patch application contains the manifest, source and Change IR. Native Windows/macOS/Linux/BSD hosts remain a later packaging milestone.`;
    }
    showTab('output');
  } catch (err) {
    output.textContent = `Build stopped:\n${err.message}`;
    showTab('output');
  }
});

for (const tab of document.querySelectorAll('.tab')) {
  tab.addEventListener('click', () => showTab(tab.dataset.tab));
}

function addControl(type) {
  try {
    code.value = addDesignerControl(code.value, type);
    projectKind.value = 'window';
    saveProject();
    refreshDesigner();
    showTab('designer');
    code.focus();
  } catch (err) {
    output.textContent = `Designer stopped:\n${err.message}`;
    showTab('output');
  }
}

function runProject() {
  try {
    const compiled = compile(code.value, projectOptions());
    runtime = new PatchInterpreter();
    const result = runtime.run(code.value);
    output.textContent = result.output.length ? result.output.join('\n') : '(program finished with no console output)';
    irView.textContent = JSON.stringify(compiled.ir, null, 2);
    renderWindows(appView, result.ui, true);
    showTab(result.ui.length ? 'app' : 'output');
  } catch (err) {
    output.textContent = `Patch stopped:\n${err.message}`;
    appView.innerHTML = '<p class="empty-preview">The app could not start.</p>';
    showTab('output');
  }
}

function refreshDesigner() {
  clearTimeout(designerTimer);
  try {
    const preview = new PatchInterpreter().run(code.value);
    renderWindows(designerCanvas, preview.ui, false);
    if (!preview.ui.length) designerCanvas.innerHTML = '<p class="empty-preview">This is a console project. Use the Toolbox to add a window control, or select the Window app sample.</p>';
  } catch (err) {
    designerCanvas.innerHTML = `<p class="empty-preview">Designer is waiting for valid Patch code.<br>${escapeHtml(err.message)}</p>`;
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
  for (const model of windows) {
    const shell = document.createElement('section');
    shell.className = 'patch-window';
    const title = document.createElement('div');
    title.className = 'patch-window-title';
    title.textContent = model.title;
    const body = document.createElement('div');
    body.className = 'patch-window-body';
    for (const control of model.controls) {
      if (control.type === 'text') {
        const el = document.createElement('p');
        el.className = 'patch-text';
        el.textContent = control.text;
        body.appendChild(el);
      } else if (control.type === 'button') {
        const el = document.createElement('button');
        el.className = `patch-button${interactive ? '' : ' designer-control'}`;
        el.textContent = control.text;
        if (interactive) el.addEventListener('click', () => trigger(control.id, 'clicked'));
        else el.type = 'button';
        body.appendChild(el);
      } else if (control.type === 'input') {
        const el = document.createElement('input');
        el.className = 'patch-input';
        el.value = control.value ?? '';
        el.placeholder = control.id ?? '';
        if (!interactive) el.readOnly = true;
        body.appendChild(el);
      }
    }
    shell.append(title, body);
    container.appendChild(shell);
  }
}

function trigger(control, event) {
  if (!runtime) return;
  try {
    const result = runtime.trigger(control, event);
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
  irView.hidden = name !== 'ir';
}

function projectOptions() {
  return { name: safeName(projectName.value), kind: projectKind.value, entry: 'main.patch' };
}

function safeName(name) {
  return (name || 'PatchApp').replace(/[^A-Za-z0-9_-]/g, '_');
}

function saveProject() {
  localStorage.setItem('patchStudio.project', JSON.stringify({
    name: projectName.value,
    kind: projectKind.value,
    code: code.value
  }));
  saveState.textContent = 'Saved locally';
}

function loadProject() {
  try { return JSON.parse(localStorage.getItem('patchStudio.project')); }
  catch { return null; }
}

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
showTab(projectKind.value === 'window' ? 'designer' : 'output');

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}
