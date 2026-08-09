# Paper

Working manuscript:

**Patch: State-Change Factorization and Semantic Change Contracts for Transparent Mutable Programs**

## Current artifact status

The implementation/research artifact is **Patch 0.2.0-beta.27 / Change IR 0.10**. The manuscript remains working research text, not yet a submission-ready top-venue paper.

The assurance story now includes:

1. **Lean semantic core** — factorization, Mutation Transparency, Change Signature Soundness, verified policy containment and integer range-analysis soundness.
2. **Source/guard translation validation** — separate production and raw-source artifact paths for explicit fragments.
3. **Direct-runtime validation/correspondence** — concrete semantic effects and guard-aware path evidence for a conservative direct-Wasm subset.
4. **Abstract call composition** — finite acyclic `formalCalls` environments checked by `PatchCalls.lean`.
5. **Exact concrete call binding** — exact safe-integer call arguments re-evaluated and positionally bound by Lean.
6. **Direct leaf-effect refinement** — exact bound quantitative effects refined into caller semantic signatures.
7. **Arithmetic certificate coverage** — the production concrete-call certificate now preserves the already mechanized integer `RangeExpr` fragment instead of limiting generated Lean to variables.

None of these is described as complete compiler verification.

## Beta.27 arithmetic concrete-call milestone

The new reproducible example is:

```patch
create number score = 0

make leaf(amount number 1..6):
  change score:
    add amount * 2

make caller(bonus number 0..5):
  do leaf(bonus + 1)

do caller(4)
show score
```

The JavaScript producer observes a concrete invocation but the generated Lean certificate preserves the formal expressions:

```text
call argument = RangeExpr.add (RangeExpr.var "bonus") (RangeExpr.lit 1)
leaf amount   = RangeExpr.scale 2 (RangeExpr.var "amount")
```

Lean re-evaluates them under the exact environments rather than accepting JavaScript's computed values as proofs. For this invocation the checked chain is:

```text
bonus = 4
bonus + 1 = 5
amount = 5
amount * 2 = 10
actual semantic effect = score increase [10,10]
```

The exact argument is still checked through beta.25's abstract argument interval into the callee declaration. The exact singleton effect is checked through the beta.26 `EffectRefines`/caller-signature composition theorem.

`src/concrete-call-certificate.js` version 0.3 recursively encodes:

```text
RangeExpr.lit
RangeExpr.var
RangeExpr.add
RangeExpr.sub
RangeExpr.neg
RangeExpr.scale Nat
```

which is exactly the already-mechanized integer expression fragment used by `PatchRange.lean`. Beta.27 therefore adds **production-to-formal certificate coverage**, not a new arithmetic soundness theorem.

The generated `GeneratedArithmeticCallCertificate.lean` is checked under pinned Lean by a dedicated workflow and by standard Formal CI. Standard CI retains `GeneratedConcreteCallCertificate.lean` as well, so arithmetic coverage does not replace the beta.26 variable-only regression case.

### Exact beta.27 boundary

Covered:

- bounded safe-integer inter-recipe arguments using integer literals, variables, addition, subtraction, unary negation and multiplication by a non-negative integer literal;
- exact positional parameter binding;
- exact values checked through beta.25 abstract intervals into declarations;
- a direct quantitative leaf `add`/`remove` amount using the same integer expression fragment;
- exact singleton effect refinement into an effect represented by the caller semantic signature.

Still outside:

- division, decimals and general variable-by-variable multiplication;
- root-program concrete call certification;
- arbitrary structured callee-body execution under exact bindings;
- complete transitive concrete call traces;
- recursive/floating-point procedure semantics;
- production JavaScript/direct-Wasm call equivalence;
- full compiler verification.

## Beta.26 exact binding/effect milestone

Beta.26 introduced `PatchCallSubstitution.lean`, `PatchCallRefinement.lean` and `PatchCallEffect.lean`. A serializable `BindingList` is converted into the established functional `IntEnv`; `concreteCallBinding_sound` proves exact expression evaluation/range fit/positional binding; `checkedConcreteBoundEffectRefinesCallerSignature` combines exact direct leaf-effect evaluation with beta.25 callee-to-caller signature containment.

The production-generated `GeneratedConcreteCallCertificate.lean` remains checked in CI. Duplicate parameter names are rejected at the concrete binding boundary to avoid ambiguous `BindingList → IntEnv` semantics.

