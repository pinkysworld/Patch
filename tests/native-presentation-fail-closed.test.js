import test from 'node:test';
import assert from 'node:assert/strict';
import { compile } from '../src/compiler.js';
import { buildCurrentNativeGuiIR, flattenCurrentNativeGuiControls } from '../src/native-current-contract.js';
import { buildNativeGuiPlan } from '../src/native-gui-build-plan.js';
import { NativeGuiError } from '../src/native-gui-frozen-lower.js';

const TREE_NODE_IMAGES = 'TreeView node images Stage 1 are Studio/Web only. Current Ready native GUI 1.9/19/1.10 does not transport ImageList bindings on TreeView nodes; validation fails closed rather than silently discarding node icons.';
const TREE_NODE_HINTS = 'TreeView node hints Stage 2 are Studio/Web only. Current Ready native GUI 1.9/19/1.10 does not transport per-node tooltip metadata; validation fails closed rather than silently discarding hints.';
const TREE_NODE_STATES = 'TreeView node state presentation Stage 3 is Studio/Web only. Current Ready native GUI 1.9/19/1.10 does not transport per-node state-tone metadata; validation fails closed rather than silently discarding state presentation.';
const ADVANCED_TABLE_COLUMNS = 'Advanced Table columns Stage 1 is Studio/Web only. Current Ready native GUI 1.9/19/1.10 does not encode source-backed per-column width/alignment; validation fails closed rather than silently discarding the column presentation.';

const TREE_IMAGES = `window "Files" as main:
  imagelist as tree_icons size 16, 16:
    image folder from "patch-resource:icons.folder"
  tree as files:
    node "src"
      node "compiler.js" image tree_icons.folder
`;

const TREE_HINTS = `window "Files" as main:
  tree as files:
    node "src"
      node "parser.js" hint "Parser implementation"
`;

const TREE_STATES = `window "Files" as main:
  tree as files:
    node "src" state success
      node "parser.js"
`;

const TABLE_COLUMNS = `window "Data" as main:
  # @table-columns 180:left, 120:center
  table "Name", "State" as people:
    row "Ada", "Ready"
`;

const PASSWORD = `create text secret = "swordfish"
window "Login" as main:
  # @input-mode password
  input secret
`;

function compiled(source, name) {
  return compile(source, { name, kind: 'window' });
}

function assertRejected(source, name, message) {
  const program = compiled(source, name);
  assert.throws(() => buildCurrentNativeGuiIR(program), error => error instanceof NativeGuiError && error.message === message);
  assert.throws(() => buildNativeGuiPlan(program), error => error instanceof NativeGuiError && error.message === message);
}

test('Current Ready native and the build plan fail closed for TreeView node images, hints, and state', () => {
  assertRejected(TREE_IMAGES, 'TreeImages', TREE_NODE_IMAGES);
  assertRejected(TREE_HINTS, 'TreeHints', TREE_NODE_HINTS);
  assertRejected(TREE_STATES, 'TreeStates', TREE_NODE_STATES);
});

test('a tree-only hint program fails closed before the frozen tier can drop the hint', () => {
  const program = compiled(TREE_HINTS, 'TreeOnlyHint');
  const body = program.ast.find(node => node.kind === 'window').body;
  assert.deepEqual(body.map(node => node.control), ['tree']);
  assert.throws(() => buildNativeGuiPlan(program), error => error instanceof NativeGuiError && error.message === TREE_NODE_HINTS);
});

test('advanced Table columns fail closed on the current facade and the frozen build plan', () => {
  assertRejected(TABLE_COLUMNS, 'AdvancedTable', ADVANCED_TABLE_COLUMNS);
});

