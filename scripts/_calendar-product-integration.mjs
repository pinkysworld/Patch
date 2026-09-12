import fs from 'node:fs';

function edit(path, transform) {
  const before = fs.readFileSync(path, 'utf8');
  const after = transform(before);
  if (after !== before) fs.writeFileSync(path, after);
}

function replaceStable(source, before, after, label) {
  if (source.includes(after)) return source;
  if (!source.includes(before)) throw new Error(`Missing anchor: ${label}`);
  return source.replace(before, after);
}

function appendStable(source, marker, addition, label) {
  if (source.includes(marker)) return source;
  if (!source.endsWith('\n')) source += '\n';
  return `${source}${addition}`;
}

edit('examples/patch-studio-showcase/main.patch', source => {
  let s = source;
  s = replaceStable(
    s,
    'create text review_time = "14:30"\ncreate text gallery_status = "Component Gallery ready"',
    'create text review_time = "14:30"\ncreate text calendar_date = "2026-09-12"\ncreate text calendar_status = "Calendar ready"\ncreate text gallery_status = "Component Gallery ready"',
    'Showcase Calendar state'
  );
  s = replaceStable(
    s,
    'text "Layout, TabOrder, Locked, PasswordEdit, MaskedEdit, NumberEdit, DatePicker, TimePicker and the current Panel/List/Slider presentations stay source-backed."',
    'text "Layout, TabOrder, Locked, PasswordEdit, MaskedEdit, NumberEdit, DatePicker, TimePicker, Calendar and the current Panel/List/Slider presentations stay source-backed."',
    'Showcase semantics Calendar copy'
  );
  return s;
});

edit('examples/patch-studio-showcase/forms.patch', source => {
  let s = source;
  s = replaceStable(
    s,
    '    row "TimePicker", "Time Input presentation", "Studio/Web"\n    row "CheckedListBox", "List presentation", "Studio/Web"',
    '    row "TimePicker", "Time Input presentation", "Studio/Web"\n    row "Calendar", "Inline month-grid Input", "Studio/Web"\n    row "CheckedListBox", "List presentation", "Studio/Web"',
    'Showcase Calendar contract row'
  );
  s = replaceStable(
    s,
    '    button "Split Lab" as gallery_split at 18, 264 size 150, 40',
    '    button "Split Lab" as gallery_split at 18, 264 size 150, 40\n    button "Calendar Lab" as gallery_calendar at 182, 264 size 148, 40',
    'Showcase Calendar Lab launcher'
  );
  s = appendStable(
    s,
    'window "Calendar Lab" as calendar_lab',
    `\nwindow "Calendar Lab" as calendar_lab size 760, 620:\n  # @locked\n  shape rounded as calendar_header fill #fff7ed stroke #fed7aa stroke-width 1 radius 20 opacity 1 at 24, 18 size 712, 84\n  text "Calendar Lab" at 44, 36 size 300, 32\n  text "An inline month grid backed by ordinary ISO date text and explicit change." at 44, 68 size 520, 22\n  text "{calendar_status}" at 548, 42 size 168, 38\n\n  # @locked\n  shape rounded as calendar_card fill #ffffff stroke #dbe3ef stroke-width 1 radius 18 opacity 1 at 24, 124 size 712, 388\n  # @input-mode calendar\n  input calendar_date at 44, 148 size 320, 330\n  text "Selected date" at 400, 166 size 180, 22\n  text "{calendar_date}" at 400, 198 size 280, 32\n  text "Month navigation is transient UI state. Selecting a day emits changed(value); only the handler persists it." at 400, 250 size 292, 96\n\n  button "Back to Gallery" as calendar_gallery at 44, 536 size 180, 40\n  button "Close Calendar Lab" as close_calendar_lab at 240, 536 size 190, 40\n  statusbar "{calendar_status}" as calendar_statusbar at 0, 592 size 760, 28\n`,
    'Showcase Calendar Lab form'
  );
  return s;
});

edit('examples/patch-studio-showcase/logic.patch', source => {
  let s = source;
  s = replaceStable(
    s,
    'when review_time changed:\n  change review_time:\n    set = value\n  change status:\n    set = "TimePicker selection updated"\n',
    'when review_time changed:\n  change review_time:\n    set = value\n  change status:\n    set = "TimePicker selection updated"\n\nwhen calendar_date changed:\n  change calendar_date:\n    set = value\n  change calendar_status:\n    set = "Calendar date selection persisted explicitly"\n',
    'Showcase Calendar changed handler'
  );
  s = appendStable(
    s,
    'when gallery_calendar clicked:',
    `\nwhen gallery_calendar clicked:\n  open calendar_lab\n  change calendar_status:\n    set = "Calendar Lab opened from Component Gallery"\n\nwhen calendar_gallery clicked:\n  open components\n  close calendar_lab\n  change gallery_status:\n    set = "Returned from Calendar Lab"\n\nwhen close_calendar_lab clicked:\n  close calendar_lab\n  change status:\n    set = "Returned from Calendar Lab"\n`,
    'Showcase Calendar navigation handlers'
  );
  return s;
});

