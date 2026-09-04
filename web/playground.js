import { compile } from '../src/compiler.js';
import { studioProjectFileStem } from '../src/studio-project.js';
import { diagnosticFromError, formatPatchDiagnostic } from '../src/diagnostics.js';
import { getStudioDesignSnapshot } from './studio-design-snapshots.js';
import { installStudioBuildController } from './studio-build-controller.js';
import { installStudioRunController } from './studio-run-controller.js';
import { createStudioWindowRenderer } from './studio-window-renderer.js';
import { createStudioFormMaterializationPlan } from '../src/studio-form-materialization.js';
import { getActiveStudioProjectFile, getStudioProjectDiagnosticContext, getStudioProjectResources } from './project-lifecycle.js';

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
const saveState = document.querySelector('#saveState');
const runButton = document.querySelector('#run');
let designerTimer = null;
let changeContractTimer = null;

const saved = loadProject();
code.value = saved?.code ?? samples.counterWindow;
projectName.value = saved?.name ?? 'MyPatchApp';
projectKind.value = saved?.kind ?? (saved ? 'console' : 'window');

sample.addEventListener('change', () => {
  if (sample.value === 'workshopDesk') return;
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

designerCanvas?.addEventListener('patch-designer-active-form-change', event => {
  const requested = Number(event.detail?.windowIndex);
  refreshDesigner(Number.isInteger(requested) ? requested : null);
});
appView.addEventListener('patch-studio-table-changed', event => {
  const detail = event.detail ?? {};
  if (typeof detail.control !== 'string' || !Array.isArray(detail.value) || !detail.value.every(cell => typeof cell === 'string')) return;
  trigger(detail.control, 'changed', { value: [...detail.value] });
});

installStudioBuildController({
  code,
  output,
  changesView,
  irView,
  projectOptions,
  formatChangeAnalysis,
  formatStudioStop,
  showTab
});

const studioWindowRenderer = createStudioWindowRenderer({ dispatch: trigger });
const studioRunController = installStudioRunController({
  code,
  runButton,
  output,
  changesView,
  irView,
  projectOptions,
  formatChangeAnalysis,
  formatStudioStop,
  showTab,
  renderInitial(ui) {
    studioWindowRenderer.renderInitial(appView, ui);
  },
  renderAfterEvent(ui) {
    studioWindowRenderer.renderAfterEvent(appView, ui);
  },
  renderFailure() {
    appView.innerHTML = '<p class="empty-preview">The app could not start.</p>';
  }
});

for (const tab of document.querySelectorAll('.tab')) {
  tab.addEventListener('click', () => {
    if (tab.dataset.tab === 'changes') refreshChangeContract();
    if (tab.dataset.tab === 'ir') studioRunController.refreshIrView();
    showTab(tab.dataset.tab);
  });
}

function refreshChangeContract() {
  clearTimeout(changeContractTimer);
  changeContractTimer = null;
  try {
    const compiled = compile(code.value, projectOptions());
    changesView.textContent = formatChangeAnalysis(compiled.ir);
  } catch (err) {
    changesView.textContent = `Change contract stopped:\n${formatStudioStop(err, 'compile')}`;
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

function refreshDesigner(requestedFormIndex = null) {
  clearTimeout(designerTimer);
  try {
    const preview = getStudioDesignSnapshot(code.value);
    const selectedFormIndex = requestedFormIndex === null || requestedFormIndex === undefined
      ? document.querySelector('#patchFormSelect')?.value
      : requestedFormIndex;
    const materialization = createStudioFormMaterializationPlan(preview.ui.length, selectedFormIndex);
    studioWindowRenderer.renderDesigner(designerCanvas, preview.ui, { materialization });
    if (!preview.ui.length) designerCanvas.innerHTML = '<p class="empty-preview">This is a console project. Use the Toolbox to add a window control, or select the Window app sample.</p>';
  } catch (err) {
    designerCanvas.innerHTML = `<p class="empty-preview">Designer is waiting for valid Patch code.<br>${escapeHtml(err.message)}</p>`;
  }
}

function scheduleDesigner() {
  clearTimeout(designerTimer);
  designerTimer = setTimeout(refreshDesigner, 220);
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
  studioRunController.trigger(control, event, payload);
}

function showTab(name) {
  for (const tab of document.querySelectorAll('.tab')) tab.classList.toggle('active', tab.dataset.tab === name);
  designerView.hidden = name !== 'designer';
  appView.hidden = name !== 'app';
  output.hidden = name !== 'output';
  changesView.hidden = name !== 'changes';
  irView.hidden = name !== 'ir';
}

function projectOptions() {
  return {
    name: studioProjectFileStem(projectName.value),
    kind: projectKind.value,
    entry: 'main.patch',
    resources: getStudioProjectResources()
  };
}

function formatStudioStop(error, phase) {
  try {
    const context = getStudioProjectDiagnosticContext();
    const active = code.value;
    const compiledWasComposed = Boolean(context.composition && active === context.source);
    return formatPatchDiagnostic(diagnosticFromError(error, {
      source: compiledWasComposed ? context.source : active,
      entry: compiledWasComposed ? context.entry : (getActiveStudioProjectFile() || 'main.patch'),
      composition: compiledWasComposed ? context.composition : null,
      phase
    }));
  } catch {
    return error?.message ?? String(error);
  }
}

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

function escapeHtml(text) {
  return String(text).replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[char]);
}

refreshDesigner();
refreshChangeContract();
showTab(projectKind.value === 'window' ? 'designer' : 'output');