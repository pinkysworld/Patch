from pathlib import Path

branch_files = {
    'playground': Path('web/playground.js'),
    'workshop_test': Path('tests/workshop-desk-browser.test.js'),
    'roadmap': Path('docs/ROADMAP.md'),
    'backlog': Path('docs/RAD_STUDIO_MASTER_BACKLOG.md'),
    'gpt': Path('docs/GPT.md'),
}

playground = branch_files['playground'].read_text()

render_start = playground.index('function renderWindows(container, windows, interactive, options = {}) {')
render_end = playground.index('\nfunction createControlElement(control, context) {', render_start)
new_render = r'''function runtimeWindowKey(model, windowIndex) {
  return String(model?.id ?? `window${windowIndex + 1}`);
}

function runtimeControlKey(control, context) {
  const id = String(control?.id ?? '').trim();
  if (id) return `id:${id}`;
  const windowKey = String(context.windowId ?? `window${Number(context.windowIndex ?? 0) + 1}`);
  const path = String(context.controlPath ?? context.controlIndex ?? 'control');
  return `${windowKey}:path:${path}`;
}

function runtimeWindowFingerprint(model) {
  return JSON.stringify(model ?? null);
}

function createWindowShell(container, windows, model, windowIndex, interactive, materialization, tabSelections) {
  const shell = document.createElement('section');
  shell.className = 'patch-window';
  const deferHiddenForm = Boolean(interactive && model.visible === false);
  const deferDesignerForm = Boolean(!interactive && materialization?.modes?.[windowIndex] === 'shell');
  const deferForm = deferHiddenForm || deferDesignerForm;
  const windowKey = runtimeWindowKey(model, windowIndex);
  shell.hidden = deferForm;
  shell.dataset.patchWindowId = model.id ?? `window${windowIndex + 1}`;
  shell.dataset.patchWindowKey = windowKey;
  shell.dataset.patchRenderDetail = deferForm ? 'deferred' : 'full';
  shell.__patchWindowFingerprint = runtimeWindowFingerprint(model);
  if (!interactive) shell.dataset.patchDesignerMaterialization = deferDesignerForm ? 'shell' : 'full';
  const title = document.createElement('div');
  title.className = 'patch-window-title';
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
  const body = document.createElement('div');
  body.className = 'patch-window-body';
  if (!deferForm) {
    model.controls.forEach((control, controlIndex) => {
      const el = createControlElement(control, {
        interactive,
        container,
        windows,
        tabSelections,
        materialization,
        windowIndex,
        controlIndex,
        controlPath: String(controlIndex),
        windowId: model.id,
        topLevel: true
      });
      if (!el) return;
      if (!interactive && control.type !== 'tree') decorateDesignerControl(el, windowIndex, controlIndex, control);
      body.appendChild(el);
    });
  }
  shell.append(title, body);
  return shell;
}

function renderWindows(container, windows, interactive, options = {}) {
  const tabSelections = container.__patchTabSelections ??= new Map();
  const materialization = interactive ? null : options.materialization ?? null;
  container.innerHTML = '';
  if (interactive) container.dataset.patchRuntimeReconcile = 'full';
  if (materialization) container.dataset.patchDesignerMaterializedForm = String(materialization.activeIndex);
  if (!windows?.length) {
    container.innerHTML = '<p class="empty-preview">No Patch window is defined.</p>';
    return;
  }
  windows.forEach((model, windowIndex) => {
    container.appendChild(createWindowShell(container, windows, model, windowIndex, interactive, materialization, tabSelections));
  });
}

function runtimeFocusableElements(root) {
  const selector = 'input, select, textarea, button, [tabindex]';
  const items = [];
  if (root.matches?.(selector)) items.push(root);
  for (const item of root.querySelectorAll?.(selector) ?? []) if (!items.includes(item)) items.push(item);
  return items;
}

function findRuntimeControlByKey(container, key) {
  for (const control of container.querySelectorAll('[data-patch-control-key]')) {
    if (control.dataset.patchControlKey === key) return control;
  }
  return null;
}

function captureRuntimeTransientState(container) {
  const state = {
    containerScrollTop: container.scrollTop,
    containerScrollLeft: container.scrollLeft,
    windows: new Map(),
    controls: new Map(),
    multiSelections: new Map(),
    focus: null
  };
  for (const shell of container.querySelectorAll(':scope > .patch-window')) {
    const key = shell.dataset.patchWindowKey ?? shell.dataset.patchWindowId ?? '';
    const body = shell.querySelector(':scope > .patch-window-body');
    state.windows.set(key, {
      shellTop: shell.scrollTop,
      shellLeft: shell.scrollLeft,
      bodyTop: body?.scrollTop ?? 0,
      bodyLeft: body?.scrollLeft ?? 0
    });
  }
  for (const control of container.querySelectorAll('[data-patch-control-key]')) {
    const key = control.dataset.patchControlKey;
    if (!key) continue;
    if (control.scrollTop || control.scrollLeft) state.controls.set(key, { top: control.scrollTop, left: control.scrollLeft });
    const select = control.matches?.('select[multiple]') ? control : control.querySelector?.('select[multiple]');
    if (select) {
      state.multiSelections.set(key, {
        selected: [...select.selectedOptions].map(option => option.value),
        rendered: select.dataset.patchRenderedSelection ?? ''
      });
    }
  }
  const active = document.activeElement;
  if (active && container.contains(active)) {
    const control = active.closest?.('[data-patch-control-key]');
    if (control && container.contains(control)) {
      const focusables = runtimeFocusableElements(control);
      const focusIndex = focusables.indexOf(active);
      state.focus = {
        key: control.dataset.patchControlKey,
        focusIndex,
        selectionStart: typeof active.selectionStart === 'number' ? active.selectionStart : null,
        selectionEnd: typeof active.selectionEnd === 'number' ? active.selectionEnd : null,
        selectionDirection: typeof active.selectionDirection === 'string' ? active.selectionDirection : null
      };
    }
  }
  return state;
}

function restoreRuntimeTransientState(container, state) {
  if (!state) return;
  container.scrollTop = state.containerScrollTop;
  container.scrollLeft = state.containerScrollLeft;
  for (const shell of container.querySelectorAll(':scope > .patch-window')) {
    const key = shell.dataset.patchWindowKey ?? shell.dataset.patchWindowId ?? '';
    const saved = state.windows.get(key);
    if (!saved) continue;
    shell.scrollTop = saved.shellTop;
    shell.scrollLeft = saved.shellLeft;
    const body = shell.querySelector(':scope > .patch-window-body');
    if (body) {
      body.scrollTop = saved.bodyTop;
      body.scrollLeft = saved.bodyLeft;
    }
  }
  for (const [key, saved] of state.controls) {
    const control = findRuntimeControlByKey(container, key);
    if (!control) continue;
    control.scrollTop = saved.top;
    control.scrollLeft = saved.left;
  }
  for (const [key, saved] of state.multiSelections) {
    const control = findRuntimeControlByKey(container, key);
    if (!control) continue;
    const select = control.matches?.('select[multiple]') ? control : control.querySelector?.('select[multiple]');
    if (!select || select.dataset.patchRenderedSelection !== saved.rendered) continue;
    const allowed = new Set([...select.options].map(option => option.value));
    const selected = new Set(saved.selected.filter(value => allowed.has(value)));
    for (const option of select.options) option.selected = selected.has(option.value);
  }
  if (!state.focus?.key) return;
  const control = findRuntimeControlByKey(container, state.focus.key);
  if (!control) return;
  const focusables = runtimeFocusableElements(control);
  const target = focusables[state.focus.focusIndex] ?? focusables[0] ?? control;
  target.focus?.({ preventScroll: true });
  if (state.focus.selectionStart !== null && typeof target.setSelectionRange === 'function') {
    const length = String(target.value ?? '').length;
    const start = Math.min(state.focus.selectionStart, length);
    const end = Math.min(state.focus.selectionEnd ?? start, length);
    try { target.setSelectionRange(start, end, state.focus.selectionDirection ?? 'none'); } catch { /* unsupported input type */ }
  }
}

function reconcileRuntimeWindows(container, windows) {
  const tabSelections = container.__patchTabSelections ??= new Map();
  if (!windows?.length) {
    container.innerHTML = '<p class="empty-preview">No Patch window is defined.</p>';
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
  windows.forEach((model, windowIndex) => {
    const key = runtimeWindowKey(model, windowIndex);
    const fingerprint = runtimeWindowFingerprint(model);
    const detail = model.visible === false ? 'deferred' : 'full';
    let shell = existing.get(key) ?? null;
    if (!shell || shell.__patchWindowFingerprint !== fingerprint || shell.dataset.patchRenderDetail !== detail) {
      shell?.remove();
      shell = createWindowShell(container, windows, model, windowIndex, true, null, tabSelections);
    }
    existing.delete(key);
    desired.push(shell);
  });
  for (const stale of existing.values()) stale.remove();
  for (const shell of desired) container.appendChild(shell);
  container.dataset.patchRuntimeReconcile = 'keyed-window-v1';
  restoreRuntimeTransientState(container, transient);
}
'''
playground = playground[:render_start] + new_render + playground[render_end:]

