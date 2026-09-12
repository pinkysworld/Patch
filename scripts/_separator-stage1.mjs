import fs from 'node:fs';
import { parseStudioProjectBundle, serializeStudioProjectBundle } from '../src/studio-project.js';

function replaceOnce(path, before, after, label = before.slice(0, 80)) {
  const source = fs.readFileSync(path, 'utf8');
  const count = source.split(before).length - 1;
  if (count !== 1) throw new Error(`${path}: expected one anchor for ${label}, found ${count}`);
  fs.writeFileSync(path, source.replace(before, after));
}

replaceOnce(
  'src/designer-shape.js',
  "export function updateDesignerShape(source, selector, changes = {}) {",
  `export function addDesignerSeparator(source, options = {}) {\n  const normalized = String(source ?? '').replace(/\\r\\n/g, '\\n');\n  const id = options.id === undefined\n    ? nextShapeId(listDesignerControls(normalized), 'separator')\n    : validId(options.id);\n  return addDesignerShape(normalized, {\n    ...options,\n    id,\n    shapeKind: 'line',\n    fill: 'transparent',\n    stroke: options.stroke ?? '#94a3b8',\n    strokeWidth: options.strokeWidth ?? 1,\n    cornerRadius: 0,\n    opacity: options.opacity ?? 1,\n    width: options.width ?? 180,\n    height: options.height ?? 16\n  });\n}\n\nexport function updateDesignerShape(source, selector, changes = {}) {`,
  'addDesignerSeparator export'
);
replaceOnce('src/designer-shape.js', 'function nextShapeId(controls) {', "function nextShapeId(controls, prefix = 'shape') {", 'separator id prefix helper');
replaceOnce('src/designer-shape.js', '    const id = `shape_${index}`;', '    const id = `${prefix}_${index}`;', 'separator id prefix allocation');

replaceOnce(
  'web/designer-workspace.js',
  `import {\n  addDesignerShape,\n  listDesignerShapes,`,
  `import {\n  addDesignerSeparator,\n  addDesignerShape,\n  listDesignerShapes,`,
  'workspace separator import'
);
replaceOnce(
  'web/designer-workspace.js',
  `    toolbar.appendChild(add);\n  }\n\n  const shapeFields = createShapeInspectorFields();`,
  `    toolbar.appendChild(add);\n  }\n\n  let addSeparator = toolbar.querySelector('#addSeparator');\n  if (!addSeparator) {\n    addSeparator = document.createElement('button');\n    addSeparator.id = 'addSeparator';\n    addSeparator.className = 'secondary small';\n    addSeparator.type = 'button';\n    addSeparator.textContent = '+ Separator';\n    addSeparator.setAttribute('aria-label', 'Add Separator');\n    addSeparator.title = 'Add a source-backed Separator preset using the canonical Shape line control';\n    add.insertAdjacentElement('afterend', addSeparator);\n  }\n\n  const shapeFields = createShapeInspectorFields();`,
  'workspace separator toolbar button'
);
replaceOnce(
  'web/designer-workspace.js',
  `  add.addEventListener('click', event => {\n    event.preventDefault();\n    event.stopImmediatePropagation();\n    try {\n      const windowIndex = Number(document.querySelector('#patchFormSelect')?.value) || 0;\n      const result = addDesignerShape(code.value, { windowIndex });\n      setShapeSource(code, result.source);\n      rememberDesignerSelection(canvas, designerSelectionForControl(result.shape, 'core'), { reason: 'add-shape' });\n      schedule();\n    } catch (error) {\n      showShapeError(error);\n    }\n  }, { capture: true });\n\n  shapeFields.querySelector('#designerShapeApply')?.addEventListener('click', () => applyShapeInspector(canvas, code, schedule));`,
  `  add.addEventListener('click', event => {\n    event.preventDefault();\n    event.stopImmediatePropagation();\n    try {\n      const windowIndex = Number(document.querySelector('#patchFormSelect')?.value) || 0;\n      const result = addDesignerShape(code.value, { windowIndex });\n      setShapeSource(code, result.source);\n      rememberDesignerSelection(canvas, designerSelectionForControl(result.shape, 'core'), { reason: 'add-shape' });\n      schedule();\n    } catch (error) {\n      showShapeError(error);\n    }\n  }, { capture: true });\n\n  addSeparator.addEventListener('click', event => {\n    event.preventDefault();\n    event.stopImmediatePropagation();\n    try {\n      const windowIndex = Number(document.querySelector('#patchFormSelect')?.value) || 0;\n      const result = addDesignerSeparator(code.value, { windowIndex });\n      setShapeSource(code, result.source);\n      rememberDesignerSelection(canvas, designerSelectionForControl(result.shape, 'core'), { reason: 'add-separator' });\n      schedule();\n    } catch (error) {\n      showShapeError(error);\n    }\n  }, { capture: true });\n\n  shapeFields.querySelector('#designerShapeApply')?.addEventListener('click', () => applyShapeInspector(canvas, code, schedule));`,
  'workspace separator click handler'
);
replaceOnce(
  'web/designer-workspace.js',
  "  hint.textContent = 'Designer-only Shape Stage 1. Web and native build targets remain capability-gated until their renderer slices land.';",
  "  hint.textContent = 'Shape is source-backed across Studio/Web and current desktop-native targets. Separator is the canonical Shape line preset and follows the same target support.';",
  'shape inspector target hint'
);

