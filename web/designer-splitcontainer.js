import { addDesignerControl, listDesignerControls } from '../src/designer.js';
import { listDesignerPanels } from '../src/designer-panel.js';
import {
  PATCH_PANEL_SPLIT_RATIO_MAX,
  PATCH_PANEL_SPLIT_RATIO_MIN,
  convertWindowPanelToSplit,
  setWindowPanelSplit
} from '../src/panel-split.js';
import {
  DESIGNER_SELECTION_EVENT,
  currentDesignerSelection,
  designerSelectionForControl,
  rememberDesignerSelection
} from './designer-selection.js';
import {
  clearDesignerInspectorError,
  showDesignerInspectorError
} from './designer-ux.js';

export const PATCH_DESIGNER_SPLITCONTAINER_VERSION = '0.1';

const doc = typeof document === 'undefined' ? null : document;
const code = doc?.querySelector('#code') ?? null;
const canvas = doc?.querySelector('#designerCanvas') ?? null;
const designer = doc?.querySelector('#designer') ?? null;
let queued = false;

if (doc && code && canvas && designer) queueMicrotask(install);

function install() {
  if (designer.dataset.patchSplitContainerStage1 === 'true') return;
  designer.dataset.patchSplitContainerStage1 = 'true';
  installStyles();
  installPaletteButton();
  installInspector();
  code.addEventListener('input', scheduleSync);
  code.addEventListener('change', scheduleSync);
  canvas.addEventListener(DESIGNER_SELECTION_EVENT, scheduleSync);
  new MutationObserver(scheduleSync).observe(canvas, { childList: true, subtree: true });
  scheduleSync();
}

function installStyles() {
  if (doc.querySelector('style[data-patch-splitcontainer-stage1]')) return;
  const style = doc.createElement('style');
  style.dataset.patchSplitcontainerStage1 = PATCH_DESIGNER_SPLITCONTAINER_VERSION;
  style.textContent = `
.patch-panel.patch-splitcontainer-designer>.patch-panel-surface{overflow:hidden!important}.designer-split-root{--patch-split-ratio:50;position:relative;width:100%;height:100%;min-width:0;min-height:0;overflow:hidden}.designer-split-pane{position:absolute;min-width:0;min-height:0;overflow:hidden}.designer-split-pane-flow{display:flex;flex-direction:column;gap:6px;width:100%;height:100%;min-width:0;min-height:0;overflow:auto;padding:8px;box-sizing:border-box}.designer-split-pane-flow>.patch-panel-child{flex:0 0 auto}.designer-split-divider{position:absolute;z-index:4;display:grid;place-items:center;padding:0;border:0;background:color-mix(in srgb,var(--accent) 8%,transparent);touch-action:none;user-select:none}.designer-split-divider::before{content:"";display:block;border-radius:999px;background:color-mix(in srgb,var(--accent) 68%,var(--border-strong))}.designer-split-divider:focus-visible{outline:2px solid var(--accent);outline-offset:-2px}.designer-split-root[data-orientation="vertical"]>.designer-split-pane-1{left:0;top:0;bottom:0;width:calc(var(--patch-split-ratio) * 1% - 4px)}.designer-split-root[data-orientation="vertical"]>.designer-split-pane-2{left:calc(var(--patch-split-ratio) * 1% + 4px);right:0;top:0;bottom:0}.designer-split-root[data-orientation="vertical"]>.designer-split-divider{left:calc(var(--patch-split-ratio) * 1% - 4px);top:0;bottom:0;width:8px;cursor:col-resize}.designer-split-root[data-orientation="vertical"]>.designer-split-divider::before{width:2px;height:34px}.designer-split-root[data-orientation="horizontal"]>.designer-split-pane-1{left:0;right:0;top:0;height:calc(var(--patch-split-ratio) * 1% - 4px)}.designer-split-root[data-orientation="horizontal"]>.designer-split-pane-2{left:0;right:0;top:calc(var(--patch-split-ratio) * 1% + 4px);bottom:0}.designer-split-root[data-orientation="horizontal"]>.designer-split-divider{left:0;right:0;top:calc(var(--patch-split-ratio) * 1% - 4px);height:8px;cursor:row-resize}.designer-split-root[data-orientation="horizontal"]>.designer-split-divider::before{width:34px;height:2px}.designer-split-pane-badge{position:absolute;z-index:2;right:6px;top:5px;padding:2px 5px;border-radius:999px;background:color-mix(in srgb,var(--surface) 86%,transparent);color:var(--muted);font-size:8px;font-weight:800;pointer-events:none}.designer-split-pane-1>.designer-split-pane-badge{right:6px}.designer-split-pane-2>.designer-split-pane-badge{right:6px}.designer-splitcontainer-editor{display:grid;gap:7px;margin:0 0 8px;padding:8px;border:1px solid var(--border);border-radius:7px;background:color-mix(in srgb,var(--surface-subtle) 90%,transparent)}.designer-splitcontainer-grid{display:grid;grid-template-columns:minmax(0,1fr) 82px;gap:7px}.designer-splitcontainer-grid label{display:grid;gap:4px;font-size:10px}.designer-splitcontainer-grid select,.designer-splitcontainer-grid input{min-width:0}.designer-splitcontainer-actions{display:flex;align-items:center;justify-content:space-between;gap:7px;flex-wrap:wrap}.designer-splitcontainer-actions .inspector-hint{flex:1 1 160px}.designer-panel-child-pane{font-weight:750}
@media(forced-colors:active){.designer-split-divider,.designer-splitcontainer-editor{border:1px solid CanvasText}.designer-split-divider::before{background:CanvasText}}
`;
  doc.head.appendChild(style);
}

