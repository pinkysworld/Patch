import { PatchInterpreter } from '../src/interpreter.js';
import { compile } from '../src/compiler.js';
import { buildPatchApp, serializePatchApp } from '../src/bundle.js';

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
const sample = document.querySelector('#sample');
const projectName = document.querySelector('#projectName');
const projectKind = document.querySelector('#projectKind');
const saveState = document.querySelector('#saveState');
let runtime = null;

const saved = loadProject();
code.value = saved?.code ?? samples.counterWindow;
projectName.value = saved?.name ?? 'MyPatchApp';
projectKind.value = saved?.kind ?? (saved ? 'console' : 'window');

sample.addEventListener('change', () => {
  code.value = samples[sample.value];
  projectKind.value = sample.value === 'counterWindow' ? 'window' : 'console';
  saveProject();
});

for (const input of [code, projectName, projectKind]) {
  input.addEventListener('input', saveProject);
  input.addEventListener('change', saveProject);
}

document.querySelector('#run').addEventListener('click', runProject);

document.querySelector('#build').addEventListener('click', () => {
  try {
    const bundle = buildPatchApp(code.value, { ...projectOptions(), targets: ['portable'] });
    const text = serializePatchApp(bundle);
    download(`${safeName(projectName.value)}.patchapp`, text, 'application/json');
    irView.textContent = JSON.stringify(bundle.ir, null, 2);
    output.textContent = `Built ${safeName(projectName.value)}.patchapp\n\nThis is Patch's portable application bundle. Native Windows/macOS/Linux/BSD and WebAssembly packagers are the next compiler backend milestone.`;
    showTab('output');
  } catch (err) {
    output.textContent = `Build stopped:\n${err.message}`;
    showTab('output');
  }
});

for (const tab of document.querySelectorAll('.tab')) {
  tab.addEventListener('click', () => showTab(tab.dataset.tab));
}

function runProject() {
  try {
    const compiled = compile(code.value, projectOptions());
    runtime = new PatchInterpreter();
    const result = runtime.run(code.value);
    output.textContent = result.output.length ? result.output.join('\n') : '(program finished with no console output)';
    irView.textContent = JSON.stringify(compiled.ir, null, 2);
    renderApp(result.ui);
    showTab(result.ui.length ? 'app' : 'output');
  } catch (err) {
    output.textContent = `Patch stopped:\n${err.message}`;
    appView.innerHTML = '<p class="empty-preview">The app could not start.</p>';
    showTab('output');
  }
}

function renderApp(windows) {
  appView.innerHTML = '';
  if (!windows?.length) {
    appView.innerHTML = '<p class="empty-preview">This is a console project. Its output is in the Output tab.</p>';
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
        el.className = 'patch-button';
        el.textContent = control.text;
        el.addEventListener('click', () => trigger(control.id, 'clicked'));
        body.appendChild(el);
      } else if (control.type === 'input') {
        const el = document.createElement('input');
        el.className = 'patch-input';
        el.value = control.value ?? '';
        el.placeholder = control.id ?? '';
        body.appendChild(el);
      }
    }
    shell.append(title, body);
    appView.appendChild(shell);
  }
}

function trigger(control, event) {
  if (!runtime) return;
  try {
    const result = runtime.trigger(control, event);
    output.textContent = result.output.length ? result.output.join('\n') : '(event completed)';
    renderApp(result.ui);
  } catch (err) {
    output.textContent = `Patch stopped:\n${err.message}`;
    showTab('output');
  }
}

function showTab(name) {
  for (const tab of document.querySelectorAll('.tab')) tab.classList.toggle('active', tab.dataset.tab === name);
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

function download(filename, text, type) {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}
