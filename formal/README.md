# Patch formal model

The `formal/` directory contains the Lean 4 assurance core for Patch. It is intentionally smaller than the executable language and must not be described as a proof of the whole JavaScript compiler.

## Modules

```text
PatchFormal.lean              semantic changes, state, intervals, effects, rules
PatchSignature.lean           effect-only structured execution + signature soundness
PatchChecker.lean             verified executable semantic-policy checker
PatchEvidence.lean            proof-free evidence decoding/correspondence
PatchSource.lean              source verbs, normalization + SourceExecutes
PatchRange.lean               integer RangeExpr evaluation + rangeAnalysisSound
PatchRuntime.lean             EffectRefines, RuntimePath and runtime correspondence
PatchRuntimeCapability.lean   concrete runtime capability containment
PatchGuarded.lean             guard truth + guarded runtime/capability correspondence
```

## Beta.23 guarded path

`PatchGuarded.lean` adds a small Boolean guard language whose integer operands reuse `RangeExpr`, plus a parallel `GuardTree` aligned with `SourceStmt`.

The executable checks prove:

```text
checkGuardShape source guardTree = true
=> GuardShape source guardTree

checkGuardPath env runtimePath guardTree = true
=> GuardPathValid env guardTree runtimePath
```

For branches, `GuardPathValid` requires the guard to evaluate to `true` for `branchThen` and `false` for `branchElse` in the supplied safe-integer invocation environment.

The combined theorem:

```text
checkGuardedSourceRuntimeEvidence_sound
```

retains the existing `SourceExecutes` and `TraceRefines` conclusions while adding `GuardShape` and `GuardPathValid`. `checkedGuardedConcreteRuntimeCannotEscape` further composes that guarded execution with the verified Change Capability policy.

Generated beta.23 runtime certificates therefore carry proof-free concrete effects, RuntimePath, used recipe parameter values and policy data. Lean checks those values against independently translation-validated source/guard artifacts; the JavaScript/Wasm producer remains outside the trusted theorem base.

## Build

The pinned toolchain is defined by `lean-toolchain`. From this directory:

```bash
lake update
lake build PatchFormal PatchSignature PatchChecker PatchEvidence PatchSource PatchRange PatchRuntime PatchRuntimeCapability PatchGuarded
lake env lean GeneratedCertificate.lean
lake env lean GeneratedRuntimeCertificate.lean
```

CI additionally rejects any `sorry` or `admit` in the formal modules.

## Current boundary

The guard-aware runtime theorem currently covers safe-integer **recipe-parameter** guards in the documented fragment. Persistent-state guards, floating-point guard correspondence, nested formal recipe calls, GUI/event execution and the full Patch language remain outside this theorem.
