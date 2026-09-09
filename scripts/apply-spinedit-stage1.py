from pathlib import Path


def replace_once(path, old, new):
    p = Path(path)
    text = p.read_text()
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{path}: expected exactly one anchor, found {count}: {old[:120]!r}")
    p.write_text(text.replace(old, new, 1))


def write(path, content):
    Path(path).write_text(content)


# Core Slider presentation contract 0.2.
p = Path('src/window-layout-policy.js')
s = p.read_text()
replacements = [
    ("export const PATCH_SLIDER_PRESENTATION_VERSION = '0.1';", "export const PATCH_SLIDER_PRESENTATION_VERSION = '0.2';"),
    ("export const PATCH_WINDOW_SLIDER_PRESENTATION_VERSION = '0.1';", "export const PATCH_WINDOW_SLIDER_PRESENTATION_VERSION = '0.2';"),
    ("const SLIDER_PRESENTATION_MODES = Object.freeze(['plain', 'progress']);", "const SLIDER_PRESENTATION_MODES = Object.freeze(['plain', 'progress', 'spin']);"),
    ("const PROGRESS_SLIDER_TARGETS = Object.freeze({ studio: 'supported', web: 'supported', windows: 'unsupported', macos: 'unsupported', linux: 'unsupported', freebsd: 'unsupported' });\nconst PANEL_PRESENTATION_MODES", "const PROGRESS_SLIDER_TARGETS = Object.freeze({ studio: 'supported', web: 'supported', windows: 'unsupported', macos: 'unsupported', linux: 'unsupported', freebsd: 'unsupported' });\nconst SPIN_SLIDER_TARGETS = Object.freeze({ studio: 'supported', web: 'supported', windows: 'unsupported', macos: 'unsupported', linux: 'unsupported', freebsd: 'unsupported' });\nconst PANEL_PRESENTATION_MODES"),
    ("Unsupported Slider presentation '${mode}'. Use plain or progress.", "Unsupported Slider presentation '${mode}'. Use plain, progress or spin."),
    ("const match = text.match(/^\\s*#\\s*@slider-mode\\s+(plain|progress)\\s*$/i);", "const match = text.match(/^\\s*#\\s*@slider-mode\\s+(plain|progress|spin)\\s*$/i);"),
    ("if (!match) throw new Error(`Invalid # @slider-mode directive '${text.trim()}'. Use '# @slider-mode progress'.`);", "if (!match) throw new Error(`Invalid # @slider-mode directive '${text.trim()}'. Use '# @slider-mode progress' or '# @slider-mode spin'.`);"),
    ("export function patchSliderPresentationTargetSupport(mode) { return normalizePatchSliderPresentation(mode) === 'progress' ? PROGRESS_SLIDER_TARGETS : PLAIN_SLIDER_TARGETS; }", "export function patchSliderPresentationTargetSupport(mode) {\n  const normalized = normalizePatchSliderPresentation(mode);\n  if (normalized === 'progress') return PROGRESS_SLIDER_TARGETS;\n  if (normalized === 'spin') return SPIN_SLIDER_TARGETS;\n  return PLAIN_SLIDER_TARGETS;\n}"),
    ("    throw new Error(`Slider presentation '${normalizedMode}' is not supported on '${normalizedTarget || 'unknown'}'. ` + (normalizedMode === 'progress' ? 'ProgressBar Stage 1 is Studio/Web only until a new explicit native GUI/runtime contract is promoted.' : 'Select a supported Patch target.'));", "    const detail = normalizedMode === 'progress'\n      ? 'ProgressBar Stage 1 is Studio/Web only until a new explicit native GUI/runtime contract is promoted.'\n      : normalizedMode === 'spin'\n        ? 'SpinEdit Stage 1 is Studio/Web only until a new explicit native GUI/runtime contract is promoted.'\n        : 'Select a supported Patch target.';\n    throw new Error(`Slider presentation '${normalizedMode}' is not supported on '${normalizedTarget || 'unknown'}'. ${detail}`);"),
    ("    if (effective === 'progress') {\n      const stateType = node.id ? stateTypes.get(node.id) : null;\n      if (stateType !== 'number') throw new Error(`ProgressBar '${node.id ?? '?'}' needs a matching 'create number ${node.id ?? 'name'} = ...' state declaration so the passive bar has one explicit numeric value source.`);\n    }", "    if (effective === 'progress' || effective === 'spin') {\n      const stateType = node.id ? stateTypes.get(node.id) : null;\n      if (stateType !== 'number') {\n        const label = effective === 'progress' ? 'ProgressBar' : 'SpinEdit';\n        const reason = effective === 'progress'\n          ? 'so the passive bar has one explicit numeric value source'\n          : 'so the numeric editor has one explicit persistent value source';\n        throw new Error(`${label} '${node.id ?? '?'}' needs a matching 'create number ${node.id ?? 'name'} = ...' state declaration ${reason}.`);\n      }\n    }"),
    ("export function collectWindowProgressBarIds(ast) {\n  const ids = [];\n  walkWindowControls(ast, node => { if (node.control === 'slider' && node.sliderPresentation === 'progress' && node.id) ids.push(node.id); });\n  return ids;\n}\n", "export function collectWindowProgressBarIds(ast) {\n  const ids = [];\n  walkWindowControls(ast, node => { if (node.control === 'slider' && node.sliderPresentation === 'progress' && node.id) ids.push(node.id); });\n  return ids;\n}\n\nexport function collectWindowSpinEditIds(ast) {\n  const ids = [];\n  walkWindowControls(ast, node => { if (node.control === 'slider' && node.sliderPresentation === 'spin' && node.id) ids.push(node.id); });\n  return ids;\n}\n")
]
for old, new in replacements:
    count = s.count(old)
    if count != 1:
        raise SystemExit(f"window-layout-policy.js anchor count {count}: {old[:120]!r}")
    s = s.replace(old, new, 1)
