# Novelty Boundary

Patch is **not** novel merely because it has patches, first-class changes, effects, capabilities, range analysis, procedure-call substitution, transitive traces, call graphs, runtime trace validation, translation validation, proof-carrying evidence, verified checkers, WebAssembly/C generation or GUI packaging. These all have substantial prior art.

The research hypothesis remains centered on two linked ideas:

> **State-Change Factorization:** ordinary post-creation persistent mutation is forced through a structured semantic Change representation rather than ordinary assignment plus later logging.

> **Semantic Change Contracts:** Patch derives operation- and magnitude-aware summaries and authority policies from that same mandatory mutation substrate.

**Beta.31 adds conservative call-aware direct-Wasm correspondence for unambiguous independently validated scoped traces. This is supporting assurance, not a new novelty headline.**

## Prior-art discipline

Patch must continue to compare against first-class/scoped state-change work, classical/graded/quantitative/refinement effect systems, capabilities/permissions/typestate, abstract interpretation, interprocedural effect analysis, procedure-call operational semantics, well-founded/ranked call graphs, translation validation, Proof-Carrying Code/certifying compilation, verified compiler/refinement/simulation work, event sourcing, patch theory, reversible languages and provenance/Whyline-style debugging.

Do not claim invention of call-aware runtime validation, scoped effect traces, transitive procedure semantics, call-graph ranking, exact substitution, effect refinement, runtime correspondence, translation validation or proof-carrying evidence.

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

For beta.31:

```text
real direct-Wasm execution
+ complete independent transition/effect validation
+ independently reconstructed recipe scope
+ one unambiguous scoped exact-effect sequence
+ runtime-derived observed effect list
+ Lean re-evaluation of observed list against beta.30 CallTreeStmt
------------------------------------------------
observed validated semantic-effect list refines caller semantic signature
```

The bottom half of this beta.31 chain is Lean checked. Runtime capture, JavaScript-validator correctness and scoped-slice attribution remain explicit proof-free evidence boundaries.

## Beta.31 exact contribution boundary

The direct-Wasm compiler is unchanged. Beta.31 does not introduce trusted compiler-emitted call-entry/exit events. Instead, an independent Change-IR executor validates the entire raw target/before/after transition stream and reconstructs semantic operation identity and recipe scope.

A beta.30 scoped exact trace is connected to that validated stream only when the exact scope/effect sequence has one occurrence. Repeated indistinguishable sequences are rejected as ambiguous.

`PatchCallRuntime.lean` then uses:

```text
evalCallTreeStmtEqBool exactBindings exactTree runtimeObservedEffects
```

so the runtime-derived observed list is independently checked against the formal call tree before caller-signature refinement is concluded.

This is materially stronger than the beta.30 runtime-independent certificate, but it is **not** a full compiler correctness/refinement result.

Explicit limitations:

- runtime capture is not formally proved;
- independent validator correctness/completeness is not formally proved;
- **scoped-slice attribution** is a proof-free uniqueness criterion;
- parser/extractor correctness remains outside Lean;
- JavaScript-to-Wasm lowering remains outside Lean;
- Wasm engine correctness remains outside Lean;
- repeated identical invocation traces cannot yet be disambiguated.

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
- **call-aware direct-Wasm correspondence for unambiguous validated scoped traces**;
- generated Lean certificates;
- desktop/C99/GUI artifact work.

## Candidate beta.31 paper statement

A defensible working statement is:

> We present Patch, an experimental language in which post-creation persistent mutation is factored through structured semantic Changes and operation-/magnitude-aware Semantic Change Contracts are derived from that mandatory mutation substrate. For mechanized fragments we prove signature/policy/range properties and exact finite transitive call-tree refinement. We further execute the production direct-Wasm backend, independently validate its complete transition/effect stream, conservatively associate one unambiguous scoped effect sequence with a beta.30 call-tree witness, and have Lean re-evaluate the runtime-derived observed effects against that exact call tree before deriving caller-signature refinement. Runtime capture, independent-validator correctness and scoped-slice attribution remain explicit proof-free boundaries, so this is not an end-to-end verified compiler theorem.

This is a contribution hypothesis, not a firstness assertion.

## High-venue path

Highest-value next work:

1. independently reconstruct concrete invocation frames so repeated identical calls can be disambiguated without trusted backend call markers;
2. build semantic-security/plugin case studies where bounded semantic authority matters;
3. measure validation/certificate/checker/backend overhead;
4. complete systematic related-work and reproducibility passes.
