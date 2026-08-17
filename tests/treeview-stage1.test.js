import test from 'node:test';
import assert from 'node:assert/strict';
import { compile } from '../src/compiler.js';
import { PatchInterpreter } from '../src/interpreter.js';
import { triggerWindowEvent } from '../src/window-events.js';
import { validateWindowRuntimeSupport } from '../src/window-build.js';

const SOURCE = `create text selected = ""

window "Files" as main:
  tree as files:
    node "src"
      node "compiler.js"
      node "parser.js"
    node "docs"
      node "ROADMAP.md"

when files changed:
  change selected:
    set = value[1]
`;

test('TreeView Stage 1 parses and lowers hierarchical source-backed nodes', () => {
  const compiled = compile(SOURCE, { name: 'TreeStage1', kind: 'window' });
  const windowNode = compiled.ast.find(node => node.kind === 'window');
  const tree = windowNode.body.find(node => node.kind === 'uiControl' && node.control === 'tree');
  assert.ok(tree);
  assert.equal(tree.id, 'files');
  assert.equal(tree.treeNodes.length, 2);
  assert.equal(tree.treeNodes[0].labelExpr, '"src"');
  assert.equal(tree.treeNodes[0].children.length, 2);
  assert.equal(tree.treeNodes[1].children[0].labelExpr, '"ROADMAP.md"');

  const windowIr = compiled.ir.instructions.find(instruction => instruction.code === 'WINDOW');
  const treeIr = windowIr.body.find(instruction => instruction.code === 'UI_CONTROL' && instruction.control === 'tree');
  assert.deepEqual(treeIr.treeNodes[0].children.map(node => node.labelExpr), ['"compiler.js"', '"parser.js"']);
  assert.ok(compiled.ir.capabilities.includes('ui.tree'));
});

test('TreeView UI model evaluates labels but does not persist toolkit selection', () => {
  const runtime = new PatchInterpreter();
  const result = runtime.run(SOURCE);
  const tree = result.ui[0].controls.find(control => control.type === 'tree');
  assert.deepEqual(tree.nodes, [
    { text: 'src', children: [{ text: 'compiler.js', children: [] }, { text: 'parser.js', children: [] }] },
    { text: 'docs', children: [{ text: 'ROADMAP.md', children: [] }] }
  ]);
  assert.equal(result.state.selected, '');
});

test('TreeView changed exposes a transient text-list path and persistence still requires Patch change', () => {
  const runtime = new PatchInterpreter();
  runtime.run(SOURCE);
  const changed = triggerWindowEvent(runtime, 'files', 'changed', { value: ['src', 'parser.js'] });
  assert.equal(changed.state.selected, 'parser.js');
  assert.equal(changed.history.length, 1);

  assert.throws(
    () => triggerWindowEvent(runtime, 'files', 'changed', { value: 'parser.js' }),
    /text-list event-local value/
  );
});

test('TreeView Stage 1 is explicitly opt-in at Window runtime validation boundary', () => {
  const compiled = compile(SOURCE, { name: 'TreeStage1', kind: 'window' });
  assert.throws(() => validateWindowRuntimeSupport(compiled), /TreeView.*not supported/i);
  const support = validateWindowRuntimeSupport(compiled, { allowTree: true });
  assert.equal(support.treeViews, 1);
  assert.equal(support.events, 1);
});

test('TreeView parser rejects malformed hierarchy and empty trees', () => {
  assert.throws(() => compile('window "X":\n  tree as nav:\n', { kind: 'window' }), /tree needs at least one/i);
  assert.throws(() => compile('window "X":\n  tree as nav:\n    button "No" as bad\n', { kind: 'window' }), /tree.*node/i);
});
