import fs from 'node:fs';

function edit(path, transform) {
  const before = fs.readFileSync(path, 'utf8');
  const after = transform(before);
  if (after === before) throw new Error(`No change produced for ${path}`);
  fs.writeFileSync(path, after);
}

function once(source, before, after, label) {
  const count = source.split(before).length - 1;
  if (count !== 1) throw new Error(`Expected one anchor for ${label}, found ${count}`);
  return source.replace(before, after);
}

edit('examples/patch-studio-showcase/forms.patch', source => once(
  source,
  '  text "Data & component contracts" at 44, 140 size 300, 26\n  table "Control", "Contract", "Surface" as gallery_table at 44, 178 size 414, 222:',
  '  text "Data & component contracts" at 44, 140 size 300, 26\n  # @table-columns 136:left, 174:left, 104:center\n  table "Control", "Contract", "Surface" as gallery_table at 44, 178 size 414, 222:',
  'Showcase advanced Table columns'
));

edit('examples/patch-studio-showcase/README.md', source => once(
  source,
  '- every Component Registry 0.10 type: Text, Button, Input, Memo, Checkbox, Radio, ComboBox, ListBox, Slider, Table, TreeView, Tabs, Panel, Picture, Shape, PaintBox, StatusBar, Timer and ImageList;\n',
  '- every Component Registry 0.10 type: Text, Button, Input, Memo, Checkbox, Radio, ComboBox, ListBox, Slider, Table, TreeView, Tabs, Panel, Picture, Shape, PaintBox, StatusBar, Timer and ImageList;\n- advanced Table columns as source-backed `# @table-columns 136:left, 174:left, 104:center`, proving per-column pixel/auto width and left/center/right alignment without changing Table row or event semantics;\n',
  'Showcase README Table columns coverage'
));

edit('README.md', source => once(
  source,
  '- structural editors for Table, TreeView, Tabs, and Panel;\n',
  '- structural editors for Table, TreeView, Tabs, and Panel;\n- advanced Table/DataGrid column presentation on Studio/Web through source-backed per-column width and alignment, with Current Ready native failing closed rather than dropping the metadata;\n',
  'root README Table columns status'
));

edit('docs/STUDIO_AUTHORING_SURFACE.md', source => {
  let out = once(
    source,
    '- invalid row widths and invalid structures fail closed.\n\n## TreeView',
    '- invalid row widths and invalid structures fail closed;\n- source-backed per-column width (`auto` or 40-2000 px) and alignment (`left`, `center`, `right`) through `# @table-columns ...`.\n\nAdvanced Table columns Stage 1 is presentation metadata only. It does not change Table syntax, row data, transient `changed(value)` selection, persistent application state or Change IR. Studio and Standalone Web render the widths/alignment; Current Ready Native GUI IR 1.9 / payload v19 / runtime v1.10 fails closed when the directive is present rather than silently discarding it. Column add/remove/reorder/duplicate operations keep the presentation entries structurally aligned with their columns.\n\n## TreeView',
    'authoring Table Stage 1 section'
  );
  out = once(
    out,
    'Memo/TextArea, PasswordEdit, MaskedEdit, NumberEdit, DatePicker, TimePicker, Calendar, CheckedListBox, ProgressBar, GroupBox, ScrollBox, SplitContainer and positioned Panel-child Stage-2 semantics do not silently widen Native GUI IR 1.9.',
    'Memo/TextArea, PasswordEdit, MaskedEdit, NumberEdit, DatePicker, TimePicker, Calendar, CheckedListBox, ProgressBar, advanced Table columns, GroupBox, ScrollBox, SplitContainer and positioned Panel-child Stage-2 semantics do not silently widen Native GUI IR 1.9.',
    'authoring native Table columns boundary'
  );
  return out;
});

edit('docs/RAD_STUDIO_MASTER_BACKLOG.md', source => {
  let out = once(source, 'Status synchronized: **2026-09-06**', 'Status synchronized: **2026-09-13**', 'backlog sync date');
  out = once(
    out,
    '- [ ] advanced Table/DataGrid columns;',
    '- [x] advanced Table/DataGrid columns Stage 1: source-backed per-column width/alignment on Studio/Web, structural Designer editing preserves metadata, Current Ready native fails closed;',
    'backlog Table columns completion'
  );
  return out;
});