test('Studio/Web tree and table metadata nested in tabs or panels still fails closed', () => {
  const hinted = compiled(`window "Files" as main:
  tabs as pages:
    tab "One":
      tree as files:
        node "src" hint "Nested hint"
    tab "Two":
      text "Other"
`, 'NestedHint');
  assert.throws(() => buildCurrentNativeGuiIR(hinted), { message: TREE_NODE_HINTS });
  assert.throws(() => buildNativeGuiPlan(hinted), { message: TREE_NODE_HINTS });

  const columns = compiled(`window "Data" as main:
  tabs as pages:
    tab "Grid":
      # @table-columns 160:right
      table "Name" as people:
        row "Ada"
    tab "Other":
      text "Other"
`, 'NestedTable');
  assert.throws(() => buildCurrentNativeGuiIR(columns), { message: ADVANCED_TABLE_COLUMNS });
  assert.throws(() => buildNativeGuiPlan(columns), { message: ADVANCED_TABLE_COLUMNS });

  const nestedPassword = compiled(`create text secret = "swordfish"
window "Login" as main:
  panel as credentials:
    # @input-mode password
    input secret
`, 'NestedPassword');
  assert.throws(() => buildNativeGuiPlan(nestedPassword), /PasswordEdit Stage 1 Input 'secret' is Studio\/Web only/);
});

test('build plan frozen tier fails closed for Studio/Web presentations the current facade already rejects', () => {
  const cases = [
    [PASSWORD, 'Password', /PasswordEdit Stage 1 Input 'secret' is Studio\/Web only/],
    [`create text appointment = "2026-09-10"\nwindow "Schedule" as main:\n  # @input-mode date\n  input appointment\n`, 'Date', /DatePicker Stage 1 Input 'appointment' is Studio\/Web only/],
    [`create text appointment_time = "09:30"\nwindow "Schedule" as main:\n  # @input-mode time\n  input appointment_time\n`, 'Time', /TimePicker Stage 1 Input 'appointment_time' is Studio\/Web only/],
    [`create text selected_date = "2026-09-12"\nwindow "Calendar" as main:\n  # @input-mode calendar\n  input selected_date\n`, 'Calendar', /Calendar Stage 1 Input 'selected_date' is Studio\/Web only/],
    [`create text phone = ""\nwindow "Mask" as main:\n  # @input-mask "000-000"\n  input phone\n`, 'Mask', /MaskedEdit Stage 1 Input 'phone' is Studio\/Web only/],
    [`create text quantity = "12"\nwindow "Quantity" as main:\n  # @number-edit\n  input quantity\n`, 'Number', /NumberEdit Stage 1 Input 'quantity' is Studio\/Web only/],
    [`window "Links" as main:\n  # @button-mode link\n  button "Open details" as details\n`, 'Link', /LinkLabel Stage 1 Button 'details' is Studio\/Web only/],
    [`create list services = ["Diagnostics"]\nwindow "Checklist" as main:\n  # @listbox-mode checked\n  listbox "Diagnostics", "Install" as services\n`, 'Checked', /CheckedListBox Stage 1 'services' is Studio\/Web only/],
    [`create number completion = 35\nwindow "Progress" as main:\n  # @slider-mode progress\n  slider 0..100 as completion step 1\n`, 'Progress', /ProgressBar Stage 1 'completion' is Studio\/Web only/],
    [`window "Scroll" as main:\n  # @slider-mode scrollbar\n  slider 0..100 as viewport step 5\n`, 'ScrollBar', /ScrollBar Stage 1 'viewport' is Studio\/Web only/],
    [`window "Groups" as main:\n  # @panel-mode group\n  panel as account_settings:\n    text "Account"\n`, 'Group', /GroupBox Stage 1 'account_settings' is Studio\/Web only/],
    [`window "Scrollable" as main:\n  panel as advanced_settings:\n    # @panel-scroll auto\n    text "Inside"\n`, 'ScrollBox', /ScrollBox Stage 1 'advanced_settings' is Studio\/Web only/],
    [`window "Split" as main:\n  panel as workspace:\n    # @panel-split vertical 45\n    text "Navigator"\n    # @panel-split-break\n    text "Editor"\n`, 'Split', /SplitContainer Stage 1 'workspace' is Studio\/Web only/]
  ];
  for (const [source, name, pattern] of cases) {
    assert.throws(() => buildNativeGuiPlan(compiled(source, name)), pattern, name);
  }
});

