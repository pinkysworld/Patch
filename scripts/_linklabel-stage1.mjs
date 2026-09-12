import fs from 'node:fs';

function edit(path, transform) {
  const before = fs.readFileSync(path, 'utf8');
  const after = transform(before);
  if (after === before) throw new Error(`No change made to ${path}`);
  fs.writeFileSync(path, after);
}
function once(source, before, after, label) {
  if (!source.includes(before)) throw new Error(`Missing anchor: ${label}`);
  return source.replace(before, after);
}

const moduleSource = `export const PATCH_WINDOW_BUTTON_PRESENTATION_VERSION = '0.1';
export const PATCH_WINDOW_BUTTON_PRESENTATION_FORMAT = 'patch-window-button-presentation';

const BUTTON_MODE_PREFIX_RE = /^\\s*#\\s*@button-mode\\b/i;
const METADATA_RE = /^\\s*#\\s*@(layout|taborder|locked|input-mode|input-mask|number-edit|listbox-mode|slider-mode|panel-mode|button-mode)\\b/i;
const DESIGNER_SELECTION_EVENT = 'patch-designer-selection-change';

export function normalizePatchButtonPresentation(mode) {
  const normalized = String(mode ?? 'plain').trim().toLowerCase() || 'plain';
  if (normalized !== 'plain' && normalized !== 'link') {
    throw new Error(\`Button presentation mode '\${mode}' is unsupported. Use plain or link.\`);
  }
  return normalized;
}

export function parsePatchButtonPresentationDirective(line) {
  const text = String(line ?? '');
  if (!BUTTON_MODE_PREFIX_RE.test(text)) return null;
  const match = text.match(/^\\s*#\\s*@button-mode\\s+(plain|link)\\s*$/i);
  if (!match) throw new Error(\`Invalid # @button-mode directive: \${text.trim()}. Use exactly '# @button-mode link'.\`);
  return normalizePatchButtonPresentation(match[1]);
}

export function formatPatchButtonPresentationDirective(mode) {
  const normalized = normalizePatchButtonPresentation(mode);
  return normalized === 'plain' ? null : \`# @button-mode \${normalized}\`;
}

export function buildWindowButtonPresentationManifest(source, ast) {
  const rows = sourceRows(source);
  const controls = [];
  walkControls(ast, node => {
    const mode = readButtonPresentationFromRows(rows, node.line);
    if (mode !== null && node.control !== 'button') {
      throw new Error(\`# @button-mode belongs only to Button controls, not '\${node.control}' on source line \${node.line ?? '?'}.\`);
    }
    if (node.control === 'button') controls.push({ line: node.line ?? null, id: node.id ?? null, mode: mode ?? 'plain' });
  });
  return validateWindowButtonPresentationManifest({
    format: PATCH_WINDOW_BUTTON_PRESENTATION_FORMAT,
    version: PATCH_WINDOW_BUTTON_PRESENTATION_VERSION,
    controls
  });
}

export function attachWindowButtonPresentations(ast, manifest) {
  validateWindowButtonPresentationManifest(manifest);
  const byLine = new Map(manifest.controls.map(control => [control.line, control.mode]));
  let attached = 0;
  walkControls(ast, node => {
    if (node.control !== 'button') return;
    Object.defineProperty(node, 'buttonPresentation', {
      value: normalizePatchButtonPresentation(byLine.get(node.line) ?? 'plain'),
      enumerable: true,
      configurable: true,
      writable: false
    });
    attached += 1;
  });
  if (attached !== manifest.controls.length) throw new Error('Window button presentation manifest does not match compiled Button controls.');
  return ast;
}

export function validateWindowButtonPresentationManifest(manifest) {
  if (!manifest || manifest.format !== PATCH_WINDOW_BUTTON_PRESENTATION_FORMAT || manifest.version !== PATCH_WINDOW_BUTTON_PRESENTATION_VERSION || !Array.isArray(manifest.controls)) {
    throw new Error('Window button presentation manifest format/version is unsupported.');
  }
  const lines = new Set();
  for (const control of manifest.controls) {
    if (!Number.isInteger(control?.line) || control.line < 1) throw new Error('Window button presentation control line is invalid.');
    if (lines.has(control.line)) throw new Error(\`Window button presentation source line \${control.line} appears more than once.\`);
    lines.add(control.line);
    control.mode = normalizePatchButtonPresentation(control.mode);
    if (control.id !== null && control.id !== undefined && !/^[A-Za-z_]\\w*$/.test(String(control.id))) throw new Error(\`Window button presentation id '\${control.id}' is invalid.\`);
  }
  return manifest;
}

export function readWindowButtonPresentation(source, sourceLine) {
  return readButtonPresentationFromRows(sourceRows(source), sourceLine) ?? 'plain';
}

export function setWindowButtonPresentation(source, sourceLine, mode) {
  const original = String(source ?? '').replace(/\\r\\n/g, '\\n');
  const rows = original.split('\\n');
  const normalized = normalizePatchButtonPresentation(mode);
  const lineIndex = Number(sourceLine) - 1;
  if (!Number.isInteger(lineIndex) || lineIndex < 0 || lineIndex >= rows.length || !/^\\s*button\\b/i.test(rows[lineIndex])) {
    throw new Error('Button presentation can only be changed on a Button control.');
  }
  let existingIndex = -1;
  for (let index = lineIndex - 1; index >= 0 && METADATA_RE.test(rows[index]); index -= 1) {
    if (!BUTTON_MODE_PREFIX_RE.test(rows[index])) continue;
    if (existingIndex >= 0) throw new Error(\`Button presentation is declared more than once before source line \${sourceLine}.\`);
    parsePatchButtonPresentationDirective(rows[index]);
    existingIndex = index;
  }
  const directive = formatPatchButtonPresentationDirective(normalized);
  if (!directive) {
    if (existingIndex >= 0) rows.splice(existingIndex, 1);
    return preserveTrailingNewline(original, rows.join('\\n'));
  }
  const indent = /^\\s*/.exec(rows[lineIndex])?.[0] ?? '';
  const rendered = \`\${indent}\${directive}\`;
  if (existingIndex >= 0) rows[existingIndex] = rendered;
  else rows.splice(lineIndex, 0, rendered);
  return preserveTrailingNewline(original, rows.join('\\n'));
}

export function collectWindowLinkLabelIds(source, ast) {
  const rows = sourceRows(source);
  const ids = [];
  walkControls(ast, node => {
    if (node.control !== 'button' || !node.id) return;
    if ((readButtonPresentationFromRows(rows, node.line) ?? 'plain') === 'link') ids.push(node.id);
  });
  return ids;
}

function readButtonPresentationFromRows(rows, sourceLine) {
  const lineIndex = Number(sourceLine) - 1;
  if (!Number.isInteger(lineIndex) || lineIndex < 1 || lineIndex >= rows.length) return null;
  let found = null;
  for (let index = lineIndex - 1; index >= 0 && METADATA_RE.test(rows[index]); index -= 1) {
    if (!BUTTON_MODE_PREFIX_RE.test(rows[index])) continue;
    if (found !== null) throw new Error(\`Button presentation is declared more than once before source line \${sourceLine}.\`);
    found = parsePatchButtonPresentationDirective(rows[index]);
  }
  return found;
}

function sourceRows(source) { return String(source ?? '').replace(/\\r\\n/g, '\\n').split('\\n'); }
function preserveTrailingNewline(original, text) { return text.replace(/\\s+$/, '') + (/\\n$/.test(String(original)) ? '\\n' : ''); }
function walkControls(nodes, visit) {
  for (const node of nodes ?? []) {
    if (node.kind === 'uiControl') visit(node);
    if (node.kind === 'window' || node.kind === 'tabPage' || node.kind === 'tabs' || (node.kind === 'uiControl' && node.control === 'panel')) walkControls(node.body, visit);
  }
}

if (typeof document !== 'undefined') queueMicrotask(installLinkLabelStudio);
let designerApiPromise = null;
let observer = null;
let syncQueued = false;
function designerApi() { designerApiPromise ??= import('./designer.js'); return designerApiPromise; }

function installLinkLabelStudio() {
  ensureLinkLabelButton();
  ensureLinkLabelInspector();
  installObservers();
  scheduleInspectorSync();
  if (!observer && document.body && !studioReady()) {
    observer = new MutationObserver(() => {
      ensureLinkLabelButton();
      ensureLinkLabelInspector();
      installObservers();
      if (studioReady()) { observer.disconnect(); observer = null; }
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }
}
function studioReady() { return Boolean(document.querySelector('#addLinkLabel') && document.querySelector('#designerInspectorButtonPresentationField')); }
function ensureLinkLabelButton() {
  const toolbar = document.querySelector('#designer .designer-toolbar');
  const anchor = toolbar?.querySelector('#addButton');
  if (!toolbar || !anchor || toolbar.querySelector('#addLinkLabel')) return Boolean(toolbar?.querySelector('#addLinkLabel'));
  const button = document.createElement('button');
  button.id = 'addLinkLabel'; button.className = 'secondary small'; button.type = 'button'; button.textContent = '+ LinkLabel';
  button.setAttribute('aria-label', 'Add LinkLabel');
  button.title = 'Add a source-backed LinkLabel. It remains a Button, uses # @button-mode link and keeps the ordinary clicked event.';
  anchor.insertAdjacentElement('afterend', button);
  button.addEventListener('click', addLinkLabelFromStudio);
  return true;
}
async function addLinkLabelFromStudio(event) {
  event?.preventDefault?.();
  const code = document.querySelector('#code'); if (!code) return;
  try {
    const api = await designerApi();
    const windowIndex = activeFormIndex();
    let next = api.addDesignerControl(code.value, 'button', { windowIndex });
    const control = api.listDesignerControls(next).filter(item => item.windowIndex === windowIndex && item.type === 'button').at(-1);
    if (!control) throw new Error('Designer created a Button but could not locate the LinkLabel preset.');
    next = setWindowButtonPresentation(next, control.line, 'link');
    setStudioSource(code, next);
    requestAnimationFrame(() => document.querySelector('#designerCanvas')?.querySelector(\`.designer-control[data-control-id="\${cssEscape(control.id ?? '')}"]\`)?.click?.());
  } catch (error) { showError(error); }
}
function ensureLinkLabelInspector() {
  const form = document.querySelector('#designerInspectorForm'); if (!form) return false;
  if (form.querySelector('#designerInspectorButtonPresentationField')) return true;
  const field = document.createElement('label');
  field.id = 'designerInspectorButtonPresentationField'; field.className = 'inspector-field'; field.hidden = true;
  field.innerHTML = \`Button mode<select id="designerInspectorButtonPresentation"><option value="plain">Button</option><option value="link">LinkLabel</option></select><small class="inspector-hint">Source-backed presentation. LinkLabel keeps the ordinary Button clicked event and has no implicit navigation.</small>\`;
  form.appendChild(field);
  field.querySelector('select')?.addEventListener('change', applyInspector);
  return true;
}
async function selectedTopLevelButton() {
  const canvas = document.querySelector('#designerCanvas'); const code = document.querySelector('#code');
  const element = canvas?.querySelector('.designer-control.designer-selected[data-window-index][data-control-index]');
  if (!canvas || !code || !element) return null;
  const windowIndex = Number(element.dataset.windowIndex); const controlIndex = Number(element.dataset.controlIndex);
  if (!Number.isInteger(windowIndex) || !Number.isInteger(controlIndex)) return null;
  try { const control = (await designerApi()).listDesignerControls(code.value).find(item => item.windowIndex === windowIndex && item.controlIndex === controlIndex); return control?.type === 'button' ? control : null; } catch { return null; }
}
async function syncInspector() {
  const field = document.querySelector('#designerInspectorButtonPresentationField'); const select = field?.querySelector('select'); const code = document.querySelector('#code');
  if (!field || !select) return; const control = await selectedTopLevelButton(); field.hidden = !control; if (!control || !code) return;
  try { if (document.activeElement !== select) select.value = readWindowButtonPresentation(code.value, control.line); } catch { field.hidden = true; }
}
async function applyInspector() {
  const code = document.querySelector('#code'); const select = document.querySelector('#designerInspectorButtonPresentation'); if (!code || !select) return;
  const control = await selectedTopLevelButton(); if (!control) return;
  try { setStudioSource(code, setWindowButtonPresentation(code.value, control.line, select.value)); } catch (error) { showError(error); }
}
function installObservers() {
  const code = document.querySelector('#code'); const canvas = document.querySelector('#designerCanvas');
  if (code?.dataset.patchButtonPresentationObserver !== '1') { code.dataset.patchButtonPresentationObserver = '1'; code.addEventListener('input', scheduleInspectorSync); code.addEventListener('change', scheduleInspectorSync); }
  if (canvas?.dataset.patchButtonPresentationObserver !== '1') { canvas.dataset.patchButtonPresentationObserver = '1'; canvas.addEventListener(DESIGNER_SELECTION_EVENT, scheduleInspectorSync); new MutationObserver(scheduleInspectorSync).observe(canvas, { childList: true, subtree: true }); }
}
function scheduleInspectorSync() { if (syncQueued) return; syncQueued = true; queueMicrotask(() => { syncQueued = false; syncInspector(); }); }
function activeFormIndex() { const value = Number(document.querySelector('#patchFormSelect')?.value); return Number.isInteger(value) && value >= 0 ? value : 0; }
function setStudioSource(code, source) { code.value = source; code.dispatchEvent(new Event('input', { bubbles: true })); code.dispatchEvent(new Event('change', { bubbles: true })); }
function showError(error) { const target = document.querySelector('#designerInspectorError'); if (!target) return; target.textContent = error?.message ?? String(error); target.hidden = false; }
function cssEscape(value) { return globalThis.CSS?.escape ? globalThis.CSS.escape(String(value)) : String(value).replace(/[^A-Za-z0-9_-]/g, char => \`\\\\\${char}\`); }
`;
fs.writeFileSync('src/button-presentation.js', moduleSource);

