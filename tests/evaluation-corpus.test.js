import test from 'node:test';
import assert from 'node:assert/strict';
import { compileToDirectWasm, runDirectWasm } from '../src/wasm-direct.js';
import { validateDirectSemanticEffects } from '../src/direct-effect-validator.js';
import { buildTransitiveRuntimeCorrespondence } from '../src/transitive-runtime-correspondence.js';
import {
  generateAssuranceScalingProgram,
  assuranceEvaluationScenarios,
  PATCH_ASSURANCE_EVALUATION_CORPUS_VERSION
} from '../src/evaluation-corpus.js';

test('assurance scaling corpus is deterministic and separates depth from invocation count', () => {
  const first = generateAssuranceScalingProgram({ nestedDepth: 3, invocations: 4, startValue: 2 });
  const second = generateAssuranceScalingProgram({ nestedDepth: 3, invocations: 4, startValue: 2 });
  assert.equal(first.version, PATCH_ASSURANCE_EVALUATION_CORPUS_VERSION);
  assert.equal(first.source, second.source);
  assert.equal(first.expected.leafAmount, 6);
  assert.equal(first.expected.finalScore, 24);
  assert.equal(first.expected.runtimeTransitions, 4);
  assert.equal((first.source.match(/do root\(2\)/g) ?? []).length, 4);
  assert.match(first.source, /make layer_3\(amount number 0\.\.99997\):/);
});

test('smoke evaluation corpus executes, validates and supports repeated invocation frames', async () => {
  const generated = generateAssuranceScalingProgram({ nestedDepth: 2, invocations: 3 });
  const compiled = compileToDirectWasm(generated.source, { name: 'EvaluationSmoke', kind: 'console' });
  const execution = await runDirectWasm(compiled.module, compiled.metadata);
  assert.equal(execution.state.score, generated.expected.finalScore);
  assert.equal(execution.trace.length, 3);

  const validation = validateDirectSemanticEffects(compiled.compiled.ir, execution.trace);
  assert.equal(validation.ok, true);
  assert.equal(validation.summary.transitions, 3);
  assert.ok(validation.invocationFrames.length >= 3);

  const correspondence = await buildTransitiveRuntimeCorrespondence(generated.source, { name: 'EvaluationSmoke', kind: 'console' });
  assert.equal(correspondence.summary.unsupported, 0);
  const rootFrames = correspondence.correspondences.filter(item => item.caller === 'root' && item.callee === 'layer_2');
  assert.equal(rootFrames.length, 3);
  assert.deepEqual(rootFrames.map(item => item.invocation), [1, 2, 3]);
  assert.equal(new Set(rootFrames.map(item => item.frameId)).size, 3);
});

test('evaluation presets are explicit and reject unknown names', () => {
  assert.equal(assuranceEvaluationScenarios('smoke').length, 1);
  assert.equal(assuranceEvaluationScenarios('quick').length, 4);
  assert.equal(assuranceEvaluationScenarios('paper').length, 12);
  assert.throws(() => assuranceEvaluationScenarios('unknown'), /Unknown assurance evaluation preset/);
});

test('evaluation corpus rejects unsafe bounds', () => {
  assert.throws(() => generateAssuranceScalingProgram({ nestedDepth: 0 }), /nestedDepth/);
  assert.throws(() => generateAssuranceScalingProgram({ invocations: 0 }), /invocations/);
  assert.throws(() => generateAssuranceScalingProgram({ nestedDepth: 4, baseMax: 4 }), /baseMax/);
});
