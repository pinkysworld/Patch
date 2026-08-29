from pathlib import Path


def replace_once(path, old, new):
    p = Path(path)
    text = p.read_text()
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{path}: expected one guarded match, found {count}: {old!r}")
    p.write_text(text.replace(old, new, 1))


replace_once(
    'web/table-stage1.js',
    "    for (const old of body.querySelectorAll(':scope > .patch-table-stage1-control')) old.remove();\n    if (designer && Number.isInteger(materializedWindow) && windowIndex !== materializedWindow) return;",
    "    for (const old of body.querySelectorAll(':scope > .patch-table-stage1-control')) old.remove();\n    if (!designer && shell.dataset.patchRenderDetail === 'deferred') return;\n    if (designer && Number.isInteger(materializedWindow) && windowIndex !== materializedWindow) return;"
)

replace_once(
    'web/designer-statusbar.js',
    "    const body = shell.querySelector(':scope > .patch-window-body');\n    if (!body) return;\n    if (isDesigner && Number.isInteger(materializedWindow) && windowIndex !== materializedWindow) {",
    "    const body = shell.querySelector(':scope > .patch-window-body');\n    if (!body) return;\n    if (!isDesigner && shell.dataset.patchRenderDetail === 'deferred') {\n      for (const stale of body.querySelectorAll(':scope > .patch-statusbar[data-patch-statusbar-adapter=\"true\"]')) stale.remove();\n      return;\n    }\n    if (isDesigner && Number.isInteger(materializedWindow) && windowIndex !== materializedWindow) {"
)

branding = Path('tests/studio-branding.test.js')
text = branding.read_text()
needle = "  assert.match(playground, /runInProgress = false/);\n});\n"
replacement = "  assert.match(playground, /runInProgress = false/);\n});\n\ntest('runtime adapters preserve hidden Form deferral', () => {\n  const table = fs.readFileSync('web/table-stage1.js', 'utf8');\n  const statusbar = fs.readFileSync('web/designer-statusbar.js', 'utf8');\n  assert.match(table, /!designer && shell\\.dataset\\.patchRenderDetail === 'deferred'/);\n  assert.match(statusbar, /!isDesigner && shell\\.dataset\\.patchRenderDetail === 'deferred'/);\n});\n"
if needle not in text:
    raise SystemExit('tests/studio-branding.test.js: expected runtime adapter insertion point not found')
branding.write_text(text.replace(needle, replacement, 1))

browser = Path('tests/workshop-desk-browser.test.js')
b = browser.read_text()
old = "    settingsChildren: document.querySelector('#app .patch-window[data-patch-window-id=\"settings\"] .patch-window-body')?.childElementCount ?? -1,\n    output: document.querySelector('#output')?.textContent ?? ''"
new = "    settingsChildren: document.querySelector('#app .patch-window[data-patch-window-id=\"settings\"] .patch-window-body')?.childElementCount ?? -1,\n    hiddenChildren: [...document.querySelectorAll('#app .patch-window')].filter(node => node.hidden).map(node => node.querySelector('.patch-window-body')?.childElementCount ?? -1),\n    output: document.querySelector('#output')?.textContent ?? ''"
if old not in b:
    raise SystemExit('tests/workshop-desk-browser.test.js: app-state insertion point missing')
b = b.replace(old, new, 1)
old = "  assert.equal(appState.settingsChildren, 0);"
new = "  assert.equal(appState.settingsChildren, 0);\n  assert.ok(appState.hiddenChildren.every(count => count === 0), `deferred Form bodies must stay empty: ${JSON.stringify(appState.hiddenChildren)}`);"
if old not in b:
    raise SystemExit('tests/workshop-desk-browser.test.js: hidden-body assertion point missing')
browser.write_text(b.replace(old, new, 1))

Path('.github/scripts/r0_runtime_adapter_defer_once.py').unlink(missing_ok=True)
