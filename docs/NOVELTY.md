# Novelty Boundary

Patch is **not** novel merely because it has patches, first-class changes, effects, capabilities, range analysis, quantitative bounds, procedure-call substitution, invocation frames, transitive traces, call graphs, runtime trace validation, translation validation, proof-carrying evidence, verified checkers, WebAssembly/C generation or GUI packaging. These all have substantial prior art.

The structured comparison and source list are maintained in `docs/RELATED_WORK.md` and `paper/references.bib`.

The research hypothesis remains centered on two linked ideas:

> **State-Change Factorization:** ordinary post-creation persistent mutation is forced through a structured semantic Change representation rather than ordinary assignment plus later logging.

> **Semantic Change Contracts:** Patch derives operation- and magnitude-aware summaries and authority policies from that same mandatory mutation substrate.

**Beta.32 adds invocation-frame-aware direct-Wasm correspondence for repeated finite calls. This is supporting assurance, not a new novelty headline.**

## Expressibility is not the novelty claim

This distinction is explicit because the strongest adjacent systems invalidate a broader formulation.

- Plaid provides first-class state change.
- Classical, algebraic and sequential effect systems provide rich effect vocabularies and composition.
- Effects-as-Capabilities and System C connect capabilities and effects.
- Graded modal/effect systems provide quantitative reasoning.
- ESOP 2026 dependent-effect work gives semantics to quantitative effect grades that may depend on program values.
- Permissions and Mezzo provide sophisticated authority over mutable objects, aliases and typestate.
- PLDI 2026 revocable capabilities couple flow-sensitive capability availability with typestate protocols.
- OOPSLA 2025 InvalML tracks permanent and temporary invalidation with a state-sensitive type-and-effect system.
- HTT, F* and Dijkstra-monad systems can specify state relations more general than Patch's bounded semantic changes.
- Edit transactions, incremental change calculi, lenses and patch theory provide extensive explicit-change prior art.

Patch therefore does **not** claim that `score may increase up to 10`, a value-dependent effect, or a state-sensitive capability is uniquely expressible. A sufficiently expressive pre/postcondition, dependent effect, graded type, typestate, or refinement system can describe equivalent or stronger properties.

The candidate distinction is architectural and deliberately narrower:

> **The modeled persistent update itself is a semantic Change, and execution, history, operation/magnitude summary, and authority reuse that same mandatory representation.**

This is a contribution hypothesis, not a firstness assertion.

## Prior-art discipline

Patch must continue to compare against first-class/scoped state-change work, classical/algebraic/sequential/graded/dependent effect systems, capabilities/permissions/typestate, Hoare/refinement verification, abstract interpretation, interprocedural effect analysis, procedure-call operational semantics, activation/invocation frames, well-founded/ranked call graphs, translation validation, Proof-Carrying Code/certifying compilation, verified compiler/refinement/simulation work, event sourcing, patch theory, reversible languages and provenance/Whyline-style debugging.

Do not claim invention of invocation frames, call-aware runtime validation, scoped effect traces, transitive procedure semantics, call-graph ranking, exact substitution, effect refinement, quantitative effects, dependent effects, capabilities, typestate, runtime correspondence, translation validation or proof-carrying evidence.

## Comparison dimensions

The related-work pass uses architectural dimensions rather than a binary novelty label:

1. what unit is reified;
2. whether ordinary persistent mutation is forced through it;
3. whether semantic operation identity is part of that unit;
4. whether numeric delta magnitude is represented/inferred;
5. whether authority is checked in the same vocabulary;
6. whether execution and authority are derived from the same mandatory substrate;
7. interprocedural composition;
8. history/provenance reuse.

A prior system can be more expressive than Patch while still occupying a different point on these dimensions. Conversely, a different architecture is not automatically a useful or publishable contribution. The formal/evaluation artifact must establish the benefit.

The 2025–2026 follow-up makes this discipline stricter. `no` or `partial` in the comparison matrix means a property is not the cited mechanism's central/default abstraction; it does not mean the surrounding language is incapable of encoding it.