p.write_text(s)

replace_once(
    'src/slider-presentation.js',
    "  setWindowSliderPresentation,\n  collectWindowProgressBarIds\n",
    "  setWindowSliderPresentation,\n  collectWindowProgressBarIds,\n  collectWindowSpinEditIds\n"
)

# Shared target validation.
p = Path('src/window-build.js')
s = p.read_text()
for old, new in [
    ("  let progressBars = 0;\n  let memos = 0;", "  let progressBars = 0;\n  let spinEdits = 0;\n  let memos = 0;"),
    ("      if (child.sliderPresentation === 'progress') progressBars += 1;", "      if (child.sliderPresentation === 'progress') progressBars += 1;\n      if (child.sliderPresentation === 'spin') spinEdits += 1;"),
    ("      if (child.sliderPresentation === 'progress' && stateType !== 'number') {\n        throw new WindowBuildError(\n          `line ${child.line ?? '?'}: ProgressBar '${child.id}' needs matching number state with the same name.`\n        );\n      }", "      if (child.sliderPresentation === 'progress' && stateType !== 'number') {\n        throw new WindowBuildError(\n          `line ${child.line ?? '?'}: ProgressBar '${child.id}' needs matching number state with the same name.`\n        );\n      }\n      if (child.sliderPresentation === 'spin' && stateType !== 'number') {\n        throw new WindowBuildError(\n          `line ${child.line ?? '?'}: SpinEdit '${child.id}' needs matching number state with the same name.`\n        );\n      }"),
    ("  if (memos && !options.allowMemo) {", "  if (spinEdits && !options.allowSpinEdit) {\n    throw new WindowBuildError(\n      'SpinEdit Stage 1 is enabled only for Patch Studio and Standalone Window Web. Current Ready native GUI 1.9/19/1.10 has no numeric SpinEdit presentation contract; validation fails closed rather than lowering it as a Slider.'\n    );\n  }\n\n  if (memos && !options.allowMemo) {"),
    ("    progressBars,\n    memos,", "    progressBars,\n    spinEdits,\n    memos,")
]:
    count = s.count(old)
    if count != 1:
        raise SystemExit(f"window-build.js anchor count {count}: {old[:120]!r}")
    s = s.replace(old, new, 1)
p.write_text(s)

replace_once(
    'src/window-compiled.js',
    "    allowProgressBar: true,\n    allowMemo: true,",
    "    allowProgressBar: true,\n    allowSpinEdit: true,\n    allowMemo: true,"
)
replace_once(
    'src/window-webapp.js',
    "validateWindowRuntimeSupport(compiled, { allowTree: true, allowSlider: true, allowProgressBar: true, allowMemo: true, allowPaintBox: true, allowImageList: true });",
    "validateWindowRuntimeSupport(compiled, { allowTree: true, allowSlider: true, allowProgressBar: true, allowSpinEdit: true, allowMemo: true, allowPaintBox: true, allowImageList: true });"
)

