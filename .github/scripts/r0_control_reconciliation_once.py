from pathlib import Path


def replace_once(path, old, new):
    file = Path(path)
    text = file.read_text()
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{path}: expected exactly one guarded match, found {count}: {old[:120]!r}")
    file.write_text(text.replace(old, new, 1))


replace_once(
    'web/playground.js',
    "function runtimeWindowFingerprint(model) {\n  return JSON.stringify(model ?? null);\n}\n\nfunction createWindowShell(container, windows, model, windowIndex, interactive, materialization, tabSelections) {",
    """function runtimeWindowFingerprint(model) {
  return JSON.stringify(model ?? null);
}

const RUNTIME_CORE_CONTROL_TYPES = new Set([
  'tabs', 'text', 'button', 'input', 'checkbox', 'radio', 'combo', 'listbox', 'slider', 'picture', 'tree'
]);

function runtimeControlFingerprint(control) {
  return JSON.stringify(control ?? null);
}

function runtimeSpecializedControlsFingerprint(model) {
  return JSON.stringify((model?.controls ?? []).filter(control => !RUNTIME_CORE_CONTROL_TYPES.has(control?.type)));
}

function runtimeWindowTitleFingerprint(model) {
  return JSON.stringify([model?.title ?? '', model?.icon ?? null]);
}

function syncRuntimeWindowTitle(title, model) {
  const fingerprint = runtimeWindowTitleFingerprint(model);
  if (title.__patchWindowTitleFingerprint === fingerprint) return;
  title.replaceChildren();
  if (model.icon) {
    const img = document.createElement('img');
    img.className = 'patch-window-icon';
    img.alt = '';
    img.width = 16;
    img.height = 16;
    try {
      img.src = pictureResourceDataUri(model.icon, getStudioProjectResources());
    } catch {
      img.src = model.icon;
    }
    title.appendChild(img);
  }
  title.append(model.title);
  title.__patchWindowTitleFingerprint = fingerprint;
}

function runtimeCoreControlContext(container, windows, tabSelections, model, windowIndex, controlIndex) {
  return {
    interactive: true,
    container,
    windows,
    tabSelections,
    materialization: null,
    windowIndex,
    controlIndex,
    controlPath: String(controlIndex),
    windowId: model.id,
    topLevel: true
  };
}

function reconcileRuntimeCoreControls(container, shell, windows, model, windowIndex, tabSelections) {
  const body = shell.querySelector(':scope > .patch-window-body');
  if (!body) return null;
  const expected = [];
  (model.controls ?? []).forEach((control, controlIndex) => {
    if (!RUNTIME_CORE_CONTROL_TYPES.has(control?.type)) return;
    const context = runtimeCoreControlContext(container, windows, tabSelections, model, windowIndex, controlIndex);
    expected.push({ control, context, key: runtimeControlKey(control, context) });
  });
  const rendered = [...body.children].filter(child => child.dataset.patchControlKey);
  if (rendered.length !== expected.length) return null;
  for (let index = 0; index < expected.length; index += 1) {
    if (rendered[index].dataset.patchControlKey !== expected[index].key) return null;
  }

  let reusedControls = 0;
  const replacements = [];
  for (let index = 0; index < expected.length; index += 1) {
    const existingElement = rendered[index];
    const { control, context } = expected[index];
    const fingerprint = runtimeControlFingerprint(control);
    if (existingElement.__patchControlFingerprint === fingerprint) {
      reusedControls += 1;
      continue;
    }
    const nextElement = createControlElement(control, context);
    if (!nextElement) return null;
    replacements.push({ existingElement, nextElement });
  }
  for (const { existingElement, nextElement } of replacements) existingElement.replaceWith(nextElement);
  return { reusedControls, replacedControls: replacements.length };
}

function reconcileRuntimeWindowShell(container, shell, windows, model, windowIndex, tabSelections) {
  if (model.visible === false || shell.dataset.patchRenderDetail !== 'full') return null;
  const title = shell.querySelector(':scope > .patch-window-title');
  if (!title) return null;
  const specializedFingerprint = runtimeSpecializedControlsFingerprint(model);
  if (shell.__patchRuntimeSpecializedFingerprint !== specializedFingerprint) return null;
  const stats = reconcileRuntimeCoreControls(container, shell, windows, model, windowIndex, tabSelections);
  if (!stats) return null;
  syncRuntimeWindowTitle(title, model);
  shell.hidden = false;
  shell.dataset.patchWindowId = model.id ?? `window${windowIndex + 1}`;
  shell.dataset.patchWindowKey = runtimeWindowKey(model, windowIndex);
  shell.dataset.patchRenderDetail = 'full';
  shell.__patchWindowFingerprint = runtimeWindowFingerprint(model);
  shell.__patchRuntimeSpecializedFingerprint = specializedFingerprint;
  return stats;
}

function createWindowShell(container, windows, model, windowIndex, interactive, materialization, tabSelections) {""",
)

