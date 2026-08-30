from pathlib import Path


def replace_once(path, old, new):
    p = Path(path)
    text = p.read_text()
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{path}: expected exactly one guarded match, found {count}")
    p.write_text(text.replace(old, new, 1))


replace_once(
    'web/playground.js',
    "import { getRuntimeSelection, runtimeSelectionKey, setRuntimeSelection } from './studio-runtime-selection-state.js';\nimport { createStudioFormMaterializationPlan } from '../src/studio-form-materialization.js';",
    "import { getRuntimeSelection, runtimeSelectionKey, setRuntimeSelection } from './studio-runtime-selection-state.js';\nimport { PATCH_STUDIO_RUNTIME_RENDER_MODE_FULL, resolveStudioRuntimeRenderMode } from './studio-runtime-render-policy.js';\nimport { createStudioFormMaterializationPlan } from '../src/studio-form-materialization.js';"
)

replace_once(
    'web/playground.js',
    "    renderWindows(appView, result.ui, true);\n    showTab(result.ui.length ? 'app' : 'output');",
    "    renderWindows(appView, result.ui, true);\n    appView.dataset.patchRuntimeRenderMode = resolveStudioRuntimeRenderMode(globalThis.location?.search ?? '');\n    showTab(result.ui.length ? 'app' : 'output');"
)

insertion_marker = "\nfunction createControlElement(control, context) {"
dispatcher = r'''
function renderRuntimeWindowsAfterEvent(container, windows) {
  const mode = resolveStudioRuntimeRenderMode(globalThis.location?.search ?? '');
  container.dataset.patchRuntimeRenderMode = mode;
  if (mode !== PATCH_STUDIO_RUNTIME_RENDER_MODE_FULL) {
    reconcileRuntimeWindows(container, windows);
    container.dataset.patchRuntimeRenderMode = mode;
    return;
  }

  const transient = captureRuntimeTransientState(container);
  renderWindows(container, windows, true);
  const models = Array.isArray(windows) ? windows : [];
  const rebuiltControls = models.reduce((count, model) => count + (model?.controls?.length ?? 0), 0);
  container.dataset.patchRuntimeRenderMode = mode;
  container.dataset.patchRuntimeReconcile = 'full-fallback-v1';
  container.dataset.patchRuntimeReusedForms = '0';
  container.dataset.patchRuntimeReplacedForms = String(models.length);
  container.dataset.patchRuntimeReconciledForms = '0';
  container.dataset.patchRuntimeReusedControls = '0';
  container.dataset.patchRuntimeReplacedControls = String(rebuiltControls);
  restoreRuntimeTransientState(container, transient);
}
'''
replace_once('web/playground.js', insertion_marker, dispatcher + insertion_marker)
replace_once(
    'web/playground.js',
    '    reconcileRuntimeWindows(appView, result.ui);',
    '    renderRuntimeWindowsAfterEvent(appView, result.ui);'
)

replace_once(
    'scripts/build-site.js',
    "  'playground.js','studio-design-snapshots.js','studio-runtime-selection-state.js','forms-designer.js'",
    "  'playground.js','studio-design-snapshots.js','studio-runtime-selection-state.js','studio-runtime-render-policy.js','forms-designer.js'"
)
replace_once(
    'web/sw.js',
    "  './playground.js', './studio-design-snapshots.js', './studio-runtime-selection-state.js', './beta35-studio.js'",
    "  './playground.js', './studio-design-snapshots.js', './studio-runtime-selection-state.js', './studio-runtime-render-policy.js', './beta35-studio.js'"
)

