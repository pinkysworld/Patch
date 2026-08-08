# Novelty Boundary

Patch is **not** novel merely because it has patches, first-class changes, undo, history, effects, capabilities, range analysis, provenance, source calculi, refinement relations, translation validation, proof-carrying evidence, verified checkers, WebAssembly/C generation, GUI packaging or execution-path witnesses. All have substantial prior art.

The research hypothesis remains centered on two linked ideas:

> **State-Change Factorization:** ordinary post-creation persistent mutation is forced through a structured semantic Change representation rather than ordinary assignment plus later logging.

> **Semantic Change Contracts:** because that mandatory mutation representation contains operation structure, Patch derives operation- and magnitude-aware summaries and policies from the same mutation substrate.

**Beta.21 strengthens assurance and product correctness; it does not add a new novelty headline.**

## Important prior-art collisions

Patch must continue to compare against, at minimum:

- Plaid and first-class state change;
- Worlds and scoped/reified state;
- classical, graded, quantitative, refinement and behavioral effect systems;
- capability, permission and typestate systems;
- abstract interpretation and range/refinement analysis;
- translation validation, including Necula's compiler-assurance work;
- Proof-Carrying Code and certifying compilation;
- verified source/IR lowering and compiler-correctness work;
- simulation/refinement relations and execution witnesses;
- ChEOPS/COPE/Edit Transactions, event sourcing, edit lenses, patch theory, reversible languages and CRDTs;
- provenance/Whyline-style debugging.

Therefore Patch must not claim to invent first-class state change, effect inference, quantitative effects, effect+capability combinations, translation validation, refinement checking, proof-carrying evidence or path witnesses.

## Formal contribution status

Machine-checked for the current formal models:

```text
State-Change Factorization
Mutation Transparency
Change Signature Soundness
formal runtime-signature-policy containment
verified semantic policy checker soundness
EvidenceStmt decoding/correspondence
SourceStmt semantic normalization/correspondence
formal SourceExecutes policy containment
integer rangeAnalysisSound
EffectRefines checker soundness
TraceRefines checker soundness
RuntimePath -> Executes soundness (`decodeCorePath_sound`)
checkSourceRuntimeEvidence_sound
```

For the structured core:

```text
RuntimeChanges(stmt) ⊆ Signature(stmt) ⊆ Capability(stmt)
```

remains the central formal containment story.

## Independent raw-source validation

```text
                      -> production SourceStmt/ranges --+
Patch source bytes ---|                                 +-> exact comparison
                      -> raw-source SourceStmt/ranges ---+
```

The independent raw-source path does not import `parser.js` or consume the production AST. This is **translation validation**, not a theorem that either JavaScript frontend is correct and not a primary novelty claim.

## Beta.21 runtime correspondence

The runtime assurance path is now:

```text
actual direct-Wasm execution
   -> observed target/before/after
   -> independent semantic reconstruction
   -> concrete proof-free EvidenceEffect occurrences

same execution
   -> untrusted JavaScript RuntimePath proposal

occurrences + RuntimePath
   -> Lean checkSourceRuntimeEvidence
   -> formal SourceExecutes trace + TraceRefines
```

`RuntimePath` describes sequence, selected branch and exact repeat structure:

```text
leaf | seq | branchThen | branchElse | repeatZero | repeatSucc
```

The key assurance point is not that JavaScript “knows” the path. The path producer is untrusted. Lean's `decodeCorePath` checks the witness against the formal `CoreStmt`, and `decodeCorePath_sound` proves that an accepted witness reconstructs a genuine `Executes` trace.

This allows the generated runtime certificate to cover supported branch/repeat executions and multiple calls to the same protected recipe, each invocation checked separately. A concrete amount remains a singleton interval, so `increase [4,4]` can refine formal `increase [0,5]` when target, field and operation agree.

The main theorem remains `checkSourceRuntimeEvidence_sound`.

## What beta.21 still does not prove

Do **not** say “Patch programs are formally verified end-to-end.” Remaining boundaries include:

- production JavaScript parser correctness;
- independent raw-source parser correctness;
- JavaScript/Wasm lowering correctness;
- Wasm engine correctness;
- JavaScript semantic reconstruction from before/after observations;
- JavaScript `RuntimePath` producer correctness (the witness is checked, but the producer itself is not verified);
- formal recipe-call/substitution semantics inside protected recipe bodies;
- floating-point correspondence beyond the explicit integer fragment;
- full Patch language semantics.

A defensible statement is:

> For a conservative source subset, Patch independently reconstructs and compares source-level formal evidence before static certification. For supported direct-Wasm protected invocations, concrete semantic occurrences and an untrusted control-flow witness are emitted as proof-free evidence; Lean validates branch/repeat structure, reconstructs an actual formal `SourceExecutes` trace, and checks pointwise concrete-to-formal effect refinement.

That remains **restricted runtime correspondence**, not end-to-end compiler verification.

## Primary vs supporting contributions

Primary candidate claim:

> Patch factors ordinary persistent mutation through a structured semantic Change representation and derives operation- and magnitude-aware semantic authority from that same mandatory mutation substrate.

Supporting assurance/evaluation mechanisms, not novelty headlines:

- independent raw-source extraction validation;
- production/formal bridge;
- verified policy checker;
- machine-checked range fragment;
- generated static/runtime Lean certificates;
- `RuntimePath` checking and runtime occurrence refinement;
- independent runtime transition/effect validation;
- C99/FreeBSD portability;
- Window Web/desktop packaging;
- provenance, undo, preview and replay tooling.

## Candidate Beta.21 paper claim

A defensible working claim is:

> We present Patch, an experimental language in which post-creation persistent mutation is factored through structured semantic Changes. Patch derives operation- and magnitude-aware Semantic Change Contracts from that mandatory mutation substrate. For a mechanized core, we prove Change Signature Soundness, policy containment, source/evidence correspondence and integer range-analysis soundness. A conservative implementation subset independently validates source claims before Lean certification. For supported direct-WebAssembly protected invocations, concrete semantic effect occurrences and proof-free control-flow witnesses are generated from observed execution; Lean checks the witness against formal control-flow structure and proves that accepted occurrences refine an actual `SourceExecutes` trace. These results do not constitute full compiler verification.

This is a contribution hypothesis, not a firstness assertion.

## What would materially weaken the claim?

Prior work satisfying most of the following would substantially narrow Patch's contribution:

1. existing persistent state cannot ordinarily mutate outside a structured semantic change mechanism;
2. mutation executes through that representation rather than being logged afterward;
3. the representation distinguishes semantic transition operations beyond write location;
4. conservative operation/magnitude summaries derive from those same mutations;
5. policies constrain operation kind and quantitative magnitude;
6. runtime-signature-policy containment has formal evidence;
7. a realistic implementation is strongly connected to the formal model;
8. the same change representation materially supports history/inversion/provenance tooling;
9. empirical evaluation demonstrates practical value.

## Current high-venue path

The highest-value next steps are:

1. keep State-Change Factorization + quantitative semantic authority as the primary claim;
2. add formal recipe-call/substitution semantics rather than broadening surface syntax;
3. prove a concrete-runtime capability corollary from formal capability admission plus `EffectRefines`;
4. introduce a typed expression/core IR or another smaller independently checkable lowering boundary;
5. build semantic-security/engineering cases and measure analysis/evidence/checker overhead;
6. conduct systematic related-work and reproducibility passes.

Patch remains a plausible OOPSLA/ECOOP-style direction, but is **not yet submission-ready**. Correspondence, evaluation and related-work discipline are more valuable than adding unrelated language features.
