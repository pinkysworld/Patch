from pathlib import Path
import json


def replace_once(path, old, new):
    p = Path(path)
    text = p.read_text()
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{path}: expected one anchor, found {count}: {old[:120]!r}")
    p.write_text(text.replace(old, new, 1))


# Duplicate lifecycle: SpinEdit owns the same explicit number-state copy contract as ProgressBar.
replace_once(
    'web/designer-control-duplicate-model.js',
    "const PROGRESSBAR_RE = /^\\s*#\\s*@slider-mode\\s+progress\\s*$/i;",
    "const PROGRESSBAR_RE = /^\\s*#\\s*@slider-mode\\s+progress\\s*$/i;\nconst SPINEDIT_RE = /^\\s*#\\s*@slider-mode\\s+spin\\s*$/i;"
)
replace_once(
    'web/designer-control-duplicate-model.js',
    "  } else if (control.type === 'slider' && copied.some(line => PROGRESSBAR_RE.test(line))) {\n    valueType = 'number';\n    label = 'ProgressBar';\n  } else {",
    "  } else if (control.type === 'slider' && copied.some(line => PROGRESSBAR_RE.test(line))) {\n    valueType = 'number';\n    label = 'ProgressBar';\n  } else if (control.type === 'slider' && copied.some(line => SPINEDIT_RE.test(line))) {\n    valueType = 'number';\n    label = 'SpinEdit';\n  } else {"
)

# Clipboard v2 lifecycle: collect and recreate SpinEdit backing number state.
replace_once(
    'web/designer-control-clipboard-model.js',
    "const PROGRESSBAR_RE = /^\\s*#\\s*@slider-mode\\s+progress\\s*$/i;",
    "const PROGRESSBAR_RE = /^\\s*#\\s*@slider-mode\\s+progress\\s*$/i;\nconst SPINEDIT_RE = /^\\s*#\\s*@slider-mode\\s+spin\\s*$/i;"
)
replace_once(
    'web/designer-control-clipboard-model.js',
    "    if (record.type === 'slider' && PROGRESSBAR_RE.test(rows[index])) return { valueType: 'number', label: 'ProgressBar' };",
    "    if (record.type === 'slider' && PROGRESSBAR_RE.test(rows[index])) return { valueType: 'number', label: 'ProgressBar' };\n    if (record.type === 'slider' && SPINEDIT_RE.test(rows[index])) return { valueType: 'number', label: 'SpinEdit' };"
)

# SpinEdit focused lifecycle tests.
replace_once(
    'tests/spinedit-stage1.test.js',
    "import fs from 'node:fs';\nimport { compile } from '../src/compiler.js';",
    "import fs from 'node:fs';\nimport { compile } from '../src/compiler.js';\nimport { listDesignerControls } from '../src/designer.js';\nimport { duplicateDesignerControl } from '../web/designer-control-duplicate-model.js';\nimport { copyDesignerControlClipboard, pasteDesignerControlClipboard } from '../web/designer-control-clipboard-model.js';"
)
with Path('tests/spinedit-stage1.test.js').open('a') as f:
    f.write(r'''

test('Designer duplicate gives SpinEdit an independent source-backed number state', () => {
  const selected = listDesignerControls(SOURCE).find(control => control.type === 'slider' && control.id === 'quantity');
  assert.ok(selected);
  const duplicated = duplicateDesignerControl(SOURCE, selected, { offset: false });
  assert.deepEqual(duplicated.idMap, { quantity: 'slider_1' });
  assert.match(duplicated.source, /create number quantity = 3\ncreate number slider_1 = 3/);
  assert.match(duplicated.source, /# @slider-mode spin\n  slider 0\.\.10 as slider_1 step 1/);
  assert.match(duplicated.source, /when slider_1 changed:/);
  assert.doesNotThrow(() => compile(duplicated.source, { kind: 'window' }));
});

test('Designer clipboard carries SpinEdit number state across cut and cross-project paste', () => {
  const selected = listDesignerControls(SOURCE).find(control => control.type === 'slider' && control.id === 'quantity');
  assert.ok(selected);
  const clipboard = copyDesignerControlClipboard(SOURCE, selected);
  assert.deepEqual(clipboard.backingStates, [{ id: 'quantity', valueType: 'number', source: 'create number quantity = 3' }]);
  assert.ok(clipboard.lines.includes('# @slider-mode spin'));

  const target = `window "Target" as target size 520, 320:\n  text "Ready" at 20, 20 size 120, 24\n`;
  const pasted = pasteDesignerControlClipboard(target, clipboard, { windowIndex: 0, offset: false });
  assert.deepEqual(pasted.idMap, { quantity: 'quantity' });
  assert.match(pasted.source, /^create number quantity = 3/m);
  assert.match(pasted.source, /# @slider-mode spin\n  slider 0\.\.10 as quantity step 1/);
  assert.match(pasted.source, /when quantity changed:/);
  assert.doesNotThrow(() => compile(pasted.source, { kind: 'window' }));
});
''')