function installPaletteButton() {
  const toolbar = doc.querySelector('#designer .designer-toolbar');
  if (!toolbar || toolbar.querySelector('#addSplitContainer')) return;
  const button = doc.createElement('button');
  button.id = 'addSplitContainer';
  button.className = 'secondary small';
  button.type = 'button';
  button.textContent = '+ SplitContainer';
  button.setAttribute('aria-label', 'Add SplitContainer');
  button.title = 'Add a source-backed two-pane SplitContainer Panel to the active Form';
  toolbar.appendChild(button);
  button.addEventListener('click', event => {
    event.preventDefault();
    event.stopImmediatePropagation();
    try {
      const windowIndex = activeFormIndex();
      const withPanel = addDesignerControl(code.value, 'panel', { windowIndex });
      const panel = listDesignerControls(withPanel)
        .filter(control => control.windowIndex === windowIndex && control.type === 'panel')
        .at(-1);
      if (!panel) throw new Error('Designer did not create the SplitContainer Panel.');
      const next = convertWindowPanelToSplit(withPanel, panel.line, { orientation: 'vertical', ratio: 50 });
      setSource(next);
      clearDesignerInspectorError({ document: doc });
      rememberDesignerSelection(canvas, designerSelectionForControl(panel, 'core'), { reason: 'add-splitcontainer' });
    } catch (error) {
      showDesignerInspectorError(error, { document: doc });
    }
  }, { capture: true });
}

function installInspector() {
  const panelEditor = doc.querySelector('#designerPanelEditor');
  if (!panelEditor || panelEditor.querySelector('#designerSplitContainerEditor')) return;
  const section = doc.createElement('div');
  section.id = 'designerSplitContainerEditor';
  section.className = 'designer-splitcontainer-editor';
  section.innerHTML = `
    <div class="designer-panel-editor-heading"><strong>SplitContainer</strong><span class="inspector-hint">source-backed initial split</span></div>
    <div class="designer-splitcontainer-grid">
      <label>Layout
        <select id="designerPanelSplitMode">
          <option value="none">Plain Panel</option>
          <option value="vertical">Vertical split</option>
          <option value="horizontal">Horizontal split</option>
        </select>
      </label>
      <label>Initial %
        <input id="designerPanelSplitRatio" type="number" min="${PATCH_PANEL_SPLIT_RATIO_MIN}" max="${PATCH_PANEL_SPLIT_RATIO_MAX}" step="1" value="50">
      </label>
    </div>
    <div class="designer-splitcontainer-actions">
      <span id="designerPanelSplitHint" class="inspector-hint">Runtime divider movement is transient.</span>
      <button id="designerPanelSplitApply" class="secondary" type="button">Apply split</button>
    </div>`;
  panelEditor.insertBefore(section, panelEditor.children[1] ?? null);
  section.querySelector('#designerPanelSplitMode')?.addEventListener('change', syncInspectorControls);
  section.querySelector('#designerPanelSplitApply')?.addEventListener('click', applyInspectorSplit);
  section.addEventListener('keydown', event => {
    if (event.key !== 'Enter' || !(event.ctrlKey || event.metaKey)) return;
    if (!event.target?.matches?.('select,input')) return;
    event.preventDefault();
    applyInspectorSplit();
  });
}

