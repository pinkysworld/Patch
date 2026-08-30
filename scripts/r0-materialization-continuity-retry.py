from pathlib import Path
import re


def replace_once(path, old, new):
    file = Path(path)
    text = file.read_text()
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{path}: expected one match, found {count}')
    file.write_text(text.replace(old, new, 1))


replace_once(
    'web/designer-selection.js',
    """export function restoreDesignerAdapterSelection(canvas, adapter, findElement) {
  const selection = currentDesignerSelection(canvas, adapter);
  if (!selection) return null;
  const element = typeof findElement === 'function' ? findElement(selection) : null;
  if (!element) {
    clearDesignerSelection(canvas, { adapter, reason: 'missing-control' });
    return null;
  }
  selectDesignerElement(canvas, element, selection, { emit: false, reason: 'restore' });
  return element;
}""",
    """export function restoreDesignerAdapterSelection(canvas, adapter, findElement, options = {}) {
  const selection = currentDesignerSelection(canvas, adapter);
  if (!selection) return null;
  const element = typeof findElement === 'function' ? findElement(selection) : null;
  if (!element) {
    const sourceStillLive = typeof options.isLive === 'function' && options.isLive(selection);
    if (sourceStillLive) return null;
    clearDesignerSelection(canvas, { adapter, reason: 'missing-control' });
    return null;
  }
  selectDesignerElement(canvas, element, selection, { emit: false, reason: 'restore' });
  return element;
}""",
)

replace_once(
    'web/table-stage1.js',
    "  if (designer) restoreDesignerAdapterSelection(designerCanvas, 'table', tableElement);",
    """  if (designer) restoreDesignerAdapterSelection(designerCanvas, 'table', tableElement, {
    isLive: selection => listDesignerControls(code.value).some(item =>
      item.windowIndex === selection.windowIndex &&
      item.controlIndex === selection.controlIndex &&
      item.type === 'table'
    )
  });""",
)

replace_once(
    'web/tree-designer.js',
    "  restoreDesignerAdapterSelection(canvas, 'tree', treeElement);",
    """  restoreDesignerAdapterSelection(canvas, 'tree', treeElement, {
    isLive: selection => controls.some(item =>
      item.windowIndex === selection.windowIndex &&
      item.controlIndex === selection.controlIndex &&
      item.type === 'tree'
    )
  });""",
)

replace_once(
    'web/designer-data-editor.js',
    "import { installDesignerStructuralKeyboard } from './designer-structural-keyboard.js';",
    """import { installDesignerStructuralKeyboard } from './designer-structural-keyboard.js';
import { currentDesignerSelection } from './designer-selection.js';""",
)

replace_once(
    'web/designer-data-editor.js',
    """function selectedControl() {
  const element = canvas.querySelector('.designer-control.designer-selected[data-window-index][data-control-index]');
  if (!element) return null;
  const windowIndex = Number(element.dataset.windowIndex);
  const controlIndex = Number(element.dataset.controlIndex);
  if (!Number.isInteger(windowIndex) || !Number.isInteger(controlIndex)) return null;
  return listDesignerControls(code.value).find(item => item.windowIndex === windowIndex && item.controlIndex === controlIndex) ?? null;
}""",
    """function selectedControl() {
  const selection = currentDesignerSelection(canvas);
  if (!selection) return null;
  return listDesignerControls(code.value).find(item =>
    item.windowIndex === selection.windowIndex && item.controlIndex === selection.controlIndex
  ) ?? null;
}""",
)

forms = Path('web/forms-designer.js')
forms_text = forms.read_text()
pattern = re.compile(
    r"\n  if \(designer && selectedForm !== null && selectedForm !== activeForm\) \{\n"
    r"    activeForm = selectedForm;\n"
    r"    syncFormTools\(\);\n"
    r"  \}\n\}"
)
replacement = """
  const materializedForm = designer ? Number(container.dataset.patchDesignerMaterializedForm) : null;
  const waitingForRequestedForm = designer && Number.isInteger(materializedForm) && materializedForm !== activeForm;
  if (designer && !waitingForRequestedForm && selectedForm !== null && selectedForm !== activeForm) {
    activeForm = selectedForm;
    syncFormTools();
  }
}"""
forms_text, count = pattern.subn(replacement, forms_text, count=1)
if count != 1:
    raise SystemExit(f'web/forms-designer.js: expected one active-form follow block, found {count}')
forms.write_text(forms_text)

anchor = """  assert.ok(designerState.controlsByForm[0] > 0, 'active Workshop Form should materialize its control DOM');
  assert.ok(designerState.controlsByForm.slice(1).every(count => count === 0), 'inactive Workshop Forms should remain lightweight shells');

  const switchedDesignerForm = await evaluate(cdp, `(() => {"""
