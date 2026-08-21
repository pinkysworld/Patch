import { PatchInterpreter } from '../src/interpreter.js';
import { compile } from '../src/compiler.js';
import { buildPatchApp, serializePatchApp } from '../src/bundle.js';
import { compileToWasm } from '../src/wasm.js';
import { compileToDirectWasm } from '../src/wasm-direct.js';
import { buildStandaloneWebApp } from '../src/webapp.js';
import { triggerWindowEvent } from '../src/window-events.js';
import { studioProjectFileStem } from '../src/studio-project.js';

const samples = {
  counterWindow: `create number count = 0

window "Counter":
  text "Count: {count}"
  button "Add" as add_button

when add_button clicked:
  change count:
    add 1`,
  tabsWindow: `create text name = "Mia"
create boolean notifications = false

window "Settings" as main size 620, 380:
  tabs as settings at 24, 24 size 540, 280:
    tab "General":
      text "Welcome {name}"
      input name
    tab "Advanced":
      checkbox "Notifications" as notifications
      button "Reset name" as reset_name

when name changed:
  change name:
    set = value

when notifications changed:
  change notifications:
    set = value

when reset_name clicked:
  change name:
    set = "Mia"`,
  sliderWindow: `create number volume = 50

window "Mixer" as main size 560, 300:
  text "Volume: {volume}"
  slider 0..100 as volume step 5 at 24, 80 size 300, 44

when volume changed:
  change volume:
    set = value`,
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
installDesignerInspector();
const sample = document.querySelector('#sample');
const projectName = document.querySelector('#projectName');
const projectKind = document.querySelector('#projectKind');
const buildTarget = document.querySelector('#buildTarget');
const saveState = document.querySelector('#saveState');
let runtime = null;
let designerTimer = null;
let changeContractTimer = null;

const saved = loadProject();
code.value = saved?.code ?? samples.counterWindow;
projectName.value = saved?.name ?? 'MyPatchApp';
projectKind.value = saved?.kind ?? (saved ? 'console' : 'window');

sample.addEventListener('change', () => {
  code.value = samples[sample.value];
  projectKind.value = ['counterWindow', 'tabsWindow', 'sliderWindow'].includes(sample.value) ? 'window' : 'console';
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
appView.addEventListener('patch-studio-table-changed', event => {
  const detail = event.detail ?? {};
  if (typeof detail.control !== 'string' || !Array.isArray(detail.value) || !detail.value.every(cell => typeof cell === 'string')) return;
  trigger(detail.control, 'changed', { value: [...detail.value] });
});

document.querySelector('#build').addEventListener('click', () => {
  try {
    const name = studioProjectFileStem(projectName.value);
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
  clearTimeout(changeContractTimer);
  changeContractTimer = null;
  try {
    const compiled = compile(code.value, projectOptions());
    changesView.textContent = formatChangeAnalysis(compiled.ir);
  } catch (err) {
    changesView.textContent = `Change contract stopped:\n${err.message}`;
  }
}

function scheduleChangeContract() {
  clearTimeout(changeContractTimer);
  changeContractTimer = setTimeout(refreshChangeContract, 220);
}

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
  const tabSelections = container.__patchTabSelections ??= new Map();
  container.innerHTML = '';
  if (!windows?.length) {
    container.innerHTML = '<p class="empty-preview">No Patch window is defined.</p>';
    return;
  }
  windows.forEach((model, windowIndex) => {
    const shell = document.createElement('section');
    shell.className = 'patch-window';
    shell.hidden = Boolean(interactive && model.visible === false);
    const title = document.createElement('div');
    title.className = 'patch-window-title';
    title.textContent = model.title;
    const body = document.createElement('div');
    body.className = 'patch-window-body';
    model.controls.forEach((control, controlIndex) => {
      const el = createControlElement(control, {
        interactive,
        container,
        windows,
        tabSelections,
        windowIndex,
        controlIndex,
        windowId: model.id,
        topLevel: true
      });
      if (!el) return;
      if (!interactive && control.type !== 'tree') decorateDesignerControl(el, windowIndex, controlIndex, control);
      body.appendChild(el);
    });
    shell.append(title, body);
    container.appendChild(shell);
  });
}

function createControlElement(control, context) {
  if (control.type === 'tabs') return createTabsElement(control, context);
  let el;
  if (control.type === 'text') {
    el = document.createElement('p');
    el.className = 'patch-text';
    el.textContent = control.text;
  } else if (control.type === 'button') {
    el = document.createElement('button');
    el.className = 'patch-button';
    el.textContent = control.text;
    el.type = 'button';
    if (context.interactive) el.addEventListener('click', () => trigger(control.id, 'clicked'));
  } else if (control.type === 'input') {
    el = document.createElement('input');
    el.className = 'patch-input';
    el.value = control.value ?? '';
    el.placeholder = control.id ?? '';
    if (context.interactive) el.addEventListener('input', () => trigger(control.id, 'changed', { value: el.value }));
    else el.readOnly = true;
  } else if (control.type === 'checkbox') {
    el = document.createElement('label');
    el.className = 'patch-checkbox';
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.checked = control.value === true;
    const text = document.createElement('span');
    text.textContent = control.text;
    el.append(input, text);
    if (context.interactive) input.addEventListener('change', () => trigger(control.id, 'changed', { value: input.checked }));
    else input.disabled = true;
  } else if (control.type === 'radio') {
    el = document.createElement('div');
    el.className = 'patch-radio';
    const groupName = `patch-radio-${context.windowId ?? context.windowIndex}-${control.id ?? context.controlIndex}`;
    for (const option of control.options ?? []) {
      const label = document.createElement('label');
      const input = document.createElement('input');
      input.type = 'radio';
      input.name = groupName;
      input.value = option;
      input.checked = String(control.value ?? '') === String(option);
      const text = document.createElement('span');
      text.textContent = option;
      label.append(input, text);
      el.appendChild(label);
      if (context.interactive) {
        input.addEventListener('change', () => {
          if (input.checked) trigger(control.id, 'changed', { value: input.value });
        });
      } else input.disabled = true;
    }
  } else if (control.type === 'combo' || control.type === 'listbox') {
    el = document.createElement('select');
    el.className = control.type === 'listbox' ? 'patch-input patch-listbox' : 'patch-input patch-combo';
    if (control.type === 'listbox') el.size = Math.min(8, Math.max(2, (control.options ?? []).length));
    for (const option of control.options ?? []) {
      const item = document.createElement('option');
      item.value = option;
      item.textContent = option;
      el.appendChild(item);
    }
    el.value = String(control.value ?? '');
    if (context.interactive) el.addEventListener('change', () => trigger(control.id, 'changed', { value: el.value }));
    else el.disabled = true;
  } else if (control.type === 'slider') {
    el = document.createElement('label');
    el.className = 'patch-slider';
    const input = document.createElement('input');
    input.type = 'range';
    input.min = String(control.min ?? 0);
    input.max = String(control.max ?? 100);
    input.step = String(control.step ?? 1);
    input.value = String(Number.isFinite(Number(control.value)) ? control.value : (control.min ?? 0));
    input.setAttribute('aria-label', control.id ? `${control.id} slider` : 'Slider');
    const value = document.createElement('output');
    value.textContent = input.value;
    value.htmlFor = input.id || '';
    input.addEventListener('input', () => { value.textContent = input.value; });
    if (context.interactive) input.addEventListener('change', () => trigger(control.id, 'changed', { value: Number(input.value) }));
    else input.disabled = true;
    el.append(input, value);
  } else if (control.type === 'tree') {
    el = createTreeElement(control, context);
  }
  return el ?? null;
}

function createTreeElement(control, context) {
  const root = document.createElement('ul');
  root.className = 'patch-tree';
  root.setAttribute('role', 'tree');
  const renderNodes = (nodes, path = []) => {
    const fragment = document.createDocumentFragment();
    for (const node of nodes ?? []) {
      const item = document.createElement('li');
      item.setAttribute('role', 'treeitem');
      const selectedPath = [...path, node.text];
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'patch-tree-node';
      button.textContent = node.text;
      button.setAttribute('aria-label', selectedPath.join(' / '));
      if (context.interactive) button.addEventListener('click', () => trigger(control.id, 'changed', { value: selectedPath }));
      else button.disabled = true;
      item.appendChild(button);
      if (node.children?.length) {
        const group = document.createElement('ul');
        group.setAttribute('role', 'group');
        group.appendChild(renderNodes(node.children, selectedPath));
        item.appendChild(group);
      }
      fragment.appendChild(item);
    }
    return fragment;
  };
  root.appendChild(renderNodes(control.nodes));
  return root;
}

function createTabsElement(control, context) {
  const root = document.createElement('div');
  root.className = 'patch-tabs';
  root.dataset.tabsId = control.id ?? '';
  const pages = control.pages ?? [];
  const key = `${context.windowId}:${control.id ?? context.controlIndex}`;
  let selected = context.tabSelections.get(key) ?? 0;
  if (!Number.isInteger(selected) || selected < 0 || selected >= pages.length) selected = 0;
  context.tabSelections.set(key, selected);

  const list = document.createElement('div');
  list.className = 'patch-tabs-list';
  list.setAttribute('role', 'tablist');
  pages.forEach((page, pageIndex) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'patch-tab-button';
    button.textContent = page.title;
    button.setAttribute('role', 'tab');
    button.setAttribute('aria-selected', pageIndex === selected ? 'true' : 'false');
    button.addEventListener('click', event => {
      event.preventDefault();
      event.stopPropagation();
      context.tabSelections.set(key, pageIndex);
      renderWindows(context.container, context.windows, context.interactive);
    });
    list.appendChild(button);
  });

  const panel = document.createElement('div');
  panel.className = 'patch-tab-panel';
  panel.setAttribute('role', 'tabpanel');
  const active = pages[selected];
  for (const nested of active?.controls ?? []) {
    const nestedEl = createControlElement(nested, { ...context, topLevel: false });
    if (nestedEl) panel.appendChild(nestedEl);
  }
  root.append(list, panel);
  return root;
}

function decorateDesignerControl(el, windowIndex, controlIndex, control) {
  el.classList.add('designer-control');
  el.dataset.windowIndex = String(windowIndex);
  el.dataset.controlIndex = String(controlIndex);
  if (!['BUTTON', 'INPUT', 'SELECT'].includes(el.tagName)) el.tabIndex = 0;
  el.setAttribute('aria-label', `Select ${control.type} control ${control.id ?? controlIndex + 1}`);
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
      <label id="designerInspectorOptionsField" class="inspector-field" hidden>Options <input id="designerInspectorOptions" autocomplete="off" spellcheck="false" placeholder='"Small", "Medium", "Large"'></label>
      <div id="designerInspectorSliderFields" class="forms-geometry-grid" hidden>
        <strong>Slider range</strong>
        <label>Min <input id="designerInspectorSliderMin" inputmode="decimal"></label>
        <label>Max <input id="designerInspectorSliderMax" inputmode="decimal"></label>
        <label>Step <input id="designerInspectorSliderStep" inputmode="decimal"></label>
      </div>
      <p id="designerInspectorError" class="inspector-hint" hidden></p>
      <div class="inspector-actions">
        <button id="designerInspectorApply" type="button">Apply</button>
        <button id="designerInspectorSource" class="secondary" type="button">Source</button>
        <button id="designerInspectorDelete" class="danger" type="button">Delete</button>
      </div>
    </div>`;
  surface.appendChild(aside);
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

function projectOptions() { return { name: studioProjectFileStem(projectName.value), kind: projectKind.value, entry: 'main.patch' }; }

function saveProject() {
  try {
    localStorage.setItem('patchStudio.project', JSON.stringify({ name: projectName.value, kind: projectKind.value, code: code.value }));
    saveState.textContent = 'Saved locally';
    saveState.removeAttribute('title');
  } catch (error) {
    saveState.textContent = 'Local save unavailable';
    saveState.title = error?.message ?? 'Browser storage is unavailable.';
  }
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