function scheduleSync() {
  if (queued) return;
  queued = true;
  queueMicrotask(() => {
    queued = false;
    try {
      syncCanvas();
      syncInspector();
    } catch {
      // Source may be incomplete while typing; the ordinary Studio diagnostics own that state.
    }
  });
}

function syncCanvas() {
  const controls = listDesignerControls(code.value).filter(control => control.type === 'panel');
  const panels = listDesignerPanels(code.value);
  const records = new Map();
  for (const control of controls) {
    const panel = panels.find(item => item.windowIndex === control.windowIndex && item.id === control.id);
    if (panel) records.set(`${control.windowIndex}:${control.controlIndex}`, { control, panel });
  }

  for (const element of canvas.querySelectorAll('.patch-panel[data-patch-panel-adapter="true"]')) {
    const record = records.get(`${element.dataset.windowIndex}:${element.dataset.controlIndex}`) ?? null;
    if (!record?.panel?.panelSplit) restorePlainPanel(element);
    else decorateSplitPanel(element, record.control, record.panel);
  }
}

function decorateSplitPanel(element, control, panel) {
  const split = panel.panelSplit;
  const surface = element.querySelector(':scope > .patch-panel-surface');
  if (!surface) return;
  element.classList.add('patch-splitcontainer-designer');
  element.dataset.patchPanelSplit = `${split.orientation}:${split.ratio}`;

  let root = surface.querySelector(':scope > .designer-split-root');
  if (!root) {
    const flow = surface.querySelector(':scope > .patch-panel-flow');
    if (!flow) return;
    const children = [...flow.children];
    if (children.length !== panel.children.length) return;
    root = doc.createElement('div');
    root.className = 'designer-split-root';
    const pane1 = makePane(1);
    const divider = doc.createElement('div');
    divider.className = 'designer-split-divider';
    const pane2 = makePane(2);
    children.forEach((child, index) => {
      const pane = panel.children[index]?.splitPane === 2 ? pane2 : pane1;
      pane.querySelector('.designer-split-pane-flow')?.appendChild(child);
    });
    surface.replaceChildren(root);
    root.append(pane1, divider, pane2);
    installCanvasDivider(root, divider, control);
  }

  root.dataset.orientation = split.orientation;
  root.style.setProperty('--patch-split-ratio', String(split.ratio));
  const divider = root.querySelector(':scope > .designer-split-divider');
  if (divider) {
    divider.dataset.panelLine = String(control.line);
    divider.dataset.orientation = split.orientation;
    divider.setAttribute('role', 'separator');
    divider.setAttribute('aria-orientation', split.orientation);
    divider.setAttribute('aria-valuemin', String(PATCH_PANEL_SPLIT_RATIO_MIN));
    divider.setAttribute('aria-valuemax', String(PATCH_PANEL_SPLIT_RATIO_MAX));
    divider.setAttribute('aria-valuenow', String(split.ratio));
    divider.setAttribute('aria-label', `Resize ${split.orientation} SplitContainer ${panel.id ?? ''}`.trim());
    divider.tabIndex = 0;
  }
}

function makePane(number) {
  const pane = doc.createElement('div');
  pane.className = `designer-split-pane designer-split-pane-${number}`;
  pane.dataset.splitPane = String(number);
  const badge = doc.createElement('span');
  badge.className = 'designer-split-pane-badge';
  badge.textContent = `Pane ${number}`;
  const flow = doc.createElement('div');
  flow.className = 'designer-split-pane-flow';
  pane.append(badge, flow);
  return pane;
}