marker = '''  await delay(1000);
  assert.equal(await evaluate(cdp, `document.querySelector('#code')?.value?.includes('window "Job details" as details') === true`, 3000), true,
    'Workshop Desk page stopped responding after Run and Form materialization');
});'''
replacement = r'''  const fullFallbackStarted = await evaluate(cdp, `(() => {
    const app = document.querySelector('#app');
    const main = document.querySelector('#app .patch-window[data-patch-window-id="main"]');
    const settings = document.querySelector('#app .patch-window[data-patch-window-id="settings"]');
    const input = [...(main?.querySelectorAll('input.patch-input') ?? [])].find(node => node.placeholder === 'item');
    if (!app || !main || !settings || !input) return false;
    const url = new URL(window.location.href);
    url.searchParams.set('patch-runtime-render', 'full');
    window.history.replaceState(null, '', url);
    window.__patchMainBeforeExplicitFull = main;
    window.__patchSettingsBeforeExplicitFull = settings;
    input.focus();
    input.value = 'Keyboard Full';
    input.setSelectionRange(4, 4);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  })()`);
  assert.equal(fullFallbackStarted, true);
  const fullFallbackState = await waitFor(cdp, `(() => {
    const app = document.querySelector('#app');
    const main = document.querySelector('#app .patch-window[data-patch-window-id="main"]');
    const settings = document.querySelector('#app .patch-window[data-patch-window-id="settings"]');
    const input = [...(main?.querySelectorAll('input.patch-input') ?? [])].find(node => node.placeholder === 'item');
    return input ? {
      mode: app?.dataset?.patchRuntimeRenderMode ?? '',
      reconcile: app?.dataset?.patchRuntimeReconcile ?? '',
      mainReplaced: window.__patchMainBeforeExplicitFull !== main,
      settingsReplaced: window.__patchSettingsBeforeExplicitFull !== settings,
      replacedForms: Number(app?.dataset?.patchRuntimeReplacedForms ?? 0),
      value: input.value,
      focused: document.activeElement === input,
      selectionStart: input.selectionStart,
      selectionEnd: input.selectionEnd,
      row: document.querySelector('#app [data-patch-control-key="id:board"] tbody > tr[aria-selected="true"]')?.textContent ?? '',
      tree: document.querySelector('#app [data-patch-control-key="id:parts"] .patch-tree-node[aria-selected="true"]')?.getAttribute('aria-label') ?? ''
    } : null;
  })()`, state => state?.mode === 'full'
    && state.reconcile === 'full-fallback-v1'
    && state.value === 'Keyboard Full'
    && state.focused === true
    && state.row.includes('WD-105')
    && state.tree === 'Parts / Input / Keyboard');
  assert.equal(fullFallbackState.mainReplaced, true, 'explicit full mode must rebuild the main Form');
  assert.equal(fullFallbackState.settingsReplaced, true, 'explicit full mode must rebuild even otherwise unchanged Forms');
  assert.ok(fullFallbackState.replacedForms >= 6, JSON.stringify(fullFallbackState));
  assert.equal(fullFallbackState.selectionStart, 4);
  assert.equal(fullFallbackState.selectionEnd, 4);

  const incrementalResumed = await evaluate(cdp, `(() => {
    const app = document.querySelector('#app');
    const settings = document.querySelector('#app .patch-window[data-patch-window-id="settings"]');
    const main = document.querySelector('#app .patch-window[data-patch-window-id="main"]');
    const input = [...(main?.querySelectorAll('input.patch-input') ?? [])].find(node => node.placeholder === 'item');
    if (!app || !settings || !input) return false;
    const url = new URL(window.location.href);
    url.searchParams.delete('patch-runtime-render');
    window.history.replaceState(null, '', url);
    window.__patchSettingsBeforeIncrementalResume = settings;
    input.value = 'Keyboard Keyed';
    input.setSelectionRange(6, 6);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  })()`);
  assert.equal(incrementalResumed, true);
  const incrementalResumeState = await waitFor(cdp, `(() => {
    const app = document.querySelector('#app');
    const main = document.querySelector('#app .patch-window[data-patch-window-id="main"]');
    const settings = document.querySelector('#app .patch-window[data-patch-window-id="settings"]');
    const input = [...(main?.querySelectorAll('input.patch-input') ?? [])].find(node => node.placeholder === 'item');
    return input ? {
      mode: app?.dataset?.patchRuntimeRenderMode ?? '',
      reconcile: app?.dataset?.patchRuntimeReconcile ?? '',
      settingsStable: window.__patchSettingsBeforeIncrementalResume === settings,
      value: input.value,
      row: document.querySelector('#app [data-patch-control-key="id:board"] tbody > tr[aria-selected="true"]')?.textContent ?? '',
      tree: document.querySelector('#app [data-patch-control-key="id:parts"] .patch-tree-node[aria-selected="true"]')?.getAttribute('aria-label') ?? ''
    } : null;
  })()`, state => state?.mode === 'incremental'
    && state.reconcile === 'keyed-control-v2'
    && state.value === 'Keyboard Keyed'
    && state.row.includes('WD-105')
    && state.tree === 'Parts / Input / Keyboard');
  assert.equal(incrementalResumeState.settingsStable, true, 'removing the explicit fallback must resume keyed reconciliation');

  await delay(1000);
  assert.equal(await evaluate(cdp, `document.querySelector('#code')?.value?.includes('window "Job details" as details') === true`, 3000), true,
    'Workshop Desk page stopped responding after Run and Form materialization');
});'''
replace_once('tests/workshop-desk-browser.test.js', marker, replacement)
