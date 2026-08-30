from pathlib import Path

path = Path('tests/workshop-desk-browser.test.js')
text = path.read_text()

anchor = """  assert.ok(designerState.controlsByForm[0] > 0, 'active Workshop Form should materialize its control DOM');
  assert.ok(designerState.controlsByForm.slice(1).every(count => count === 0), 'inactive Workshop Forms should remain lightweight shells');

  const switchedDesignerForm = await evaluate(cdp, `(() => {
"""
insert = """  assert.ok(designerState.controlsByForm[0] > 0, 'active Workshop Form should materialize its control DOM');
  assert.ok(designerState.controlsByForm.slice(1).every(count => count === 0), 'inactive Workshop Forms should remain lightweight shells');

  const selectedDesignerTable = await evaluate(cdp, `(() => {
    const table = document.querySelector('#designerCanvas .patch-table-stage1-control[data-window-index=\"0\"]');
    if (!table) return false;
    table.click();
    return true;
  })()`);
  assert.equal(selectedDesignerTable, true);
  const selectedDesignerState = await waitFor(cdp, `(() => ({
    selected: !!document.querySelector('#designerCanvas .patch-table-stage1-control[data-window-index=\"0\"].designer-selected'),
    inspectorType: document.querySelector('#designerInspectorType')?.textContent ?? '',
    editorHidden: document.querySelector('[data-designer-data-editor]')?.hidden ?? true,
    activeFile: document.querySelector('#projectOutlineTree .outline-file[aria-current=\"true\"]')?.textContent ?? '',
    rowAction: document.querySelector('[data-table-action-row]')?.value ?? ''
  }))()`, state => state?.selected === true && state.inspectorType === 'Table' && state.editorHidden === false && state.activeFile.includes('main.patch'));
  assert.equal(selectedDesignerState.selected, true);
  assert.equal(selectedDesignerState.inspectorType, 'Table');
  assert.equal(selectedDesignerState.editorHidden, false);
  assert.match(selectedDesignerState.activeFile, /main\.patch/);

  const rememberedTableRow = await evaluate(cdp, `(() => {
    const select = document.querySelector('[data-table-action-row]');
    if (!select || select.options.length < 3) return false;
    select.value = '2';
    select.dispatchEvent(new Event('change', { bubbles: true }));
    return select.value === '2';
  })()`);
  assert.equal(rememberedTableRow, true, 'Table structural editor should expose row selection memory before materialization switch');

  const switchedDesignerForm = await evaluate(cdp, `(() => {
"""
if text.count(anchor) != 1:
    raise SystemExit(f'expected one initial Designer switch anchor, found {text.count(anchor)}')
text = text.replace(anchor, insert, 1)