# Current Ready native fail-closed boundary.
p = Path('src/native-current-contract.js')
s = p.read_text()
old = """function assertCurrentNativeSliderPresentation(nodes) {
  for (const node of nodes ?? []) {
    if (node?.kind === 'uiControl' && node.control === 'slider' && node.sliderPresentation === 'progress') {
      const name = node.id ? ` '${node.id}'` : '';
      throw new NativeGuiError(`ProgressBar Stage 1${name} is Studio/Web only. Current Ready native ${PATCH_CURRENT_NATIVE_RUNTIME_VERSION} has no passive progress presentation contract; validation fails closed rather than lowering it as an interactive Slider.`);
    }
    if (node?.kind === 'window' || (node?.kind === 'uiControl' && node.control === 'panel')) {
      assertCurrentNativeSliderPresentation(node.body);
    }
    if (node?.kind === 'tabs') {
      for (const page of node.body ?? []) assertCurrentNativeSliderPresentation(page.body);
    }
  }
}
"""
new = """function assertCurrentNativeSliderPresentation(nodes) {
  for (const node of nodes ?? []) {
    if (node?.kind === 'uiControl' && node.control === 'slider') {
      const name = node.id ? ` '${node.id}'` : '';
      if (node.sliderPresentation === 'progress') {
        throw new NativeGuiError(`ProgressBar Stage 1${name} is Studio/Web only. Current Ready native ${PATCH_CURRENT_NATIVE_RUNTIME_VERSION} has no passive progress presentation contract; validation fails closed rather than lowering it as an interactive Slider.`);
      }
      if (node.sliderPresentation === 'spin') {
        throw new NativeGuiError(`SpinEdit Stage 1${name} is Studio/Web only. Current Ready native ${PATCH_CURRENT_NATIVE_RUNTIME_VERSION} has no numeric SpinEdit presentation contract; validation fails closed rather than lowering it as a Slider.`);
      }
    }
    if (node?.kind === 'window' || (node?.kind === 'uiControl' && node.control === 'panel')) {
      assertCurrentNativeSliderPresentation(node.body);
    }
    if (node?.kind === 'tabs') {
      for (const page of node.body ?? []) assertCurrentNativeSliderPresentation(page.body);
    }
  }
}
"""
if s.count(old) != 1:
    raise SystemExit('native-current-contract.js slider presentation block not found uniquely')
p.write_text(s.replace(old, new, 1))