# Authoring surface documentation.
replace_once(
    'docs/STUDIO_AUTHORING_SURFACE.md',
    "- ProgressBar as number-backed Slider plus `# @slider-mode progress`;\n- GroupBox as ordinary Panel plus `# @panel-mode group`;",
    "- ProgressBar as number-backed Slider plus `# @slider-mode progress`;\n- SpinEdit as number-backed Slider plus `# @slider-mode spin`;\n- GroupBox as ordinary Panel plus `# @panel-mode group`;"
)
replace_once(
    'docs/STUDIO_AUTHORING_SURFACE.md',
    "These presentation contracts remain source-backed. PasswordEdit, MaskedEdit, CheckedListBox, ProgressBar, GroupBox, ScrollBox and SplitContainer are supported in Studio and Standalone Web.",
    "These presentation contracts remain source-backed. PasswordEdit, MaskedEdit, CheckedListBox, ProgressBar, SpinEdit, GroupBox, ScrollBox and SplitContainer are supported in Studio and Standalone Web."
)
replace_once(
    'docs/STUDIO_AUTHORING_SURFACE.md',
    "ProgressBar Stage 1 is passive. It reads the same-id explicit `create number` state and has no control event. Application code changes that number only through ordinary explicit `change`; Studio/Web then re-renders the passive progress presentation.\n\nGroupBox Stage 1",
    "ProgressBar Stage 1 is passive. It reads the same-id explicit `create number` state and has no control event. Application code changes that number only through ordinary explicit `change`; Studio/Web then re-renders the passive progress presentation.\n\nSpinEdit Stage 1 is interactive but does not introduce a second numeric model. It reuses ordinary Slider range, step and finite numeric `changed(value)` semantics while presenting a numeric editor in Studio/Web. The renderer value remains transient until the handler performs explicit `change` on the same-id `create number` state. Duplicate and clipboard operations create or carry an independent explicit backing number state rather than sharing hidden mutable UI state.\n\nGroupBox Stage 1"
)
replace_once(
    'docs/STUDIO_AUTHORING_SURFACE.md',
    "- source-backed backing-state duplication for CheckedListBox and ProgressBar presets;",
    "- source-backed backing-state duplication for CheckedListBox, ProgressBar and SpinEdit presets;"
)
replace_once(
    'docs/STUDIO_AUTHORING_SURFACE.md',
    "Memo/TextArea, PasswordEdit, MaskedEdit, CheckedListBox, ProgressBar, GroupBox, ScrollBox, SplitContainer and positioned Panel-child Stage-2 semantics",
    "Memo/TextArea, PasswordEdit, MaskedEdit, CheckedListBox, ProgressBar, SpinEdit, GroupBox, ScrollBox, SplitContainer and positioned Panel-child Stage-2 semantics"
)
replace_once(
    'docs/STUDIO_AUTHORING_SURFACE.md',
    "- Number/SpinEdit, date/time controls and richer shell controls from the RAD master backlog;",
    "- date/time controls and richer shell controls from the RAD master backlog;"
)

# Roadmap and master backlog.
replace_once(
    'docs/ROADMAP.md',
    "- [x] ProgressBar as passive number-backed Slider presentation via `# @slider-mode progress`, Studio/Web supported with no control event and Current Ready native fail-closed\n- [x] GroupBox",
    "- [x] ProgressBar as passive number-backed Slider presentation via `# @slider-mode progress`, Studio/Web supported with no control event and Current Ready native fail-closed\n- [x] SpinEdit/NumberEdit as interactive number-backed Slider presentation via `# @slider-mode spin`, preserving range/step and numeric `changed(value)`, Studio/Web supported and Current Ready native fail-closed\n- [x] GroupBox"
)
replace_once(
    'docs/ROADMAP.md',
    "- [ ] SpinEdit/NumberEdit and Date/Time controls",
    "- [ ] Date/Time controls"
)
replace_once(
    'docs/RAD_STUDIO_MASTER_BACKLOG.md',
    "plus source-backed PasswordEdit, MaskedEdit, CheckedListBox and ProgressBar presentation contracts;",
    "plus source-backed PasswordEdit, MaskedEdit, CheckedListBox, ProgressBar and SpinEdit presentation contracts;"
)
replace_once(
    'docs/RAD_STUDIO_MASTER_BACKLOG.md',
    "- [ ] SpinEdit/NumberEdit;",
    "- [x] SpinEdit/NumberEdit Stage 1: number-backed Slider plus `# @slider-mode spin`, Studio/Web interactive numeric `changed(value)`, explicit backing number-state lifecycle and Current Ready native unsupported/fail-closed;"
)

