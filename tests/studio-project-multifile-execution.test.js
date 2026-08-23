import test from 'node:test';
import assert from 'node:assert/strict';
import { compile } from '../src/compiler.js';
import { PatchInterpreter } from '../src/interpreter.js';
import { buildStudioProjectBundle, composeStudioProjectSource, mapStudioProjectLine } from '../src/studio-project.js';

test('composed Studio v3 files form one executable Patch program', () => {
  const bundle = buildStudioProjectBundle({
    name: 'MultiFileCounter',
    kind: 'window',
    files: [
      { path: 'main.patch', content: 'create number count = 0\n' },
      { path: 'forms/main.patch', content: 'window "Counter" as main:\n  text "Count: {count}"\n  button "Add" as add\n' },
      { path: 'events/counter.patch', content: 'when add clicked:\n  change count:\n    add 1\n' }
    ]
  });

  const composition = composeStudioProjectSource(bundle);
  const compiled = compile(composition.source, { name: 'MultiFileCounter', kind: 'window', entry: composition.entry });
  assert.equal(compiled.project.kind, 'window');
  assert.equal(compiled.ir.version, '0.10');

  const interpreter = new PatchInterpreter();
  const initial = interpreter.run(composition.source);
  assert.equal(initial.state.count, 0);
  assert.equal(initial.ui.length, 1);
  assert.equal(initial.ui[0].id, 'main');
  assert.equal(initial.ui[0].controls.find(control => control.id === 'add')?.text, 'Add');

  const changed = interpreter.trigger('add', 'clicked');
  assert.equal(changed.state.count, 1);
  assert.equal(changed.history.length, 1);
});

test('composed project locations map back to their owning source file', () => {
  const bundle = buildStudioProjectBundle({
    name: 'Locations',
    kind: 'console',
    files: [
      { path: 'main.patch', content: 'create number score = 0\n' },
      { path: 'logic/reward.patch', content: 'change score:\n  add 2\nshow score\n' }
    ]
  });
  const composition = composeStudioProjectSource(bundle);
  const reward = composition.segments.find(segment => segment.path === 'logic/reward.patch');
  assert.deepEqual(mapStudioProjectLine(composition, reward.startLine), { path: 'logic/reward.patch', line: 1 });
  assert.deepEqual(mapStudioProjectLine(composition, reward.startLine + 2), { path: 'logic/reward.patch', line: 3 });
});

