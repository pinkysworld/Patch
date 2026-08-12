export const PATCH_FUZZ_DEFAULT_SEED = 20260812;

export function createSeededRandom(seed = PATCH_FUZZ_DEFAULT_SEED) {
  let state = Number(seed) >>> 0;
  if (state === 0) state = 0x9e3779b9;
  return function random() {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 0x100000000;
  };
}

export function generateNumericProgram(random, index = 0) {
  const id = `v${index}`;
  const a = `${id}_a`;
  const b = `${id}_b`;
  const recipe = `${id}_bump`;
  const outer = `${id}_twice`;
  const bounded = `${id}_bounded`;
  const start = int(random, 0, 12);
  const factor = int(random, 1, 4);
  const offset = int(random, 0, 8);
  const delta = int(random, 1, 5);
  const remove = int(random, 0, 3);
  const repeat = int(random, 1, 4);
  const callAmount = int(random, 1, 5);
  const boundedAmount = int(random, 0, 5);
  const threshold = int(random, 0, 20);
  const setValue = int(random, 0, 25);
  const mode = index % 5;

  const lines = [
    `create number ${a} = ${start}`,
    `create number ${b} = ${a} * ${factor} + ${offset}`,
    `change ${a}:`,
    `  add ${delta}`,
    `change ${b}:`,
    `  remove ${remove}`
  ];

  if (mode === 0) {
    lines.push(
      `change ${a}:`,
      `  set = ${setValue}`,
      `change ${a}:`,
      '  clear',
      `change ${a}:`,
      `  add ${delta + 1}`
    );
  } else if (mode === 1) {
    lines.push(
      `if ${a} >= ${threshold} and not false:`,
      `  change ${b}:`,
      `    add ${delta}`,
      'else:',
      `  change ${b}:`,
      `    remove ${remove + 1}`
    );
  } else if (mode === 2) {
    lines.push(
      `repeat ${repeat}:`,
      `  change ${a}:`,
      '    add count'
    );
  } else if (mode === 3) {
    lines.push(
      `make ${recipe}(amount):`,
      `  change ${b}:`,
      '    add amount',
      `make ${outer}(amount):`,
      `  do ${recipe}(amount)`,
      `  do ${recipe}(amount)`,
      `do ${outer}(${callAmount})`
    );
  } else {
    lines.push(
      `allow ${bounded}:`,
      `  ${b} may increase up to 10`,
      `make ${bounded}(amount number 0..5):`,
      `  change ${b}:`,
      '    add amount * 2',
      `do ${bounded}(${boundedAmount})`
    );
  }

  lines.push(`show ${a}`, `show ${b}`);
  return `${lines.join('\n')}\n`;
}

export function generateInvalidProgram(random, index = 0) {
  const value = int(random, 1, 9);
  switch (index % 4) {
    case 0:
      return { source: `if true:\n  mystery_${index} ${value}\n`, expectedCode: 'PATCH1001', kind: 'unknown-statement' };
    case 1:
      return { source: `  show ${value}\n`, expectedCode: 'PATCH1002', kind: 'indentation' };
    case 2:
      return { source: `repeat ${value}:\n`, expectedCode: 'PATCH1003', kind: 'missing-block' };
    default:
      return { source: `allow reward_${index}:\n  score may set up to ${value}\n`, expectedCode: 'PATCH1004', kind: 'invalid-structure' };
  }
}

export function differentialCorpus() {
  return [
    {
      name: 'numeric-arithmetic-and-all-change-verbs',
      coverage: ['top-level numeric create', 'numeric change set/add/remove/clear', 'numeric show', 'numeric + - * /'],
      source: `create number base = 12\ncreate number score = base / 3 + 2 * 5 - 1\nchange score:\n  add 4\nchange score:\n  remove 2\nchange score:\n  set = 22\nchange score:\n  clear\nchange score:\n  add 7\nshow base\nshow score\n`
    },
    {
      name: 'if-else-condition',
      coverage: ['if/else with direct-subset conditions'],
      source: `create number score = 4\nif score < 10 and not false:\n  change score:\n    add 3\nelse:\n  change score:\n    remove 100\nshow score\n`
    },
    {
      name: 'literal-repeat-count',
      coverage: ['literal repeat with Patch count'],
      source: `create number total = 0\nrepeat 4:\n  change total:\n    add count\nshow total\n`
    },
    {
      name: 'numeric-recipe',
      coverage: ['non-recursive acyclic numeric recipes'],
      source: `create number score = 1\nmake add_points(amount):\n  change score:\n    add amount\ndo add_points(5)\nshow score\n`
    },
    {
      name: 'acyclic-recipe-call-tree',
      coverage: ['non-recursive acyclic numeric recipes'],
      source: `create number score = 0\nmake add_points(amount):\n  change score:\n    add amount\nmake twice(amount):\n  do add_points(amount)\n  do add_points(amount)\ndo twice(3)\nshow score\n`
    },
    {
      name: 'ranged-recipe-guard-in-range',
      coverage: ['ranged numeric recipe guards'],
      source: `create number score = 0\nallow reward:\n  score may increase up to 10\nmake reward(bonus number 0..5):\n  change score:\n    add bonus * 2\ndo reward(4)\nshow score\n`
    }
  ];
}

function int(random, min, max) {
  return min + Math.floor(random() * (max - min + 1));
}