const calendarExample = `create text selected_date = "2026-09-12"\ncreate text status = "Choose a date from the inline month grid."\n\nwindow "Calendar" as main size 760, 500:\n  text "Calendar Stage 1" at 24, 24 size 320, 30\n  # @input-mode calendar\n  input selected_date at 24, 70 size 320, 330\n  text "Selected date" at 388, 90 size 180, 24\n  text "{selected_date}" at 388, 124 size 300, 34\n  text "{status}" at 388, 180 size 320, 72\n\nwhen selected_date changed:\n  change selected_date:\n    set = value\n  change status:\n    set = "Calendar changed with ISO YYYY-MM-DD text"\n`;
if (!fs.existsSync('examples/calendar-window.patch')) fs.writeFileSync('examples/calendar-window.patch', calendarExample);
else if (fs.readFileSync('examples/calendar-window.patch', 'utf8') !== calendarExample) fs.writeFileSync('examples/calendar-window.patch', calendarExample);

edit('examples/patch-studio-showcase/README.md', source => {
  let s = source;
  s = replaceStable(
    s,
    '- **Split Lab** isolates SplitContainer Stage 1 as a two-pane source-backed Panel with a real pointer/keyboard divider, keeping the initial ratio in source and runtime divider movement transient.',
    '- **Split Lab** isolates SplitContainer Stage 1 as a two-pane source-backed Panel with a real pointer/keyboard divider, keeping the initial ratio in source and runtime divider movement transient.\n- **Calendar Lab** gives the inline Calendar Stage 1 presentation enough room to behave like a real date-selection surface instead of crowding the dashboard.',
    'Showcase README Calendar Lab'
  );
  s = replaceStable(
    s,
    '- TimePicker as the source-backed `# @input-mode time` Input presentation with local `HH:MM` text;\n- CheckedListBox',
    '- TimePicker as the source-backed `# @input-mode time` Input presentation with local `HH:MM` text;\n- Calendar as the source-backed `# @input-mode calendar` inline month-grid presentation with ISO `YYYY-MM-DD` text;\n- CheckedListBox',
    'Showcase README Calendar coverage'
  );
  s = replaceStable(
    s,
    'Memo, PasswordEdit, MaskedEdit, NumberEdit, DatePicker, TimePicker, CheckedListBox, ProgressBar, GroupBox, ScrollBox and SplitContainer',
    'Memo, PasswordEdit, MaskedEdit, NumberEdit, DatePicker, TimePicker, Calendar, CheckedListBox, ProgressBar, GroupBox, ScrollBox and SplitContainer',
    'Showcase README native boundary'
  );
  return s;
});

edit('README.md', source => replaceStable(
  source,
  'source-backed Studio/Web R4 presentations for PasswordEdit, MaskedEdit, NumberEdit, DatePicker, TimePicker, CheckedListBox, ProgressBar, GroupBox, ScrollBox, and SplitContainer, with unsupported Current Ready native combinations failing closed;',
  'source-backed Studio/Web R4 presentations for PasswordEdit, MaskedEdit, NumberEdit, DatePicker, TimePicker, Calendar, CheckedListBox, ProgressBar, GroupBox, ScrollBox, and SplitContainer, with unsupported Current Ready native combinations failing closed;',
  'README Calendar surface'
));

edit('docs/ROADMAP.md', source => {
  let s = source;
  s = replaceStable(
    s,
    '- [x] TimePicker as `# @input-mode time` presentation of ordinary Input, Studio/Web browser time editor with local `HH:MM` text `changed(value)` and Current Ready native fail-closed\n- [x] CheckedListBox',
    '- [x] TimePicker as `# @input-mode time` presentation of ordinary Input, Studio/Web browser time editor with local `HH:MM` text `changed(value)` and Current Ready native fail-closed\n- [x] Calendar as `# @input-mode calendar` presentation of ordinary Input, Studio/Web inline month grid with ISO date text `changed(value)` and Current Ready native fail-closed\n- [x] CheckedListBox',
    'ROADMAP Calendar implemented'
  );
  s = s.replace('\n- [ ] Calendar\n- [ ] richer TreeView/ListView/Table metadata and image bindings', '\n- [ ] richer TreeView/ListView/Table metadata and image bindings');
  return s;
});

