import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createStudioRunLifecycle } from '../web/studio-run-controller.js';
import {
  clearAppListboxSelections,
  getAppListboxSelection,
  isRuntimeCoreReconcileChild,
  resolveMultiListboxSelection,
  setAppListboxSelection,
  syncMultiListboxes
} from '../web/table-stage1.js';

const renderer = fs.readFileSync('web/studio-window-renderer.js', 'utf8');
const table = fs.readFileSync('web/table-stage1.js', 'utf8');
const controller = fs.readFileSync('web/studio-run-controller.js', 'utf8');

test('adapter-owned table nodes stay out of the core reconcile sequence', () => {
  const button = { dataset: { patchControlKey: 'id:add' } };
  const tableNode = {
    dataset: { patchControlKey: 'id:board', patchRuntimeSelectionKind: 'table' },
    classList: { contains: name => name === 'patch-table-stage1-control' }
  };
  const classOnlyTable = {
    dataset: { patchControlKey: 'id:queue' },
    classList: { contains: name => name === 'patch-table-stage1-control' }
  };
  const input = {
    dataset: { patchControlKey: 'id:item' },
    classList: { contains: () => false }
  };
  const tree = {
    dataset: { patchControlKey: 'id:parts', patchRuntimeSelectionKind: 'tree' },
    classList: { contains: () => false }
  };
  const rendered = [button, tableNode, classOnlyTable, input, tree].filter(isRuntimeCoreReconcileChild);

  assert.equal(isRuntimeCoreReconcileChild(null), false);
  assert.equal(isRuntimeCoreReconcileChild({ dataset: {} }), false);
  assert.deepEqual(rendered.map(child => child.dataset.patchControlKey), ['id:add', 'id:item', 'id:parts']);
  assert.match(renderer, /const rendered = \[\.\.\.body\.children\]\.filter\(isRuntimeCoreReconcileChild\)/);
  assert.match(renderer, /if \(rendered\.length !== expected\.length\) return null/);
  assert.match(renderer, /rendered\[index\]\.dataset\.patchControlKey !== expected\[index\]\.key/);
});

test('model listbox selection wins over a stale cache and a new Run clears it', () => {
  assert.deepEqual(resolveMultiListboxSelection(['Cherry'], ['Banana']), ['Cherry']);
  assert.deepEqual(resolveMultiListboxSelection(['Diagnostics', 'Pickup'], ['Diagnostics']), ['Diagnostics', 'Pickup']);
  assert.deepEqual(resolveMultiListboxSelection([], ['Diagnostics']), []);
  assert.deepEqual(resolveMultiListboxSelection(undefined, ['Banana']), ['Banana']);
  assert.equal(resolveMultiListboxSelection(undefined, undefined), null);

  const model = ['Cherry'];
  const chosen = resolveMultiListboxSelection(model, ['Banana']);
  chosen.push('Date');
  assert.deepEqual(model, ['Cherry']);

  clearAppListboxSelections();
  setAppListboxSelection('0:0:fruit', ['Banana']);
  const options = ['Apple', 'Banana', 'Cherry'].map(value => ({ value, selected: value === 'Banana' }));
  const select = {
    multiple: false,
    options,
    dataset: { patchRenderedSelection: JSON.stringify(['Cherry']) },
    setAttribute() {},
    matches() { return true; },
    get selectedOptions() { return options.filter(option => option.selected); },
    addEventListener(_type, listener) { select.listener = listener; },
    dispatchEvent() { return true; }
  };
  const context = {
    designer: false,
    windowIndex: 0,
    path: '0',
    changedHandlers: new Set(),
    listInitials: new Map([['fruit', ['Banana']]])
  };
  syncMultiListboxes({ kind: 'uiControl', control: 'listbox', id: 'fruit' }, select, context);
  assert.deepEqual(options.filter(option => option.selected).map(option => option.value), ['Cherry']);
  assert.deepEqual(getAppListboxSelection('0:0:fruit'), ['Cherry']);

  options.forEach(option => { option.selected = option.value === 'Apple' || option.value === 'Cherry'; });
  select.listener({ stopImmediatePropagation() {} });
  assert.deepEqual(getAppListboxSelection('0:0:fruit'), ['Apple', 'Cherry']);

  select.dataset.patchRenderedSelection = JSON.stringify(['Apple']);
  syncMultiListboxes({ kind: 'uiControl', control: 'listbox', id: 'fruit' }, select, context);
  assert.deepEqual(options.filter(option => option.selected).map(option => option.value), ['Apple']);
  assert.deepEqual(getAppListboxSelection('0:0:fruit'), ['Apple']);

  const untouched = ['Apple', 'Banana', 'Cherry'].map(value => ({ value, selected: value === 'Cherry' }));
  const untouchedSelect = {
    multiple: false,
    options: untouched,
    dataset: {},
    setAttribute() {},
    matches() { return true; }
  };
  clearAppListboxSelections();
  setAppListboxSelection('0:0:fruit', ['Banana']);
  syncMultiListboxes(
    { kind: 'uiControl', control: 'listbox', id: 'fruit' },
    untouchedSelect,
    { ...context, designer: true }
  );
  assert.deepEqual(untouched.filter(option => option.selected).map(option => option.value), ['Cherry']);
  assert.deepEqual(getAppListboxSelection('0:0:fruit'), ['Banana']);

  clearAppListboxSelections();
  assert.equal(getAppListboxSelection('0:0:fruit'), undefined);
  setAppListboxSelection('1:2:other', ['Pickup']);
  clearAppListboxSelections();
  assert.equal(getAppListboxSelection('1:2:other'), undefined);

  const initialStart = renderer.indexOf('renderInitial(container, windows)');
  const initialEnd = renderer.indexOf('renderAfterEvent(container, windows)', initialStart);
  const initial = renderer.slice(initialStart, initialEnd);
  assert.match(initial, /clearAppListboxSelections\(\)/);
  assert.match(initial, /__patchTabSelections/);
  assert.match(initial, /clearRuntimeSelections\(container\)/);
  assert.ok(initial.indexOf('clearAppListboxSelections') < initial.indexOf('renderWindows'));
  assert.ok(initial.indexOf('clearRuntimeSelections') < initial.indexOf('renderWindows'));
  const afterStart = renderer.indexOf('renderAfterEvent(container, windows)');
  const afterEnd = renderer.indexOf('renderDesigner(container, windows', afterStart);
  assert.doesNotMatch(renderer.slice(afterStart, afterEnd), /clearRuntimeSelections|clearAppListboxSelections/);
});

