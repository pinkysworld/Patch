# Patch Core Formal Model

Status: **beta.28: mechanized semantic-change contracts, guard-aware runtime correspondence, finite acyclic recipe-call signature composition, exact safe-integer call binding, arithmetic concrete-call certificates, and exact structured sequence/static-repeat callee traces**.

Patch is not a fully verified compiler. Lean covers explicit fragments; the JavaScript frontend, WebAssembly lowering/runtime and implementation-side evidence producers remain named trust/validation boundaries.

## Lean modules

- `PatchFormal.lean` — semantic operations, changes, state, intervals, effects and policies.
- `PatchSignature.lean` — effect-only execution and Change Signature Soundness.
- `PatchChecker.lean` — executable verified semantic policy checker.
- `PatchEvidence.lean` — proof-free evidence decoding/correspondence.
- `PatchSource.lean` — source mutation normalization and `SourceExecutes`.
- `PatchRange.lean` — integer `RangeExpr` evaluator/analyzer and `rangeAnalysisSound`.
- `PatchRuntime.lean` — `EffectRefines`, `TraceRefines`, `RuntimePath` correspondence.
- `PatchRuntimeCapability.lean` — concrete runtime capability containment.
- `PatchGuarded.lean` — guard evaluation and guard-aware RuntimePath validity.
- `PatchCalls.lean` — finite recipe environments, argument-interval fit, rank-decreasing calls and call-aware signature soundness.
- `PatchCallSubstitution.lean` — exact `RangeExpr` argument evaluation and positional callee binding.
- `PatchCallRefinement.lean` — exact concrete values transported through abstract argument intervals into declarations.
- `PatchCallEffect.lean` — exact bound direct quantitative effects refined into imported caller-signature effects.
- `PatchCallBody.lean` — executable exact structured callee-body traces for direct emits, sequence and static repeat.
- `PatchCallBodyImport.lean` — exact whole-trace import from callee signature to caller signature.

Beta.28 does **not** introduce another arithmetic or call semantics. It builds on the existing `PatchRange`, exact binding and signature-containment layers.

## Core containment

For the effect-only structured core:

```text
Executes(stmt, runtime)
=> RuntimeChanges(runtime) ⊆ inferSignature(stmt)
```

Combined with the verified semantic policy checker:

```text
RuntimeChanges(stmt) ⊆ Signature(stmt) ⊆ Capability(stmt)
```

## Guard-aware direct runtime

The beta.23 path independently validates supported source/guard extraction and checks proof-free direct-Wasm effects and branch paths against formal source execution, guard truth and Change Capabilities. That theorem remains separate from the call-aware certificate layers.

## Beta.25 abstract call layer

`PatchCalls.lean` models finite structured `CallStmt` bodies with direct effects, sequence, branches, literal repeats and calls carrying abstract argument intervals. A `RecipeEnv` stores parameter intervals, a well-founded rank, semantic signature and body.

`checkRecipeEnv` verifies direct-effect membership, lower-rank call resolution, `ArgsFit` and callee-to-caller `SignatureCovers`. `callSignatureSoundness` proves effects from a modeled rank-decreasing call execution remain in the caller signature.

## Beta.26 exact binding/effect layer

Serializable production bindings are represented as:

```text
BindingList := List (Name × Int)
```

while the established evaluator still uses:

```text
IntEnv := Name → Option Int
```

`envOfBindings` bridges those representations. `evalCallArgs` re-evaluates exact formal argument expressions; `bindCallParams` performs positional binding. `concreteCallBinding_sound` proves an accepted binding has relational witnesses for exact expression evaluation, range fit and parameter binding.

`PatchCallRefinement.lean` composes exact value membership with beta.25 abstract interval containment. `PatchCallEffect.lean` re-evaluates a direct quantitative leaf amount under the exact bound environment and uses the existing `EffectRefines` relation. `checkedConcreteBoundEffectRefinesCallerSignature` combines exact binding/effect evaluation with executable callee membership and callee-to-caller signature containment.

## Beta.27 arithmetic certificate coverage

The formal evaluator already supports:

```text
RangeExpr.lit Int
RangeExpr.var Name
RangeExpr.add left right
RangeExpr.sub left right
RangeExpr.neg expr
RangeExpr.scale Nat expr
```