# Studio Slider presentation UI.
p = Path('web/slider-stage1.js')
s = p.read_text()
for old, new in [
    (".patch-slider.patch-progressbar-studio.designer-control{cursor:pointer}\n@media(forced-colors:active){.patch-slider.patch-progressbar-studio progress{forced-color-adjust:auto}}", ".patch-slider.patch-progressbar-studio.designer-control{cursor:pointer}\n.patch-slider.patch-spinedit-studio{grid-template-columns:minmax(120px,180px);gap:0}\n.patch-slider.patch-spinedit-studio>.patch-spinedit-source,.patch-slider.patch-spinedit-studio>output{position:absolute!important;width:1px!important;height:1px!important;min-width:1px!important;min-height:1px!important;margin:-1px!important;padding:0!important;border:0!important;clip:rect(0 0 0 0)!important;clip-path:inset(50%)!important;overflow:hidden!important;white-space:nowrap!important;opacity:0!important;pointer-events:none!important}\n.patch-spinedit-input{width:100%;min-width:0;border:1px solid var(--border,#d4d4d8);border-radius:7px;padding:7px 9px;background:var(--surface,#fff);color:inherit;font:inherit;font-variant-numeric:tabular-nums}\n.designer-control.patch-spinedit-studio .patch-spinedit-input{pointer-events:none}\n@media(forced-colors:active){.patch-slider.patch-progressbar-studio progress{forced-color-adjust:auto}.patch-spinedit-input{border:1px solid CanvasText}}"),
    ("function installProgressBarStudio() {\n  ensureProgressBarButton();\n  ensureProgressBarInspector();", "function installProgressBarStudio() {\n  ensureProgressBarButton();\n  ensureSpinEditButton();\n  ensureProgressBarInspector();"),
    ("    ensureProgressBarButton();\n    ensureProgressBarInspector();\n    installProgressBarObservers();\n    if (document.querySelector('#addProgressBar') && document.querySelector('#designerInspectorSliderPresentationField')) observer.disconnect();", "    ensureProgressBarButton();\n    ensureSpinEditButton();\n    ensureProgressBarInspector();\n    installProgressBarObservers();\n    if (document.querySelector('#addProgressBar') && document.querySelector('#addSpinEdit') && document.querySelector('#designerInspectorSliderPresentationField')) observer.disconnect();"),
    ("function addProgressBarFromStudio(event) {", "function ensureSpinEditButton() {\n  const toolbar = document.querySelector('#designer .designer-toolbar');\n  const anchor = toolbar?.querySelector('#addProgressBar') ?? toolbar?.querySelector('#addSlider');\n  if (!toolbar || !anchor || toolbar.querySelector('#addSpinEdit')) return Boolean(toolbar?.querySelector('#addSpinEdit'));\n  const button = document.createElement('button');\n  button.id = 'addSpinEdit';\n  button.className = 'secondary small';\n  button.type = 'button';\n  button.textContent = '+ SpinEdit';\n  button.setAttribute('aria-label', 'Add SpinEdit');\n  button.title = 'Add an interactive source-backed SpinEdit preset. It remains Slider number/range/step semantics and uses # @slider-mode spin.';\n  anchor.insertAdjacentElement('afterend', button);\n  button.addEventListener('click', addSpinEditFromStudio);\n  return true;\n}\n\nfunction addProgressBarFromStudio(event) {"),
    ("    next = ensureProgressNumberState(next, added.id, added.min ?? 0);", "    next = ensureSliderNumberState(next, added.id, added.min ?? 0, 'ProgressBar');"),
    ("function ensureProgressBarInspector() {", "function addSpinEditFromStudio(event) {\n  event?.preventDefault?.();\n  event?.stopImmediatePropagation?.();\n  if (!code) return;\n  try {\n    const windowIndex = activeFormIndex();\n    let next = addDesignerControl(code.value, 'slider', { windowIndex });\n    let added = listDesignerControls(next)\n      .filter(control => control.windowIndex === windowIndex && control.type === 'slider')\n      .at(-1);\n    if (!added?.id) throw new Error('Designer created a Slider but could not locate its source-backed id.');\n    next = ensureSliderNumberState(next, added.id, added.min ?? 0, 'SpinEdit');\n    const line = findSliderLineById(next, added.id);\n    next = setWindowSliderPresentation(next, line, 'spin');\n    setSource(next);\n    added = listDesignerControls(next).find(control => control.id === added.id && control.type === 'slider') ?? added;\n    requestAnimationFrame(() => {\n      document.querySelector(`#designerCanvas .designer-control[data-window-index=\"${added.windowIndex}\"][data-control-index=\"${added.controlIndex}\"]`)?.click?.();\n      scheduleProgressBarSync();\n    });\n  } catch (error) {\n    showDesignerInspectorError(error, { document });\n  }\n}\n\nfunction ensureProgressBarInspector() {"),
    ("      <option value=\"progress\">ProgressBar</option>\n    </select>\n    <small id=\"designerInspectorSliderPresentationHint\" class=\"inspector-hint\">ProgressBar is a passive source-backed number-state presentation. Stage 1 is Studio/Web; Current Ready native 1.10 fails closed.</small>", "      <option value=\"progress\">ProgressBar</option>\n      <option value=\"spin\">SpinEdit</option>\n    </select>\n    <small id=\"designerInspectorSliderPresentationHint\" class=\"inspector-hint\">ProgressBar is passive; SpinEdit is interactive. Both remain source-backed Slider number/range/step presentations. Stage 1 is Studio/Web; Current Ready native 1.10 fails closed.</small>"),
    ("    if (select.value === 'progress') next = ensureProgressNumberState(next, control.id, control.min ?? 0);", "    if (select.value === 'progress' || select.value === 'spin') {\n      next = ensureSliderNumberState(next, control.id, control.min ?? 0, select.value === 'spin' ? 'SpinEdit' : 'ProgressBar');\n    }"),
    ("function ensureProgressNumberState(source, id, initialValue = 0) {", "function ensureSliderNumberState(source, id, initialValue = 0, label = 'Slider presentation') {"),
    ("      throw new Error(`ProgressBar '${id}' needs number state, but '${id}' is already declared as ${existing.valueType}.`);", "      throw new Error(`${label} '${id}' needs number state, but '${id}' is already declared as ${existing.valueType}.`);"),
    ("  let progressIds;\n  try {\n    const ast = parse(code.value);\n    const manifest = buildWindowSliderPresentationManifest(code.value, ast);\n    progressIds = new Set(manifest.controls.filter(control => control.mode === 'progress').map(control => control.id).filter(Boolean));", "  let presentationModes;\n  try {\n    const ast = parse(code.value);\n    const manifest = buildWindowSliderPresentationManifest(code.value, ast);\n    presentationModes = new Map(manifest.controls.filter(control => control.id).map(control => [control.id, control.mode]));"),
    ("      if (progressIds.has(id)) renderProgressPresentation(slider, id, root.id === 'app');\n      else restoreSliderPresentation(slider, root.id === 'app');", "      const mode = presentationModes.get(id) ?? 'plain';\n      if (mode === 'progress') renderProgressPresentation(slider, id, root.id === 'app');\n      else if (mode === 'spin') renderSpinPresentation(slider, id, root.id === 'app');\n      else restoreSliderPresentation(slider, root.id === 'app');"),
    ("function renderProgressPresentation(slider, id, interactiveRoot) {\n  slider.classList.add('patch-progressbar-studio');", "function renderProgressPresentation(slider, id, interactiveRoot) {\n  if (slider.classList.contains('patch-spinedit-studio')) restoreSliderPresentation(slider, interactiveRoot);\n  slider.classList.add('patch-progressbar-studio');"),
    ("function restoreSliderPresentation(slider, interactiveRoot) {\n  if (!slider.classList.contains('patch-progressbar-studio')) return;\n  slider.classList.remove('patch-progressbar-studio');\n  delete slider.dataset.patchSliderPresentation;\n  slider.querySelector('progress.patch-progressbar-meter')?.remove();\n  slider.querySelector('.patch-progressbar-value')?.remove();\n  const input = slider.querySelector('input[type=\"range\"]');\n  if (input) {\n    input.classList.remove('patch-progressbar-source');\n    input.removeAttribute('aria-hidden');\n    input.removeAttribute('tabindex');\n    input.disabled = !interactiveRoot;\n  }\n  slider.removeAttribute('aria-label');\n}", "function renderSpinPresentation(slider, id, interactiveRoot) {\n  if (slider.classList.contains('patch-progressbar-studio')) restoreSliderPresentation(slider, interactiveRoot);\n  slider.classList.add('patch-spinedit-studio');\n  slider.dataset.patchSliderPresentation = 'spin';\n  const input = slider.querySelector('input[type=\"range\"]');\n  if (!input) return;\n  input.classList.add('patch-spinedit-source');\n  input.tabIndex = -1;\n  input.setAttribute('aria-hidden', 'true');\n  input.disabled = !interactiveRoot;\n\n  let editor = slider.querySelector('input.patch-spinedit-input');\n  if (!editor) {\n    editor = document.createElement('input');\n    editor.type = 'number';\n    editor.className = 'patch-spinedit-input';\n    slider.appendChild(editor);\n  }\n  editor.min = input.min;\n  editor.max = input.max;\n  editor.step = input.step || '1';\n  editor.value = input.value;\n  editor.readOnly = !interactiveRoot;\n  editor.tabIndex = interactiveRoot ? 0 : -1;\n  editor.setAttribute('aria-label', `${id} SpinEdit`);\n  if (interactiveRoot && editor.dataset.patchSpinBound !== '1') {\n    editor.dataset.patchSpinBound = '1';\n    editor.addEventListener('change', () => {\n      const min = finiteNumber(input.min, 0);\n      const max = finiteNumber(input.max, 100);\n      const requested = Math.min(max, Math.max(min, finiteNumber(editor.value, finiteNumber(input.value, min))));\n      input.value = String(requested);\n      const value = finiteNumber(input.value, requested);\n      editor.value = formatNumber(value);\n      input.dispatchEvent(new Event('change', { bubbles: true }));\n    });\n  }\n  slider.setAttribute('aria-label', `${id} SpinEdit`);\n}\n\nfunction restoreSliderPresentation(slider, interactiveRoot) {\n  if (!slider.classList.contains('patch-progressbar-studio') && !slider.classList.contains('patch-spinedit-studio')) return;\n  slider.classList.remove('patch-progressbar-studio', 'patch-spinedit-studio');\n  delete slider.dataset.patchSliderPresentation;\n  slider.querySelector('progress.patch-progressbar-meter')?.remove();\n  slider.querySelector('.patch-progressbar-value')?.remove();\n  slider.querySelector('input.patch-spinedit-input')?.remove();\n  const input = slider.querySelector('input[type=\"range\"]');\n  if (input) {\n    input.classList.remove('patch-progressbar-source', 'patch-spinedit-source');\n    input.removeAttribute('aria-hidden');\n    input.removeAttribute('tabindex');\n    input.disabled = !interactiveRoot;\n  }\n  slider.removeAttribute('aria-label');\n}")
]:
    count = s.count(old)
    if count != 1:
        raise SystemExit(f"web/slider-stage1.js anchor count {count}: {old[:120]!r}")
    s = s.replace(old, new, 1)