## Machine-checked status

Current formal results include:

```text
State-Change Factorization
Mutation Transparency
Change Signature Soundness
rangeAnalysisSound
checkedGuardedConcreteRuntimeCannotEscape
callSignatureSoundness
concreteCallBinding_sound
checkedConcreteBoundEffectRefinesCallerSignature
checkedConcreteCallBodyRefinesCallerSignature
checkedConcreteTransitiveCallTreeRefinesCallerSignature
checkedObservedTransitiveRuntimeRefinesCallerSignature
```

For beta.30:

```text
exact nested bindings
+ strict outer/nested rank decrease
+ exact GuardExpr/static-repeat/direct-effect execution
+ nested semantic-signature coverage
+ edge-by-edge SignatureCovers import
------------------------------------------------
finite selected transitive trace refines caller semantic signature
```

For beta.32:

```text
real direct-Wasm execution
+ complete independent transition/effect validation
+ independently reconstructed semantic operation + recipe scope
+ independently reconstructed concrete invocation-frame identity/bindings
+ frame-selected observed semantic effects
+ Lean check: runtime-frame BindingList = beta.30 exact BindingList
+ Lean re-evaluation of observed effects against beta.30 CallTreeStmt
------------------------------------------------
frame-selected observed semantic-effect list refines caller semantic signature
```

The Lean half checks exact binding equality, call-tree execution and caller-signature refinement. Runtime capture and correctness/completeness of the independent JavaScript validator/invocation-frame reconstruction remain explicit proof-free evidence boundaries.

## Primary vs supporting contribution

Primary candidate claim:

> Patch factors ordinary post-creation persistent mutation through a structured semantic Change representation and derives operation- and magnitude-aware semantic authority from that same mandatory mutation substrate.

Supporting assurance/evaluation, not novelty headlines:

- verified semantic policy and integer range core;
- source/guard translation validation;
- direct runtime transition/effect validation;
- finite ranked abstract call composition;
- exact safe-integer call binding;
- guarded structured exact traces;
- finite transitive exact call trees;
- invocation-frame-aware direct-Wasm correspondence for repeated finite calls;
- generated Lean certificates;
- semantic-authority ablation and checkout case;
- process-isolated controlled-measurement protocol;
- commit-bound reproducibility bundle;
- desktop/C99/GUI artifact work.

## Defensible working paper statement

> We present Patch, an experimental language in which ordinary post-creation persistent mutation is factored through structured semantic Changes and operation-/magnitude-aware Semantic Change Contracts are derived from that mandatory mutation substrate. Prior work offers first-class state change, expressive and value-dependent effect systems, capabilities/typestate, quantitative types and general state specifications; Patch does not claim these are individually new or inexpressible elsewhere. For mechanized fragments we prove signature/policy/range properties and exact finite transitive call-tree refinement. We further execute the production direct-Wasm backend and independently validate its complete transition/effect stream, reconstructing concrete invocation frames without backend call markers. Runtime capture and independent-validator/frame-reconstruction correctness remain explicit proof-free boundaries, so this is not an end-to-end verified compiler theorem.

## High-venue path

Completed supporting blocks now include the semantic-security ablation, checkout/loyalty case, reproducibility bundle, process-isolated controlled-measurement protocol, structured related-work comparison, targeted 2025–2026 dependent/state-sensitive effect follow-up, and a beta.32/beta.34-synchronized main manuscript.

Highest-value remaining work:

1. collect controlled performance/scaling data on fixed documented hardware;
2. analyze the controlled dataset with explicit models, dispersion and plots, then synchronize measured results into `paper/main.tex`;
3. broaden the externally motivated application/extension corpus;
4. reduce remaining parser/lowering/runtime trust boundaries without overstating full verification;
5. extend invocation-frame evidence to richer branching/repeated-call scenarios;
6. obtain expert/venue feedback on whether the architectural conjunction is sufficiently distinct and useful.

Normal literature surveillance should continue before submission, but the targeted recent dependent/state-sensitive effect search for this paper iteration is complete.
