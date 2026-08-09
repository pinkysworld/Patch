# Novelty Boundary

Patch is **not** novel merely because it has patches, first-class changes, effects, capabilities, range analysis, procedure-call substitution, invocation frames, transitive traces, call graphs, runtime trace validation, translation validation, proof-carrying evidence, verified checkers, WebAssembly/C generation or GUI packaging. These all have substantial prior art.

The research hypothesis remains centered on two linked ideas:

> **State-Change Factorization:** ordinary post-creation persistent mutation is forced through a structured semantic Change representation rather than ordinary assignment plus later logging.

> **Semantic Change Contracts:** Patch derives operation- and magnitude-aware summaries and authority policies from that same mandatory mutation substrate.

**Beta.32 adds invocation-frame-aware direct-Wasm correspondence for repeated finite calls. This is supporting assurance, not a new novelty headline.**

## Prior-art discipline

Patch must continue to compare against first-class/scoped state-change work, classical/graded/quantitative/refinement effect systems, capabilities/permissions/typestate, abstract interpretation, interprocedural effect analysis, procedure-call operational semantics, activation/invocation frames, well-founded/ranked call graphs, translation validation, Proof-Carrying Code/certifying compilation, verified compiler/refinement/simulation work, event sourcing, patch theory, reversible languages and provenance/Whyline-style debugging.

Do not claim invention of invocation frames, call-aware runtime validation, scoped effect traces, transitive procedure semantics, call-graph ranking, exact substitution, effect refinement, runtime correspondence, translation validation or proof-carrying evidence.

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

The Lean half checks the exact binding equality, call-tree execution and caller-signature refinement. Runtime capture and correctness/completeness of the independent JavaScript validator/invocation-frame reconstruction remain explicit proof-free evidence boundaries.

## Beta.32 exact contribution boundary

The direct-Wasm compiler remains unchanged and emits no trusted call-entry/exit events. The independent Change-IR executor validates the complete raw target/before/after transition stream and reconstructs semantic operation identity, recipe scope and concrete `DO` invocation frames.

Each frame carries caller/callee identity, dynamic invocation ordinal, parent/depth information, exact arguments/bindings and a transition interval. Validated effects carry the active frame stack. Beta.32 therefore selects observed effects by concrete frame identity rather than requiring a globally unique scoped effect sequence.

`examples/formal-transitive-calls-repeated.patch` demonstrates two identical `do caller(1)` calls that receive distinct reconstructed frames and separate generated certificates.

`PatchCallRuntime.lean` still uses:

```text
evalCallTreeStmtEqBool exactBindings exactTree runtimeObservedEffects
```

and the beta.32 generated certificate additionally checks:

```text
runtimeFrameBindings = exactBindings
```

before caller-signature refinement is concluded.

This is stronger evidence attribution than beta.31, but it is **not** a full compiler correctness/refinement result.

Explicit limitations:

- runtime capture is not formally proved;
- independent validator and invocation-frame reconstruction correctness/completeness are not formally proved;
- parser/extractor correctness remains outside Lean;
- JavaScript-to-Wasm lowering remains outside Lean;
- Wasm engine correctness remains outside Lean.

## Primary vs supporting contribution

Primary candidate claim:

> Patch factors ordinary persistent mutation through a structured semantic Change representation and derives operation- and magnitude-aware semantic authority from that same mandatory mutation substrate.

Supporting assurance, not novelty headlines:

- verified semantic policy and integer range core;
- source/guard translation validation;
- direct runtime transition/effect validation;
- finite ranked abstract call composition;
- exact safe-integer call binding;
- guarded structured exact traces;
- finite transitive exact call trees;
- **invocation-frame-aware direct-Wasm correspondence for repeated finite calls**;
- generated Lean certificates;
- desktop/C99/GUI artifact work.

## Candidate beta.32 paper statement

A defensible working statement is:

> We present Patch, an experimental language in which post-creation persistent mutation is factored through structured semantic Changes and operation-/magnitude-aware Semantic Change Contracts are derived from that mandatory mutation substrate. For mechanized fragments we prove signature/policy/range properties and exact finite transitive call-tree refinement. We further execute the production direct-Wasm backend and independently validate its complete transition/effect stream. The independent execution model reconstructs concrete invocation frames without backend call markers, allowing repeated identical calls to be attributed separately. Generated evidence checks each runtime-frame binding against the beta.30 exact callee binding, and Lean re-evaluates the frame-selected observed effects against that exact call tree before deriving caller-signature refinement. Runtime capture and independent-validator/frame-reconstruction correctness remain explicit proof-free boundaries, so this is not an end-to-end verified compiler theorem.

This is a contribution hypothesis, not a firstness assertion.

## High-venue path

Highest-value next work:

1. build semantic-security/plugin case studies where bounded semantic authority matters;
2. measure validation/certificate/checker/backend overhead;
3. complete systematic related-work and reproducibility passes;
4. reduce remaining parser/lowering/runtime trust boundaries without overstating full verification.