replaceOnce(
  'tests/designer-shape-studio.test.js',
  "import { addDesignerShape, listDesignerShapes, updateDesignerShape } from '../src/designer-shape.js';",
  "import { addDesignerSeparator, addDesignerShape, listDesignerShapes, updateDesignerShape } from '../src/designer-shape.js';",
  'shape test separator import'
);
replaceOnce(
  'tests/designer-shape-studio.test.js',
  `test('Shape Studio renderer is wired to the canonical Shape API and shared selection', () => {`,
  `test('Separator Stage 1 is a canonical Shape line Designer preset', () => {\n  const first = addDesignerSeparator('window "Demo" as main size 640, 420:\\n', { windowIndex: 0 });\n  assert.match(first.source, /shape line as separator_1 fill transparent stroke #94a3b8 stroke-width 1 radius 0 opacity 1 at 24, 24 size 180, 16/);\n  const second = addDesignerSeparator(first.source, { windowIndex: 0 });\n  assert.match(second.source, /shape line as separator_2 fill transparent stroke #94a3b8 stroke-width 1 radius 0 opacity 1/);\n  const separators = listDesignerShapes(second.source).filter(shape => shape.id?.startsWith('separator_'));\n  assert.equal(separators.length, 2);\n  assert.equal(separators.every(shape => shape.shapeKind === 'line'), true);\n});\n\ntest('Shape Studio renderer is wired to the canonical Shape API and shared selection', () => {`,
  'separator source-backed test'
);
replaceOnce(
  'tests/designer-shape-studio.test.js',
  "  assert.match(workspace, /id = 'addShape'/);",
  "  assert.match(workspace, /id = 'addShape'/);\n  assert.match(workspace, /id = 'addSeparator'/);\n  assert.match(workspace, /textContent = '\\+ Separator'/);\n  assert.match(workspace, /addDesignerSeparator\\(code\\.value, \\{ windowIndex \\}\\)/);",
  'separator Studio wiring assertions'
);

replaceOnce(
  'docs/RAD_STUDIO_MASTER_BACKLOG.md',
  '- [ ] Separator;',
  '- [x] Separator Stage 1: Designer preset over the canonical `shape line` control, source-backed with `separator_N` ids, Studio/Web and current Windows/macOS/Linux native Shape support without a new language or IR control type;',
  'backlog separator completion'
);
replaceOnce(
  'docs/ROADMAP.md',
  '- [x] LinkLabel as `# @button-mode link` presentation of ordinary Button, Studio/Web link styling with ordinary `clicked` semantics, no implicit navigation and Current Ready native fail-closed\n- [x] CheckedListBox',
  '- [x] LinkLabel as `# @button-mode link` presentation of ordinary Button, Studio/Web link styling with ordinary `clicked` semantics, no implicit navigation and Current Ready native fail-closed\n- [x] Separator as a source-backed Designer preset over canonical `shape line`, retaining existing Shape Web/native support and requiring no language or IR version bump\n- [x] CheckedListBox',
  'roadmap separator completion'
);
replaceOnce(
  'docs/STUDIO_AUTHORING_SURFACE.md',
  '- LinkLabel as ordinary Button plus `# @button-mode link`, preserving the ordinary `clicked` event without implicit browser navigation;\n- CheckedListBox',
  '- LinkLabel as ordinary Button plus `# @button-mode link`, preserving the ordinary `clicked` event without implicit browser navigation;\n- Separator as a Designer preset that writes an ordinary `shape line` with a `separator_N` id, so the source remains portable and uses the existing Shape renderer/native contract;\n- CheckedListBox',
  'authoring surface separator entry'
);
replaceOnce(
  'README.md',
  '- source-backed Studio/Web R4 presentations for PasswordEdit, MaskedEdit, NumberEdit, DatePicker, TimePicker, Calendar, LinkLabel, CheckedListBox, ProgressBar, GroupBox, ScrollBox, and SplitContainer, with unsupported Current Ready native combinations failing closed;\n- active-Form Designer materialization',
  '- source-backed Studio/Web R4 presentations for PasswordEdit, MaskedEdit, NumberEdit, DatePicker, TimePicker, Calendar, LinkLabel, CheckedListBox, ProgressBar, GroupBox, ScrollBox, and SplitContainer, with unsupported Current Ready native combinations failing closed;\n- Separator Stage 1 as a source-backed Designer preset over canonical `shape line`, preserving the existing Studio/Web and current desktop-native Shape contract;\n- active-Form Designer materialization',
  'README separator feature'
);
replaceOnce(
  'web/index.html',
  'Patch Studio beta.36+: source-backed RAD development with Project v4, Calendar, LinkLabel and current R4 Studio/Web presentations, plus verified Native GUI IR 1.9 / runtime v1.10 Ready builds.',
  'Patch Studio beta.36+: source-backed RAD development with Project v4, Calendar, LinkLabel, Separator and current R4 Studio/Web presentations, plus verified Native GUI IR 1.9 / runtime v1.10 Ready builds.',
  'public site separator metadata'
);