old_control_start = "function createControlElement(control, context) {\n  if (control.type === 'tabs') return createTabsElement(control, context);\n  let el;\n  if (control.type === 'text') {"
new_control_start = "function createControlElement(control, context) {\n  let el;\n  if (control.type === 'tabs') {\n    el = createTabsElement(control, context);\n  } else if (control.type === 'text') {"
if old_control_start not in playground:
    raise SystemExit('createControlElement start anchor not found')
playground = playground.replace(old_control_start, new_control_start, 1)

control_start = playground.index('function createControlElement(control, context) {')
control_end = playground.index('\nfunction createTreeElement(control, context) {', control_start)
control_block = playground[control_start:control_end]
old_return = '  return el ?? null;\n}'
new_return = "  if (el) el.dataset.patchControlKey = runtimeControlKey(control, context);\n  return el ?? null;\n}"
if old_return not in control_block:
    raise SystemExit('createControlElement return anchor not found')
control_block = control_block.replace(old_return, new_return, 1)
# Track the rendered list selection separately from transient DOM selection.
old_multi = "    if (!multi) el.value = String(control.value ?? '');\n    if (context.interactive) {"
new_multi = "    if (!multi) el.value = String(control.value ?? '');\n    if (multi) el.dataset.patchRenderedSelection = JSON.stringify([...el.selectedOptions].map(item => item.value));\n    if (context.interactive) {"
if old_multi not in control_block:
    raise SystemExit('listbox rendered selection anchor not found')