edit('src/compiler.js', source => {
  let s = source;
  s = once(s, "import {\n  attachWindowListboxPresentations,", "import {\n  attachWindowButtonPresentations,\n  buildWindowButtonPresentationManifest\n} from './button-presentation.js';\nimport {\n  attachWindowListboxPresentations,", 'compiler button presentation import');
  s = once(s, '  const windowNumberEdit = buildWindowNumberEditManifest(source, ast);\n  const windowListboxPresentation', '  const windowNumberEdit = buildWindowNumberEditManifest(source, ast);\n  const windowButtonPresentation = buildWindowButtonPresentationManifest(source, ast);\n  const windowListboxPresentation', 'compiler button manifest build');
  s = once(s, '  attachWindowNumberEdits(ast, windowNumberEdit);\n  attachWindowListboxPresentations', '  attachWindowNumberEdits(ast, windowNumberEdit);\n  attachWindowButtonPresentations(ast, windowButtonPresentation);\n  attachWindowListboxPresentations', 'compiler button manifest attach');
  s = once(s, 'windowInputPresentation, windowInputMask, windowNumberEdit, windowListboxPresentation,', 'windowInputPresentation, windowInputMask, windowNumberEdit, windowButtonPresentation, windowListboxPresentation,', 'compiler button manifest return');
  return s;
});

