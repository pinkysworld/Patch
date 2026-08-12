# Patch fuzzing and backend differential testing

Patch CI uses two complementary testing gates for the currently shared numeric Console subset.

## Deterministic grammar fuzzing

`npm run fuzz:compiler` runs 500 generated valid programs and 500 paired known-invalid programs with seed `20260812`.

The valid generator deliberately cycles through five structural modes:

- numeric `create` plus `change set/add/remove/clear`;
- `if/else` with boolean composition;
- literal `repeat` using Patch `count`;
- acyclic numeric recipe-to-recipe calls;
- ranged recipe parameters protected by magnitude-aware capabilities.

Every valid case is parsed, compiled to Change IR, lowered to direct Wasm, validated with `WebAssembly.validate`, and independently lowered to portable C99. This checks parser/compiler/backend robustness without relying on random source bytes that are almost always rejected before reaching meaningful compiler paths.

Each paired invalid case is guaranteed to exercise one of four stable parser diagnostic families: unknown statement, indentation error, missing block, or invalid structure. The compiler must reject it with the expected `PATCHxxxx` code.

The generator is dependency-free and reproducible. To replay or expand a run:

```bash
node scripts/fuzz-compiler.js --seed 20260812 --cases 500
node scripts/fuzz-compiler.js --seed 12345 --cases 5000
```

On failure the harness prints the seed, case number, generated source, and original stack so the exact case can be reproduced.

This is **deterministic grammar fuzzing**, not coverage-guided AFL/libFuzzer fuzzing. Coverage-guided/native fuzzing may be added later if the parser/compiler is exposed through a suitable long-running harness.

## Executable backend differential testing

`npm run test:differential` executes a curated corpus through three independent paths:

1. `PatchInterpreter`;
2. direct WebAssembly plus the Patch direct-Wasm runtime;
3. generated portable C99 compiled by the host `cc`/`gcc`/`clang` and executed as a native process.

For every corpus case, interpreter and direct-Wasm outputs and final persistent state must be identical. The generated C99 executable's stdout must be identical to interpreter output. Corpus programs explicitly `show` their relevant final numeric state so the executable C path exposes the same observable result.

The differential corpus tracks the C99 backend's own `metadata.supported` list. CI fails if the backend adds a new documented shared capability without adding a differential case. The current corpus covers:

- top-level numeric create;
- numeric change set/add/remove/clear;
- numeric show;
- numeric `+ - * /`;
- if/else with direct-subset conditions;
- literal repeat with Patch count;
- non-recursive acyclic numeric recipes;
- ranged numeric recipe guards for in-range calls.

CI runs the executable differential gate on Linux/Node 24, where a C99 compiler is available. The harness itself searches `CC`, `cc`, `gcc`, then `clang` and can be run locally on any system with a compatible compiler.

## Boundaries

These tests strengthen implementation confidence but are not a proof of compiler correctness. In particular:

- the fuzz generator explores a structured language subset rather than all possible byte strings;
- differential equality can miss a bug shared by all compared implementations;
- C99 differential execution currently focuses on successful in-range numeric programs;
- Window/GUI semantics, unsupported direct-Wasm features, packaging, OS GUI runtimes, and future language features need their own differential or integration coverage.

The existing formal/certificate pipeline remains separate and complementary.
