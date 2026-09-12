import fs from 'node:fs';
import { parseStudioProjectBundle, serializeStudioProjectBundle } from '../src/studio-project.js';

function replaceOnce(path, before, after) {
  const source = fs.readFileSync(path, 'utf8');
  const count = source.split(before).length - 1;
  if (count !== 1) throw new Error(`${path}: expected one integration anchor, found ${count}: ${before.slice(0, 100)}`);
  fs.writeFileSync(path, source.replace(before, after));
}

replaceOnce(
  'examples/patch-studio-showcase/main.patch',
  'Layout, TabOrder, Locked, PasswordEdit, MaskedEdit, NumberEdit, DatePicker, TimePicker, Calendar and the current Panel/List/Slider presentations stay source-backed.',
  'Layout, TabOrder, Locked, PasswordEdit, MaskedEdit, NumberEdit, DatePicker, TimePicker, Calendar, LinkLabel and the current Panel/List/Slider presentations stay source-backed.'
);

replaceOnce(
  'examples/patch-studio-showcase/forms.patch',
  '    row "Calendar", "Inline month-grid Input", "Studio/Web"\n    row "CheckedListBox", "List presentation", "Studio/Web"',
  '    row "Calendar", "Inline month-grid Input", "Studio/Web"\n    row "LinkLabel", "Button link presentation", "Studio/Web"\n    row "CheckedListBox", "List presentation", "Studio/Web"'
);
replaceOnce(
  'examples/patch-studio-showcase/forms.patch',
  '        node "Button"\n        node "Input"',
  '        node "Button"\n        node "LinkLabel"\n        node "Input"'
);
replaceOnce(
  'examples/patch-studio-showcase/forms.patch',
  '    button "Calendar Lab" as gallery_calendar at 182, 264 size 148, 40\n',
  '    button "Calendar Lab" as gallery_calendar at 182, 264 size 148, 40\n    # @button-mode link\n    button "LinkLabel action" as gallery_link at 18, 318 size 180, 34\n'
);

replaceOnce(
  'examples/patch-studio-showcase/logic.patch',
  'when gallery_update clicked:\n  change gallery_status:\n    set = "Panel child action completed"\n',
  'when gallery_update clicked:\n  change gallery_status:\n    set = "Panel child action completed"\n\nwhen gallery_link clicked:\n  change gallery_status:\n    set = "LinkLabel clicked through ordinary Button semantics"\n'
);

replaceOnce(
  'examples/patch-studio-showcase/README.md',
  '- Calendar as the source-backed `# @input-mode calendar` inline month-grid presentation with ISO `YYYY-MM-DD` text;\n',
  '- Calendar as the source-backed `# @input-mode calendar` inline month-grid presentation with ISO `YYYY-MM-DD` text;\n- LinkLabel as ordinary Button plus source-backed `# @button-mode link`, retaining the normal `clicked` event without implicit navigation;\n'
);
replaceOnce(
  'examples/patch-studio-showcase/README.md',
  '- Memo, PasswordEdit, MaskedEdit, NumberEdit, DatePicker, TimePicker, Calendar, CheckedListBox, ProgressBar, GroupBox, ScrollBox and SplitContainer are Studio/Web Stage-1 surfaces at their present contracts and fail closed for Current Ready native 1.9 / payload v19 / runtime v1.10 where no matching native presentation/containment contract exists.',
  '- Memo, PasswordEdit, MaskedEdit, NumberEdit, DatePicker, TimePicker, Calendar, LinkLabel, CheckedListBox, ProgressBar, GroupBox, ScrollBox and SplitContainer are Studio/Web Stage-1 surfaces at their present contracts and fail closed for Current Ready native 1.9 / payload v19 / runtime v1.10 where no matching native presentation/containment contract exists.'
);