## Beta.25 abstract call composition

A proof-free `formalCalls` environment records safe-integer argument intervals, ranks and semantic signatures. `PatchCalls.lean` checks rank decrease, `ArgsFit`, direct-effect membership and callee-to-caller signature containment. `callSignatureSoundness` proves modeled transitive abstract call effects remain within the caller signature.

## Supporting runtime/product milestones

The beta.23 guard-aware runtime path checks concrete direct-Wasm effects and branch witnesses against normalized source guards and Change Capabilities for an explicit safe-integer fragment. Beta.24 shows that editable Window input preserves the single semantic persistent-mutation route: control edits expose transient `value`; only source `change` persists state.

## Current formal modules

```text
PatchFormal.lean             factorization, state, intervals, effects, policies
PatchSignature.lean          effect-only execution + signature soundness
PatchChecker.lean            verified semantic policy checker
PatchEvidence.lean           proof-free evidence decoding
PatchSource.lean             source normalization + SourceExecutes
PatchRange.lean              integer evaluator/range soundness
PatchRuntime.lean            EffectRefines + RuntimePath correspondence
PatchRuntimeCapability.lean  concrete runtime capability containment
PatchGuarded.lean            guard truth + guarded runtime/capability correspondence
PatchCalls.lean              finite ranked calls + abstract signature soundness
PatchCallSubstitution.lean   exact RangeExpr argument evaluation + positional binding
PatchCallRefinement.lean     concrete values through abstract/declaration intervals
PatchCallEffect.lean         exact bound direct quantitative effect → caller signature
```

No new Lean module is required for beta.27 because the arithmetic semantics was already mechanized in `PatchRange.lean`; the new result is that production-generated certificates preserve and exercise it.

## Artifact engineering

Reproducible certificate commands include:

```bash
npm run concrete-call-certify:example
npm run arithmetic-call-certify:example
```

The second command generates `formal/GeneratedArithmeticCallCertificate.lean` from `examples/formal-calls-arithmetic.patch`.

The artifact retains direct numeric Patch→Wasm, portable C99 tested on Linux/macOS/FreeBSD 15.1, Windows/macOS/Linux Console and Window packages, Standalone Window Web Apps and Patch Studio. These engineering features support artifact evaluation but are not novelty claims.

## Current claim boundary

A defensible beta.27 formal/artifact statement is:

> For explicit mechanized fragments, Patch proves semantic Change Signature and policy properties and checks conservative source/guard/runtime evidence. For a finite acyclic recipe fragment, Lean checks abstract argument-interval and semantic-signature composition. Generated proof-free concrete call evidence is re-evaluated by Lean for exact positional binding; the production certificate preserves the existing safe-integer `RangeExpr` fragment including addition, subtraction, negation and non-negative constant scaling. For direct quantitative leaf Changes, the resulting exact singleton effect is proved to refine an effect represented by the caller semantic signature. These results do not establish arbitrary structured callee execution, production-Wasm call equivalence or full compiler verification.

Still unverified include parser/extractor correctness, JavaScript→Wasm lowering, Wasm engine correctness, complete call-aware runtime observation and arbitrary structured concrete call execution.

## Remaining high-value gaps

- structured callee-body execution under exact bound environments;
- complete transitive concrete call-trace semantics;
- composition with observed direct-Wasm call execution;
- semantic-security/plugin case studies;
- measured validation/certificate/checker/backend overhead;
- systematic related-work review and reproducibility bundle;
- empirical usability work only with appropriate study/ethics design.

## Prior-art discipline

Patch does not claim novelty for procedure-call semantics, parameter/arithmetic substitution, call graphs, interprocedural effect summaries, range analysis, effect refinement, abstract interpretation, translation validation, Proof-Carrying Code, verified checkers, WebAssembly/C generation, provenance, undo, GUI wiring or cross-platform packaging.

The candidate contribution remains **mandatory semantic mutation factorization plus operation-/magnitude-aware semantic authority derived from the same representation**. Beta.27's arithmetic certificate is supporting assurance, not a firstness assertion.

## Manuscript source

`main.tex` remains the working article source and still requires a separate controlled manuscript synchronization pass. No empirical performance or user-study results should be stated until actually collected.