edit('src/interpreter.js', source => once(
  source,
  "          source:node.control==='picture'&&node.sourceExpr?this.uiText(node.sourceExpr):'',\n          value:",
  "          source:node.control==='picture'&&node.sourceExpr?this.uiText(node.sourceExpr):'',\n          buttonPresentation:node.control==='button'?(node.buttonPresentation??'plain'):null,\n          value:",
  'interpreter button presentation'
));

edit('web/studio-window-renderer.js', source => once(
  source,
  "    el.className = 'patch-button';\n    el.type = 'button';",
  "    el.className = control.buttonPresentation === 'link' ? 'patch-button patch-linklabel' : 'patch-button';\n    el.type = 'button';\n    if (control.buttonPresentation === 'link') el.dataset.patchButtonPresentation = 'link';",
  'Studio renderer LinkLabel class'
));

edit('web/style.css', source => once(
  source,
  '.patch-button { padding: 8px 15px; display: inline-flex; align-items: center; gap: 8px; }',
  ".patch-button { padding: 8px 15px; display: inline-flex; align-items: center; gap: 8px; }\n.patch-button.patch-linklabel { padding: 2px 0; border: 0; border-radius: 0; background: transparent; color: #2563eb; box-shadow: none; text-decoration: underline; text-underline-offset: 3px; font-weight: 650; }\n.patch-button.patch-linklabel:hover { color: #1d4ed8; background: transparent; }\n.patch-button.patch-linklabel:focus-visible { outline: 2px solid currentColor; outline-offset: 3px; }\n@media (prefers-color-scheme: dark) { .patch-button.patch-linklabel { color: #93c5fd; } .patch-button.patch-linklabel:hover { color: #bfdbfe; } }",
  'Studio LinkLabel CSS'
));

