# Novelty Boundary

Patch is **not** novel merely because it has patches, first-class changes, undo, history, effects, capabilities, range analysis, provenance, source calculi, translation validation, proof-carrying evidence, verified checkers, WebAssembly or C generation. All have substantial prior art.

The current research hypothesis remains centered on two linked ideas:

> **State-Change Factorization:** ordinary post-creation persistent mutation is forced through a structured semantic Change representation rather than ordinary assignment plus later logging.

> **Semantic Change Contracts:** because that mandatory mutation representation contains operation structure, Patch derives operation- and magnitude-aware summaries and policies from the same mutation substrate.

Beta.19 strengthens the implementation/formal correspondence story. It does **not** add a new novelty headline.

## Important prior-art collisions

Patch must continue to compare against, at minimum:

- Plaid and first-class state change;
- Worlds and scoped/reified state;
- classical, graded, quantitative, refinement and behavioral effect systems;
- Effects as Capabilities, object capabilities, permissions and typestate;
- abstract interpretation and range/refinement analysis;
- translation validation, including Necula's compiler-assurance work;
- Proof-Carrying Code and certifying compilation;
- verified source/IR lowering and compiler-correctness work;
- ChEOPS/COPE/Edit Transactions, event sourcing, edit lenses, patch theory, reversible languages and CRDTs;
- provenance/Whyline-style debugging.

Therefore Patch must not claim to invent first-class state change, effect inference, quantitative effects, effect+capability combinations, translation validation, source calculi or proof-carrying evidence.

## Formal contribution status

Machine-checked for the current formal models:

```text
State-Change Factorization
Mutation Transparency
Change Signature Soundness
formal runtime-signature-policy containment
verified semantic policy checker soundness
proof-free EvidenceStmt decoding/correspondence
SourceStmt semantic normalization/correspondence
formal source execution policy containment
integer rangeAnalysisSound
```

For the structured formal core:

```text
RuntimeChanges(stmt) ⊆ Signature(stmt) ⊆ Capability(stmt)
```

is the core formal containment story.

## Beta.19 independent raw-source validation

Before beta.19, a key implementation trust path was:

```text
Patch source bytes
   -> parser.js / production AST
   -> formal SourceStmt + range claims
```

Beta.19 adds a second path that does not import `parser.js` and does not consume the production AST:

```text
exact source bytes
   -> small independent raw-source parser
   -> raw SourceStmt + raw range claims
```

The two views must structurally agree for a supported protected recipe before `patch certify` will emit its Lean certificate.

This reduces exposure to a single production-parser/AST-extractor error. It is **translation validation**, not a theorem that either JavaScript parser is correct. The validator itself is not claimed as a new verification technique or a novelty contribution.

The assurance path is now approximately:

```text
                      -> production SourceStmt/ranges --+
Patch source bytes ---|                                 +-> exact comparison
                      -> raw-source SourceStmt/ranges ---+
                                                          |
                                                          v
                                               certificate emission
                                                          |
                                                          v
SourceStmt -> Lean normalization -> EvidenceStmt -> CoreStmt
                                              -> formal Signature
                                              -> policy checker
```

## Runtime assurance status

Separately, direct Wasm emits small transition observations. An independent Change-IR validator reconstructs expected transitions and concrete `increase/decrease/set/clear` effects and checks observed execution against static Change Signatures and protected Change Capabilities.

This is useful translation/runtime-validation evidence, but not a compiler-correctness proof.

## What beta.19 still does not prove

Do **not** say “Patch programs are formally verified end-to-end.” Remaining gaps include:

- production JavaScript parser correctness is not machine proved;
- independent raw-source parser correctness is not machine proved;
- production/direct runtime occurrences are not yet connected by theorem to Lean `SourceExecutes` / `Executes`;
- direct Wasm and C99 lowering are tested/validated rather than machine proved;
- recipe-call substitution is not fully covered in the formal source model;
- full Patch language semantics are not formalized.

A more accurate statement is:

> For a conservative source subset, Patch independently reconstructs and compares source-level formal evidence before certification; Lean then checks range, source/evidence/signature and policy properties of the accepted formal artifact. Runtime/backend correspondence remains a separate validation and proof obligation.

## Primary vs supporting contributions

Primary candidate claim:

> Patch factors ordinary persistent mutation through a structured semantic Change representation and derives operation- and magnitude-aware semantic authority from that same mandatory mutation substrate.

Supporting assurance/evaluation mechanisms, not primary novelty headlines:

- independent raw-source extraction validation;
- production/formal bridge;
- verified policy checker;
- machine-checked range fragment;
- generated Lean certificates;
- independent runtime transition/effect validation;
- C99/FreeBSD portability;
- provenance, undo, preview and replay tooling;
- GUI/IDE/mobile/cross-platform packaging.

## Candidate beta.19 paper claim

A defensible working claim is:

> We present Patch, an experimental language in which post-creation persistent mutation is factored through structured semantic Changes. Patch derives operation- and magnitude-aware semantic Change Contracts from that mandatory mutation substrate. For a mechanized core, we prove Change Signature Soundness and runtime policy containment. For a conservative implementation subset, separate source, semantic-evidence and production-signature claims are checked through a combination of independent source translation validation and Lean-checked source/evidence/signature/policy correspondence. Direct runtime transitions are additionally checked against an independent Change-IR model. These results do not constitute full compiler verification; parser correctness and production-runtime-to-formal-execution correspondence remain explicit boundaries.

This is a contribution hypothesis, not a firstness assertion.

## What would materially weaken the claim?

Prior work satisfying most of the following would substantially narrow the contribution:

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

1. keep State-Change Factorization + quantitative semantic authority as the primary paper claim;
2. connect independently reconstructed runtime effect occurrences to Lean `SourceExecutes` / `Executes`;
3. introduce a typed expression/core IR or another smaller independently checkable lowering input;
4. extend formal recipe-call/substitution semantics for the direct subset;
5. build compelling security/engineering cases and measure analysis/evidence/checker overhead;
6. conduct a systematic related-work review and reproducibility pass.

Patch remains a plausible OOPSLA/ECOOP-style direction, but is **not yet submission-ready**. The next gains should come from correspondence and evaluation rather than feature accumulation.
