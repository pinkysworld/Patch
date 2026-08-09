# Patch Core Formal Model

Status: **beta.29: mechanized semantic-change contracts, guard-aware runtime correspondence, finite acyclic recipe-call signature composition, exact safe-integer call binding, arithmetic concrete-call certificates, and guard-aware exact structured callee traces**.

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
- `PatchGuarded.lean` — `GuardExpr`, `evalGuard`, guard truth and guard-aware RuntimePath validity.
- `PatchCalls.lean` — finite recipe environments, argument-interval fit, rank-decreasing calls and call-aware signature soundness.
- `PatchCallSubstitution.lean` — exact `RangeExpr` argument evaluation, `envOfBindings` and positional callee binding.
- `PatchCallRefinement.lean` — exact concrete values transported through abstract argument intervals into declarations.
- `PatchCallEffect.lean` — exact bound direct quantitative effects refined into imported caller-signature effects.
- `PatchCallBody.lean` — executable exact structured callee-body traces for direct emits, sequence, static repeat and exact formal-guard branches.
- `PatchCallBodyImport.lean` — exact selected whole-trace import from callee signature to caller signature.

Beta.29 does **not** introduce another arithmetic, guard or call semantics. It reuses `PatchRange`, `PatchGuarded`, exact binding and signature-containment layers.

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

`PatchGuarded.lean` provides the formal guard language reused by beta.29:

```text
GuardExpr.bool
GuardExpr.eq
GuardExpr.lt
GuardExpr.le
GuardExpr.and
GuardExpr.or
GuardExpr.not
```

`evalGuard` evaluates those guards over an `IntEnv` using the same exact integer `RangeExpr` evaluator already used by the range/call layers.

## Beta.25 abstract call layer

`PatchCalls.lean` models finite structured `CallStmt` bodies with direct effects, sequence, branches, literal repeats and calls carrying abstract argument intervals. A `RecipeEnv` stores parameter intervals, a well-founded rank, semantic signature and body.

`checkRecipeEnv` verifies direct-effect membership, lower-rank call resolution, `ArgsFit` and callee-to-caller `SignatureCovers`. `callSignatureSoundness` proves effects from a modeled rank-decreasing call execution remain in the caller signature.

## Beta.26 exact binding/effect layer

Serializable production bindings are represented as:

```text
BindingList := List (Name × Int)
```

while the established evaluator uses:

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

Beta.28 established the branch-free exact callee-body fragment:

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

`PatchCallBodyImport.lean` proves that trace refinement survives beta.25 callee-to-caller `SignatureCovers`. Its certificate-facing theorem is `checkedConcreteCallBodyRefinesCallerSignature`.

`GeneratedConcreteCallBodyCertificate.lean` checks the unchanged branch-free beta.28 regression example.

## Beta.29 guard-aware exact structured callee traces

Beta.29 extends the **same** `BoundStmt` semantics with:

```text
| branch (guard : GuardExpr) (thenBranch elseBranch : BoundStmt)
```

No JavaScript Boolean is trusted as the branch fact. The exact evaluator computes:

```text
evalGuard guard (envOfBindings bindings)
```

where `bindings` is the exact callee `BindingList` already checked by the beta.26 call-binding theorem.

The relational semantics add:

```text
BoundExec.branchThen
BoundExec.branchElse
```

Each constructor requires the corresponding formal guard result, `some true` or `some false`, plus execution of exactly that branch. `evalBoundStmt_sound` proves a successful executable branch evaluation recovers the matching relational execution and guard truth.

The certificate-facing equality path is unchanged:

```text
evalBoundStmtEqBool
→ effectListEqBool
→ effectListEqBool_sound
→ evalBoundStmtEqBool_sound
```

so a proof-free production trace is accepted only after Lean independently selects and evaluates the concrete branch.

### Both-arm static coverage

Concrete trace selection and semantic-signature coverage are intentionally different obligations. `BoundBodyCovered` adds a branch constructor requiring coverage of **both** `thenBranch` and `elseBranch`. `boundBodyCoveredBool` checks both arms with conjunction, and `boundBodyCoveredBool_sound` proves that executable check.

`boundExecRefinesSignature` then follows only the selected `BoundExec.branchThen` or `branchElse` path and proves every actual occurrence in that selected trace refines the callee signature. `PatchCallBodyImport.lean` imports that exact selected trace through the caller signature using the existing `SignatureCovers` relation.

The final certificate-facing theorem remains:

```text
checkedConcreteCallBodyRefinesCallerSignature
```

This stability is deliberate: beta.29 strengthens the supported `BoundStmt` evaluator rather than creating a parallel theorem stack.

### Generated beta.29 evidence

`GeneratedGuardedCallBodyCertificate.lean` is generated from `examples/formal-callee-guard.patch`. It checks two calls to the same callee:

```text
caller_high -> award, amount = 3 -> then branch -> score increase [3,3]
caller_low  -> award, amount = 1 -> else branch -> coins increase [2,2]
```

Production JavaScript reconstructs a proof-free formal `GuardExpr` and claimed selected trace. Lean re-evaluates exact binding, `evalGuard`, the selected `BoundStmt`, exact trace equality, both-arm callee coverage and caller-signature import.

The focused beta.29 workflow also regenerates `GeneratedConcreteCallBodyCertificate.lean`, so the beta.28 branch-free result remains a regression requirement.

## Exact beta.29 boundary

Covered:

- finite acyclic/rank-decreasing abstract recipe environments from beta.25;
- bounded safe-integer parameter expressions from the beta.27 `RangeExpr` fragment;
- exact positional binding;
- direct quantitative `add`/`remove` emits;
- sequence;
- literal/static repeat;
- formal Boolean/comparison `GuardExpr` over exact recipe parameters;
- exact true/false branch choice;
- complete selected semantic-effect trace;
- callee signature coverage for both branch arms;
- selected-trace import into the caller semantic signature.

Still outside:

- persistent-state variables inside the exact callee guard certificate;
- nested recipe calls inside the certified body;
- dynamic repeat counts;
- arbitrary state-dependent amounts/guards outside the formal fragments;
- root-program concrete call certification;
- complete transitive concrete traces across nested calls;
- recursive/floating-point call semantics;
- equivalence to production JavaScript/direct-Wasm call execution;
- full compiler correctness.

Unsupported exact-call cases fail rather than silently weakening the certificate.

## Trust boundaries

Still not machine proved:

- production or independent JavaScript parser correctness;
- correctness/completeness of `formalCalls` and concrete-call/body/guard extraction;
- JavaScript → Wasm lowering correctness;
- Wasm engine correctness;
- runtime observation completeness;
- nested/transitive structured source-call execution correspondence;
- production JavaScript/direct-Wasm call execution equivalence.

Generated values, formal guard trees and traces remain proof-free inputs. For the beta.29 fragment, Lean recomputes exact binding, guard truth, structured body evaluation, trace equality and signature obligations rather than trusting the production claims.

## Research boundary

Procedure-call semantics, substitution, arithmetic expression evaluation, structured execution traces, guard evaluation, interprocedural effect summaries, interval analysis, effect refinement, proof-carrying evidence, translation validation and verified checkers all have extensive prior art. Beta.29 guard-aware exact callee traces are supporting assurance for Patch's primary design hypothesis, not a standalone novelty claim.

The primary candidate contribution remains **mandatory semantic mutation factorization plus operation-/magnitude-aware semantic authority derived from that same mutation substrate**.