edit('src/window-webapp.js', source => {
  let s = source;
  s = once(s, "  const calendarCount = compiled?.windowInputPresentation?.controls?.filter(control => control.mode === 'calendar').length ?? 0;", "  const calendarCount = compiled?.windowInputPresentation?.controls?.filter(control => control.mode === 'calendar').length ?? 0;\n  const linkLabelCount = compiled?.windowButtonPresentation?.controls?.filter(control => control.mode === 'link').length ?? 0;", 'Web LinkLabel count');
  s = once(s, "    ...(calendarCount ? {\n      calendarStage: 1,\n      calendarVersion: '0.4',\n      calendarMode: 'source-backed-inline-month-grid',\n      calendarEventValue: 'iso-date-text'\n    } : {})", "    ...(calendarCount ? {\n      calendarStage: 1,\n      calendarVersion: '0.4',\n      calendarMode: 'source-backed-inline-month-grid',\n      calendarEventValue: 'iso-date-text'\n    } : {}),\n    ...(linkLabelCount ? {\n      linkLabelStage: 1,\n      linkLabelVersion: '0.1',\n      linkLabelMode: 'source-backed-button-presentation',\n      linkLabelEvent: 'clicked'\n    } : {})", 'Web LinkLabel metadata');
  s = once(s, '.body .patch-button-image{width:16px;height:16px;object-fit:contain;flex:0 0 auto;border:0}', '.body .patch-button-image{width:16px;height:16px;object-fit:contain;flex:0 0 auto;border:0}.body .patch-linklabel{padding:2px 0;border-radius:0;background:transparent;color:#2563eb;text-decoration:underline;text-underline-offset:3px;box-shadow:none}.body .patch-linklabel:hover,.body .patch-linklabel:focus-visible{background:transparent;color:#1d4ed8}', 'Standalone LinkLabel CSS');
  s = once(s, '.body button{background:#f4f4f5;color:#18181b}', '.body button{background:#f4f4f5;color:#18181b}.body .patch-linklabel{background:transparent;color:#93c5fd}.body .patch-linklabel:hover,.body .patch-linklabel:focus-visible{color:#bfdbfe}', 'Standalone dark LinkLabel CSS');
  s = once(s, "value:node.id&&state.has(node.id)?clone(state.get(node.id)):'',inputPresentation:", "value:node.id&&state.has(node.id)?clone(state.get(node.id)):'',buttonPresentation:node.control==='button'?(node.buttonPresentation||'plain'):null,inputPresentation:", 'Standalone UI model button presentation');
  s = once(s, "if(control.type==='button'){const el=document.createElement('button');el.type='button';el.className='patch-button';", "if(control.type==='button'){const el=document.createElement('button');el.type='button';el.className=control.buttonPresentation==='link'?'patch-button patch-linklabel':'patch-button';if(control.buttonPresentation==='link')el.dataset.patchButtonPresentation='link';", 'Standalone LinkLabel renderer');
  return s;
});