function restorePlainPanel(element) {
  element.classList.remove('patch-splitcontainer-designer');
  delete element.dataset.patchPanelSplit;
  const surface = element.querySelector(':scope > .patch-panel-surface');
  const root = surface?.querySelector(':scope > .designer-split-root');
  if (!surface || !root) return;
  const flow = doc.createElement('div');
  flow.className = 'patch-panel-flow';
  for (const pane of root.querySelectorAll(':scope > .designer-split-pane')) {
    const paneFlow = pane.querySelector(':scope > .designer-split-pane-flow');
    if (!paneFlow) continue;
    for (const child of [...paneFlow.children]) flow.appendChild(child);
  }
  const positioned = doc.createElement('div');
  positioned.className = 'patch-panel-positioned';
  surface.replaceChildren(flow, positioned);
}

function installCanvasDivider(root, divider, control) {
  let pointerId = null;
  let previewRatio = null;
  const update = event => {
    if (pointerId === null || event.pointerId !== pointerId) return;
    const orientation = divider.dataset.orientation || root.dataset.orientation || 'vertical';
    previewRatio = pointerRatio(root, event, orientation);
    previewDivider(root, divider, previewRatio);
  };
  const finish = event => {
    if (pointerId === null || event.pointerId !== pointerId) return;
    try { divider.releasePointerCapture?.(pointerId); } catch {}
    pointerId = null;
    if (previewRatio !== null) commitDivider(control, divider.dataset.orientation || 'vertical', previewRatio);
    previewRatio = null;
  };
  divider.addEventListener('pointerdown', event => {
    if (event.button !== undefined && event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    pointerId = event.pointerId;
    try { divider.setPointerCapture?.(pointerId); } catch {}
    previewRatio = pointerRatio(root, event, divider.dataset.orientation || root.dataset.orientation || 'vertical');
    previewDivider(root, divider, previewRatio);
  });
  divider.addEventListener('pointermove', update);
  divider.addEventListener('pointerup', finish);
  divider.addEventListener('pointercancel', finish);
  divider.addEventListener('click', event => event.stopPropagation());
  divider.addEventListener('keydown', event => {
    const orientation = divider.dataset.orientation || root.dataset.orientation || 'vertical';
    const vertical = orientation === 'vertical';
    const decrease = (vertical && event.key === 'ArrowLeft') || (!vertical && event.key === 'ArrowUp');
    const increase = (vertical && event.key === 'ArrowRight') || (!vertical && event.key === 'ArrowDown');
    if (!decrease && !increase && event.key !== 'Home' && event.key !== 'End') return;
    event.preventDefault();
    event.stopPropagation();
    const current = Number(divider.getAttribute('aria-valuenow')) || 50;
    const step = event.shiftKey ? 10 : 2;
    const next = event.key === 'Home'
      ? PATCH_PANEL_SPLIT_RATIO_MIN
      : event.key === 'End'
        ? PATCH_PANEL_SPLIT_RATIO_MAX
        : current + (increase ? step : -step);
    const ratio = clampRatio(next);
    previewDivider(root, divider, ratio);
    commitDivider(control, orientation, ratio);
  });
}

function pointerRatio(root, event, orientation) {
  const rect = root.getBoundingClientRect();
  const raw = orientation === 'horizontal'
    ? ((Number(event.clientY) - rect.top) / Math.max(1, rect.height)) * 100
    : ((Number(event.clientX) - rect.left) / Math.max(1, rect.width)) * 100;
  return clampRatio(raw);
}

function previewDivider(root, divider, ratio) {
  const next = clampRatio(ratio);
  root.style.setProperty('--patch-split-ratio', String(next));
  divider.setAttribute('aria-valuenow', String(Math.round(next)));
}

function commitDivider(control, orientation, ratio) {
  try {
    const live = selectedPanelRecord();
    const target = live?.control?.id === control.id ? live.control : control;
    const next = setWindowPanelSplit(code.value, target.line, { orientation, ratio: Math.round(clampRatio(ratio)) });
    setSource(next);
    clearDesignerInspectorError({ document: doc });
  } catch (error) {
    showDesignerInspectorError(error, { document: doc });
  }
}

function syncInspector() {
  const section = doc.querySelector('#designerSplitContainerEditor');
  if (!section) return;
  const selected = selectedPanelRecord();
  section.hidden = !selected;
  if (!selected) return;
  const split = selected.panel.panelSplit;
  const mode = section.querySelector('#designerPanelSplitMode');
  const ratio = section.querySelector('#designerPanelSplitRatio');
  if (mode) mode.value = split?.orientation ?? 'none';
  if (ratio) ratio.value = String(split?.ratio ?? 50);
  syncInspectorControls();

  const panelEditor = doc.querySelector('#designerPanelEditor');
  const positioned = panelEditor?.querySelector('#designerPanelChildPositioned');
  if (positioned) {
    positioned.disabled = Boolean(split);
    positioned.title = split
      ? 'SplitContainer Stage 1 uses flow-layout children inside each pane.'
      : 'Store Panel-relative coordinates for this child.';
  }
  const childList = panelEditor?.querySelector('#designerPanelChildList');
  if (childList && split) {
    for (const option of childList.options ?? []) {
      const child = selected.panel.children[Number(option.value)];
      if (!child?.splitPane || option.textContent.startsWith('Pane ')) continue;
      option.textContent = `Pane ${child.splitPane} · ${option.textContent}`;
      option.classList.add('designer-panel-child-pane');
    }
  }
}

function syncInspectorControls() {
  const section = doc.querySelector('#designerSplitContainerEditor');
  if (!section || section.hidden) return;
  const mode = section.querySelector('#designerPanelSplitMode')?.value ?? 'none';
  const ratio = section.querySelector('#designerPanelSplitRatio');
  if (ratio) ratio.disabled = mode === 'none';
  const hint = section.querySelector('#designerPanelSplitHint');
  if (hint) hint.textContent = mode === 'none'
    ? 'Conversion needs at least two flow-layout Panel children.'
    : 'Designer changes persist the initial split; runtime dragging stays transient.';
}

function applyInspectorSplit() {
  const selected = selectedPanelRecord();
  const section = doc.querySelector('#designerSplitContainerEditor');
  if (!selected || !section) return;
  const mode = section.querySelector('#designerPanelSplitMode')?.value ?? 'none';
  const ratio = clampRatio(Number(section.querySelector('#designerPanelSplitRatio')?.value ?? 50));
  try {
    let next = code.value;
    if (mode === 'none') {
      if (selected.panel.panelSplit) next = setWindowPanelSplit(next, selected.control.line, null);
    } else if (selected.panel.panelSplit) {
      next = setWindowPanelSplit(next, selected.control.line, { orientation: mode, ratio: Math.round(ratio) });
    } else {
      next = convertWindowPanelToSplit(next, selected.control.line, { orientation: mode, ratio: Math.round(ratio) });
    }
    setSource(next);
    clearDesignerInspectorError({ document: doc });
  } catch (error) {
    showDesignerInspectorError(error, { document: doc });
  }
}

function selectedPanelRecord() {
  const selection = currentDesignerSelection(canvas);
  if (!selection) return null;
  try {
    const control = listDesignerControls(code.value).find(item =>
      item.type === 'panel' &&
      Number(item.windowIndex) === Number(selection.windowIndex) &&
      Number(item.controlIndex) === Number(selection.controlIndex)
    ) ?? null;
    if (!control) return null;
    const panel = listDesignerPanels(code.value).find(item =>
      Number(item.windowIndex) === Number(control.windowIndex) && item.id === control.id
    ) ?? null;
    return panel ? { control, panel } : null;
  } catch {
    return null;
  }
}

function activeFormIndex() {
  const value = Number(doc.querySelector('#patchFormSelect')?.value);
  return Number.isInteger(value) && value >= 0 ? value : 0;
}

function clampRatio(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 50;
  return Math.max(PATCH_PANEL_SPLIT_RATIO_MIN, Math.min(PATCH_PANEL_SPLIT_RATIO_MAX, number));
}

function setSource(source) {
  if (typeof source !== 'string' || source === code.value) return;
  code.value = source;
  code.dispatchEvent(new Event('input', { bubbles: true }));
  code.dispatchEvent(new Event('change', { bubbles: true }));
}
