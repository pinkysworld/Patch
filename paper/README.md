# Paper

Working manuscript:

**Patch: State-Change Factorization and Semantic Change Contracts for Transparent Mutable Programs**

## Current artifact status

The implementation/research artifact is **Patch 0.2.0-beta.26 / Change IR 0.10**. The manuscript remains working research text, not yet a submission-ready top-venue paper.

The current assurance story now has a seventh explicit layer around the primary State-Change Factorization / Semantic Change Contracts claim:

1. **Lean semantic core** — factorization, Mutation Transparency, Change Signature Soundness, verified semantic policy containment and integer range-analysis soundness.
2. **Source translation validation** — independent raw-source SourceStmt/range reconstruction.
3. **Guard translation validation** — independent raw-source GuardTree/control-flow reconstruction.
4. **Direct-runtime validation** — independent reconstruction of concrete semantic effects from direct-Wasm transitions.
5. **Guard-aware runtime → Lean composition** — concrete effects, paths and safe-integer invocation environments checked against formal execution and Change Capabilities.
6. **Abstract call-aware semantic-signature composition** — finite acyclic `formalCalls` environments checked by `PatchCalls.lean`.
7. **Concrete call binding/effect refinement** — exact safe-integer inter-recipe variable arguments are re-evaluated and bound by Lean; direct quantitative leaf effects are instantiated exactly and refined into imported caller-signature effects.

None of these is described as complete compiler verification.

## Beta.26 concrete-call milestone

Consider:

```patch
create number score = 0

make add_points(amount number 0..5):
  change score:
    add amount

make reward(bonus number 0..5):
  do add_points(bonus)

make double_reward(bonus number 0..5):
  do reward(bonus)
  do reward(bonus)

do double_reward(4)
```

The beta.26 producer records proof-free concrete witnesses for the nested inter-recipe calls. For `reward(bonus=4) -> add_points(bonus)`, the certificate carries the caller binding, formal `RangeExpr.var "bonus"`, exact value `4`, expected callee binding `amount=4`, the beta.25 actual interval `[0,5]` and the declared `add_points.amount` interval `[0,5]`.

Lean does not trust those concrete claims. `PatchCallSubstitution.lean` converts a serializable `BindingList` to the existing functional `IntEnv`, re-evaluates the argument and reconstructs the exact positional binding. `concreteCallBinding_sound` proves a successful executable check satisfies the relational `ConcreteCallBindingSpec`.

`PatchCallRefinement.lean` then proves the exact value through the abstract interval chain:

```text
4 ∈ [0,5]
[0,5] ⊆ [0,5]
----------------
4 ∈ declared add_points.amount range
```

For the direct leaf Change inside `add_points`, `PatchCallEffect.lean` evaluates the bound amount expression and constructs:

```text
actual:   score increase [4,4]
expected: score increase [0,5]
```

`evalBoundQuantitativeEffect_sound` establishes the existing `EffectRefines` relation. `checkedConcreteBoundEffectRefinesCallerSignature` then combines exact binding/effect evaluation with beta.25's executable callee effect membership and callee-to-caller signature containment, yielding a concrete effect that refines an effect represented by the caller signature.

A generated `GeneratedConcreteCallCertificate.lean` is compiled under pinned Lean. The production example currently generates concrete binding checks for all four nested inter-recipe call occurrences and direct bound-effect refinement checks for the two `reward -> add_points` leaf occurrences.

### Exact beta.26 boundary

The concrete result is deliberately narrow. It currently covers:

- safe-integer inter-recipe **variable pass-through** arguments;
- exact positional parameter binding;
- concrete-value transport through beta.25 abstract argument intervals;
- one direct quantitative leaf `add`/`remove` Change whose amount is a bound variable;
- refinement of that exact effect into an effect admitted by the caller semantic signature.

It does **not** yet prove root-program concrete call binding, general arithmetic argument substitution, arbitrary structured callee-body execution, a complete transitive concrete call trace, recursive/floating-point procedure semantics, or equivalence to production JavaScript/direct-Wasm call execution.

## Beta.25 abstract call-composition milestone

Beta.25 remains the abstract interprocedural foundation. A proof-free `formalCalls` environment records safe-integer argument intervals, ranks and semantic signatures. `PatchCalls.lean` checks rank decrease, `ArgsFit`, direct-effect membership and callee-to-caller signature containment. `callSignatureSoundness` proves modeled transitive call effects remain within the caller signature.