replace_once(
    'web/playground.js',
    "  shell.__patchWindowFingerprint = runtimeWindowFingerprint(model);\n  if (!interactive) shell.dataset.patchDesignerMaterialization = deferDesignerForm ? 'shell' : 'full';\n  const title = document.createElement('div');\n  title.className = 'patch-window-title';\n  if (model.icon) {\n    const img = document.createElement('img');\n    img.className = 'patch-window-icon';\n    img.alt = '';\n    img.width = 16;\n    img.height = 16;\n    try {\n      img.src = pictureResourceDataUri(model.icon, getStudioProjectResources());\n    } catch {\n      img.src = model.icon;\n    }\n    title.appendChild(img);\n  }\n  title.append(model.title);",
    "  shell.__patchWindowFingerprint = runtimeWindowFingerprint(model);\n  shell.__patchRuntimeSpecializedFingerprint = runtimeSpecializedControlsFingerprint(model);\n  if (!interactive) shell.dataset.patchDesignerMaterialization = deferDesignerForm ? 'shell' : 'full';\n  const title = document.createElement('div');\n  title.className = 'patch-window-title';\n  syncRuntimeWindowTitle(title, model);",
)

replace_once(
    'web/playground.js',
    """  if (!windows?.length) {
    container.innerHTML = '<p class=\"empty-preview\">No Patch window is defined.</p>';
    container.dataset.patchRuntimeReconcile = 'keyed-window-v1';
    return;
  }
  const transient = captureRuntimeTransientState(container);
  const existing = new Map();
  for (const shell of container.querySelectorAll(':scope > .patch-window')) {
    const key = shell.dataset.patchWindowKey ?? shell.dataset.patchWindowId ?? '';
    if (key) existing.set(key, shell);
  }
  const desired = [];
  let reusedForms = 0;
  let replacedForms = 0;
  windows.forEach((model, windowIndex) => {
    const key = runtimeWindowKey(model, windowIndex);
    const fingerprint = runtimeWindowFingerprint(model);
    const detail = model.visible === false ? 'deferred' : 'full';
    let shell = existing.get(key) ?? null;
    if (!shell || shell.__patchWindowFingerprint !== fingerprint || shell.dataset.patchRenderDetail !== detail) {
      shell?.remove();
      shell = createWindowShell(container, windows, model, windowIndex, true, null, tabSelections);
      replacedForms += 1;
    } else {
      reusedForms += 1;
    }
    existing.delete(key);
    desired.push(shell);
  });
  for (const stale of existing.values()) stale.remove();
  desired.forEach((shell, index) => {
    const current = container.querySelectorAll(':scope > .patch-window')[index] ?? null;
    if (current !== shell) container.insertBefore(shell, current);
  });
  container.dataset.patchRuntimeReconcile = 'keyed-window-v1';
  container.dataset.patchRuntimeReusedForms = String(reusedForms);
  container.dataset.patchRuntimeReplacedForms = String(replacedForms);
  restoreRuntimeTransientState(container, transient);""",
    """  if (!windows?.length) {
    container.innerHTML = '<p class=\"empty-preview\">No Patch window is defined.</p>';
    container.dataset.patchRuntimeReconcile = 'keyed-control-v2';
    container.dataset.patchRuntimeReusedForms = '0';
    container.dataset.patchRuntimeReplacedForms = '0';
    container.dataset.patchRuntimeReconciledForms = '0';
    container.dataset.patchRuntimeReusedControls = '0';
    container.dataset.patchRuntimeReplacedControls = '0';
    return;
  }
  const transient = captureRuntimeTransientState(container);
  const existing = new Map();
  for (const shell of container.querySelectorAll(':scope > .patch-window')) {
    const key = shell.dataset.patchWindowKey ?? shell.dataset.patchWindowId ?? '';
    if (key) existing.set(key, shell);
  }
  const desired = [];
  let reusedForms = 0;
  let replacedForms = 0;
  let reconciledForms = 0;
  let reusedControls = 0;
  let replacedControls = 0;
  windows.forEach((model, windowIndex) => {
    const key = runtimeWindowKey(model, windowIndex);
    const fingerprint = runtimeWindowFingerprint(model);
    const detail = model.visible === false ? 'deferred' : 'full';
    let shell = existing.get(key) ?? null;
    if (!shell || shell.dataset.patchRenderDetail !== detail) {
      shell?.remove();
      shell = createWindowShell(container, windows, model, windowIndex, true, null, tabSelections);
      replacedForms += 1;
    } else if (shell.__patchWindowFingerprint === fingerprint) {
      reusedForms += 1;
    } else {
      const controlStats = reconcileRuntimeWindowShell(container, shell, windows, model, windowIndex, tabSelections);
      if (controlStats) {
        reusedForms += 1;
        reconciledForms += 1;
        reusedControls += controlStats.reusedControls;
        replacedControls += controlStats.replacedControls;
      } else {
        shell.remove();
        shell = createWindowShell(container, windows, model, windowIndex, true, null, tabSelections);
        replacedForms += 1;
      }
    }
    existing.delete(key);
    desired.push(shell);
  });
  for (const stale of existing.values()) stale.remove();
  desired.forEach((shell, index) => {
    const current = container.querySelectorAll(':scope > .patch-window')[index] ?? null;
    if (current !== shell) container.insertBefore(shell, current);
  });
  container.dataset.patchRuntimeReconcile = 'keyed-control-v2';
  container.dataset.patchRuntimeReusedForms = String(reusedForms);
  container.dataset.patchRuntimeReplacedForms = String(replacedForms);
  container.dataset.patchRuntimeReconciledForms = String(reconciledForms);
  container.dataset.patchRuntimeReusedControls = String(reusedControls);
  container.dataset.patchRuntimeReplacedControls = String(replacedControls);
  restoreRuntimeTransientState(container, transient);""",
)

