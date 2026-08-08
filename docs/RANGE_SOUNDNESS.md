# Beta 9 Range-Analysis Soundness

Patch 0.2.0-beta.9 adds a machine-checked soundness result for a deliberately small integer expression fragment used by magnitude-aware Semantic Change Contracts.

## Why this matters

A production capability can say:

```patch
allow reward:
  player.score may increase up to 10

make reward(player, bonus number 0..5):
  change player:
    add bonus * 2 to score
```

The production analyzer computes `bonus * 2` as `0..10`. Before beta 9, the formal checker validated the emitted interval and its containment in policy, but the statement that an expression's concrete result really lies inside its inferred interval was not mechanized.

Beta 9 formalizes that mathematical obligation for a useful integer fragment.

## Formal expression language

`formal/PatchRange.lean` defines:

```text
RangeExpr =
    lit Int
  | var Name
  | add RangeExpr RangeExpr
  | sub RangeExpr RangeExpr
  | neg RangeExpr
  | scale Nat RangeExpr
```

`scale n e` is multiplication by a non-negative integer constant. This representation makes the first verified fragment linear and directly covers common capability expressions such as `bonus * 2`.

The module defines a concrete evaluator:

```text
evalRangeExpr : RangeExpr -> IntEnv -> Option Int
```

and an interval analyzer:

```text
analyzeRange : RangeExpr -> RangeEnv -> Option Interval
```

A concrete value environment respects an abstract range environment when every concrete variable value lies inside its declared interval.

## Main theorem

Lean machine-checks:

```text
rangeAnalysisSound
```

schematically:

```text
EnvRespects(ranges, values)
analyzeRange(expr, ranges) = some interval
evalRangeExpr(expr, values) = some value
------------------------------------------------
value ∈ interval
```

This is a general theorem for every expression in the modeled fragment, not a test over selected examples.

A separate sanity theorem establishes the motivating case:

```text
bonus ∈ [0,5]
---------------------
2 * bonus ∈ [0,10]
```

## Production connection

`src/formal-range.js` independently parses supported production expression text into the formal expression vocabulary. It is intentionally separate from `src/range-analysis.js`.

For a certifiable numeric source change, Patch currently computes:

```text
production expression
   |
   +--> range-analysis.js ------> production interval
   |
   `--> formal-range.js --------> RangeExpr + independent formal-style interval
```

Certification requires the two intervals to agree. The generated Lean certificate then emits the `RangeExpr`, its abstract environment and the claimed interval. Lean evaluates `analyzeRange` on those values and applies `rangeAnalysisSound` to every modeled concrete evaluation.

This makes the assurance structure stronger than merely importing the production analyzer's interval into Lean.

## Deliberate boundary

The production analyzer is currently broader than the verified beta.9 fragment. Certification therefore refuses expressions whose semantics have not yet been modeled precisely.

Currently outside beta.9 range certification:

- division;
- decimal or floating-point literals/semantics;
- general multiplication where neither side is a non-negative integer literal;
- arbitrary production expression features not represented by `RangeExpr`.

Such expressions can still be ordinary Patch expressions where supported by the production implementation, but they are not silently called formally range-certified.

## What is and is not proved

Machine checked for the formal fragment:

```text
formal range analysis is sound with respect to formal integer evaluation
```

Generated certificate checking also verifies that the emitted formal expression analyzes to the emitted formal interval.

Still outside the theorem:

```text
Patch source bytes -> production parser/AST -> RangeExpr extraction
production runtime evaluation -> formal evalRangeExpr correspondence
```

The independent extractor and production/formal range comparison reduce this trust boundary, but they do not constitute a proof of the JavaScript parser or runtime.

## Formal CI

Formal CI pins Lean 4.30.0 and explicitly builds:

```text
PatchFormal
PatchSignature
PatchChecker
PatchEvidence
PatchSource
PatchRange
```

It then generates a certificate from `examples/range-soundness.patch`, whose protected recipe uses `bonus * 2`, and compiles that generated certificate with Lean.

The CI also rejects unfinished `sorry` and `admit` proof placeholders.

## Research significance

Range analysis and abstract interpretation have extensive prior art. Patch does not claim interval analysis itself as novel.

The relevant research question is whether Patch's mandatory semantic mutation representation allows quantitative authority to be attached directly to semantic state transitions, and whether useful parts of that authority chain can be independently reconstructed and machine checked while the surface language remains small.
