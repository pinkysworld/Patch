import test from 'node:test';
import assert from 'node:assert/strict';
import { compile } from '../src/compiler.js';
import { validateWindowRuntimeSupport } from '../src/window-build.js';

const TREE_SOURCE = `window "Files" as main:
  tree as files:
    node "src"
      node "compiler.js"
`;

const MENU_SOURCE = `window "Menu" as main:
  menu "File":
    item "Open" as open_item shortcut "Primary+O"
    separator
    item "About" as about_item shortcut "F1"
`;

test('TreeView fail-closed diagnostic describes target capability instead of obsolete product availability', () => {
  const compiled = compile(TREE_SOURCE, { name: 'TreeDiagnostic', kind: 'window' });
  assert.throws(
    () => validateWindowRuntimeSupport(compiled),
    error => {
      assert.match(error.message, /TreeView is not enabled for this Window target/i);
      assert.match(error.message, /versioned TreeView runtime contract/i);
      assert.doesNotMatch(error.message, /Studio App Preview.*native and standalone targets fail closed/i);
      return true;
    }
  );
});

test('menu-decoration fail-closed diagnostic is target-scoped and does not hard-code the obsolete sealed runtime', () => {
  const compiled = compile(MENU_SOURCE, { name: 'MenuDiagnostic', kind: 'window' });
  assert.throws(
    () => validateWindowRuntimeSupport(compiled),
    error => {
      assert.match(error.message, /has not enabled the corresponding menu-decoration contract/i);
      assert.match(error.message, /validation fails closed/i);
      assert.doesNotMatch(error.message, /payload v9\/runtime v1\.0/i);
      return true;
    }
  );
});

test('current TreeView and decorated-menu opt-ins still validate successfully', () => {
  const tree = validateWindowRuntimeSupport(
    compile(TREE_SOURCE, { name: 'TreeDiagnostic', kind: 'window' }),
    { allowTree: true }
  );
  assert.equal(tree.treeViews, 1);

  const menu = validateWindowRuntimeSupport(
    compile(MENU_SOURCE, { name: 'MenuDiagnostic', kind: 'window' }),
    { allowMenuDecorations: true }
  );
  assert.equal(menu.menuItems, 2);
  assert.equal(menu.menuSeparators, 1);
  assert.equal(menu.menuShortcuts, 2);
});