replaceOnce(
  'README.md',
  'source-backed Studio/Web R4 presentations for PasswordEdit, MaskedEdit, NumberEdit, DatePicker, TimePicker, Calendar, CheckedListBox, ProgressBar, GroupBox, ScrollBox, and SplitContainer, with unsupported Current Ready native combinations failing closed;',
  'source-backed Studio/Web R4 presentations for PasswordEdit, MaskedEdit, NumberEdit, DatePicker, TimePicker, Calendar, LinkLabel, CheckedListBox, ProgressBar, GroupBox, ScrollBox, and SplitContainer, with unsupported Current Ready native combinations failing closed;'
);

replaceOnce(
  'docs/STUDIO_AUTHORING_SURFACE.md',
  '- Calendar as ordinary Input plus `# @input-mode calendar`;\n- CheckedListBox',
  '- Calendar as ordinary Input plus `# @input-mode calendar`;\n- LinkLabel as ordinary Button plus `# @button-mode link`, preserving the ordinary `clicked` event without implicit browser navigation;\n- CheckedListBox'
);
replaceOnce(
  'docs/STUDIO_AUTHORING_SURFACE.md',
  'PasswordEdit, MaskedEdit, NumberEdit, DatePicker, TimePicker, Calendar, CheckedListBox, ProgressBar, GroupBox, ScrollBox and SplitContainer are supported in Studio and Standalone Web.',
  'PasswordEdit, MaskedEdit, NumberEdit, DatePicker, TimePicker, Calendar, LinkLabel, CheckedListBox, ProgressBar, GroupBox, ScrollBox and SplitContainer are supported in Studio and Standalone Web.'
);
replaceOnce(
  'docs/STUDIO_AUTHORING_SURFACE.md',
  'Layout, TabOrder, Locked, PasswordEdit, MaskedEdit, NumberEdit, DatePicker, TimePicker, Calendar, CheckedListBox, ProgressBar and GroupBox metadata move with their control',
  'Layout, TabOrder, Locked, PasswordEdit, MaskedEdit, NumberEdit, DatePicker, TimePicker, Calendar, LinkLabel, CheckedListBox, ProgressBar and GroupBox metadata move with their control'
);

replaceOnce(
  'docs/ROADMAP.md',
  '- [x] Calendar as `# @input-mode calendar` presentation of ordinary Input, Studio/Web inline month grid with ISO date text `changed(value)` and Current Ready native fail-closed\n- [x] CheckedListBox',
  '- [x] Calendar as `# @input-mode calendar` presentation of ordinary Input, Studio/Web inline month grid with ISO date text `changed(value)` and Current Ready native fail-closed\n- [x] LinkLabel as `# @button-mode link` presentation of ordinary Button, Studio/Web link styling with ordinary `clicked` semantics, no implicit navigation and Current Ready native fail-closed\n- [x] CheckedListBox'
);
replaceOnce(
  'docs/RAD_STUDIO_MASTER_BACKLOG.md',
  '- [ ] LinkLabel;',
  '- [x] LinkLabel Stage 1: ordinary Button plus `# @button-mode link`, Studio/Web link presentation with ordinary `clicked` semantics and no implicit navigation, Current Ready native unsupported/fail-closed;'
);

replaceOnce(
  'web/index.html',
  'Patch Studio beta.36+: source-backed RAD development with Project v4, Calendar and current R4 Studio/Web presentations, plus verified Native GUI IR 1.9 / runtime v1.10 Ready builds.',
  'Patch Studio beta.36+: source-backed RAD development with Project v4, Calendar, LinkLabel and current R4 Studio/Web presentations, plus verified Native GUI IR 1.9 / runtime v1.10 Ready builds.'
);
replaceOnce(
  'web/index.html',
  'Picture, Shape, PaintBox, TimePicker, Calendar and the current R4 presentation family extend the source-backed Designer;',
  'Picture, Shape, PaintBox, TimePicker, Calendar, LinkLabel and the current R4 presentation family extend the source-backed Designer;'
);
replaceOnce(
  'web/index.html',
  'PasswordEdit, MaskedEdit, NumberEdit, DatePicker, TimePicker and Calendar source-backed Input presentations on Studio/Web;',
  'PasswordEdit, MaskedEdit, NumberEdit, DatePicker, TimePicker and Calendar source-backed Input presentations plus LinkLabel Button presentation on Studio/Web;'
);