edit('docs/RAD_STUDIO_MASTER_BACKLOG.md', source => replaceStable(
  source,
  '- [ ] Calendar;\n- [ ] LinkLabel;',
  '- [x] Calendar Stage 1: ordinary Input plus `# @input-mode calendar`, Studio/Web inline month-grid presentation with transient month navigation and ISO date text `changed(value)`, Current Ready native unsupported/fail-closed;\n- [ ] LinkLabel;',
  'RAD backlog Calendar checked'
));

edit('docs/STUDIO_AUTHORING_SURFACE.md', source => {
  let s = source;
  s = replaceStable(s, '- TimePicker as ordinary Input plus `# @input-mode time`;\n- CheckedListBox', '- TimePicker as ordinary Input plus `# @input-mode time`;\n- Calendar as ordinary Input plus `# @input-mode calendar`;\n- CheckedListBox', 'Authoring Calendar list');
  s = s.replaceAll('PasswordEdit, MaskedEdit, NumberEdit, DatePicker, TimePicker, CheckedListBox', 'PasswordEdit, MaskedEdit, NumberEdit, DatePicker, TimePicker, Calendar, CheckedListBox');
  s = s.replaceAll('Layout, TabOrder, Locked, PasswordEdit, MaskedEdit, NumberEdit, DatePicker, TimePicker, CheckedListBox', 'Layout, TabOrder, Locked, PasswordEdit, MaskedEdit, NumberEdit, DatePicker, TimePicker, Calendar, CheckedListBox');
  s = replaceStable(
    s,
    'Input presentations retain the ordinary Input `changed(value)` text contract: NumberEdit emits numeric text and DatePicker emits browser date text in `YYYY-MM-DD` form when a date is selected.',
    'Input presentations retain the ordinary Input `changed(value)` text contract: NumberEdit emits numeric text, DatePicker emits browser date text, TimePicker emits local `HH:MM` text, and Calendar emits ISO `YYYY-MM-DD` text when a day is selected. Calendar month navigation is transient view state and emits no Patch change by itself.',
    'Authoring Calendar semantics'
  );
  s = s.replace('Calendar and richer date/time or shell controls from the RAD master backlog;', 'richer date/time or shell controls from the RAD master backlog;');
  return s;
});

edit('web/index.html', source => {
  let s = source;
  s = s.replace('Project v4, TimePicker and current R4 Studio/Web presentations', 'Project v4, Calendar and current R4 Studio/Web presentations');
  s = s.replace('Picture, Shape, PaintBox, TimePicker and the current R4 presentation family', 'Picture, Shape, PaintBox, TimePicker, Calendar and the current R4 presentation family');
  s = s.replace('PasswordEdit, MaskedEdit, NumberEdit, DatePicker and TimePicker source-backed Input presentations on Studio/Web;', 'PasswordEdit, MaskedEdit, NumberEdit, DatePicker, TimePicker and Calendar source-backed Input presentations on Studio/Web;');
  return s;
});

edit('web/examples.html', source => {
  let s = source;
  s = replaceStable(
    s,
    '<tr><td><strong>TimePicker Window</strong></td><td>Studio/Web source-backed <code># @input-mode time</code> with local <code>HH:MM</code> text and explicit native fail-closed behavior.</td><td><a href="https://github.com/pinkysworld/Patch/blob/main/examples/timepicker-window.patch"><code>timepicker-window.patch</code></a></td></tr>',
    '<tr><td><strong>TimePicker Window</strong></td><td>Studio/Web source-backed <code># @input-mode time</code> with local <code>HH:MM</code> text and explicit native fail-closed behavior.</td><td><a href="https://github.com/pinkysworld/Patch/blob/main/examples/timepicker-window.patch"><code>timepicker-window.patch</code></a></td></tr>\n        <tr><td><strong>Calendar Window</strong></td><td>Studio/Web inline month grid via <code># @input-mode calendar</code>, transient month navigation and explicit ISO-date persistence.</td><td><a href="https://github.com/pinkysworld/Patch/blob/main/examples/calendar-window.patch"><code>calendar-window.patch</code></a></td></tr>',
    'Examples Calendar row'
  );
  s = s.replace('NumberEdit, DatePicker, TimePicker, CheckedListBox', 'NumberEdit, DatePicker, TimePicker, Calendar, CheckedListBox');
  return s;
});

