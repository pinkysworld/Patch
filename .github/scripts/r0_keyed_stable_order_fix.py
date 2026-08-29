from pathlib import Path

playground_path = Path('web/playground.js')
playground = playground_path.read_text()
old = '''  const desired = [];
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
'''
new = '''  const desired = [];
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
  restoreRuntimeTransientState(container, transient);
'''
if old not in playground:
    raise SystemExit('runtime reconciliation order anchor not found')
playground_path.write_text(playground.replace(old, new, 1))

unit_path = Path('tests/studio-runtime-keyed-renderer.test.js')
unit = unit_path.read_text()
old_unit = "  assert.match(playground, /patchRuntimeReconcile = 'keyed-window-v1'/);\n"
new_unit = old_unit + "  assert.match(playground, /patchRuntimeReusedForms/);\n  assert.match(playground, /container\\.insertBefore\\(shell, current\\)/);\n"
if old_unit not in unit:
    raise SystemExit('keyed renderer unit anchor not found')
unit_path.write_text(unit.replace(old_unit, new_unit, 1))

browser_path = Path('tests/workshop-desk-browser.test.js')
browser = browser_path.read_text()
old_state = "      reconcile: document.querySelector('#app')?.dataset?.patchRuntimeReconcile ?? '',\n      key: input.dataset.patchControlKey ?? ''\n"
new_state = "      reconcile: document.querySelector('#app')?.dataset?.patchRuntimeReconcile ?? '',\n      reusedForms: Number(document.querySelector('#app')?.dataset?.patchRuntimeReusedForms ?? 0),\n      replacedForms: Number(document.querySelector('#app')?.dataset?.patchRuntimeReplacedForms ?? 0),\n      key: input.dataset.patchControlKey ?? ''\n"
if old_state not in browser:
    raise SystemExit('Workshop keyed state anchor not found')
browser = browser.replace(old_state, new_state, 1)
old_assert = "  assert.equal(keyedInputState.settingsStable, true, 'unchanged hidden Form DOM should retain identity across an event');\n  assert.equal(keyedInputState.selectionStart, 5);\n"
new_assert = "  assert.equal(keyedInputState.settingsStable, true, 'unchanged hidden Form DOM should retain identity across an event');\n  assert.ok(keyedInputState.reusedForms >= 1, `expected keyed Form reuse, got ${JSON.stringify(keyedInputState)}`);\n  assert.ok(keyedInputState.replacedForms >= 1, `expected a changed Form replacement, got ${JSON.stringify(keyedInputState)}`);\n  assert.equal(keyedInputState.selectionStart, 5);\n"
if old_assert not in browser:
    raise SystemExit('Workshop keyed assertion anchor not found')
browser_path.write_text(browser.replace(old_assert, new_assert, 1))
