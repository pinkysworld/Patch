# Patch Core Formal Model

Status: **beta.27: mechanized semantic-change contracts, guard-aware runtime correspondence, finite acyclic recipe-call signature composition, exact safe-integer call binding, and production-generated arithmetic `RangeExpr` call/effect certificates**.

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

Beta.27 does **not** add a parallel arithmetic semantics. It carries the existing `PatchRange.RangeExpr` semantics through the production-generated concrete-call certificate boundary.

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

The formal evaluator already supports this integer expression grammar:

```text
RangeExpr.lit Int
RangeExpr.var Name
RangeExpr.add left right
RangeExpr.sub left right
RangeExpr.neg expr
RangeExpr.scale Nat expr
```

Beta.26's production certificate encoder deliberately exposed only `RangeExpr.var`. Beta.27 makes the encoder structurally preserve the full grammar above. This is a production/formal coverage improvement, not a new range-analysis theorem.

Example:

```patch
create number score = 0

make leaf(amount number 1..6):
  change score:
    add amount * 2

make caller(bonus number 0..5):
  do leaf(bonus + 1)

do caller(4)
```

The proof-free producer records exact values but the generated certificate carries the expressions themselves:

```text
RangeExpr.add (RangeExpr.var "bonus") (RangeExpr.lit 1)
RangeExpr.scale 2 (RangeExpr.var "amount")
```

Lean re-evaluates them. For the concrete invocation it establishes:

```text
bonus = 4
bonus + 1 = 5
amount = 5
amount * 2 = 10
```

The first exact value is checked through the beta.25 abstract argument interval into the callee declaration. The second becomes the singleton concrete semantic effect:

```text
score increase [10,10]
```

which must refine the expected direct leaf effect and an effect represented by the caller signature.

`GeneratedArithmeticCallCertificate.lean` is generated from `examples/formal-calls-arithmetic.patch`. A dedicated `Patch Beta27 Arithmetic Calls` workflow compiles that exact generated file under pinned Lean. Standard Formal CI also generates and checks both the beta.26 variable example and the beta.27 arithmetic example.

## Production certificate boundaries

`src/concrete-call-witness.js` remains a proof-free producer. It records caller bindings, formal argument expressions, concrete values, expected callee bindings and beta.25 abstract intervals. Duplicate parameter names are rejected explicitly at this boundary.

`src/concrete-call-certificate.js` version 0.3 recursively encodes the already-supported formal `RangeExpr` constructors. For direct quantitative leaf Changes it computes only a proof-free claimed singleton effect; Lean independently re-evaluates the encoded amount expression through `evalBoundQuantitativeEffectEqBool`/`evalBoundQuantitativeEffectEqBool_sound`.

## Exact beta.27 boundary

Covered by the concrete certificate:

- finite acyclic/rank-decreasing abstract recipe environments from beta.25;
- safe-integer bounded parameters;
- inter-recipe argument expressions using integer literals, variables, `+`, `-`, unary negation and multiplication by a non-negative integer literal;
- exact positional binding;
- exact-value fit through beta.25 abstract argument intervals into declarations;
- one direct quantitative leaf `add`/`remove` Change whose amount uses the same formal integer expression fragment;
- refinement of the exact singleton effect into an imported caller signature.

Still outside:

- division, decimals and general variable-by-variable multiplication;
- root-program concrete call certification;
- arbitrary multi-statement, branch, repeat or nested-call callee execution under exact bindings;
- complete transitive concrete traces across a call tree;
- recursive call semantics;
- equivalence to production JavaScript/direct-Wasm call execution;
- full compiler correctness.

## Trust boundaries

Still not machine proved:

- production or independent JavaScript parser correctness;
- correctness/completeness of `formalCalls` and concrete-call extraction;
- JavaScript → Wasm lowering correctness;
- Wasm engine correctness;
- runtime observation completeness;
- arbitrary structured source-call execution correspondence.

Generated exact values and effect claims remain proof-free inputs. For the supported certificate fragment, Lean recomputes the expression/binding/effect obligations rather than trusting those values.

## Research boundary

Procedure-call semantics, substitution, arithmetic expression evaluation, interprocedural effect summaries, interval analysis, effect refinement, proof-carrying evidence, translation validation and verified checkers all have extensive prior art. Beta.27 is supporting assurance for Patch's primary design hypothesis, not a standalone novelty claim.

The primary candidate contribution remains **mandatory semantic mutation factorization plus operation-/magnitude-aware semantic authority derived from that same mutation substrate**.
