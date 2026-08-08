# Novelty Boundary

Patch is **not** novel merely because it has patches, first-class changes, undo/history, effects, capabilities, range analysis, provenance, source calculi, refinement relations, translation validation, proof-carrying evidence, verified checkers, WebAssembly/C generation, GUI packaging or execution-path witnesses. All have substantial prior art.

The research hypothesis remains centered on:

> **State-Change Factorization:** ordinary post-creation persistent mutation is forced through a structured semantic Change representation rather than ordinary assignment plus later logging.

> **Semantic Change Contracts:** Patch derives operation- and magnitude-aware summaries and authority policies from that same mandatory mutation substrate.

**Beta.22 strengthens implementation correctness and assurance composition; it does not add a new primary novelty headline.**

## Prior-art discipline

Patch must continue to compare against Plaid/first-class state change, Worlds/scoped state, classical/graded/quantitative/refinement effect systems, capability/permission/typestate work, abstract interpretation, translation validation (including Necula), Proof-Carrying Code/certifying compilation, verified compiler/refinement work, ChEOPS/COPE/Edit Transactions, event sourcing, edit lenses, patch theory, reversible languages, CRDTs and provenance/Whyline-style debugging.

Do not claim invention of effect inference, quantitative effects, effect+capability combinations, translation validation, refinement checking, proof-carrying evidence, path witnesses or runtime-capability composition.

## Formal contribution status

Machine-checked for current fragments:

```text
State-Change Factorization
Mutation Transparency
Change Signature Soundness
formal runtime-signature-policy containment
verified semantic policy checker
EvidenceStmt / SourceStmt correspondence
integer rangeAnalysisSound
EffectRefines / TraceRefines checker soundness
RuntimePath -> Executes soundness
checkSourceRuntimeEvidence_sound
allowsRefinedEffect
traceRefinesPreservesPolicy
checkedConcreteRuntimeCannotEscape
```

For the effect-only structured core:

```text
RuntimeChanges(stmt) ⊆ Signature(stmt) ⊆ Capability(stmt)
```

## Beta.22 runtime capability composition

The runtime assurance chain is now:

```text
actual direct-Wasm execution
  -> observed before/after transitions
  -> independent semantic reconstruction
  -> proof-free concrete EvidenceEffect list
  + untrusted RuntimePath
  -> Lean SourceExecutes + TraceRefines
  -> verified formal semantic policy
  -> checked concrete runtime capability containment
```

`allowsRefinedEffect` establishes downward closure of semantic authority: if a concrete effect refines a formal effect and a rule allows the formal effect, that same rule allows the concrete effect. Quantitative containment composes by interval transitivity.

`checkedConcreteRuntimeCannotEscape` combines successful runtime correspondence with `checkSourceProtected`; every decoded concrete runtime effect is then admitted by a declared policy rule.

This is a useful assurance result but **not end-to-end compiler verification**. The direct compiler, Wasm engine, transition observation and JavaScript semantic reconstruction remain implementation boundaries.

## Important branch limitation

`RuntimePath.branchThen` / `branchElse` currently validate against an effect-only `CoreStmt.branch` that contains no original Boolean guard. Therefore Lean proves that the selected branch is structurally an execution admitted by the formal effect core; it does not yet prove that the original source condition evaluated to the selected Boolean.

This boundary must be stated explicitly. The next high-value formal feature is a typed, guard-aware execution core that retains enough integer/Boolean semantics to check branch truth and then erases/refines to the existing effect-only core.

## Primary vs supporting contribution

Primary candidate claim:

> Patch factors ordinary persistent mutation through a structured semantic Change representation and derives operation- and magnitude-aware semantic authority from that same mandatory mutation substrate.

Supporting assurance/evaluation mechanisms, not novelty headlines:

- independent raw-source translation validation;
- production/formal bridge;
- verified semantic policy checker;
- machine-checked range fragment;
- runtime occurrence/refinement certificates;
- RuntimePath checking;
- concrete runtime capability containment;
- independent runtime transition/effect validation;
- C99/FreeBSD and Window platform artifacts;
- provenance/undo/preview/replay tooling.

## Candidate Beta.22 paper claim

A defensible working claim is:

> We present Patch, an experimental language in which post-creation persistent mutation is factored through structured semantic Changes and operation-/magnitude-aware Semantic Change Contracts are derived from that mandatory mutation substrate. For a mechanized core we prove Change Signature Soundness, semantic policy containment, source/evidence correspondence and integer range-analysis soundness. A conservative implementation subset independently validates source claims before certification. For supported direct-WebAssembly protected invocations, proof-free concrete semantic occurrences and control-flow witnesses are checked by Lean against a formal `SourceExecutes` trace; composing effect refinement with the verified policy checker proves every decoded concrete occurrence remains within the declared semantic capability. These results do not constitute full compiler verification, and source-guard truth correspondence remains future work.

This is a contribution hypothesis, not a firstness assertion.

## High-venue path

Highest-value next work:

1. retain State-Change Factorization + quantitative semantic authority as the primary claim;
2. add the typed, guard-aware execution core;
3. add formal recipe-call/substitution semantics;
4. build semantic-security/engineering case studies;
5. measure source validation, analysis, certificate generation/checking and runtime overhead;
6. conduct systematic related-work and reproducibility passes.

Patch remains plausible as an OOPSLA/ECOOP-style direction, but is not yet submission-ready. Formal correspondence and evaluation matter more than unrelated feature accumulation.
