export const PATCH_ASSURANCE_EVALUATION_CORPUS_VERSION = '0.1';

/**
 * Build a deterministic Patch program for beta.32 assurance scaling studies.
 *
 * `nestedDepth` is the number of nested recipe-call edges beneath the certified
 * `root -> layer_N` call. Every program uses one quantitative leaf mutation so
 * trace length scales primarily with concrete invocation count while call-tree
 * structure scales independently with depth.
 */
export function generateAssuranceScalingProgram(options = {}) {
  const nestedDepth = integerOption(options.nestedDepth ?? 2, 'nestedDepth', 1, 32);
  const invocations = integerOption(options.invocations ?? 1, 'invocations', 1, 10000);
  const baseMax = integerOption(options.baseMax ?? 100000, 'baseMax', nestedDepth + 2, 1_000_000_000);
  const startValue = integerOption(options.startValue ?? 1, 'startValue', 0, baseMax - nestedDepth - 1);

  const lines = [
    'create number score = 0',
    '',
    `make leaf(amount number 0..${baseMax}):`,
    '  change score:',
    '    add amount',
    ''
  ];

  for (let level = 1; level <= nestedDepth; level += 1) {
    const max = baseMax - level;
    const child = level === 1 ? 'leaf' : `layer_${level - 1}`;
    lines.push(
      `make layer_${level}(amount number 0..${max}):`,
      `  do ${child}(amount + 1)`,
      ''
    );
  }

  const rootMax = baseMax - nestedDepth - 1;
  lines.push(
    `make root(amount number 0..${rootMax}):`,
    `  do layer_${nestedDepth}(amount + 1)`,
    ''
  );

  for (let index = 0; index < invocations; index += 1) lines.push(`do root(${startValue})`);
  lines.push('show score');

  const source = `${lines.join('\n')}\n`;
  return {
    format: 'patch-assurance-evaluation-program',
    version: PATCH_ASSURANCE_EVALUATION_CORPUS_VERSION,
    source,
    parameters: { nestedDepth, invocations, baseMax, startValue },
    expected: {
      leafAmount: startValue + nestedDepth + 1,
      finalScore: invocations * (startValue + nestedDepth + 1),
      runtimeTransitions: invocations,
      rootToFirstLayerWitnesses: invocations,
      recipes: nestedDepth + 2
    }
  };
}

export function assuranceEvaluationScenarios(preset = 'quick') {
  if (preset === 'smoke') return [
    scenario('smoke', 1, 2)
  ];
  if (preset === 'quick') return [
    scenario('baseline', 1, 1),
    scenario('depth-4', 4, 1),
    scenario('invocations-10', 2, 10),
    scenario('combined', 4, 10)
  ];
  if (preset === 'paper') return [
    scenario('depth-1', 1, 1),
    scenario('depth-2', 2, 1),
    scenario('depth-4', 4, 1),
    scenario('depth-6', 6, 1),
    scenario('depth-8', 8, 1),
    scenario('invocations-1', 2, 1),
    scenario('invocations-5', 2, 5),
    scenario('invocations-10', 2, 10),
    scenario('invocations-25', 2, 25),
    scenario('invocations-50', 2, 50),
    scenario('combined-4x25', 4, 25),
    scenario('combined-6x25', 6, 25)
  ];
  throw new Error(`Unknown assurance evaluation preset '${preset}'. Use smoke, quick or paper.`);
}

function scenario(name, nestedDepth, invocations) {
  return { name, nestedDepth, invocations };
}

function integerOption(value, name, min, max) {
  if (!Number.isSafeInteger(value) || value < min || value > max) {
    throw new Error(`${name} must be a safe integer in ${min}..${max}.`);
  }
  return value;
}