replace_once(
    'web/playground.js',
    "  if (el) el.dataset.patchControlKey = runtimeControlKey(control, context);\n  return el ?? null;",
    "  if (el) {\n    el.dataset.patchControlKey = runtimeControlKey(control, context);\n    el.__patchControlFingerprint = runtimeControlFingerprint(control);\n  }\n  return el ?? null;",
)

replace_once(
    'tests/workshop-desk-browser.test.js',
    "state?.value === 'Keyboard Pro' && state.active === true && state.reconcile === 'keyed-window-v1'",
    "state?.value === 'Keyboard Pro' && state.active === true && state.reconcile === 'keyed-control-v2'",
)

replace_once(
    'tests/workshop-desk-browser.test.js',
    "assert.equal(keyedInputState.mainReplaced, true, 'changed main Form should be replaced at the Stage 1 Form boundary');",
    "assert.equal(keyedInputState.mainReplaced, true, 'main Form keeps the safe full-Form fallback while its adapter-owned StatusBar model changes');",
)

insert_before = """  const tabsSwitched = await evaluate(cdp, `(() => {
"""
addition = """  const controlReconcileStarted = await evaluate(cdp, `(() => {
    const main = document.querySelector('#app .patch-window[data-patch-window-id=\"main\"]');
    const settings = document.querySelector('#app .patch-window[data-patch-window-id=\"settings\"]');
    const tabs = settings?.querySelector('.patch-tabs[data-tabs-id=\"prefs\"]');
    const close = [...(settings?.querySelectorAll('button.patch-button') ?? [])].find(node => node.textContent.trim() === 'Close settings');
    const checkbox = [...(settings?.querySelectorAll('.patch-checkbox') ?? [])].find(node => node.textContent.includes('Notify when a quote changes'))?.querySelector('input');
    if (!main || !settings || !tabs || !close || !checkbox) return false;
    window.__patchMainBeforeControlReconcile = main;
    window.__patchSettingsBeforeControlReconcile = settings;
    window.__patchTabsBeforeControlReconcile = tabs;
    window.__patchCloseBeforeControlReconcile = close;
    checkbox.focus();
    checkbox.click();
    return true;
  })()`);
  assert.equal(controlReconcileStarted, true);
  const controlReconcileState = await waitFor(cdp, `(() => {
    const main = document.querySelector('#app .patch-window[data-patch-window-id=\"main\"]');
    const settings = document.querySelector('#app .patch-window[data-patch-window-id=\"settings\"]');
    const tabs = settings?.querySelector('.patch-tabs[data-tabs-id=\"prefs\"]');
    const close = [...(settings?.querySelectorAll('button.patch-button') ?? [])].find(node => node.textContent.trim() === 'Close settings');
    const checkbox = [...(settings?.querySelectorAll('.patch-checkbox') ?? [])].find(node => node.textContent.includes('Notify when a quote changes'))?.querySelector('input');
    const app = document.querySelector('#app');
    return checkbox ? {
      checked: checkbox.checked,
      focused: document.activeElement === checkbox,
      mainReplaced: window.__patchMainBeforeControlReconcile !== main,
      settingsStable: window.__patchSettingsBeforeControlReconcile === settings,
      tabsReplaced: window.__patchTabsBeforeControlReconcile !== tabs,
      closeStable: window.__patchCloseBeforeControlReconcile === close,
      reconcile: app?.dataset?.patchRuntimeReconcile ?? '',
      reconciledForms: Number(app?.dataset?.patchRuntimeReconciledForms ?? 0),
      reusedControls: Number(app?.dataset?.patchRuntimeReusedControls ?? 0),
      replacedControls: Number(app?.dataset?.patchRuntimeReplacedControls ?? 0)
    } : null;
  })()`, state => state?.checked === false && state.focused === true && state.reconcile === 'keyed-control-v2' && state.reconciledForms >= 1);
  assert.equal(controlReconcileState.settingsStable, true, 'changed settings Form should retain its shell when core control keys remain stable');
  assert.equal(controlReconcileState.tabsReplaced, true, 'changed Tabs control should be replaced at the control boundary');
  assert.equal(controlReconcileState.closeStable, true, 'unchanged sibling Button should retain DOM identity inside the changed Form');
  assert.equal(controlReconcileState.mainReplaced, true, 'adapter-owned StatusBar drift in main should keep the safe full-Form fallback');
  assert.ok(controlReconcileState.reusedControls >= 1, JSON.stringify(controlReconcileState));
  assert.ok(controlReconcileState.replacedControls >= 1, JSON.stringify(controlReconcileState));

"""
replace_once('tests/workshop-desk-browser.test.js', insert_before, addition + insert_before)

# Update the small architecture regression to the v2 contract.
path = Path('tests/studio-runtime-keyed-renderer.test.js')
text = path.read_text()
text = text.replace("patchRuntimeReconcile = 'keyed-window-v1'", "patchRuntimeReconcile = 'keyed-control-v2'")
if "keyed-window-v1" in text:
    raise SystemExit('tests/studio-runtime-keyed-renderer.test.js: stale keyed-window-v1 marker remains')
path.write_text(text)