control_block = control_block.replace(old_multi, new_multi, 1)
playground = playground[:control_start] + control_block + playground[control_end:]

tabs_start = playground.index('function createTabsElement(control, context) {')
tabs_end = playground.index('\nfunction decorateDesignerControl(', tabs_start)
new_tabs = r'''function renderTabsPanel(panel, page, context, pageIndex) {
  panel.replaceChildren();
  (page?.controls ?? []).forEach((nested, nestedIndex) => {
    const basePath = String(context.controlPath ?? context.controlIndex ?? 'tabs');
    const nestedEl = createControlElement(nested, {
      ...context,
      controlIndex: nestedIndex,
      controlPath: `${basePath}.tab${pageIndex}.${nestedIndex}`,
      topLevel: false
    });
    if (nestedEl) panel.appendChild(nestedEl);
  });
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
  const panel = document.createElement('div');
  panel.className = 'patch-tab-panel';
  panel.setAttribute('role', 'tabpanel');
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
      for (const [index, tab] of [...list.querySelectorAll('.patch-tab-button')].entries()) {
        tab.setAttribute('aria-selected', index === pageIndex ? 'true' : 'false');
      }
      renderTabsPanel(panel, pages[pageIndex], context, pageIndex);
      button.focus({ preventScroll: true });
    });
    list.appendChild(button);
  });

  renderTabsPanel(panel, pages[selected], context, selected);
  root.append(list, panel);
  return root;
}
'''
playground = playground[:tabs_start] + new_tabs + playground[tabs_end:]

