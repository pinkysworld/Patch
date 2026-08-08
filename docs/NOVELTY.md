# Novelty Boundary

Patch is **not** novel merely because it has patches, first-class changes, undo/history, effects, capabilities, range analysis, provenance, source calculi, guard semantics, refinement relations, execution witnesses, translation validation, proof-carrying evidence, verified checkers, WebAssembly/C generation or GUI packaging. All have substantial prior art.

The research hypothesis remains centered on two linked ideas:

> **State-Change Factorization:** ordinary post-creation persistent mutation is forced through a structured semantic Change representation rather than ordinary assignment plus later logging.

> **Semantic Change Contracts:** Patch derives operation- and magnitude-aware summaries and authority policies from that same mandatory mutation substrate.

**Beta.23 strengthens the assurance connection between concrete compiled execution and the formal semantics; it is not a new primary novelty headline.**

## Prior-art discipline

Patch must continue to compare against Plaid/first-class state change, Worlds/scoped state, classical/graded/quantitative/refinement effect systems, capability/permission/typestate work, abstract interpretation, translation validation (including Necula), Proof-Carrying Code/certifying compilation, verified compiler/refinement/simulation work, operational semantics for control flow, ChEOPS/COPE/Edit Transactions, event sourcing, edit lenses, patch theory, reversible languages, CRDTs and provenance/Whyline-style debugging.

Do not claim invention of effect inference, quantitative effects, effect+capability combinations, runtime path witnesses, guard-aware operational semantics, translation validation, refinement checking or proof-carrying evidence.

## Machine-checked status

Current formal results include:

```text
State-Change Factorization
Mutation Transparency
Change Signature Soundness
formal runtime-signature-policy containment
verified semantic policy checker
EvidenceStmt / SourceStmt correspondence
integer rangeAnalysisSound
EffectRefines / TraceRefines soundness
RuntimePath -> Executes soundness
checkSourceRuntimeEvidence_sound
allowsRefinedEffect
traceRefinesPreservesPolicy
checkedConcreteRuntimeCannotEscape
GuardShape / checkGuardShape_sound
GuardPathValid / checkGuardPath_sound
checkGuardedSourceRuntimeEvidence_sound
checkedGuardedConcreteRuntimeCannotEscape
```

For the effect-only structured core:

```text
RuntimeChanges(stmt) ⊆ Signature(stmt) ⊆ Capability(stmt)
```

## Beta.23 guard-aware assurance

Beta.22 could prove structural branch execution but the effect-only `CoreStmt.branch` did not retain source guard truth. Beta.23 adds a parallel GuardTree instead of complicating that existing effect core.

The runtime assurance chain is now:

```text
exact source
  -> production SourceStmt + GuardTree
  -> independent source/range validation
  -> independent raw GuardTree/control-flow validation

actual direct-Wasm execution
  -> independently reconstructed semantic effects
  -> proof-free RuntimePath
  -> proof-free concrete recipe-parameter environment

Lean
  -> GuardShape
  -> evalGuard under concrete IntEnv
  -> GuardPathValid
  -> SourceExecutes + TraceRefines
  -> concrete Change Capability containment
```

Within the explicit safe-integer recipe-parameter fragment, `branchThen` therefore requires the normalized source guard to evaluate true and `branchElse` requires false.

This is stronger than structural path correspondence, but it is still **not end-to-end compiler verification**. JavaScript parsing/lowering, the Wasm engine, runtime observation, semantic reconstruction and correct binding of proof-free invocation values to machine parameters remain implementation/trust boundaries.

## Primary vs supporting contribution

Primary candidate claim:

> Patch factors ordinary persistent mutation through a structured semantic Change representation and derives operation- and magnitude-aware semantic authority from that same mandatory mutation substrate.

Supporting assurance/evaluation mechanisms, not novelty headlines:

- independent SourceStmt/range translation validation;
- independent GuardTree/control-flow translation validation;
- production/formal bridge;
- verified policy checker;
- machine-checked range fragment;
- RuntimePath/GuardPath checking;
- concrete runtime capability containment;
- independent runtime transition/effect validation;
- C99/FreeBSD and Window platform artifacts;
- provenance/undo/preview/replay tooling.

## Candidate beta.23 paper claim

A defensible working claim is:

> We present Patch, an experimental language in which post-creation persistent mutation is factored through structured semantic Changes and operation-/magnitude-aware Semantic Change Contracts are derived from that mandatory mutation substrate. For a mechanized core we prove Change Signature Soundness, semantic policy containment, source/evidence correspondence and integer range-analysis soundness. Conservative implementation artifacts are checked by independent source/control-flow translation-validation paths. For supported protected direct-WebAssembly invocations, proof-free concrete semantic occurrences, path witnesses and concrete recipe-parameter environments are checked by Lean against a formal execution; branch witnesses must agree with evaluation of the normalized source guard in a safe-integer parameter fragment, and every decoded concrete occurrence is proved to remain within the declared semantic capability. These results do not constitute full compiler verification.

This is a contribution hypothesis, not a firstness assertion.

## High-venue path

Highest-value next work:

1. retain State-Change Factorization + quantitative semantic authority as the primary claim;
2. add **formal recipe-call/substitution semantics** for the already implemented acyclic direct subset;
3. build semantic-security/plugin cases where bounded semantic authority matters;
4. measure analysis, translation-validation, certificate generation/checking and backend overhead;
5. conduct systematic related-work and reproducibility passes.

Patch remains plausible as an OOPSLA/ECOOP-style direction, but is not yet submission-ready. The next gains should come from call correspondence and evaluation rather than unrelated feature accumulation.
