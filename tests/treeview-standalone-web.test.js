import test from 'node:test';
import assert from 'node:assert/strict';
import { compile } from '../src/compiler.js';
import { buildStandaloneWindowWebApp, PATCH_WINDOW_WEB_VERSION } from '../src/window-webapp.js';
import { validateWindowRuntimeSupport } from '../src/window-build.js';

const SOURCE = `create list selected = []

window "Files" as main:
  tree as files:
    node "src"
      node "compiler.js"
      node "parser.js"
    node "docs"
      node "ROADMAP.md"

when files changed:
  change selected:
    set = value
`;

test('Standalone Window Web v0.9 opts into TreeView without opening the generic target boundary', () => {
  const compiled = compile(SOURCE, { name: 'TreeWeb', kind: 'window' });
  assert.throws(() => validateWindowRuntimeSupport(compiled), /TreeView.*not supported/i);
  assert.equal(PATCH_WINDOW_WEB_VERSION, '0.9');
  const built = buildStandaloneWindowWebApp(compiled, 'Tree Web');
  assert.equal(built.metadata.version, '0.9');
  assert.equal(built.metadata.projectKind, 'window');
  assert.ok(built.compiled.ir.capabilities.includes('ui.tree'));
});

test('Standalone TreeView runtime embeds hierarchy, accessibility roles and full-path changed dispatch', () => {
  const built = buildStandaloneWindowWebApp(compile(SOURCE, { name: 'TreeWeb', kind: 'window' }), 'Tree Web');
  for (const marker of [
    'function uiTreeNodes(nodes)',
    "type:node.control,id:node.id,text:node.textExpr?uiText(node.textExpr):'',options:Array.isArray(node.options)?node.options.map(uiOption):[],nodes:node.control==='tree'?uiTreeNodes(node.treeNodes):[]",
    "root.setAttribute('role','tree')",
    "item.setAttribute('role','treeitem')",
    "group.setAttribute('role','group')",
    "safeTrigger(control.id,'changed',{value:selectedPath})",
    "type==='tree'",
    'text-list event-local value containing the selected node path',
    '.patch-tree-node'
  ]) assert.ok(built.html.includes(marker), marker);
  assert.match(built.html, /compiler\.js/);
  assert.match(built.html, /ROADMAP\.md/);
});

test('Standalone Web TreeView keeps selection transient until source uses change', () => {
  const passive = compile(`window "Files":\n  tree as files:\n    node "src"\n      node "parser.js"\n\nwhen files changed:\n  show value\n`, { name: 'PassiveTree', kind: 'window' });
  const built = buildStandaloneWindowWebApp(passive, 'Passive Tree');
  assert.ok(built.html.includes("safeTrigger(control.id,'changed',{value:selectedPath})"));
  assert.doesNotMatch(built.html, /state\.set\(control\.id/);
});
