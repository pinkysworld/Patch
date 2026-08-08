# Novelty Boundary

Patch is **not** novel merely because it has patches, first-class changes, undo/history, effects, capabilities, range analysis, provenance, source calculi, guard semantics, refinement relations, execution witnesses, translation validation, proof-carrying evidence, verified checkers, interprocedural effect summaries, ranked/well-founded call graphs, WebAssembly/C generation or GUI packaging. All have substantial prior art.

The research hypothesis remains centered on two linked ideas:

> **State-Change Factorization:** ordinary post-creation persistent mutation is forced through a structured semantic Change representation rather than ordinary assignment plus later logging.

> **Semantic Change Contracts:** Patch derives operation- and magnitude-aware summaries and authority policies from that same mandatory mutation substrate.

**Beta.25 strengthens interprocedural assurance for an explicit acyclic recipe fragment; it is supporting evidence for the primary design claim, not a new novelty headline.**

## Prior-art discipline

Patch must continue to compare against Plaid/first-class state change, Worlds/scoped state, classical/graded/quantitative/refinement effect systems, capability/permission/typestate work, abstract interpretation, interprocedural effect analysis, call-graph analyses, well-founded/ranked termination restrictions, translation validation (including Necula), Proof-Carrying Code/certifying compilation, verified compiler/refinement/simulation work, operational semantics for control flow and procedure calls, ChEOPS/COPE/Edit Transactions, event sourcing, edit lenses, patch theory, reversible languages, CRDTs and provenance/Whyline-style debugging.

Do not claim invention of effect inference, quantitative effects, effect+capability combinations, interprocedural effect composition, call-graph ranking, runtime path witnesses, guard-aware operational semantics, translation validation, refinement checking or proof-carrying evidence.

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
ArgsFit / argsFitBool_sound
signatureCoversBool_sound
BodyComposes / checkCallStmt_sound
checkRecipeEnv_sound
callSignatureSoundness
checkedRecipeExecutionCannotEscape
```

For the effect-only structured core:

```text
RuntimeChanges(stmt) ⊆ Signature(stmt) ⊆ Capability(stmt)
```

For the beta.25 call-aware core, schematically:

```text
checked finite recipe environment
+ modeled rank-decreasing call execution
+ caller compositional obligations
------------------------------------------------
runtime effect trace ⊆ caller semantic signature
```

## Beta.23 guard-aware assurance

Beta.23 adds a parallel GuardTree to the effect-only source core. For the explicit safe-integer recipe-parameter fragment, proof-free `branchThen`/`branchElse` witnesses must agree with normalized guard evaluation in Lean before concrete runtime effects are composed with Change Capabilities.

This is stronger than structural path correspondence, but it is still **not end-to-end compiler verification**. JavaScript parsing/lowering, the Wasm engine, runtime observation, semantic reconstruction and correct binding of proof-free invocation values to machine parameters remain implementation/trust boundaries.

## Beta.25 recipe-call assurance

Beta.25 adds a separate call-aware effect layer rather than pretending the older SourceStmt/runtime theorem already models procedure calls.

Production source is conservatively mapped to a finite `formalCalls` environment containing:

```text
recipe name
safe-integer parameter intervals
rank
semantic Change Signature
CallStmt body
```

For each call the generated proof-free artifact records the callee name and statically established argument intervals. `PatchCalls.lean` independently checks:

```text
callee exists
callee.rank < caller.rank
actual argument intervals fit declared parameter intervals
callee semantic signature ⊆ caller semantic signature
```

Direct emitted semantic effects must also occur in the caller signature. The finite environment passes only if every recipe satisfies these obligations.

`callSignatureSoundness` then proves that effects produced by the modeled finite rank-decreasing call execution remain in the caller signature. A production-generated `GeneratedCallCertificate.lean` is accepted by `native_decide` only when `checkRecipeEnv callEnv = true`.

This is useful assurance composition, but it is **not concrete parameter substitution correctness**. Beta.25 does not prove that a particular production caller expression evaluates to an exact integer, that this exact value is bound to the callee parameter, or that the production runtime's callee execution matches a concrete Lean value-environment execution. Those are explicit next-step gaps.

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
- finite rank-decreasing recipe-call signature composition;
- production-generated Lean call certificates;
- independent runtime transition/effect validation;
- C99/FreeBSD and Window platform artifacts;
- provenance/undo/preview/replay tooling.

## Candidate beta.25 paper claim

A defensible working claim is:

> We present Patch, an experimental language in which post-creation persistent mutation is factored through structured semantic Changes and operation-/magnitude-aware Semantic Change Contracts are derived from that mandatory mutation substrate. For mechanized fragments we prove Change Signature Soundness, semantic policy containment, source/evidence correspondence and integer range-analysis soundness. Conservative source/control-flow artifacts are checked by translation-validation paths, and supported protected direct-WebAssembly invocations receive guard-aware runtime/capability correspondence. Separately, for a finite acyclic recipe fragment, a production-generated proof-free recipe environment records safe-integer argument intervals and semantic signatures; Lean checks rank decrease, argument-interval fit, direct-effect membership and callee-to-caller signature containment, and proves modeled transitive call effects remain within the caller signature. These results do not constitute full compiler verification or concrete parameter-substitution correctness.

This is a contribution hypothesis, not a firstness assertion.

## High-venue path

Highest-value next work:

1. retain State-Change Factorization + quantitative semantic authority as the primary claim;
2. add **concrete recipe argument evaluation, parameter binding and substitution semantics**, then connect them to the beta.25 abstract call theorem;
3. build semantic-security/plugin cases where bounded semantic authority matters;
4. measure analysis, translation-validation, certificate generation/checking and backend overhead;
5. conduct systematic related-work and reproducibility passes.

Patch remains plausible as an OOPSLA/ECOOP-style direction, but is not yet submission-ready. The next gains should come from concrete call correspondence and evaluation rather than unrelated feature accumulation.