trigger_start = playground.index('function trigger(control, event, payload = {}) {')
trigger_end = playground.index('\nfunction showTab(name) {', trigger_start)
new_trigger = r'''function trigger(control, event, payload = {}) {
  if (!runtime) return;
  try {
    const result = triggerWindowEvent(runtime, control, event, payload);
    output.textContent = result.output.length ? result.output.join('\n') : '(event completed)';
    reconcileRuntimeWindows(appView, result.ui);
  } catch (err) {
    output.textContent = `Patch stopped:\n${formatStudioStop(err, 'run')}`;
    showTab('output');
  }
}
'''
playground = playground[:trigger_start] + new_trigger + playground[trigger_end:]
branch_files['playground'].write_text(playground)

unit_path = Path('tests/studio-runtime-keyed-renderer.test.js')
unit_path.write_text(r'''import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const playground = fs.readFileSync('web/playground.js', 'utf8');

test('runtime events reconcile keyed Forms instead of rebuilding the complete app tree', () => {
  assert.match(playground, /function runtimeWindowKey\(/);
  assert.match(playground, /dataset\.patchWindowKey/);
  assert.match(playground, /dataset\.patchControlKey = runtimeControlKey/);
  assert.match(playground, /function reconcileRuntimeWindows\(/);
  assert.match(playground, /patchRuntimeReconcile = 'keyed-window-v1'/);
  const trigger = playground.slice(playground.indexOf('function trigger(control, event, payload = {})'), playground.indexOf('function showTab(name)'));
  assert.match(trigger, /reconcileRuntimeWindows\(appView, result\.ui\)/);
  assert.doesNotMatch(trigger, /renderWindows\(appView/);
});

test('keyed Form replacement preserves bounded transient browser state', () => {
  assert.match(playground, /function captureRuntimeTransientState\(/);
  assert.match(playground, /function restoreRuntimeTransientState\(/);
  assert.match(playground, /selectionStart/);
  assert.match(playground, /setSelectionRange/);
  assert.match(playground, /containerScrollTop/);
  assert.match(playground, /patchRenderedSelection/);
  assert.match(playground, /preventScroll: true/);
});

test('Tabs update only their local panel instead of rerendering all Forms', () => {
  const start = playground.indexOf('function createTabsElement(control, context)');
  const end = playground.indexOf('function decorateDesignerControl', start);
  const tabs = playground.slice(start, end);
  assert.match(tabs, /renderTabsPanel\(panel, pages\[pageIndex\], context, pageIndex\)/);
  assert.match(tabs, /aria-selected/);
  assert.doesNotMatch(tabs, /renderWindows\(/);
});
''')

workshop = branch_files['workshop_test'].read_text()
app_anchor = "  assert.ok(appState.hiddenChildren.every(count => count === 0), `deferred Form bodies must stay empty: ${JSON.stringify(appState.hiddenChildren)}`);\n\n  const multiBefore = await evaluate(cdp, `(() => {"
app_insert = r'''  assert.ok(appState.hiddenChildren.every(count => count === 0), `deferred Form bodies must stay empty: ${JSON.stringify(appState.hiddenChildren)}`);

  const keyedInputStarted = await evaluate(cdp, `(() => {
    const main = document.querySelector('#app .patch-window[data-patch-window-id="main"]');
    const settings = document.querySelector('#app .patch-window[data-patch-window-id="settings"]');
    const input = [...(main?.querySelectorAll('input.patch-input') ?? [])].find(node => node.placeholder === 'item');
    if (!main || !settings || !input) return false;
    window.__patchMainBeforeItemEvent = main;
    window.__patchSettingsBeforeItemEvent = settings;
    input.focus();
    input.value = 'Keyboard Pro';
    input.setSelectionRange(5, 5);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  })()`);
  assert.equal(keyedInputStarted, true);
  const keyedInputState = await waitFor(cdp, `(() => {
    const main = document.querySelector('#app .patch-window[data-patch-window-id="main"]');
    const settings = document.querySelector('#app .patch-window[data-patch-window-id="settings"]');
    const input = [...(main?.querySelectorAll('input.patch-input') ?? [])].find(node => node.placeholder === 'item');
    return input ? {
      value: input.value,
      active: document.activeElement === input,
      selectionStart: input.selectionStart,
      selectionEnd: input.selectionEnd,
      mainReplaced: window.__patchMainBeforeItemEvent !== main,
      settingsStable: window.__patchSettingsBeforeItemEvent === settings,
      reconcile: document.querySelector('#app')?.dataset?.patchRuntimeReconcile ?? '',
      key: input.dataset.patchControlKey ?? ''
    } : null;
  })()`, state => state?.value === 'Keyboard Pro' && state.active === true && state.reconcile === 'keyed-window-v1');
  assert.equal(keyedInputState.mainReplaced, true, 'changed main Form should be replaced at the Stage 1 Form boundary');
  assert.equal(keyedInputState.settingsStable, true, 'unchanged hidden Form DOM should retain identity across an event');
  assert.equal(keyedInputState.selectionStart, 5);
  assert.equal(keyedInputState.selectionEnd, 5);
  assert.match(keyedInputState.key, /^id:item$/);

  const multiBefore = await evaluate(cdp, `(() => {'''
