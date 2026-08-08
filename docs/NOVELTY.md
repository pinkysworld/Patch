# Novelty Boundary

Patch is **not** novel merely because it has patches, first-class changes, undo, history, effects, capabilities, range analysis, provenance, source calculi, refinement relations, translation validation, proof-carrying evidence, verified checkers, WebAssembly or C generation. All have substantial prior art.

The current research hypothesis remains centered on two linked ideas:

> **State-Change Factorization:** ordinary post-creation persistent mutation is forced through a structured semantic Change representation rather than ordinary assignment plus later logging.

> **Semantic Change Contracts:** because that mandatory mutation representation contains operation structure, Patch derives operation- and magnitude-aware summaries and policies from the same mutation substrate.

Beta.20 strengthens the implementation/formal correspondence story. It does **not** add a new novelty headline.

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
- simulation/refinement relations between implementation and formal semantics;
- ChEOPS/COPE/Edit Transactions, event sourcing, edit lenses, patch theory, reversible languages and CRDTs;
- provenance/Whyline-style debugging.

Therefore Patch must not claim to invent first-class state change, effect inference, quantitative effects, effect+capability combinations, translation validation, refinement checking, source calculi or proof-carrying evidence.

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
concrete EffectRefines checker soundness
linear runtime-trace refinement checker soundness
linear EvidenceStmt trace -> Executes correspondence
checkSourceRuntimeEvidence_sound
```

For the structured formal core:

```text
RuntimeChanges(stmt) ⊆ Signature(stmt) ⊆ Capability(stmt)
```

remains the core formal containment story.

## Independent raw-source validation

A key implementation trust path is checked by two independent JavaScript routes:

```text
                      -> production SourceStmt/ranges --+
Patch source bytes ---|                                 +-> exact comparison
                      -> raw-source SourceStmt/ranges ---+
```

The raw-source path does not import `parser.js` or consume the production AST. A supported protected recipe must pass this structural comparison before static Lean certificate emission.

This is **translation validation**, not a theorem that either JavaScript frontend is correct. The validator itself is not claimed as a new verification technique or novelty contribution.

## Beta.20 runtime correspondence

Previously, direct Wasm runtime validation and formal `SourceExecutes` reasoning were separate. Beta.20 adds a deliberately restricted connection:

```text
actual direct-Wasm execution
   -> observed target/before/after
   -> independent semantic reconstruction
   -> concrete proof-free EvidenceEffect occurrences
   -> Lean checkSourceRuntimeEvidence
   -> actual formal SourceExecutes trace
```

A concrete runtime amount is modeled as a singleton interval. Thus an observed:

```text
increase [8,8]
```

can refine a formal:

```text
increase [0,10]
```

when target, field and operation agree and the concrete interval lies within the formal interval.

Lean proves the executable effect- and trace-refinement checks sound and proves that the formal trace produced for the accepted linear evidence is an actual `Executes` trace. The resulting `checkSourceRuntimeEvidence_sound` theorem yields a formal `SourceExecutes` witness plus pointwise refinement of the concrete observed effects.

This is stronger assurance than checking only final state or static-signature membership, but it is still **not** end-to-end compiler verification. The producer-side direct compiler, transition observation and semantic reconstruction remain implementation boundaries.

## Current runtime-correspondence boundary

Beta.20 runtime certification is deliberately restricted to:

- protected recipes already covered by formal source extraction and raw-source validation;
- linear formal source structure (`skip`, direct changes, sequence);
- one observed invocation per protected recipe;
- concrete integer increase/decrease magnitudes.

Branches, repeats, multiple invocations, floating-point magnitudes and broader language constructs are rejected at the runtime-certification boundary rather than silently described as covered.

## What beta.20 still does not prove

Do **not** say “Patch programs are formally verified end-to-end.” Remaining gaps include:

- production JavaScript parser correctness is not machine proved;
- independent raw-source parser correctness is not machine proved;
- JavaScript/Wasm lowering correctness is not machine proved;
- JavaScript semantic reconstruction from observed before/after transitions is not machine proved;
- branch/repeat runtime path correspondence and multi-invocation segmentation are not yet formalized;
- direct Wasm and C99 backends are broader than the currently certified runtime subset;
- recipe-call substitution is not fully covered in the formal source model;
- full Patch language semantics are not formalized.

A more accurate statement is:

> For a conservative source subset, Patch independently reconstructs and compares source-level formal evidence before certification; Lean checks range, source/evidence/signature and policy properties of the accepted formal artifact. For a still narrower linear protected subset, concrete semantic effects reconstructed from one direct-Wasm execution are supplied as proof-free occurrence evidence, and Lean checks that they refine an actual formal `SourceExecutes` trace.

## Primary vs supporting contributions

Primary candidate claim:

> Patch factors ordinary persistent mutation through a structured semantic Change representation and derives operation- and magnitude-aware semantic authority from that same mandatory mutation substrate.

Supporting assurance/evaluation mechanisms, not primary novelty headlines:

- independent raw-source extraction validation;
- production/formal bridge;
- verified policy checker;
- machine-checked range fragment;
- generated static and runtime Lean certificates;
- runtime occurrence refinement / `SourceExecutes` correspondence;
- independent runtime transition/effect validation;
- C99/FreeBSD portability;
- provenance, undo, preview and replay tooling;
- GUI/IDE/mobile/cross-platform packaging.

## Candidate beta.20 paper claim

A defensible working claim is:

> We present Patch, an experimental language in which post-creation persistent mutation is factored through structured semantic Changes. Patch derives operation- and magnitude-aware semantic Change Contracts from that mandatory mutation substrate. For a mechanized core, we prove Change Signature Soundness, policy containment, source/evidence correspondence and integer range-analysis soundness. For a conservative implementation subset, separate source claims are checked through independent source translation validation before Lean certification. For a narrower linear protected subset, concrete semantic effect occurrences reconstructed from direct WebAssembly execution are supplied as proof-free evidence, and Lean proves that accepted occurrences pointwise refine an actual formal `SourceExecutes` trace. These results do not constitute full compiler verification; frontend correctness, backend lowering, runtime semantic reconstruction, and broader control-flow correspondence remain explicit boundaries.

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
2. extend runtime correspondence with explicit branch/repeat path witnesses and invocation identifiers;
3. prove a concrete-runtime capability corollary from formal capability admission plus `EffectRefines`;
4. introduce a typed expression/core IR or another smaller independently checkable lowering input;
5. extend formal recipe-call/substitution semantics for the direct subset;
6. build compelling security/engineering cases and measure analysis/evidence/checker overhead;
7. conduct a systematic related-work review and reproducibility pass.

Patch remains a plausible OOPSLA/ECOOP-style direction, but is **not yet submission-ready**. The next gains should come from correspondence and evaluation rather than feature accumulation.