replaceOnce(
  'tests/studio-showcase.test.js',
  '  assert.match(forms, /button "Calendar Lab" as gallery_calendar/);\n',
  '  assert.match(forms, /button "Calendar Lab" as gallery_calendar/);\n  assert.match(forms, /# @button-mode link\\n    button "LinkLabel action" as gallery_link/);\n  assert.match(forms, /row "LinkLabel", "Button link presentation", "Studio\\/Web"/);\n'
);
replaceOnce(
  'tests/studio-showcase.test.js',
  '  assert.match(composition.source, /# @input-mode calendar/);\n  assert.match(composition.source, /# @listbox-mode checked/);',
  '  assert.match(composition.source, /# @input-mode calendar/);\n  assert.match(composition.source, /# @button-mode link/);\n  assert.match(composition.source, /# @listbox-mode checked/);'
);
replaceOnce(
  'tests/studio-showcase.test.js',
  "  assert.equal(compiled.windowInputPresentation.controls.some(control => control.mode === 'calendar'), true);\n  assert.equal(compiled.windowNumberEdit.controls.some(control => control.id === 'nested_number'), true);",
  "  assert.equal(compiled.windowInputPresentation.controls.some(control => control.mode === 'calendar'), true);\n  assert.equal(compiled.windowButtonPresentation.controls.some(control => control.mode === 'link' && control.id === 'gallery_link'), true);\n  assert.equal(compiled.windowNumberEdit.controls.some(control => control.id === 'nested_number'), true);"
);
replaceOnce(
  'tests/studio-showcase.test.js',
  "  assert.equal(built.metadata.calendarEventValue, 'iso-date-text');\n  assert.equal(built.metadata.numberEditStage, 1);",
  "  assert.equal(built.metadata.calendarEventValue, 'iso-date-text');\n  assert.equal(built.metadata.linkLabelStage, 1);\n  assert.equal(built.metadata.linkLabelMode, 'source-backed-button-presentation');\n  assert.equal(built.metadata.linkLabelEvent, 'clicked');\n  assert.equal(built.metadata.numberEditStage, 1);"
);
replaceOnce(
  'tests/studio-showcase.test.js',
  '  assert.match(built.html, /patch-calendar-grid/);\n  assert.match(built.html, /dataset\\.patchInputPresentation=\'number\'/);',
  '  assert.match(built.html, /patch-calendar-grid/);\n  assert.match(built.html, /patch-linklabel/);\n  assert.match(built.html, /patchButtonPresentation=\'link\'/);\n  assert.match(built.html, /dataset\\.patchInputPresentation=\'number\'/);'
);

replaceOnce(
  'tests/docs-current-studio-surface.test.js',
  '  assert.match(roadmap, /Calendar as `# @input-mode calendar`/);\n  assert.equal(roadmap.includes("- [ ] Calendar"), false);',
  '  assert.match(roadmap, /Calendar as `# @input-mode calendar`/);\n  assert.match(roadmap, /LinkLabel as `# @button-mode link`/);\n  assert.equal(roadmap.includes("- [ ] Calendar"), false);\n  assert.equal(roadmap.includes("- [ ] LinkLabel"), false);'
);

const projectPath = 'examples/patch-studio-showcase.patchproject';
const bundle = parseStudioProjectBundle(fs.readFileSync(projectPath, 'utf8'));
for (const file of bundle.files) {
  const sourcePath = `examples/patch-studio-showcase/${file.path}`;
  file.content = fs.readFileSync(sourcePath, 'utf8');
}
const canonical = serializeStudioProjectBundle(bundle);
if (canonical.includes('`')) throw new Error('Showcase canonical JSON unexpectedly contains a backtick and cannot be embedded raw.');
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

console.log('LinkLabel Showcase, docs, public surface and canonical project integration applied.');