if app_anchor not in workshop:
    raise SystemExit('Workshop app-state insertion anchor not found')
workshop = workshop.replace(app_anchor, app_insert, 1)

settings_anchor = "  assert.ok(settingsState.children > 0);\n\n  await delay(1000);"
settings_insert = r'''  assert.ok(settingsState.children > 0);

  const tabsSwitched = await evaluate(cdp, `(() => {
    const main = document.querySelector('#app .patch-window[data-patch-window-id="main"]');
    const settings = document.querySelector('#app .patch-window[data-patch-window-id="settings"]');
    const tabs = settings?.querySelector('.patch-tabs[data-tabs-id="prefs"]');
    const buttons = tabs ? [...tabs.querySelectorAll('.patch-tab-button')] : [];
    if (!main || !settings || buttons.length < 2) return false;
    window.__patchMainBeforeTabSwitch = main;
    window.__patchSettingsBeforeTabSwitch = settings;
    buttons[1].click();
    return true;
  })()`);
  assert.equal(tabsSwitched, true);
  const tabState = await waitFor(cdp, `(() => {
    const main = document.querySelector('#app .patch-window[data-patch-window-id="main"]');
    const settings = document.querySelector('#app .patch-window[data-patch-window-id="settings"]');
    const tabs = settings?.querySelector('.patch-tabs[data-tabs-id="prefs"]');
    const buttons = tabs ? [...tabs.querySelectorAll('.patch-tab-button')] : [];
    return tabs ? {
      mainStable: window.__patchMainBeforeTabSwitch === main,
      settingsStable: window.__patchSettingsBeforeTabSwitch === settings,
      selected: buttons.map(button => button.getAttribute('aria-selected')),
      panel: tabs.querySelector('.patch-tab-panel')?.textContent ?? ''
    } : null;
  })()`, state => state?.selected?.[1] === 'true' && state.panel.includes('Labor approval limit'));
  assert.equal(tabState.mainStable, true, 'Tabs switch must not rebuild unrelated Forms');
  assert.equal(tabState.settingsStable, true, 'Tabs switch must keep its parent Form DOM identity');
  assert.equal(tabState.selected[0], 'false');
  assert.equal(tabState.selected[1], 'true');

  await delay(1000);'''
if settings_anchor not in workshop:
    raise SystemExit('Workshop settings tabs insertion anchor not found')
workshop = workshop.replace(settings_anchor, settings_insert, 1)
branch_files['workshop_test'].write_text(workshop)

roadmap = branch_files['roadmap'].read_text()
roadmap_old = '''- [x] primary `refreshDesigner()` consumes the shared declaration-only design cache instead of executing the Patch application; hosted/Offline Studio package the same design-model/cache modules\n\nRemaining R0 work:\n- [ ] share parsed/compiled AST/design snapshots across Designer adapters by project revision\n- [ ] true active-Form Designer materialization/virtualization rather than post-render hiding\n- [ ] preserve Object Inspector, selection, structural editing and Project Explorer across Form materialization\n- [ ] define and implement the Worker boundary for parse/compile/design-model work\n- [ ] bounded evaluation policy for any remaining design-time expressions\n- [ ] stable keyed Form/control identities in the browser runtime renderer\n- [ ] incremental event rendering with focus/caret/scroll/transient-selection preservation\n- [ ] avoid complete window-tree rebuild on Tabs page switches\n'''
roadmap_new = '''- [x] primary `refreshDesigner()` consumes the shared declaration-only design cache instead of executing the Patch application; hosted/Offline Studio package the same design-model/cache modules\n- [x] true active-Form Designer materialization keeps inactive Forms as lightweight source-backed shells while the active Form alone owns full control DOM\n- [x] Stage 1 keyed runtime Form/control identities reuse unchanged Form DOM across events and restore bounded focus, caret, scroll and unchanged-model multi-selection state when a changed Form is replaced\n- [x] Tabs page switches update only their local tab panel instead of rebuilding the complete runtime window tree\n\nRemaining R0 work:\n- [ ] share parsed/compiled AST/design snapshots across Designer adapters by project revision\n- [ ] preserve Object Inspector, selection, structural editing and Project Explorer across every Form materialization edge case\n- [ ] define and implement the Worker boundary for parse/compile/design-model work\n- [ ] bounded evaluation policy for any remaining design-time expressions\n- [ ] fine-grained keyed control reconciliation inside a changed Form rather than replacing that whole Form shell\n'''
if roadmap_old not in roadmap:
    raise SystemExit('ROADMAP R0 anchor not found')
