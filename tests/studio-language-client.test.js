import test from 'node:test';
import assert from 'node:assert/strict';
import { createStudioLanguageClient } from '../web/studio-language-client.js';

test('Studio language client synchronous fallback preserves parse compile and design semantics', async () => {
  const client = createStudioLanguageClient({ WorkerCtor: undefined });

  const parsed = await client.parse('create number score = 0\nshow score');
  assert.equal(parsed.ast[0].kind, 'create');

  const compiled = await client.compile('create number score = 0\nchange score:\n  add 1', {
    name: 'FallbackApp',
    kind: 'console',
    entry: 'main.patch'
  });
  assert.equal(compiled.project.name, 'FallbackApp');
  assert.equal(compiled.ir.format, 'patch-ir');

  const source = 'create number count = 1\nchange count:\n  add 99\nwindow "Count {count}" as main:\n  text "{count}"';
  const first = await client.designModel(source);
  const second = await client.designModel(source);
  assert.equal(first.state.count, 1);
  assert.equal(first.ui[0].title, 'Count 1');
  assert.equal(first, second, 'exact design revision should reuse the bounded client cache');

  client.dispose();
});

test('Studio language client rejects compile option leakage through the shared protocol', () => {
  const client = createStudioLanguageClient({ WorkerCtor: undefined });
  assert.throws(
    () => client.compile('show 1', { resources: [] }),
    /not allowed for this task/
  );
});