test('scroll and focus restore runs again after the live table node is attached', () => {
  assert.match(renderer, /container\.__patchRestoreRuntimeTransient = restore/);
  assert.match(renderer, /queueMicrotask\(\(\) => \{\s*queueMicrotask\(\(\) => \{/);
  const syncStart = table.indexOf('function syncContainer');
  const syncEnd = table.indexOf('export function syncMultiListboxes');
  const sync = table.slice(syncStart, syncEnd);
  const insertAt = sync.lastIndexOf('body.insertBefore(element, anchor)');
  const restoreAt = sync.lastIndexOf('__patchRestoreRuntimeTransient');
  assert.ok(insertAt >= 0 && restoreAt > insertAt);
});

test('trigger does not dispatch into the previous runtime while Run is scheduled', () => {
  const scheduled = [];
  const events = [];
  let nextId = 0;
  const lifecycle = createStudioRunLifecycle({
    source: () => 'window "Demo":',
    projectOptions: () => ({ kind: 'window' }),
    schedule: callback => scheduled.push(callback),
    compileProgram: () => ({ ast: {}, ir: {} }),
    createRuntime: () => {
      nextId += 1;
      const id = nextId;
      return { id, runAst: () => ({ output: [], ui: [] }) };
    },
    triggerEvent(runtime, control, event) {
      events.push({ id: runtime.id, control, event });
      return { output: ['event'], ui: [] };
    }
  });

  assert.equal(lifecycle.run(), true);
  assert.equal(scheduled.length, 1);
  scheduled.shift()();
  assert.equal(lifecycle.running, false);
  assert.equal(lifecycle.trigger('add_button', 'clicked'), true);
  assert.deepEqual(events, [{ id: 1, control: 'add_button', event: 'clicked' }]);

  assert.equal(lifecycle.run(), true);
  assert.equal(lifecycle.running, true);
  assert.equal(lifecycle.trigger('add_button', 'clicked'), false);
  assert.deepEqual(events, [{ id: 1, control: 'add_button', event: 'clicked' }]);

  scheduled.shift()();
  assert.equal(lifecycle.running, false);
  assert.equal(lifecycle.started, true);
  assert.equal(lifecycle.trigger('add_button', 'changed'), true);
  assert.deepEqual(events, [
    { id: 1, control: 'add_button', event: 'clicked' },
    { id: 2, control: 'add_button', event: 'changed' }
  ]);

  const triggerStart = controller.indexOf('function trigger(control, event, payload = {})');
  const triggerEnd = controller.indexOf('function takePendingIr', triggerStart);
  const trigger = controller.slice(triggerStart, triggerEnd);
  assert.match(trigger, /if \(running \|\| !runtime\) return false;/);
  assert.ok(trigger.indexOf('if (running || !runtime) return false;') < trigger.indexOf('triggerEvent('));
});