p.write_text(s)

# Standalone Window Web SpinEdit transformer.
p = Path('src/window-web-paintbox.js')
s = p.read_text()
for old, new in [
    ("export const PATCH_WINDOW_WEB_PROGRESSBAR_VERSION = '0.1';", "export const PATCH_WINDOW_WEB_PROGRESSBAR_VERSION = '0.1';\nexport const PATCH_WINDOW_WEB_SPINEDIT_VERSION = '0.1';"),
    ("  const progressBarIds = collectProgressBarIds(ast);", "  const progressBarIds = collectProgressBarIds(ast);\n  const spinEditIds = collectSpinEditIds(ast);"),
    ("  const hasProgressBars = progressBarIds.length > 0;\n  if (!hasPaintBoxes && !hasPasswordEdits && !hasMaskedEdits && !hasCheckedListBoxes && !hasProgressBars) return built;", "  const hasProgressBars = progressBarIds.length > 0;\n  const hasSpinEdits = spinEditIds.length > 0;\n  if (!hasPaintBoxes && !hasPasswordEdits && !hasMaskedEdits && !hasCheckedListBoxes && !hasProgressBars && !hasSpinEdits) return built;"),
    ("  if (hasProgressBars) {\n    html = html\n      .replace('</head>', `${progressBarStyle()}\\n</head>`)\n      .replace('</body>', `${progressBarRuntime(progressBarIds)}\\n</body>`);\n  }", "  if (hasProgressBars) {\n    html = html\n      .replace('</head>', `${progressBarStyle()}\\n</head>`)\n      .replace('</body>', `${progressBarRuntime(progressBarIds)}\\n</body>`);\n  }\n  if (hasSpinEdits) {\n    html = html\n      .replace('</head>', `${spinEditStyle()}\\n</head>`)\n      .replace('</body>', `${spinEditRuntime(spinEditIds)}\\n</body>`);\n  }"),
    ("      ...(hasProgressBars ? {\n        progressBarStage: 1,\n        progressBarVersion: PATCH_WINDOW_WEB_PROGRESSBAR_VERSION,\n        progressBarMode: 'passive-number-state-presentation'\n      } : {})", "      ...(hasProgressBars ? {\n        progressBarStage: 1,\n        progressBarVersion: PATCH_WINDOW_WEB_PROGRESSBAR_VERSION,\n        progressBarMode: 'passive-number-state-presentation'\n      } : {}),\n      ...(hasSpinEdits ? {\n        spinEditStage: 1,\n        spinEditVersion: PATCH_WINDOW_WEB_SPINEDIT_VERSION,\n        spinEditMode: 'interactive-number-state-presentation'\n      } : {})"),
    ("export function collectProgressBarIds(ast) {\n  const ids = [];\n  walk(ast, node => {\n    if (\n      node.kind === 'uiControl' &&\n      node.control === 'slider' &&\n      node.sliderPresentation === 'progress' &&\n      node.id\n    ) ids.push(node.id);\n  });\n  return ids;\n}\n", "export function collectProgressBarIds(ast) {\n  const ids = [];\n  walk(ast, node => {\n    if (\n      node.kind === 'uiControl' &&\n      node.control === 'slider' &&\n      node.sliderPresentation === 'progress' &&\n      node.id\n    ) ids.push(node.id);\n  });\n  return ids;\n}\n\nexport function collectSpinEditIds(ast) {\n  const ids = [];\n  walk(ast, node => {\n    if (\n      node.kind === 'uiControl' &&\n      node.control === 'slider' &&\n      node.sliderPresentation === 'spin' &&\n      node.id\n    ) ids.push(node.id);\n  });\n  return ids;\n}\n"),
    ("function paintBoxRuntime(descriptors) {", "function spinEditStyle() {\n  return `<style data-patch-window-spinedit>\n.patch-spinedit{display:inline-flex;align-items:center;min-width:140px;color:inherit}.patch-spinedit-input{width:100%;min-width:120px;border:1px solid #d4d4d8;border-radius:9px;padding:9px 11px;background:#fff;color:#18181b;font:inherit;font-variant-numeric:tabular-nums}.patch-spinedit-input:focus-visible{outline:3px solid #2563eb;outline-offset:2px}\n@media(prefers-color-scheme:dark){.patch-spinedit-input{border-color:#41444e;background:#17191e;color:#f4f4f5}}\n@media(forced-colors:active){.patch-spinedit-input{border:1px solid CanvasText;background:Canvas;color:CanvasText}.patch-spinedit-input:focus-visible{outline:3px solid Highlight}}\n</style>`;\n}\n\nfunction paintBoxRuntime(descriptors) {"),
    ("function progressBarRuntime(ids) {", "function spinEditRuntime(ids) {\n  const idJson = JSON.stringify(ids).replace(/</g, '\\\\u003c');\n  return `<script data-patch-window-spinedit>\n(function(){\n  if(typeof renderControl!=='function'||typeof render!=='function')return;\n  const PATCH_SPINEDIT_IDS=new Set(${idJson});\n  const patchSpinOriginalRenderControl=renderControl;\n\n  function patchSpinElement(control,sliderElement){\n    const source=sliderElement?.querySelector?.('input[type=\\\"range\\\"]');\n    if(!source)throw new PatchAppError(\"SpinEdit '\"+String(control?.id||'?')+\"' could not resolve its Slider underlay.\");\n    const min=Number.isFinite(Number(source.min))?Number(source.min):0;\n    const max=Number.isFinite(Number(source.max))?Number(source.max):100;\n    const step=Number.isFinite(Number(source.step))&&Number(source.step)>0?Number(source.step):1;\n    const raw=Number.isFinite(Number(source.value))?Number(source.value):min;\n    const value=Math.min(max,Math.max(min,raw));\n    const wrap=document.createElement('label');\n    wrap.className='patch-spinedit';\n    wrap.dataset.patchSliderPresentation='spin';\n    wrap.dataset.controlId=String(control?.id||'');\n    const editor=document.createElement('input');\n    editor.type='number';\n    editor.className='patch-spinedit-input';\n    editor.min=String(min);editor.max=String(max);editor.step=String(step);editor.value=String(value);\n    editor.setAttribute('aria-label',String(control?.id||'SpinEdit')+' SpinEdit');\n    editor.addEventListener('change',function(){\n      const requested=Number(editor.value);\n      if(!Number.isFinite(requested)){editor.value=String(value);return;}\n      const bounded=Math.min(max,Math.max(min,requested));\n      editor.value=String(bounded);\n      safeTrigger(control.id,'changed',{value:bounded});\n    });\n    wrap.appendChild(editor);\n    return wrap;\n  }\n\n  renderControl=function(control,windowId,controlIndex){\n    const element=patchSpinOriginalRenderControl(control,windowId,controlIndex);\n    if(control?.type!=='slider'||!PATCH_SPINEDIT_IDS.has(String(control?.id||'')))return element;\n    return patchSpinElement(control,element);\n  };\n  render();\n})();\n</script>`;\n}\n\nfunction progressBarRuntime(ids) {")
]:
    count = s.count(old)
    if count != 1:
        raise SystemExit(f"src/window-web-paintbox.js anchor count {count}: {old[:120]!r}")
    s = s.replace(old, new, 1)