replaceOnce(
  'examples/patch-studio-showcase/forms.patch',
  '    row "LinkLabel", "Button link presentation", "Studio/Web"\n    row "CheckedListBox",',
  '    row "LinkLabel", "Button link presentation", "Studio/Web"\n    row "Separator", "Shape line Designer preset", "Ready"\n    row "CheckedListBox",',
  'showcase separator row'
);
replaceOnce(
  'examples/patch-studio-showcase/forms.patch',
  '        node "Shape"\n        node "PaintBox"',
  '        node "Shape"\n        node "Separator"\n        node "PaintBox"',
  'showcase separator tree node'
);
replaceOnce(
  'examples/patch-studio-showcase/forms.patch',
  '  paintbox as gallery_canvas at 888, 204 size 148, 116\n  text "Both remain source-visible and deterministic." at 728, 342 size 288, 44',
  '  paintbox as gallery_canvas at 888, 204 size 148, 116\n  text "Separator preset" at 728, 326 size 160, 20\n  # @locked\n  shape line as gallery_separator fill transparent stroke #94a3b8 stroke-width 1 radius 0 opacity 1 at 728, 350 size 308, 16\n  text "All graphics remain source-visible and deterministic." at 728, 374 size 288, 32',
  'showcase separator visual'
);
replaceOnce(
  'examples/patch-studio-showcase/README.md',
  '- LinkLabel as ordinary Button plus source-backed `# @button-mode link`, retaining the normal `clicked` event without implicit navigation;\n- CheckedListBox',
  '- LinkLabel as ordinary Button plus source-backed `# @button-mode link`, retaining the normal `clicked` event without implicit navigation;\n- Separator as the source-backed Designer preset over ordinary `shape line`, keeping existing Shape Web/native portability;\n- CheckedListBox',
  'showcase README separator coverage'
);
replaceOnce(
  'tests/studio-showcase.test.js',
  '  assert.match(forms, /row "LinkLabel", "Button link presentation", "Studio\\/Web"/);',
  '  assert.match(forms, /row "LinkLabel", "Button link presentation", "Studio\\/Web"/);\n  assert.match(forms, /row "Separator", "Shape line Designer preset", "Ready"/);\n  assert.match(forms, /shape line as gallery_separator fill transparent stroke #94a3b8 stroke-width 1 radius 0 opacity 1/);',
  'showcase separator assertions'
);
replaceOnce(
  'tests/studio-showcase.test.js',
  '  assert.match(composition.source, /# @button-mode link/);\n  assert.match(composition.source, /# @listbox-mode checked/);',
  '  assert.match(composition.source, /# @button-mode link/);\n  assert.match(composition.source, /shape line as gallery_separator/);\n  assert.match(composition.source, /# @listbox-mode checked/);',
  'showcase compiled source separator assertion'
);

const projectPath = 'examples/patch-studio-showcase.patchproject';
const bundle = parseStudioProjectBundle(fs.readFileSync(projectPath, 'utf8'));
for (const file of bundle.files) {
  file.content = fs.readFileSync(`examples/patch-studio-showcase/${file.path}`, 'utf8');
}
const canonical = serializeStudioProjectBundle(bundle);
if (canonical.includes('`')) throw new Error('Showcase canonical JSON unexpectedly contains a backtick.');
fs.writeFileSync(projectPath, canonical);

const embeddedPath = 'web/studio-showcase-project.js';
const embedded = fs.readFileSync(embeddedPath, 'utf8');
const marker = 'export const PATCH_STUDIO_SHOWCASE_PROJECT = String.raw`';
const start = embedded.indexOf(marker);
if (start < 0) throw new Error('Showcase embedded-project marker is missing.');
const contentStart = start + marker.length;
const end = embedded.indexOf('`;', contentStart);
if (end < contentStart) throw new Error('Showcase embedded-project terminator is missing.');
fs.writeFileSync(embeddedPath, embedded.slice(0, contentStart) + canonical + embedded.slice(end));

console.log('Separator Stage 1 patch applied.');
