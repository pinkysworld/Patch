# Patch Core Formal Model

Status: **beta.26: mechanized semantic-change contracts, source/guard translation validation, guard-aware runtime correspondence, finite acyclic recipe-call signature composition, exact safe-integer call binding and conservative direct bound-effect refinement**.

Patch is not a fully verified compiler. Lean covers explicit fragments; the JavaScript frontend, WebAssembly lowering/runtime and implementation-side evidence producers remain named trust/validation boundaries.

## Lean modules

- `PatchFormal.lean` — semantic operations, changes, state, intervals, effects and policies.
- `PatchSignature.lean` — effect-only `CoreStmt`, execution and Change Signature Soundness.
- `PatchChecker.lean` — executable verified semantic policy checker.
- `PatchEvidence.lean` — proof-free evidence decoding/correspondence.
- `PatchSource.lean` — source mutation verbs, normalization and `SourceExecutes`.
- `PatchRange.lean` — integer `RangeExpr` evaluation/analysis and `rangeAnalysisSound`.
- `PatchRuntime.lean` — `EffectRefines`, `TraceRefines`, proof-free `RuntimePath` and runtime correspondence.
- `PatchRuntimeCapability.lean` — concrete runtime capability containment.
- `PatchGuarded.lean` — guard evaluation, GuardTree shape and guard-aware RuntimePath validity.
- `PatchCalls.lean` — beta.25 finite recipe environments, argument-interval fit, rank-decreasing calls and call-aware signature soundness.
- **`PatchCallSubstitution.lean`** — beta.26 exact caller-side `RangeExpr` evaluation and positional callee parameter binding.
- **`PatchCallRefinement.lean`** — exact concrete values transported through beta.25 argument intervals into declared callee ranges.
- **`PatchCallEffect.lean`** — exact bound direct quantitative effects refined into imported caller-signature effects.

Formal CI builds every module, generates static/runtime/abstract-call/concrete-call certificates from production Patch source, compiles those certificates under pinned Lean, and rejects `sorry`/`admit`.

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

The runtime/capability modules additionally transfer authority to decoded concrete runtime effects that refine a formal source execution.

## Source, guard and runtime validation

Production source/guard extraction and independent raw-source validation remain separate. `PatchGuarded.lean` checks proof-free branch witnesses against normalized safe-integer recipe-parameter guards and composes accepted direct-runtime evidence with Change Capabilities.

That guard-aware runtime path remains distinct from the newer call-aware formal layers: beta.26 does not silently claim that the existing direct-Wasm runtime theorem now proves arbitrary call execution.

## Beta.25 abstract call layer

`PatchCalls.lean` models:

```text
CallStmt.skip
CallStmt.emit Effect
CallStmt.seq first second
CallStmt.branch then else
CallStmt.repeat count body
CallStmt.call name argumentIntervals
```

A finite `RecipeEnv` stores parameter intervals, a well-founded rank, semantic signature and `CallStmt` body. `checkRecipeEnv` verifies direct-effect membership, lower-rank call resolution, positional `ArgsFit` and callee-to-caller `SignatureCovers`.

The central abstract theorem is `callSignatureSoundness`:

```text
EnvironmentChecked env
CallExec env rank stmt trace
BodyComposes env rank signature stmt
------------------------------------------------
SignatureCovers trace signature
```

`checkedRecipeExecutionCannotEscape` packages the result for a checked finite environment. This remains an abstract interval/effect-summary theorem.

## Beta.26 exact argument evaluation and parameter binding

The existing formal integer evaluator is reused rather than duplicated. The serializable production witness is represented in Lean as:

```text
BindingList := List (Name × Int)
```

while the established evaluator environment remains:

```text
IntEnv := Name → Option Int
```

`envOfBindings` converts proof-free serializable bindings into that functional environment. `evalCallArgs` evaluates a positional list of `RangeExpr` arguments in the caller environment. `bindCallParams` binds the resulting exact integers positionally to callee parameter names.

The executable step is:

```text
concreteCallBinding
  exprs caller params declared
  : Option BindingList
```

It requires exact argument evaluation, pointwise `ConcreteArgsFit` against the declared callee intervals and arity-correct positional binding. Its soundness theorem is:

```text
concreteCallBinding_sound
```

which yields `ConcreteCallBindingSpec` containing relational witnesses for evaluation, range fit and binding.

## Exact value through beta.25 abstract intervals

`PatchCallRefinement.lean` composes beta.26 exact values with beta.25 abstract call intervals.

For one value:

```text
ValueFits value actual
Within actual declared
-----------------------
ValueFits value declared
```

is theorem `valueFitsWithin`.

Pointwise over arguments:

```text
ConcreteArgsFit values actual
ArgsFit actual declared
-----------------------------
ConcreteArgsFit values declared
```