roadmap = roadmap.replace(roadmap_old, roadmap_new, 1)
branch_files['roadmap'].write_text(roadmap)

backlog = branch_files['backlog'].read_text()
backlog_old = '''## P0.4 Incremental runtime renderer\n\n- [ ] stable keyed Form/control identities;\n- [ ] update only changed visible Forms/controls where safe;\n- [ ] preserve focus, caret, scroll and transient Table/Tree/List selections;\n- [ ] avoid complete app-tree rebuild on Tabs page changes;\n- [ ] deterministic full rerender fallback/debug mode;\n- [ ] event-to-paint regression gates.\n'''
backlog_new = '''## P0.4 Incremental runtime renderer\n\n- [x] stable keyed Form/control identities in the browser runtime surface;\n- [x] Stage 1 event reconciliation reuses unchanged Form DOM and replaces only changed Form shells;\n- [x] bounded focus, caret, Form/control scroll and unchanged-model multi-selection restoration across changed-Form replacement;\n- [x] Tabs page changes update only the local tab panel and preserve parent/unrelated Form DOM identity;\n- [ ] reconcile only changed controls inside a changed Form rather than replacing its complete shell;\n- [ ] preserve richer transient Table/Tree adapter selections through the same canonical keyed-state contract;\n- [ ] deterministic full rerender fallback/debug mode;\n- [ ] event-to-paint regression gates.\n'''
if backlog_old not in backlog:
    raise SystemExit('Backlog P0.4 anchor not found')
backlog = backlog.replace(backlog_old, backlog_new, 1)
branch_files['backlog'].write_text(backlog)

gpt = branch_files['gpt'].read_text()
gpt_old = '''Next R0 work:\n\n1. true active-Form Designer materialization/virtualization;\n2. share revision snapshots across remaining Designer adapters and define the Worker boundary;\n3. stable keyed/incremental runtime rendering with focus/caret/selection preservation;\n4. measurable Workshop/large-project performance gates;\n5. split runtime/render/build responsibilities out of `web/playground.js`;\n6. make Pages deployment release-aware without weakening fail-closed runtime verification.\n'''
gpt_new = '''Current R0 additions:\n\n- active-Form Designer materialization is real: inactive Forms remain lightweight shells;\n- Stage 1 keyed runtime reconciliation keeps unchanged Form DOM identities across events and restores bounded focus/caret/scroll state when a changed Form is replaced;\n- Tabs switch locally inside their panel instead of rebuilding the whole app tree.\n\nNext R0 work:\n\n1. share revision snapshots across remaining Designer adapters and define the Worker boundary;\n2. move from changed-Form replacement to fine-grained changed-control reconciliation;\n3. preserve richer transient Table/Tree adapter selection through the canonical keyed-state layer;\n4. measurable Workshop/large-project event-to-paint performance gates;\n5. split runtime/render/build responsibilities out of `web/playground.js`;\n6. make Pages deployment release-aware without weakening fail-closed runtime verification.\n'''
if gpt_old not in gpt:
    raise SystemExit('GPT R0 next-work anchor not found')
gpt = gpt.replace(gpt_old, gpt_new, 1)
branch_files['gpt'].write_text(gpt)