edit('src/native-current-contract.js', source => {
  let s = once(source, '  assertCurrentNativeInputPresentation(compiled?.ast);', '  assertCurrentNativeInputPresentation(compiled?.ast);\n  assertCurrentNativeButtonPresentation(compiled?.ast);', 'native LinkLabel assertion call');
  s = once(s, '\nfunction assertCurrentNativeListboxPresentation(nodes) {', `\nfunction assertCurrentNativeButtonPresentation(nodes) {\n  for (const node of nodes ?? []) {\n    if (node?.kind === 'uiControl' && node.control === 'button' && node.buttonPresentation === 'link') {\n      const name = node.id ? \` '\${node.id}'\` : '';\n      throw new NativeGuiError(\`LinkLabel Stage 1 Button\${name} is Studio/Web only. Current Ready native \${PATCH_CURRENT_NATIVE_RUNTIME_VERSION} has no link-style Button presentation contract; validation fails closed rather than lowering it as an ordinary native Button.\`);\n    }\n    if (node?.kind === 'window' || (node?.kind === 'uiControl' && node.control === 'panel')) assertCurrentNativeButtonPresentation(node.body);\n    if (node?.kind === 'tabs') for (const page of node.body ?? []) assertCurrentNativeButtonPresentation(page.body);\n  }\n}\n\nfunction assertCurrentNativeListboxPresentation(nodes) {`, 'native LinkLabel assertion function');
  return s;
});