is theorem `concreteArgsFitThroughAbstract`. `concreteThroughAbstractBool` is the executable certificate-facing checker, with theorem `concreteThroughAbstractBool_sound`.

For the running example, this lets Lean check the concrete chain:

```text
4 ∈ [0,5] ⊆ [0,5]
```

rather than merely trusting a JavaScript claim that the concrete value fits.

## Direct bound quantitative effect refinement

`PatchCallEffect.lean` adds a deliberately narrower concrete effect layer. For a direct quantitative leaf Change, `evalBoundQuantitativeEffect` evaluates the amount `RangeExpr` under `envOfBindings bound` and constructs an exact singleton amount interval:

```text
amount = 4  ->  [4,4]
```

`evalBoundQuantitativeEffect_sound` proves that a successful instantiation satisfies the existing `PatchRuntime.EffectRefines` relation against the expected formal semantic effect.

Because `Effect` intentionally has no global `DecidableEq`, generated certificates do not add one. `evalBoundQuantitativeEffectEqBool` uses beta.25's verified `effectEqBool`; `evalBoundQuantitativeEffectEqBool_sound` recovers the exact equality needed by the relational theorem.

The main beta.26 composition theorem is:

```text
checkedConcreteBoundEffectRefinesCallerSignature
```

It combines:

```text
exact concreteCallBinding
exact bound amount evaluation
callee effectMemberBool
callee → caller signatureCoversBool
```

and derives:

```text
ConcreteCallBindingSpec ...
and
RefinesSignature concreteEffect callerSignature
```

Thus, for the supported leaf case, the exact bound concrete semantic effect is shown to refine a semantic effect admitted by the caller signature.

## Production-generated concrete-call certificate

`src/concrete-call-witness.js` produces proof-free concrete witnesses by executing supported call argument expressions over safe-integer local environments. It records caller bindings, formal argument expressions, exact values, expected callee bindings and beta.25 abstract argument intervals.

`src/concrete-call-certificate.js` emits `GeneratedConcreteCallCertificate.lean`. Lean re-evaluates the arguments and reconstructs the positional bindings instead of trusting the JavaScript-produced exact-value claims.

For direct quantitative leaf calls such as:

```patch
make add_points(amount number 0..5):
  change score:
    add amount

make reward(bonus number 0..5):
  do add_points(bonus)
```

with `bonus = 4`, the generated certificate additionally checks:

```text
amount = 4
score increase [4,4]
EffectRefines [4,4] [0,5]
callee effect ∈ add_points signature
add_points signature ⊆ reward signature
```

The generated certificate is compiled under pinned Lean in both the beta.26 gate and the standard formal workflow.

## Exact beta.26 boundary

Covered:

- finite acyclic/rank-decreasing abstract recipe environments from beta.25;
- safe-integer bounded parameters;
- concrete **inter-recipe variable pass-through** argument evaluation;
- exact positional `BindingList` construction;
- concrete-value fit through beta.25 abstract argument intervals to declarations;
- a single direct quantitative leaf `add`/`remove` Change whose amount is a bound variable;
- refinement of that exact semantic effect into an imported caller signature.

Not proved:

- root-program call binding certification;
- general arithmetic argument substitution, despite the wider `RangeExpr` evaluator existing formally;
- arbitrary multi-statement, branch, repeat or nested-call callee execution under exact bound environments;
- complete transitive concrete traces across an entire call tree;
- equivalence to production JavaScript/direct-Wasm call execution;
- recursive recipe semantics, floating-point call correspondence or the full Patch language;
- full compiler correctness.

These exclusions are deliberate. beta.26 closes a concrete binding/effect gap without overstating it as end-to-end procedure-call verification.

## Trust boundaries

Still not machine proved:

- production or independent JavaScript parser correctness;
- JavaScript → Wasm lowering correctness;
- Wasm engine correctness;
- runtime observation completeness;
- correctness of production `formalCalls` extraction;
- correctness/completeness of the proof-free concrete-call witness extractor;
- source-to-certificate correspondence for arbitrary call amount expressions outside the explicitly generated subset.

Generated environments, bindings and effect claims are therefore proof-free inputs whose supported obligations are recomputed or checked by Lean.

## Research boundary

Procedure-call operational semantics, substitution, call graphs, well-founded restrictions, interprocedural effect summaries, interval analysis, effect refinement, proof-carrying evidence, translation validation and verified checkers all have extensive prior art. The beta.25/26 call layers are supporting assurance for Patch's primary design hypothesis, not standalone firstness claims.

The primary candidate contribution remains **mandatory semantic mutation factorization plus operation-/magnitude-aware semantic authority derived from that same mutation substrate**.