edit('web/examples.html', source => once(
  source,
  'The canonical multi-file Project-v4 acceptance project covers every Registry 0.10 component plus the current source-backed R4 presets. It includes PasswordEdit, MaskedEdit, NumberEdit, DatePicker, TimePicker, CheckedListBox and a passive number-backed ProgressBar using <code># @slider-mode progress</code>. It is selectable directly in hosted and Offline Studio.',
  'The canonical multi-file Project-v4 acceptance project covers every Registry 0.10 component plus the current source-backed R4 presets and advanced Table columns. Its Component Gallery demonstrates source-backed per-column width/alignment alongside PasswordEdit, MaskedEdit, NumberEdit, DatePicker, TimePicker, CheckedListBox and passive ProgressBar. It is selectable directly in hosted and Offline Studio.',
  'public Showcase Table columns description'
));

edit('tests/table-columns-stage1.test.js', source => {
  const marker = "test('Patch Studio Table editor exposes width and alignment without a second state model', () => {";
  if (!source.includes(marker)) throw new Error('Table columns test marker missing');
  if (source.includes("canonical Showcase visibly exercises advanced Table columns")) throw new Error('Showcase Table columns test already present');
  return source + `\n\ntest('canonical Showcase visibly exercises advanced Table columns and documents the target boundary', () => {\n  const forms = fs.readFileSync('examples/patch-studio-showcase/forms.patch', 'utf8');\n  const showcaseReadme = fs.readFileSync('examples/patch-studio-showcase/README.md', 'utf8');\n  const rootReadme = fs.readFileSync('README.md', 'utf8');\n  const authoring = fs.readFileSync('docs/STUDIO_AUTHORING_SURFACE.md', 'utf8');\n  const backlog = fs.readFileSync('docs/RAD_STUDIO_MASTER_BACKLOG.md', 'utf8');\n  const examples = fs.readFileSync('web/examples.html', 'utf8');\n  assert.match(forms, /# @table-columns 136:left, 174:left, 104:center\\n  table \"Control\", \"Contract\", \"Surface\" as gallery_table/);\n  assert.match(showcaseReadme, /advanced Table columns as source-backed/);\n  assert.match(rootReadme, /advanced Table\\/DataGrid column presentation/);\n  assert.match(authoring, /Advanced Table columns Stage 1 is presentation metadata only/);\n  assert.match(authoring, /Current Ready Native GUI IR 1\\.9 \\/ payload v19 \\/ runtime v1\\.10 fails closed/);\n  assert.match(backlog, /\\[x\\] advanced Table\\/DataGrid columns Stage 1/);\n  assert.match(examples, /current source-backed R4 presets and advanced Table columns/);\n});\n`;
});

const projectPath = 'examples/patch-studio-showcase.patchproject';
const bundle = JSON.parse(fs.readFileSync(projectPath, 'utf8'));
for (const file of bundle.files ?? []) {
  const readable = `examples/patch-studio-showcase/${file.path}`;
  if (fs.existsSync(readable)) file.content = fs.readFileSync(readable, 'utf8');
}
const canonical = JSON.stringify(bundle, null, 2) + '\n';
if (canonical.includes('`') || canonical.includes('${')) throw new Error('Showcase project cannot be embedded byte-for-byte in String.raw safely.');
fs.writeFileSync(projectPath, canonical);
fs.writeFileSync(
  'web/studio-showcase-project.js',
  '// Generated canonical browser copy of examples/patch-studio-showcase.patchproject.\n' +
  '// tests/studio-showcase-loader.test.js keeps the String.raw payload byte-for-byte synchronized.\n' +
  'export const PATCH_STUDIO_SHOWCASE_PROJECT = String.raw`' + canonical + '`;\n'
);

console.log('Advanced Table columns Showcase/docs polish applied and canonical project synchronized.');