edit('tests/studio-showcase.test.js', source => {
  let s = source;
  s = replaceStable(
    s,
    '  assert.match(forms, /button "Split Lab" as gallery_split/);\n  assert.match(forms, /window "Split Lab" as split_lab size 820, 560/);',
    '  assert.match(forms, /button "Split Lab" as gallery_split/);\n  assert.match(forms, /button "Calendar Lab" as gallery_calendar/);\n  assert.match(forms, /window "Split Lab" as split_lab size 820, 560/);\n  assert.match(forms, /window "Calendar Lab" as calendar_lab size 760, 620/);\n  assert.match(forms, /row "Calendar", "Inline month-grid Input", "Studio\\/Web"/);',
    'Showcase test Calendar visual hierarchy'
  );
  s = replaceStable(s, '  assert.match(composition.source, /# @input-mode time/);\n  assert.match(composition.source, /# @listbox-mode checked/);', '  assert.match(composition.source, /# @input-mode time/);\n  assert.match(composition.source, /# @input-mode calendar/);\n  assert.match(composition.source, /# @listbox-mode checked/);', 'Showcase Calendar source directive');
  s = replaceStable(s, "  assert.equal(compiled.windowInputPresentation.controls.some(control => control.mode === 'time'), true);\n  assert.equal(compiled.windowNumberEdit", "  assert.equal(compiled.windowInputPresentation.controls.some(control => control.mode === 'time'), true);\n  assert.equal(compiled.windowInputPresentation.controls.some(control => control.mode === 'calendar'), true);\n  assert.equal(compiled.windowNumberEdit", 'Showcase Calendar compile manifest');
  s = replaceStable(s, "  assert.equal(built.metadata.timePickerEventValue, 'local-time-text');\n  assert.equal(built.metadata.numberEditStage, 1);", "  assert.equal(built.metadata.timePickerEventValue, 'local-time-text');\n  assert.equal(built.metadata.calendarStage, 1);\n  assert.equal(built.metadata.calendarMode, 'source-backed-inline-month-grid');\n  assert.equal(built.metadata.calendarEventValue, 'iso-date-text');\n  assert.equal(built.metadata.numberEditStage, 1);", 'Showcase Calendar web metadata');
  s = replaceStable(s, "  assert.match(built.html, /dataset\\.patchInputPresentation='time'/);\n  assert.match(built.html, /dataset\\.patchInputPresentation='number'/);", "  assert.match(built.html, /dataset\\.patchInputPresentation='time'/);\n  assert.match(built.html, /patch-calendar-grid/);\n  assert.match(built.html, /dataset\\.patchInputPresentation='number'/);", 'Showcase Calendar web render');
  return s;
});

edit('tests/docs-current-studio-surface.test.js', source => replaceStable(
  source,
  '  assert.equal(roadmap.includes("- [ ] Calendar"), true);',
  '  assert.match(roadmap, /Calendar as `# @input-mode calendar`/);\n  assert.equal(roadmap.includes("- [ ] Calendar"), false);',
  'Docs Calendar roadmap assertion'
));

edit('tests/handbook-site.test.js', source => {
  let s = source;
  s = replaceStable(s, "  assert.match(examples, /Patch Studio Showcase/);\n  assert.match(examples, /Workshop Desk/);", "  assert.match(examples, /Patch Studio Showcase/);\n  assert.match(examples, /Workshop Desk/);\n  assert.match(examples, /Calendar Window/);", 'Handbook Calendar visible');
  s = s.replace("'combo-window.patch', 'workshop-desk.patch'", "'combo-window.patch', 'calendar-window.patch', 'workshop-desk.patch'");
  return s;
});

const projectPath = 'examples/patch-studio-showcase.patchproject';
const bundle = JSON.parse(fs.readFileSync(projectPath, 'utf8'));
for (const file of bundle.files) {
  const sourcePath = `examples/patch-studio-showcase/${file.path}`;
  if (!fs.existsSync(sourcePath)) throw new Error(`Missing Showcase source ${sourcePath}`);
  file.content = fs.readFileSync(sourcePath, 'utf8');
}
const canonical = `${JSON.stringify(bundle, null, 2)}\n`;
if (canonical.includes('`') || canonical.includes('${')) throw new Error('Showcase canonical payload cannot be embedded losslessly in String.raw.');
fs.writeFileSync(projectPath, canonical);
fs.writeFileSync('web/studio-showcase-project.js', `// Generated canonical browser copy of examples/patch-studio-showcase.patchproject.\n// tests/studio-showcase-loader.test.js keeps the String.raw payload byte-for-byte synchronized.\nexport const PATCH_STUDIO_SHOWCASE_PROJECT = String.raw\`${canonical}\`;\n`);

console.log('Calendar product integration applied and Showcase bundle regenerated.');
