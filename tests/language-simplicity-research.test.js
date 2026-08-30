import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { parse, PatchSyntaxError } from '../src/parser.js';
import { PatchInterpreter } from '../src/interpreter.js';

const MINIMAL_PROGRAM = `create number score = 0
change score:
  add 1
show score`;

test('the five-minute Patch program keeps its four-line beginner surface', () => {
  const significant = MINIMAL_PROGRAM.split(/\r?\n/).filter(line => line.trim());
  assert.equal(significant.length, 4);

  const ast = parse(MINIMAL_PROGRAM);
  assert.deepEqual(ast.map(node => node.kind), ['create', 'change', 'show']);

  const result = new PatchInterpreter().run(MINIMAL_PROGRAM);
  assert.deepEqual(result.output, ['1']);
  assert.equal(result.state.score, 1);
});

test('research ChangeSet syntax does not silently enter the stable parser', () => {
  assert.throws(
    () => parse(`change together:\n  change a:\n    add 1\n  change b:\n    add 1`),
    error => error instanceof PatchSyntaxError
  );
});

test('Stage-0 research modules remain optional dependencies of the stable language path', () => {
  for (const filename of ['src/parser.js', 'src/interpreter.js', 'src/compiler.js']) {
    const source = fs.readFileSync(filename, 'utf8');
    assert.doesNotMatch(source, /change-set-source|change-set-experiment|least-authority/,
      `${filename} should not depend on Stage-0 research modules before an explicit language-version decision`);
  }
});
