import test from 'node:test';
import assert from 'node:assert/strict';
import { compile } from '../src/compiler.js';
import { PatchInterpreter } from '../src/interpreter.js';
import { triggerWindowEvent } from '../src/window-events.js';
import { validateWindowRuntimeSupport } from '../src/window-build.js';
import { buildStandaloneWebApp } from '../src/webapp.js';

const source = `create list remembered = []

window "People" as main size 520, 320:
  table "Name", "Role" as people at 24, 64 size 440, 180:
    row "Ada", "Engineer"
    row "Grace", "Scientist"

when people changed:
  show value
`;

test('Table changed is an explicit supported Window event', () => {
  const compiled = compile(source, { kind: 'window', name: 'PeopleTable' });
  const support = validateWindowRuntimeSupport(compiled);
  assert.equal(support.events, 1);
});

test('Table changed exposes the selected row only as transient list value', () => {
  const runtime = new PatchInterpreter();
  const initial = runtime.run(source);
  assert.deepEqual(initial.state.remembered, []);

  const result = triggerWindowEvent(runtime, 'people', 'changed', { value: ['Ada', 'Engineer'] });
  assert.deepEqual(result.output, ['Ada, Engineer']);
  assert.deepEqual(result.state.remembered, []);
});

test('Table changed rejects non-row and mixed-type payloads', () => {
  const runtime = new PatchInterpreter();
  runtime.run(source);
  assert.throws(
    () => triggerWindowEvent(runtime, 'people', 'changed', { value: 'Ada' }),
    /row list of text event-local values/i
  );
  assert.throws(
    () => triggerWindowEvent(runtime, 'people', 'changed', { value: ['Ada', 1] }),
    /row list of text event-local values/i
  );
});

test('Table still rejects non-selection event kinds', () => {
  const clicked = source.replace('when people changed:', 'when people clicked:');
  const compiled = compile(clicked, { kind: 'window', name: 'PeopleTable' });
  assert.throws(
    () => validateWindowRuntimeSupport(compiled),
    /Table 'people' exposes only 'changed'/i
  );
});

test('Standalone Web Table selection is keyboard-accessible and dispatches copied row values', () => {
  const built = buildStandaloneWebApp(source, { kind: 'window', name: 'PeopleTable' });
  assert.equal(built.metadata.tableStage, 2);
  assert.equal(built.metadata.tableMode, 'transient-row-selection');
  assert.match(built.html, /const tableSelections=new Map\(\)/);
  assert.match(built.html, /tr\.setAttribute\('aria-selected'/);
  assert.match(built.html, /event\.key==='Enter'\|\|event\.key===' '/);
  assert.match(built.html, /safeTrigger\(control\.id,'changed',\{value:\[\.\.\.row\]\}\)/);
  assert.match(built.html, /events\.some\(handler=>handler\.control===control\.id&&handler\.event==='changed'\)/);
  assert.match(built.html, /patch-table-selected/);
});

test('Standalone Web Table remains selectable without requiring a Patch handler', () => {
  const noHandler = source.replace(/\nwhen people changed:[\s\S]*$/, '\n');
  const built = buildStandaloneWebApp(noHandler, { kind: 'window', name: 'PeopleTable' });
  assert.equal(built.metadata.tableMode, 'transient-row-selection');
  assert.match(built.html, /if\(hasHandler\)safeTrigger/);
  assert.match(built.html, /else render\(\)/);
});