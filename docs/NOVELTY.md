# Novelty Boundary

Patch is **not** novel merely because it has patches, first-class changes, undo/history, effects, capabilities, range analysis, provenance, source calculi, procedure-call substitution, guard semantics, refinement relations, execution witnesses, translation validation, proof-carrying evidence, verified checkers, interprocedural effect summaries, ranked/well-founded call graphs, WebAssembly/C generation or GUI packaging. All have substantial prior art.

The research hypothesis remains centered on two linked ideas:

> **State-Change Factorization:** ordinary post-creation persistent mutation is forced through a structured semantic Change representation rather than ordinary assignment plus later logging.

> **Semantic Change Contracts:** Patch derives operation- and magnitude-aware summaries and authority policies from that same mandatory mutation substrate.

**Beta.26 strengthens concrete interprocedural assurance for an explicit safe-integer subset; it is supporting evidence for the primary design claim, not a new novelty headline.**

## Prior-art discipline

Patch must continue to compare against Plaid/first-class state change, Worlds/scoped state, classical/graded/quantitative/refinement effect systems, capability/permission/typestate work, abstract interpretation, interprocedural effect analysis, procedure-call operational semantics/substitution, call-graph analyses, well-founded/ranked restrictions, translation validation (including Necula), Proof-Carrying Code/certifying compilation, verified compiler/refinement/simulation work, ChEOPS/COPE/Edit Transactions, event sourcing, edit lenses, patch theory, reversible languages, CRDTs and provenance/Whyline-style debugging.

Do not claim invention of effect inference, quantitative effects, effect+capability combinations, concrete parameter binding, interprocedural effect composition, effect refinement, call-graph ranking, runtime path witnesses, translation validation, refinement checking or proof-carrying evidence.

## Machine-checked status

Current formal results include, among others:

```text
State-Change Factorization
Mutation Transparency
Change Signature Soundness
verified semantic policy checker
integer rangeAnalysisSound
EffectRefines / TraceRefines soundness
checkedConcreteRuntimeCannotEscape
GuardShape / GuardPathValid
checkedGuardedConcreteRuntimeCannotEscape
ArgsFit / argsFitBool_sound
signatureCoversBool_sound
checkRecipeEnv_sound
callSignatureSoundness
checkedRecipeExecutionCannotEscape
concreteCallBinding_sound
valueFitsWithin
concreteArgsFitThroughAbstract
concreteThroughAbstractBool_sound
evalBoundQuantitativeEffectEqBool_sound
evalBoundQuantitativeEffect_sound
checkedConcreteBoundEffectRefinesCallerSignature
```

For the effect-only structured core:

```text
RuntimeChanges(stmt) ⊆ Signature(stmt) ⊆ Capability(stmt)
```

For beta.25 abstract calls:

```text
checked finite recipe environment
+ modeled rank-decreasing call execution
------------------------------------------------
effect trace ⊆ caller semantic signature
```

For beta.26's supported direct leaf case:

```text
exact caller argument evaluation
+ exact positional callee binding
+ concrete value through abstract/declaration intervals
+ exact bound quantitative effect
+ beta.25 callee → caller signature containment
------------------------------------------------
concrete effect refines an effect in caller semantic signature
```

## Beta.23 guard-aware assurance

For the explicit safe-integer recipe-parameter guard fragment, proof-free branch witnesses must agree with normalized guard evaluation in Lean before concrete direct-runtime effects are composed with Change Capabilities. This remains restricted correspondence, not end-to-end compiler verification.

## Beta.25 abstract recipe-call assurance

Beta.25 introduced a separate finite call-aware effect layer. `PatchCalls.lean` independently checks call resolution, strict rank decrease, argument-interval fit, direct-effect membership and callee-to-caller semantic-signature containment. `callSignatureSoundness` proves modeled transitive call effects remain within the caller signature.

This layer is abstract: call arguments are intervals, not exact values.

## Beta.26 concrete recipe-call assurance

Beta.26 closes part of that explicit gap without changing the language syntax or Change IR.

For supported inter-recipe variable-pass-through calls, a proof-free production witness records caller bindings, a formal `RangeExpr`, exact argument values, expected callee bindings and beta.25 abstract intervals. Lean independently re-evaluates the argument and checks exact positional parameter binding through `concreteCallBinding_sound`.

`PatchCallRefinement.lean` connects the exact value to beta.25's abstract interval and the declared callee interval. Thus the concrete value is not accepted merely because JavaScript says it fits.

For a narrower direct quantitative leaf Change, `PatchCallEffect.lean` evaluates the amount expression under the exact bound callee environment, constructs a singleton concrete effect such as `increase [4,4]`, proves `EffectRefines` against the formal callee effect such as `increase [0,5]`, and composes that with beta.25's callee-to-caller signature containment.

The generated `GeneratedConcreteCallCertificate.lean` checks the running production example under pinned Lean. This is stronger than beta.25's interval-only composition, but it still does **not** establish arbitrary substitution semantics, arbitrary callee-body execution or production-Wasm call equivalence.

## Primary vs supporting contribution

Primary candidate claim:

> Patch factors ordinary persistent mutation through a structured semantic Change representation and derives operation- and magnitude-aware semantic authority from that same mandatory mutation substrate.

Supporting assurance/evaluation mechanisms, not novelty headlines:

- independent SourceStmt/range and GuardTree translation validation;
- verified semantic policy checker and machine-checked range fragment;
- RuntimePath/GuardPath checking and concrete runtime capability containment;
- finite rank-decreasing recipe-call signature composition;
- exact safe-integer variable call binding for an explicit subset;
- direct bound quantitative effect refinement into the caller signature;
- production-generated Lean certificates;
- independent runtime transition/effect validation;
- C99/FreeBSD and Window platform artifacts;
- provenance/undo/preview/replay tooling.

## Candidate beta.26 paper claim

A defensible working claim is:

> We present Patch, an experimental language in which post-creation persistent mutation is factored through structured semantic Changes and operation-/magnitude-aware Semantic Change Contracts are derived from that mandatory mutation substrate. For mechanized fragments we prove Change Signature Soundness, semantic policy containment, source/evidence correspondence and integer range-analysis soundness. Conservative source/control-flow and runtime artifacts are checked through explicit validation/certificate boundaries. For a finite acyclic recipe fragment, Lean checks abstract argument-interval and semantic-signature composition. For a narrower safe-integer inter-recipe variable-passing subset, generated proof-free evidence is re-evaluated by Lean to establish exact positional parameter binding; for direct quantitative leaf Changes, the resulting exact effect is proved to refine an effect admitted by the caller semantic signature. These results do not constitute full compiler verification, arbitrary parameter-substitution correctness or production-Wasm call equivalence.

This is a contribution hypothesis, not a firstness assertion.

## High-venue path

Highest-value next work:

1. retain State-Change Factorization + quantitative semantic authority as the primary claim;
2. expand concrete call certification to useful arithmetic `RangeExpr` arguments and structured callee bodies;
3. connect concrete call certificates to observed direct-Wasm call execution;
4. build semantic-security/plugin cases where bounded semantic authority matters;
5. measure analysis/validation/certificate/checker/backend overhead and complete systematic related-work/reproducibility passes.

Patch remains plausible as an OOPSLA/ECOOP-style direction, but is not yet submission-ready. The next gains should come from broader concrete call/runtime correspondence and evaluation rather than unrelated feature accumulation.