p.write_text(s)

# Existing ProgressBar contract now lives under Slider presentation 0.2.
replace_once(
    'tests/progressbar-stage1.test.js',
    "  assert.equal(PATCH_SLIDER_PRESENTATION_VERSION, '0.1');\n  assert.equal(PATCH_WINDOW_SLIDER_PRESENTATION_VERSION, '0.1');",
    "  assert.equal(PATCH_SLIDER_PRESENTATION_VERSION, '0.2');\n  assert.equal(PATCH_WINDOW_SLIDER_PRESENTATION_VERSION, '0.2');"
)

write('tests/spinedit-stage1.test.js', '''import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { compile } from '../src/compiler.js';
import { buildStandaloneWebApp } from '../src/webapp.js';
import { buildCurrentNativeGuiIR } from '../src/native-current-contract.js';
import { validateWindowRuntimeSupport } from '../src/window-build.js';
import { PATCH_COMPONENT_REGISTRY_VERSION } from '../src/component-registry.js';
import {
  PATCH_SLIDER_PRESENTATION_VERSION,
  PATCH_WINDOW_SLIDER_PRESENTATION_VERSION,
  assertPatchSliderPresentationTarget,
  parsePatchSliderPresentationDirective,
  patchSliderPresentationTargetSupport,
  readWindowSliderPresentation,
  setWindowSliderPresentation
} from '../src/slider-presentation.js';

const SOURCE = `create number quantity = 3

window "Spin" as main size 520, 260:
  # @slider-mode spin
  slider 0..10 as quantity step 1 at 24, 72 size 180, 34

when quantity changed:
  change quantity:
    set = value
`;

test('SpinEdit Stage 1 extends the versioned Slider presentation contract without IR or Registry bumps', () => {
  assert.equal(PATCH_SLIDER_PRESENTATION_VERSION, '0.2');
  assert.equal(PATCH_WINDOW_SLIDER_PRESENTATION_VERSION, '0.2');
  assert.equal(PATCH_COMPONENT_REGISTRY_VERSION, '0.10');
  assert.equal(parsePatchSliderPresentationDirective('# @slider-mode spin'), 'spin');
  assert.equal(patchSliderPresentationTargetSupport('spin').studio, 'supported');
  assert.equal(patchSliderPresentationTargetSupport('spin').web, 'supported');
  assert.equal(patchSliderPresentationTargetSupport('spin').windows, 'unsupported');
  assert.doesNotThrow(() => assertPatchSliderPresentationTarget('spin', 'web'));
  assert.throws(() => assertPatchSliderPresentationTarget('spin', 'windows'), /SpinEdit Stage 1 is Studio\\/Web only/);
});

test('SpinEdit metadata round-trips on ordinary Slider syntax', () => {
  const plain = `create number quantity = 2\\n\\nwindow "Spin" as main:\\n  # @layout anchor left\\n  slider 0..10 as quantity step 1\\n`;
  const line = plain.split('\\n').findIndex(row => /^\\s*slider\\b/.test(row)) + 1;
  const spin = setWindowSliderPresentation(plain, line, 'spin');
  assert.match(spin, /# @layout anchor left\\n  # @slider-mode spin\\n  slider/);
  assert.equal(readWindowSliderPresentation(spin, line + 1), 'spin');
  const restored = setWindowSliderPresentation(spin, line + 1, 'plain');
  assert.doesNotMatch(restored, /@slider-mode/);
});

test('compiler attaches SpinEdit presentation while preserving Change IR 0.10', () => {
  const compiled = compile(SOURCE, { name: 'Spin', kind: 'window' });
  const slider = compiled.ast.find(node => node.kind === 'window').body.find(node => node.control === 'slider');
  assert.equal(compiled.ir.version, '0.10');
  assert.equal(slider.sliderPresentation, 'spin');
  assert.equal(compiled.windowSliderPresentation.controls[0].mode, 'spin');
  const irSlider = compiled.ir.instructions.find(node => node.code === 'WINDOW').body.find(node => node.code === 'UI_CONTROL');
  assert.equal(Object.hasOwn(irSlider, 'sliderPresentation'), false);
});

test('SpinEdit requires explicit matching number state and keeps numeric changed(value)', () => {
  assert.throws(
    () => compile(`window "Bad" as main:\\n  # @slider-mode spin\\n  slider 0..10 as quantity step 1\\n`, { kind: 'window' }),
    /SpinEdit 'quantity'.*create number quantity/i
  );
  const compiled = compile(SOURCE, { kind: 'window' });
  assert.throws(
    () => validateWindowRuntimeSupport(compiled, { allowSlider: true }),
    /SpinEdit Stage 1.*Standalone Window Web.*no numeric SpinEdit presentation contract/i
  );
  const web = validateWindowRuntimeSupport(compiled, { allowSlider: true, allowSpinEdit: true });
  assert.equal(web.sliders, 1);
  assert.equal(web.spinEdits, 1);
  assert.equal(web.events, 1);
});

test('Current Ready native fails closed instead of lowering SpinEdit to Slider', () => {
  const compiled = compile(SOURCE, { name: 'Spin', kind: 'window' });
  assert.throws(
    () => buildCurrentNativeGuiIR(compiled),
    /SpinEdit Stage 1.*Studio\\/Web only.*no numeric SpinEdit presentation contract/i
  );
});

test('Standalone Web renders an interactive numeric SpinEdit using the Slider range and step', () => {
  const built = buildStandaloneWebApp(SOURCE, { name: 'Spin', kind: 'window' });
  assert.equal(built.metadata.spinEditStage, 1);
  assert.equal(built.metadata.spinEditMode, 'interactive-number-state-presentation');
  assert.match(built.html, /data-patch-window-spinedit/);
  assert.match(built.html, /patch-spinedit/);
  assert.match(built.html, /editor\\.type='number'/);
  assert.match(built.html, /safeTrigger\\(control\\.id,'changed',\\{value:bounded\\}\\)/);
});

test('Patch Studio exposes SpinEdit as a Slider preset and Inspector mode', () => {
  const studio = fs.readFileSync('web/slider-stage1.js', 'utf8');
  assert.match(studio, /addSpinEdit/);
  assert.match(studio, /\\+ SpinEdit/);
  assert.match(studio, /value="spin">SpinEdit/);
  assert.match(studio, /patch-spinedit-input/);
  assert.match(studio, /# @slider-mode spin/);
});
''')