The generated `GeneratedCallCertificate.lean` requires:

```text
checkRecipeEnv callEnv = true
```

via `native_decide`. Beta.26 builds on this result rather than replacing it.

## Beta.23/24 supporting milestones

The beta.23 guard-aware runtime path checks proof-free concrete direct-Wasm effects and branch witnesses against normalized source guards and Change Capabilities for an explicit safe-integer parameter fragment.

Beta.24 shows that editable Window input preserves the single semantic persistent-mutation route: control edits expose transient event-local `value`; only explicit source `change` persists state.

## Current formal modules

```text
PatchFormal.lean             factorization, state, intervals, effects, policies
PatchSignature.lean          effect-only CoreStmt execution + signature soundness
PatchChecker.lean            verified semantic policy checker
PatchEvidence.lean           proof-free evidence decoding
PatchSource.lean             source normalization + SourceExecutes
PatchRange.lean              integer evaluator/range soundness
PatchRuntime.lean            EffectRefines + RuntimePath correspondence
PatchRuntimeCapability.lean  concrete runtime capability containment
PatchGuarded.lean            guard truth + guarded runtime/capability correspondence
PatchCalls.lean              finite ranked recipe calls + abstract call signature soundness
PatchCallSubstitution.lean   exact concrete argument evaluation + positional binding
PatchCallRefinement.lean     concrete values through abstract/declaration intervals
PatchCallEffect.lean         bound direct quantitative effect → caller-signature refinement
```

Formal CI generates and compiles static, guard-aware direct-runtime, abstract recipe-call and concrete recipe-call certificates under pinned Lean and rejects `sorry`/`admit`.

## Artifact engineering

The beta.26 artifact retains direct numeric Patch→Wasm, portable C99 tested on Linux/macOS/FreeBSD 15.1, Windows/macOS/Linux Console and Window packages, Standalone Window Web Apps and Patch Studio. It adds the reproducible certificate command:

```bash
npm run concrete-call-certify:example
```

which generates `formal/GeneratedConcreteCallCertificate.lean` from `examples/formal-calls.patch`.

These engineering features support artifact evaluation but are not novelty claims.

## Current claim boundary

A defensible beta.26 formal statement is:

> For explicit mechanized fragments, Patch proves semantic Change Signature and policy properties and checks conservative source/guard/runtime evidence. For a finite acyclic recipe fragment, Lean checks abstract argument-interval and semantic-signature composition. For a narrower safe-integer inter-recipe variable-passing subset, generated proof-free call evidence is re-evaluated by Lean to establish exact positional parameter binding. For direct quantitative leaf Changes, the resulting exact singleton effect is proved to refine a formal effect admitted by the caller semantic signature. These results do not constitute arbitrary parameter-substitution correctness, production-Wasm call equivalence or full compiler verification.

Still unverified include JavaScript parser correctness, production `formalCalls`/concrete-call extractor correctness, JavaScript→Wasm lowering, Wasm engine correctness, complete call-aware runtime observation and arbitrary structured concrete call execution.

## Remaining high-value gaps

- richer concrete `RangeExpr` argument/substitution certification;
- structured callee-body execution under exact bound environments;
- composition with observed direct-Wasm call execution;
- semantic-security/plugin case studies;
- measured analysis/source/guard-validation/certificate/checker/backend overhead;
- systematic related-work review and reproducibility bundle;
- empirical usability work only with appropriate study/ethics design.

## Prior-art discipline

Patch does not claim novelty for procedure-call operational semantics, parameter substitution, call graphs, ranked/well-founded restrictions, interprocedural effect summaries, interval argument analysis, effect refinement, abstract interpretation, translation validation, Proof-Carrying Code, verified checkers, effects, capabilities, WebAssembly/C generation, provenance, undo, GUI event wiring or cross-platform packaging.

The candidate contribution remains **mandatory semantic mutation factorization plus operation-/magnitude-aware semantic authority derived from the same representation**. The beta.26 call result is supporting assurance, not a firstness assertion.

## Manuscript source

`main.tex` is the working article source. No empirical performance or user-study results should be stated until actually collected.