# Docs tests.
replace_once(
    'tests/studio-authoring-surface.test.js',
    "  assert.match(surface, /ProgressBar as number-backed Slider plus `# @slider-mode progress`/);\n  assert.match(surface, /GroupBox",
    "  assert.match(surface, /ProgressBar as number-backed Slider plus `# @slider-mode progress`/);\n  assert.match(surface, /SpinEdit as number-backed Slider plus `# @slider-mode spin`/);\n  assert.match(surface, /SpinEdit Stage 1 is interactive but does not introduce a second numeric model/);\n  assert.match(surface, /GroupBox"
)
replace_once(
    'tests/studio-authoring-surface.test.js',
    "  assert.match(surface, /Number\\/SpinEdit, date\\/time controls and richer shell controls/);\n  assert.doesNotMatch(surface, /Number\\/SpinEdit, date\\/time controls, SplitContainer/);",
    "  assert.match(surface, /date\\/time controls and richer shell controls/);\n  assert.doesNotMatch(surface, /Number\\/SpinEdit, date\\/time controls/);"
)
replace_once(
    'tests/docs-current-studio-surface.test.js',
    "  assert.match(roadmap, /ProgressBar as passive number-backed Slider presentation via `# @slider-mode progress`/);\n  assert.match(roadmap, /SpinEdit\\/NumberEdit and Date\\/Time controls/);",
    "  assert.match(roadmap, /ProgressBar as passive number-backed Slider presentation via `# @slider-mode progress`/);\n  assert.match(roadmap, /SpinEdit\\/NumberEdit as interactive number-backed Slider presentation via `# @slider-mode spin`/);\n  assert.match(roadmap, /Next component\\/project priorities:[\\s\\S]*?Date\\/Time controls/);"
)

# Showcase contract gates.
replace_once(
    'tests/studio-showcase.test.js',
    "  assert.match(forms, /row \"SplitContainer\", \"Two-pane Panel\", \"Studio\\/Web\"/);",
    "  assert.match(forms, /row \"SpinEdit\", \"Interactive Slider\", \"Studio\\/Web\"/);\n  assert.match(forms, /row \"SplitContainer\", \"Two-pane Panel\", \"Studio\\/Web\"/);"
)
replace_once(
    'tests/studio-showcase.test.js',
    "  assert.match(forms, /panel as split_demo[^\\n]*:\\n    # @panel-split vertical 42[\\s\\S]*?# @panel-split-break/);",
    "  assert.match(forms, /panel as split_demo[^\\n]*:\\n    # @panel-split vertical 42[\\s\\S]*?# @panel-split-break/);\n  assert.match(forms, /# @slider-mode spin\\n  slider 1\\.\\.10 as split_step step 1/);"
)
replace_once(
    'tests/studio-showcase.test.js',
    "  assert.match(composition.source, /# @slider-mode progress/);",
    "  assert.match(composition.source, /# @slider-mode progress/);\n  assert.match(composition.source, /# @slider-mode spin/);"
)
replace_once(
    'tests/studio-showcase.test.js',
    "  assert.equal(compiled.windowSliderPresentation.controls.some(control => control.mode === 'progress' && control.id === 'completion'), true);",
    "  assert.equal(compiled.windowSliderPresentation.controls.some(control => control.mode === 'progress' && control.id === 'completion'), true);\n  assert.equal(compiled.windowSliderPresentation.controls.some(control => control.mode === 'spin' && control.id === 'split_step'), true);"
)
replace_once(
    'tests/studio-showcase.test.js',
    "  assert.doesNotMatch(composition.source, /when split_demo (?:changed|resized|split):/);",
    "  assert.doesNotMatch(composition.source, /when split_demo (?:changed|resized|split):/);\n  assert.match(composition.source, /when split_step changed:\\n  change split_step:\\n    set = value/);"
)
replace_once(
    'tests/studio-showcase.test.js',
    "  assert.equal(built.metadata.progressBarMode, 'passive-number-state-presentation');",
    "  assert.equal(built.metadata.progressBarMode, 'passive-number-state-presentation');\n  assert.equal(built.metadata.spinEditStage, 1);\n  assert.equal(built.metadata.spinEditMode, 'interactive-number-state-presentation');"
)
replace_once(
    'tests/studio-showcase.test.js',
    "  assert.match(built.html, /data-patch-window-progressbar/);",
    "  assert.match(built.html, /data-patch-window-progressbar/);\n  assert.match(built.html, /data-patch-window-spinedit/);\n  assert.match(built.html, /patch-spinedit-input/);"
)

# Synchronize readable Showcase sources into canonical project-v4 JSON.
project_path = Path('examples/patch-studio-showcase.patchproject')
bundle = json.loads(project_path.read_text())
source_dir = Path('examples/patch-studio-showcase')
for record in bundle['files']:
    record['content'] = (source_dir / record['path']).read_text()
project_text = json.dumps(bundle, ensure_ascii=False, indent=2) + '\n'
project_path.write_text(project_text)
Path('web/studio-showcase-project.js').write_text(
    '// Generated canonical browser copy of examples/patch-studio-showcase.patchproject.\n'
    '// tests/studio-showcase-loader.test.js keeps the String.raw payload byte-for-byte synchronized.\n'
    'export const PATCH_STUDIO_SHOWCASE_PROJECT = String.raw`' + project_text + '`;\n'
)
