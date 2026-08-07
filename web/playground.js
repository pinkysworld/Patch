import { PatchInterpreter } from '../src/interpreter.js';
import { compile } from '../src/compiler.js';
import { buildPatchApp, serializePatchApp } from '../src/bundle.js';

const samples = {
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
const sample = document.querySelector('#sample');
const projectName = document.querySelector('#projectName');
const projectKind = document.querySelector('#projectKind');
const saveState = document.querySelector('#saveState');

const saved = loadProject();
code.value = saved?.code ?? samples.score;
projectName.value = saved?.name ?? 'MyPatchApp';
projectKind.value = saved?.kind ?? 'console';

sample.addEventListener('change', () => {
  code.value = samples[sample.value];
  saveProject();
});

for (const input of [code, projectName, projectKind]) {
  input.addEventListener('input', saveProject);
  input.addEventListener('change', saveProject);
}

document.querySelector('#run').addEventListener('click', () => {
  try {
    const compiled = compile(code.value, projectOptions());
    const result = new PatchInterpreter().run(code.value);
    output.textContent = result.output.length ? result.output.join('\n') : '(program finished with no output)';
    irView.textContent = JSON.stringify(compiled.ir, null, 2);
    showTab('output');
  } catch (err) {
    output.textContent = `Patch stopped:\n${err.message}`;
    showTab('output');
  }
});

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

function showTab(name) {
  for (const tab of document.querySelectorAll('.tab')) tab.classList.toggle('active', tab.dataset.tab === name);
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