old_settings = """  const materializedSettings = await waitFor(cdp, `(() => ({
    active: document.querySelector('#designerCanvas')?.dataset?.patchDesignerMaterializedForm ?? '',
    controls: [...document.querySelectorAll('#designerCanvas .patch-window')].map(form => form.querySelectorAll('.designer-control').length),
    leaks: [...document.querySelectorAll('#designerCanvas .patch-window')].map((form, index) => index === 1 ? [] : [...form.querySelectorAll('.designer-control')].map(control => ({ className: control.className?.baseVal ?? control.className ?? '', tag: control.tagName, id: control.id ?? '', type: control.dataset?.componentType ?? control.dataset?.patchControlType ?? '' })))
  }))()`, state => state?.active === '1' && state.controls?.[1] > 0 && state.controls.every((count, index) => index === 1 ? count > 0 : count === 0));
  assert.equal(materializedSettings.controls[0], 0, JSON.stringify(materializedSettings.leaks));
  assert.ok(materializedSettings.controls[1] > 0);
  assert.ok(materializedSettings.controls.slice(2).every(count => count === 0), JSON.stringify(materializedSettings.leaks));
"""
new_settings = """  const materializedSettings = await waitFor(cdp, `(() => ({
    active: document.querySelector('#designerCanvas')?.dataset?.patchDesignerMaterializedForm ?? '',
    controls: [...document.querySelectorAll('#designerCanvas .patch-window')].map(form => form.querySelectorAll('.designer-control').length),
    leaks: [...document.querySelectorAll('#designerCanvas .patch-window')].map((form, index) => index === 1 ? [] : [...form.querySelectorAll('.designer-control')].map(control => ({ className: control.className?.baseVal ?? control.className ?? '', tag: control.tagName, id: control.id ?? '', type: control.dataset?.componentType ?? control.dataset?.patchControlType ?? '' }))),
    inspectorType: document.querySelector('#designerInspectorType')?.textContent ?? '',
    editorHidden: document.querySelector('[data-designer-data-editor]')?.hidden ?? true,
    activeFile: document.querySelector('#projectOutlineTree .outline-file[aria-current=\"true\"]')?.textContent ?? '',
    oldFormSelectedDom: document.querySelectorAll('#designerCanvas .patch-window:nth-child(1) .designer-selected').length
  }))()`, state => state?.active === '1'
    && state.controls?.[1] > 0
    && state.controls.every((count, index) => index === 1 ? count > 0 : count === 0)
    && state.inspectorType === 'Table'
    && state.editorHidden === false
    && state.activeFile.includes('main.patch'));
  assert.equal(materializedSettings.controls[0], 0, JSON.stringify(materializedSettings.leaks));
  assert.ok(materializedSettings.controls[1] > 0);
  assert.ok(materializedSettings.controls.slice(2).every(count => count === 0), JSON.stringify(materializedSettings.leaks));
  assert.equal(materializedSettings.oldFormSelectedDom, 0, 'inactive Form should keep no selected DOM while source selection remains remembered');
  assert.equal(materializedSettings.inspectorType, 'Table', 'Object Inspector should stay bound to the source-selected Table while its Form is a shell');
  assert.equal(materializedSettings.editorHidden, false, 'structural Table editor should stay available through Form materialization');
  assert.match(materializedSettings.activeFile, /main\.patch/, 'Project Tree active file must not change during Form materialization');
"""
if text.count(old_settings) != 1:
    raise SystemExit(f'expected one materialized settings block, found {text.count(old_settings)}')
text = text.replace(old_settings, new_settings, 1)

old_back = """  await waitFor(cdp, `(() => ({
    active: document.querySelector('#designerCanvas')?.dataset?.patchDesignerMaterializedForm ?? '',
    controls: [...document.querySelectorAll('#designerCanvas .patch-window')].map(form => form.querySelectorAll('.designer-control').length)
  }))()`, state => state?.active === '0' && state.controls?.[0] > 0 && state.controls.slice(1).every(count => count === 0));
"""
new_back = """  const restoredDesignerSelection = await waitFor(cdp, `(() => ({
    active: document.querySelector('#designerCanvas')?.dataset?.patchDesignerMaterializedForm ?? '',
    controls: [...document.querySelectorAll('#designerCanvas .patch-window')].map(form => form.querySelectorAll('.designer-control').length),
    selected: !!document.querySelector('#designerCanvas .patch-table-stage1-control[data-window-index=\"0\"].designer-selected'),
    inspectorType: document.querySelector('#designerInspectorType')?.textContent ?? '',
    editorHidden: document.querySelector('[data-designer-data-editor]')?.hidden ?? true,
    activeFile: document.querySelector('#projectOutlineTree .outline-file[aria-current=\"true\"]')?.textContent ?? '',
    rowAction: document.querySelector('[data-table-action-row]')?.value ?? ''
  }))()`, state => state?.active === '0'
    && state.controls?.[0] > 0
    && state.controls.slice(1).every(count => count === 0)
    && state.selected === true
    && state.inspectorType === 'Table'
    && state.editorHidden === false
    && state.activeFile.includes('main.patch')
    && state.rowAction === '2');
  assert.equal(restoredDesignerSelection.selected, true, 'source-selected Table should regain selected DOM when its Form rematerializes');
  assert.equal(restoredDesignerSelection.inspectorType, 'Table');
  assert.equal(restoredDesignerSelection.editorHidden, false);
  assert.match(restoredDesignerSelection.activeFile, /main\.patch/);
  assert.equal(restoredDesignerSelection.rowAction, '2', 'Table structural row selection should survive Form materialization round-trip');
"""
if text.count(old_back) != 1:
    raise SystemExit(f'expected one return materialization block, found {text.count(old_back)}')
text = text.replace(old_back, new_back, 1)

path.write_text(text)