test('plain TreeView and Table still lower, and a shape line stays a native shape', () => {
  const tree = compiled(`window "Files" as main:
  tree as files:
    node "src"
      node "compiler.js"
`, 'PlainTree');
  const treeIr = buildCurrentNativeGuiIR(tree);
  assert.equal(treeIr.version, '1.9');
  const currentTree = flattenCurrentNativeGuiControls(treeIr).find(control => control.id === 'files');
  assert.equal(currentTree.type, 'tree');
  assert.deepEqual(currentTree.nodes, [
    { text: 'src', children: [{ text: 'compiler.js', children: [] }] }
  ]);
  const treePlan = buildNativeGuiPlan(tree);
  assert.equal(treePlan.tier, 'tree-v13');
  assert.equal(treePlan.gui.version, '1.2');
  assert.equal(treePlan.gui.forms[0].controls.find(control => control.id === 'files').type, 'tree');

  const table = compiled(`window "Data" as main:
  table "Name", "State" as people:
    row "Ada", "Ready"
`, 'PlainTable');
  const tableIr = buildCurrentNativeGuiIR(table);
  assert.equal(tableIr.version, '1.9');
  const currentTable = flattenCurrentNativeGuiControls(tableIr).find(control => control.id === 'people');
  assert.equal(currentTable.type, 'table');
  assert.deepEqual(currentTable.columns, ['Name', 'State']);
  assert.equal(currentTable.tableColumnPresentation, undefined);
  const tablePlan = buildNativeGuiPlan(table);
  assert.equal(tablePlan.tier, 'tree-v13');
  assert.equal(tablePlan.gui.version, '1.2');
  const frozenTable = tablePlan.gui.forms[0].controls.find(control => control.id === 'people');
  assert.equal(frozenTable.type, 'table');
  assert.deepEqual(frozenTable.columns, ['Name', 'State']);

  const shape = compiled(`window "Shapes" as main:
  shape line as separator stroke #334155 stroke-width 2 opacity 1
`, 'Separator');
  const shapeIr = buildCurrentNativeGuiIR(shape);
  assert.equal(shapeIr.version, '1.9');
  const separator = flattenCurrentNativeGuiControls(shapeIr).find(control => control.id === 'separator');
  assert.equal(separator.type, 'shape');
  assert.equal(separator.shapeKind, 'line');
  const shapePlan = buildNativeGuiPlan(shape);
  assert.equal(shapePlan.tier, 'shape-v16');
  assert.equal(shapePlan.gui.version, '1.9');
  assert.equal(flattenCurrentNativeGuiControls(shapePlan.gui).find(control => control.id === 'separator').shapeKind, 'line');
});

test('ordinary inputs, buttons, listboxes, sliders, and panels still build', () => {
  const plain = compiled(`create text name = "Ada"
create list fruits = ["apple"]
window "Plain" as main:
  input name
  button "Save" as save
  listbox "apple", "pear" as fruits
`, 'PlainControls');
  assert.equal(buildNativeGuiPlan(plain).tier, 'tree-v13');
  assert.equal(buildCurrentNativeGuiIR(plain).version, '1.9');

  const slider = compiled(`create number volume = 50
window "Mixer" as main:
  slider 0..100 as volume step 5
`, 'PlainSlider');
  const sliderPlan = buildNativeGuiPlan(slider);
  assert.equal(sliderPlan.tier, 'slider-v14');
  assert.equal(sliderPlan.gui.version, '1.9');

  const panel = compiled(`window "Legacy Panel" as main:
  panel as tools:
    text "Flow"
    button "Run" as run_button
`, 'PlainPanel');
  const panelPlan = buildNativeGuiPlan(panel);
  assert.equal(panelPlan.tier, 'chrome-v15');
  assert.equal(panelPlan.gui.version, '1.9');
  assert.equal(flattenCurrentNativeGuiControls(panelPlan.gui).find(control => control.id === 'tools').type, 'panel');
});
