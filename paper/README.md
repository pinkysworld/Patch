# Paper

Working manuscript:

**Patch: State-Change Factorization and Semantic Change Contracts for Transparent Mutable Programs**

## Current artifact status

The implementation/research artifact is **Patch 0.2.0-beta.29 / Change IR 0.10**. The manuscript remains working research text, not yet a submission-ready top-venue paper.

The assurance story now includes:

1. **Lean semantic core** — factorization, Mutation Transparency, Change Signature Soundness, verified policy containment and integer range-analysis soundness.
2. **Source/guard translation validation** — separate production and raw-source artifact paths for explicit fragments.
3. **Direct-runtime validation/correspondence** — concrete semantic effects and guard-aware path evidence for a conservative direct-Wasm subset.
4. **Abstract call composition** — finite acyclic `formalCalls` environments checked by `PatchCalls.lean`.
5. **Exact concrete call binding** — exact safe-integer call arguments re-evaluated and positionally bound by Lean.
6. **Direct leaf-effect refinement** — exact bound quantitative effects refined into caller semantic signatures.
7. **Arithmetic certificate coverage** — production concrete-call certificates preserve the already mechanized integer `RangeExpr` fragment.
8. **Beta.28 exact structured callee traces** — complete semantic-effect traces for a conservative direct quantitative sequence/static-repeat callee-body fragment are independently evaluated and checked by Lean.
9. **Beta.29 guard-aware exact structured traces** — Lean independently evaluates formal branch truth under exact callee bindings, checks only the selected concrete trace and still requires static signature coverage for both arms.

None of these is described as complete compiler verification.

## Beta.29 guard-aware exact callee-trace milestone

The reproducible guarded example is:

```patch
create number score = 0
create number coins = 0

make award(amount number 1..5):
  if amount >= 3:
    change score:
      add amount
  else:
    change coins:
      add amount * 2

make caller_high(bonus number 0..4):
  do award(bonus + 1)

make caller_low(bonus number 0..4):
  do award(bonus + 1)

do caller_high(2)
do caller_low(0)
```

Exact binding gives `amount = 3` for the first call and `amount = 1` for the second. The production witness emits proof-free selected trace claims:

```text
caller_high -> award: score increase [3,3]
caller_low  -> award: coins increase [2,2]
```

`formal/PatchCallBody.lean` now extends the beta.28 `BoundStmt` with:

```text
branch GuardExpr thenBranch elseBranch
```

The guard is not trusted as a JavaScript Boolean. Lean evaluates the already-mechanized `GuardExpr` through `evalGuard guard (envOfBindings bindings)`. `BoundExec.branchThen` and `BoundExec.branchElse` record the concrete branch truth, and `evalBoundStmt_sound` connects executable evaluation to that relational execution.

`BoundBodyCovered` intentionally requires **both** branch arms to be represented in the callee semantic signature. The concrete execution trace still contains only the selected branch. `boundExecRefinesSignature` proves every selected concrete occurrence refines the callee signature, and `formal/PatchCallBodyImport.lean` composes that with exact binding and beta.25 `SignatureCovers` through `checkedConcreteCallBodyRefinesCallerSignature`.

`GeneratedGuardedCallBodyCertificate.lean` is generated from `examples/formal-callee-guard.patch` and checked under pinned Lean. The focused beta.29 workflow also regenerates and verifies `GeneratedConcreteCallBodyCertificate.lean` as the beta.28 regression certificate.

### Exact beta.29 boundary

Covered:

- bounded safe-integer inter-recipe arguments from the beta.27 `RangeExpr` fragment;
- exact positional parameter binding;
- direct quantitative `add`/`remove` emits;
- sequence;
- literal/static repeat;
- formal Boolean/comparison `GuardExpr` over exact recipe parameters;
- exact true/false branch selection;
- complete selected semantic-effect trace;
- static callee-signature coverage for both branch arms;
- selected-trace import into the caller semantic signature.

Still outside:

- persistent-state guard variables in the exact callee certificate;
- nested recipe calls inside the certified body;
- dynamic repeats;
- arbitrary state-dependent amounts/guards outside the formal fragments;
- root-program concrete call certification;
- complete transitive concrete call traces;
- recursive/floating-point procedure semantics;
- production JavaScript/direct-Wasm call equivalence;
- full compiler verification.

## Beta.28 exact structured callee-trace milestone

Beta.28 established the branch-free baseline with direct quantitative emits, sequence and static repeat. `GeneratedConcreteCallBodyCertificate.lean` is generated from `examples/formal-callee-trace.patch`; Lean checks exact binding, the complete claimed three-occurrence trace and whole-trace import into the caller signature.

The beta.28 theorem chain remains a regression requirement in beta.29:

```text
evalBoundStmt
→ evalBoundStmtEqBool_sound
→ BoundBodyCovered
→ boundExecRefinesSignature
→ checkedConcreteCallBodyRefinesCallerSignature
→ TraceRefinesSignature exactTrace callerSignature
```

## Beta.27 arithmetic concrete-call milestone

Beta.27 made generated concrete-call certificates preserve:

```text
RangeExpr.lit
RangeExpr.var
RangeExpr.add
RangeExpr.sub
RangeExpr.neg
RangeExpr.scale Nat
```

For `bonus + 1` and `amount * 2`, `GeneratedArithmeticCallCertificate.lean` carries the formal expressions rather than only JavaScript-computed constants. Lean re-evaluates exact binding and the direct quantitative leaf effect through the existing beta.26 refinement theorem.

This is production-to-formal certificate coverage, not a new arithmetic soundness theorem.

## Beta.26 exact binding/effect milestone

Beta.26 introduced `PatchCallSubstitution.lean`, `PatchCallRefinement.lean` and `PatchCallEffect.lean`. A serializable `BindingList` is converted into the established functional `IntEnv`; `concreteCallBinding_sound` proves exact expression evaluation/range fit/positional binding; `checkedConcreteBoundEffectRefinesCallerSignature` combines exact direct leaf-effect evaluation with beta.25 callee-to-caller signature containment.

## Beta.25 abstract call composition

A proof-free `formalCalls` environment records safe-integer argument intervals, ranks and semantic signatures. `PatchCalls.lean` checks rank decrease, `ArgsFit`, direct-effect membership and callee-to-caller signature containment. `callSignatureSoundness` proves modeled transitive abstract call effects remain within the caller signature.

## Supporting runtime/product milestones

The beta.23 guard-aware runtime path checks concrete direct-Wasm effects and branch witnesses against normalized source guards and Change Capabilities for an explicit safe-integer fragment. Beta.24 shows that editable Window input preserves the single semantic persistent-mutation route: control edits expose transient `value`; only source `change` persists state.

The Studio now also has source-backed Designer control selection/property editing, project-specific sealed Console executables and a sandboxed/validated Window desktop runtime path. These are engineering/artifact improvements, not novelty claims.

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
PatchGuarded.lean            GuardExpr truth + guarded runtime/capability correspondence
PatchCalls.lean              finite ranked calls + abstract signature soundness
PatchCallSubstitution.lean   exact RangeExpr argument evaluation + positional binding
PatchCallRefinement.lean     concrete values through abstract/declaration intervals
PatchCallEffect.lean         exact bound direct quantitative effect → caller signature
PatchCallBody.lean           exact guarded sequence/static-repeat body execution + full trace
PatchCallBodyImport.lean     exact selected callee trace → caller signature import
```

## Artifact engineering

Reproducible certificate commands include:

```bash
npm run concrete-call-certify:example
npm run arithmetic-call-certify:example
npm run callee-trace-certify:example
npm run guarded-callee-trace-certify:example
```

The third command generates `formal/GeneratedConcreteCallBodyCertificate.lean`; the fourth generates `formal/GeneratedGuardedCallBodyCertificate.lean`.

The artifact retains direct numeric Patch→Wasm, portable C99 tested on Linux/macOS/FreeBSD 15.1, Windows/macOS/Linux Console and Window packages, Standalone Window Web Apps and Patch Studio. These engineering features support artifact evaluation but are not novelty claims.

## Current claim boundary

A defensible beta.29 formal/artifact statement is:

> For explicit mechanized fragments, Patch proves semantic Change Signature and policy properties and checks conservative source/guard/runtime evidence. For finite acyclic recipe environments, Lean checks abstract argument-interval and semantic-signature composition. Generated proof-free concrete call evidence is re-evaluated by Lean for exact positional binding and arithmetic effects. For a conservative direct quantitative branch/sequence/static-repeat callee-body fragment, Lean independently evaluates formal guard truth under exact recipe-parameter bindings, evaluates the complete selected semantic-effect trace, checks exact trace equality, verifies static callee-signature coverage for both branch arms and proves the selected concrete trace is represented by the caller semantic signature. These results do not establish state-dependent exact callee guards, nested/transitive exact callee execution, production-Wasm call equivalence or full compiler verification.

Still unverified include parser/extractor correctness, JavaScript→Wasm lowering, Wasm engine correctness, complete call-aware runtime observation and nested/transitive structured concrete execution.

## Remaining high-value gaps

- nested and complete transitive concrete call-trace semantics;
- composition with observed direct-Wasm call execution;
- semantic-security/plugin case studies;
- measured validation/certificate/checker/backend overhead;
- systematic related-work review and reproducibility bundle;
- empirical usability work only with appropriate study/ethics design.

## Prior-art discipline

Patch does not claim novelty for procedure-call semantics, parameter/arithmetic substitution, structured trace semantics, guard evaluation, call graphs, interprocedural effect summaries, range analysis, effect refinement, abstract interpretation, translation validation, Proof-Carrying Code, verified checkers, WebAssembly/C generation, provenance, undo, GUI wiring or cross-platform packaging.

The candidate contribution remains **mandatory semantic mutation factorization plus operation-/magnitude-aware semantic authority derived from the same representation**. Beta.29's guard-aware exact trace layer is supporting assurance, not a firstness assertion.

## Manuscript source

`main.tex` remains the working article source and requires a controlled manuscript synchronization pass before venue submission. No empirical performance or user-study results should be stated until actually collected.