Beta.27 makes the production encoder structurally preserve that grammar. `GeneratedArithmeticCallCertificate.lean` therefore contains real `RangeExpr.add` and `RangeExpr.scale` terms for examples such as `bonus + 1` and `amount * 2`; Lean re-evaluates them under exact environments.

For a direct quantitative leaf effect, `evalBoundQuantitativeEffectEqBool`/`evalBoundQuantitativeEffectEqBool_sound` check the proof-free singleton effect claim.

## Beta.28 exact structured callee traces

Beta.28 introduces an exact callee-body fragment:

```text
inductive BoundStmt where
  | skip
  | emit (expected : Effect) (amountExpr : RangeExpr)
  | seq (first second : BoundStmt)
  | repeat (count : Nat) (body : BoundStmt)
```

`BoundExec bindings stmt trace` gives the relational semantics. Every `emit` reuses `evalBoundQuantitativeEffect`, so amount evaluation and refinement remain grounded in the previously checked exact-binding/range layer.

`evalBoundStmt` is the executable evaluator used by generated evidence. `evalBoundStmt_sound` proves successful evaluation yields `BoundExec`.

Because `Effect` intentionally has no global `DecidableEq`, proof-free claimed traces are checked by `effectListEqBool`, which applies the already-verified `effectEqBool` element by element. `effectListEqBool_sound` and `evalBoundStmtEqBool_sound` recover exact Lean list equality.

Static signature coverage is represented by `BoundBodyCovered`. `boundBodyCoveredBool_sound` connects its executable checker to the proposition.

```text
TraceRefinesSignature trace signature
:= every actual effect occurrence in trace refines some effect in signature
```

`boundExecRefinesSignature` proves this property for complete supported structured traces. `checkedEvaluatedBoundBodyRefinesSignature` packages executable evaluation plus executable body coverage.

`PatchCallBodyImport.lean` proves that trace refinement survives beta.25 callee-to-caller `SignatureCovers`. Its certificate-facing theorem is:

```text
checkedConcreteCallBodyRefinesCallerSignature
```

Given successful exact call binding, exact structured body evaluation, callee coverage and signature import, the theorem yields:

```text
ConcreteCallBindingSpec ... bindings
∧ TraceRefinesSignature trace callerSignature
```

The generated `GeneratedConcreteCallBodyCertificate.lean` checks `examples/formal-callee-trace.patch`, where `caller(bonus=2)` invokes `award(amount=3)` and the complete supported trace is:

```text
score increase [3,3]
coins increase [6,6]
coins increase [6,6]
```

The JavaScript list is proof-free; Lean re-evaluates the body and validates exact trace equality before using it in the theorem.

## Exact beta.28 boundary

Covered:

- finite acyclic/rank-decreasing abstract recipe environments from beta.25;
- bounded safe-integer parameter expressions from the beta.27 `RangeExpr` fragment;
- exact positional binding;
- direct quantitative `add`/`remove` emits;
- sequence;
- literal/static repeat;
- complete exact semantic-effect trace for that body;
- callee signature coverage;
- whole-trace import into the caller semantic signature.

Still outside:

- branch/guard choices inside the exact structured body certificate;
- nested recipe calls inside the certified body;
- dynamic repeat counts;
- arbitrary state-dependent amounts outside the formal integer fragment;
- root-program concrete call certification;
- complete transitive concrete traces across nested calls;
- recursive/floating-point call semantics;
- equivalence to production JavaScript/direct-Wasm call execution;
- full compiler correctness.

## Trust boundaries

Still not machine proved:

- production or independent JavaScript parser correctness;
- correctness/completeness of `formalCalls` and concrete-call/body extraction;
- JavaScript → Wasm lowering correctness;
- Wasm engine correctness;
- runtime observation completeness;
- branch/nested-call structured source-call execution correspondence.

Generated values and traces remain proof-free inputs. For the beta.28 fragment, Lean recomputes exact binding, structured body evaluation, trace equality and signature obligations rather than trusting the production claims.

## Research boundary

Procedure-call semantics, substitution, arithmetic expression evaluation, structured operational semantics, interprocedural effect summaries, interval analysis, effect refinement, proof-carrying evidence, translation validation and verified checkers all have extensive prior art. Beta.28 is supporting assurance for Patch's primary design hypothesis, not a standalone novelty claim.

The primary candidate contribution remains **mandatory semantic mutation factorization plus operation-/magnitude-aware semantic authority derived from that same mutation substrate**.
