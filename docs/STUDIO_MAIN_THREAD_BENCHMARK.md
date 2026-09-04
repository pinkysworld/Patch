# Patch Studio main-thread benchmark

This benchmark supports the R0.1 measurement work for Patch Studio. It extends the existing large-project benchmark so there is one measurement surface rather than a second overlapping harness. It measures synchronous parser, compiler and declaration-only Designer-model cost on representative projects before any Worker migration or rendering optimization is justified.

The benchmark is intentionally measurement-only. It does not define a CI performance threshold and it must not be used to claim an improvement without comparable measurements on the same environment.

## Run it

```bash
node scripts/benchmark-studio-large-project.js --main-thread --iterations 20 --warmup 3
```

The existing aggregate stress benchmark remains available through:

```bash
npm run benchmark:studio
```

The main-thread mode prints a JSON report containing runtime metadata plus minimum, median, p95, mean and maximum duration for each phase.

## Representative cases

The default main-thread report contains three cases:

1. `counter-window`: the small beginner Window example.
2. `workshop-desk`: the current seven-Form Patch Studio RAD showcase.
3. `scale-10x20`: the existing deterministic R0 workload with 10 Forms and 20 controls per Form, for 200 controls total.

Reusing the existing scale fixture keeps the R0 measurement contract stable and avoids maintaining a second synthetic project.

## What is measured

Each case measures three synchronous operations independently:

- `parse`: direct parser cost.
- `compile`: the real compiler path, including the parsing and validation work performed by `compile` itself.
- `designModel`: `buildStudioDesignModel`, including its own parse plus declaration-only design-time materialization.

The parser is measured separately to provide a baseline. Do not subtract parser timings mechanically from the other measurements because runtime effects and allocation behavior are not guaranteed to be additive.

Window and control counts are collected as workload metadata outside the phase timers. The benchmark therefore does not confuse legacy Designer source-reader cost with the three R0.1 phases being evaluated.

## Interpreting results

Use repeated runs on the same hardware and runtime when comparing revisions. Median is the primary steady-state signal; p95 helps identify long synchronous stalls. Source size and line count are recorded with every case so a result remains tied to a concrete workload.

A Worker adoption decision should be based on measured cost in representative projects, not on file size or architectural preference alone. If compile or design-model work becomes materially expensive on the main thread, migrate incrementally through the existing versioned Worker boundary while preserving deterministic diagnostics and the synchronous fallback path.

Large Table or Tree virtualization remains a separate measurement-gated decision. This benchmark measures parse, compile and design-model work, not browser DOM paint or layout cost.