for (const path of ['src/window-layout-policy.js','web/designer-control-duplicate-model.js','web/designer-control-clipboard-model.js']) {
  edit(path, source => source.replaceAll('layout|taborder|locked|input-mode|input-mask|listbox-mode|slider-mode|panel-mode', 'layout|taborder|locked|input-mode|input-mask|listbox-mode|slider-mode|panel-mode|button-mode'));
}
edit('src/designer.js', source => source.replaceAll('layout|taborder|locked|input-mode|input-mask|listbox-mode|slider-mode|panel-mode', 'layout|taborder|locked|input-mode|input-mask|listbox-mode|slider-mode|panel-mode|button-mode'));
edit('src/window-input-presentation.js', source => source.replaceAll('layout|taborder|locked|input-mode|input-mask|number-edit', 'layout|taborder|locked|input-mode|input-mask|number-edit|button-mode'));
edit('src/input-presentation.js', source => source.replaceAll('layout|taborder|locked|input-mode|input-mask|listbox-mode', 'layout|taborder|locked|input-mode|input-mask|listbox-mode|button-mode'));

const testSource = `import test from 'node:test';\nimport assert from 'node:assert/strict';\nimport fs from 'node:fs';\nimport { parse } from '../src/parser.js';\nimport { compile } from '../src/compiler.js';\nimport { PatchInterpreter } from '../src/interpreter.js';\nimport { buildStandaloneWebApp } from '../src/webapp.js';\nimport { buildCurrentNativeGuiIR } from '../src/native-current-contract.js';\nimport { collectWindowLinkLabelIds, readWindowButtonPresentation, setWindowButtonPresentation } from '../src/button-presentation.js';\n\nconst SOURCE = \`window "Links" as main size 520, 300:\n  # @button-mode link\n  button "Open details" as details at 24, 24 size 180, 32\nwhen details clicked:\n  show "clicked"\n\`;\n\ntest('LinkLabel metadata round-trips on an ordinary Button', () => {\n  const plain = \`window "Links":\\n  button "Open" as details\\n\`;\n  const linked = setWindowButtonPresentation(plain, 2, 'link');\n  assert.match(linked, /# @button-mode link/);\n  assert.equal(readWindowButtonPresentation(linked, 3), 'link');\n  assert.equal(setWindowButtonPresentation(linked, 3, 'plain'), plain);\n});\n\ntest('LinkLabel discovery follows Buttons through Tabs and Panels and rejects wrong controls', () => {\n  const nested = \`window "Nested":\n  # @button-mode link\n  button "Top" as top_link\n  tabs as pages:\n    tab "One":\n      # @button-mode link\n      button "Tab" as tab_link\n    tab "Two":\n      text "Other"\n  panel as holder:\n    # @button-mode link\n    button "Panel" as panel_link\n\`;\n  assert.deepEqual(collectWindowLinkLabelIds(nested, parse(nested)), ['top_link','tab_link','panel_link']);\n  assert.throws(() => compile(\`window "Bad":\\n  # @button-mode link\\n  input value\\n\`, { kind: 'window' }), /belongs only to Button controls/);\n});\n\ntest('LinkLabel compile preserves ordinary Button, clicked event and Change IR 0.10', () => {\n  const compiled = compile(SOURCE, { name: 'Links', kind: 'window' });\n  const button = compiled.ast.find(node => node.kind === 'window').body.find(node => node.control === 'button');\n  assert.equal(compiled.ir.version, '0.10');\n  assert.equal(compiled.windowButtonPresentation.version, '0.1');\n  assert.equal(button.control, 'button');\n  assert.equal(button.buttonPresentation, 'link');\n  const runtime = new PatchInterpreter();\n  runtime.run(SOURCE);\n  assert.deepEqual(runtime.trigger('details','clicked').output, ['clicked']);\n});\n\ntest('Standalone Web renders LinkLabel as a styled Button without implicit href navigation', () => {\n  const built = buildStandaloneWebApp(SOURCE, { name: 'Links', kind: 'window' });\n  assert.equal(built.metadata.linkLabelStage, 1);\n  assert.equal(built.metadata.linkLabelVersion, '0.1');\n  assert.equal(built.metadata.linkLabelMode, 'source-backed-button-presentation');\n  assert.equal(built.metadata.linkLabelEvent, 'clicked');\n  assert.match(built.html, /patch-linklabel/);\n  assert.match(built.html, /patchButtonPresentation='link'/);\n  assert.doesNotMatch(built.html, /href=.*details/);\n});\n\ntest('Current Ready native rejects LinkLabel explicitly while plain Button remains compatible', () => {\n  assert.throws(() => buildCurrentNativeGuiIR(compile(SOURCE, { name: 'Links', kind: 'window' })), /LinkLabel Stage 1.*Studio\\/Web only.*Current Ready native 1\\.10/i);\n  const plain = compile(\`window "Plain":\\n  button "Open" as details\\nwhen details clicked:\\n  show "clicked"\\n\`, { name: 'Plain', kind: 'window' });\n  assert.doesNotThrow(() => buildCurrentNativeGuiIR(plain));\n});\n\ntest('Studio exposes LinkLabel palette and Inspector and renderer preserves Button semantics', () => {\n  const module = fs.readFileSync('src/button-presentation.js','utf8');\n  const renderer = fs.readFileSync('web/studio-window-renderer.js','utf8');\n  assert.match(module, /button\\.id = 'addLinkLabel'/);\n  assert.match(module, /button\\.textContent = '\\+ LinkLabel'/);\n  assert.match(module, /option value="link">LinkLabel<\\/option>/);\n  assert.match(module, /keeps the ordinary Button clicked event/);\n  assert.match(renderer, /control\\.buttonPresentation === 'link'/);\n  assert.match(renderer, /patch-button patch-linklabel/);\n});\n\ntest('LinkLabel source metadata participates in generic designer duplicate and clipboard lifecycle', () => {\n  for (const path of ['src/designer.js','src/window-layout-policy.js','web/designer-control-duplicate-model.js','web/designer-control-clipboard-model.js']) {\n    assert.match(fs.readFileSync(path,'utf8'), /button-mode/, path);\n  }\n});\n`;
fs.writeFileSync('tests/linklabel-stage1.test.js', testSource);
console.log('LinkLabel Stage 1 patch applied.');