replacement = """  assert.ok(designerState.controlsByForm[0] > 0, 'active Workshop Form should materialize its control DOM');
  assert.ok(designerState.controlsByForm.slice(1).every(count => count === 0), 'inactive Workshop Forms should remain lightweight shells');

  const continuitySelectionStarted = await evaluate(cdp, `(() => {
    const table = document.querySelector('#designerCanvas .patch-table-stage1-control[data-control-id="board"]');
    if (!table) return false;
    table.click();
    return true;
  })()`);
  assert.equal(continuitySelectionStarted, true);
  const continuityBeforeSwitch = await waitFor(cdp, `(() => ({
    objectValue: document.querySelector('#designerObjectSelect')?.value ?? '',
    inspectorVisible: document.querySelector('#designerInspectorForm')?.hidden === false,
    dataEditorVisible: document.querySelector('[data-designer-data-editor]')?.hidden === false,
    dataEditorHeading: document.querySelector('[data-designer-data-editor] .designer-data-editor-head strong')?.textContent ?? '',
    projectTree: document.querySelector('#projectOutlineTree')?.textContent ?? '',
    selectedTables: document.querySelectorAll('#designerCanvas .patch-table-stage1-control.designer-selected').length
  }))()`, state => state?.objectValue?.startsWith('0:') && state.inspectorVisible === true
    && state.dataEditorVisible === true && state.dataEditorHeading === 'Table data' && state.selectedTables === 1);
  assert.match(continuityBeforeSwitch.projectTree, /main\\.patch/);

  const switchedDesignerForm = await evaluate(cdp, `(() => {"""
replace_once('tests/workshop-desk-browser.test.js', anchor, replacement)

anchor = """  assert.equal(materializedSettings.controls[0], 0, JSON.stringify(materializedSettings.leaks));
  assert.ok(materializedSettings.controls[1] > 0);
  assert.ok(materializedSettings.controls.slice(2).every(count => count === 0), JSON.stringify(materializedSettings.leaks));

  await evaluate(cdp, `(() => {"""
replacement = """  assert.equal(materializedSettings.controls[0], 0, JSON.stringify(materializedSettings.leaks));
  assert.ok(materializedSettings.controls[1] > 0);
  assert.ok(materializedSettings.controls.slice(2).every(count => count === 0), JSON.stringify(materializedSettings.leaks));
  const continuityWhileInactive = await waitFor(cdp, `(() => ({
    selectValue: document.querySelector('#patchFormSelect')?.value ?? '',
    objectValue: document.querySelector('#designerObjectSelect')?.value ?? '',
    inspectorVisible: document.querySelector('#designerInspectorForm')?.hidden === false,
    dataEditorVisible: document.querySelector('[data-designer-data-editor]')?.hidden === false,
    dataEditorHeading: document.querySelector('[data-designer-data-editor] .designer-data-editor-head strong')?.textContent ?? '',
    projectTree: document.querySelector('#projectOutlineTree')?.textContent ?? '',
    selectedTables: document.querySelectorAll('#designerCanvas .patch-table-stage1-control.designer-selected').length
  }))()`, state => state?.selectValue === '1' && state.objectValue === continuityBeforeSwitch.objectValue
    && state.inspectorVisible === true && state.dataEditorVisible === true
    && state.dataEditorHeading === 'Table data' && state.selectedTables === 0);
  assert.equal(continuityWhileInactive.projectTree, continuityBeforeSwitch.projectTree, 'Project Tree should remain stable across Form materialization');

  await evaluate(cdp, `(() => {"""
replace_once('tests/workshop-desk-browser.test.js', anchor, replacement)

anchor = """  await waitFor(cdp, `(() => ({
    active: document.querySelector('#designerCanvas')?.dataset?.patchDesignerMaterializedForm ?? '',
    controls: [...document.querySelectorAll('#designerCanvas .patch-window')].map(form => form.querySelectorAll('.designer-control').length)
  }))()`, state => state?.active === '0' && state.controls?.[0] > 0 && state.controls.slice(1).every(count => count === 0));

  // The reported failure appears after the initial render."""
replacement = """  await waitFor(cdp, `(() => ({
    active: document.querySelector('#designerCanvas')?.dataset?.patchDesignerMaterializedForm ?? '',
    controls: [...document.querySelectorAll('#designerCanvas .patch-window')].map(form => form.querySelectorAll('.designer-control').length)
  }))()`, state => state?.active === '0' && state.controls?.[0] > 0 && state.controls.slice(1).every(count => count === 0));
  const continuityAfterReturn = await waitFor(cdp, `(() => ({
    objectValue: document.querySelector('#designerObjectSelect')?.value ?? '',
    dataEditorVisible: document.querySelector('[data-designer-data-editor]')?.hidden === false,
    dataEditorHeading: document.querySelector('[data-designer-data-editor] .designer-data-editor-head strong')?.textContent ?? '',
    selectedTables: document.querySelectorAll('#designerCanvas .patch-table-stage1-control[data-control-id="board"].designer-selected').length
  }))()`, state => state?.objectValue === continuityBeforeSwitch.objectValue
    && state.dataEditorVisible === true && state.dataEditorHeading === 'Table data' && state.selectedTables === 1);
  assert.equal(continuityAfterReturn.selectedTables, 1, 'source-backed Table selection should restore when its Form rematerializes');

  // The reported failure appears after the initial render."""
replace_once('tests/workshop-desk-browser.test.js', anchor, replacement)
