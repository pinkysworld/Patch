# Patch roadmap

Current development beta: **0.2.0-beta.31**

Checked items are implemented and must pass final exact-head gates before merge. Unchecked items are not presented as finished features.

## Completed research milestones

### beta.25–27: call composition and exact binding
- [x] Change IR **0.10** with finite ranked `formalCalls`
- [x] `PatchCalls.lean` abstract argument-interval and semantic-signature composition
- [x] exact safe-integer positional binding through `concreteCallBinding`
- [x] concrete values through beta.25 abstract intervals
- [x] exact quantitative direct leaf-effect refinement
- [x] integer `RangeExpr` arithmetic certificate coverage

### beta.28: exact structured callee traces
- [x] `PatchCallBody.lean`
- [x] direct quantitative emit, sequence and literal/static repeat
- [x] exact trace equality and callee-signature coverage
- [x] caller-signature import through `PatchCallBodyImport.lean`
- [x] `GeneratedConcreteCallBodyCertificate.lean`

### beta.29: guard-aware exact structured callee traces
- [x] exact formal `GuardExpr` selection under exact recipe-parameter bindings
- [x] selected concrete trace contains only the chosen branch
- [x] both branch arms remain statically covered by the callee signature
- [x] `GeneratedGuardedCallBodyCertificate.lean`

### beta.30: finite transitive exact call-tree traces
- [x] `formal/PatchCallTree.lean`
- [x] beta.29 `BoundStmt` retained as call-free leaf semantics
- [x] exact nested `RangeExpr` argument evaluation and positional `BindingList` construction
- [x] strict beta.25 rank decrease checked on outer and nested call edges
- [x] exact nested guards/static repeats/direct quantitative effects
- [x] nested body coverage by nested callee signature
- [x] edge-by-edge `SignatureCovers` import
- [x] `checkedConcreteTransitiveCallTreeRefinesCallerSignature`
- [x] `caller → outer → middle → leaf` depth-2 example
- [x] exact selected trace `score +4, coins +3`
- [x] `GeneratedTransitiveCallBodyCertificate.lean`
- [x] focused and standard pinned-Lean gates

### beta.31: call-aware direct-Wasm correspondence

Runtime evidence:
- [x] execute the existing direct-Wasm backend unchanged
- [x] validate the **complete** raw target/before/after transition sequence using the independent Change-IR executor
- [x] reconstruct semantic operation identity and recipe scope independently of the backend trace
- [x] beta.31 transitive witness schema **0.2** preserves exact recipe scope per selected effect occurrence
- [x] match beta.30 scoped exact traces only when the exact scope/effect sequence has one unique occurrence in the validated runtime stream
- [x] ambiguous repeated identical scoped traces fail closed
- [x] preserve site ids, source lines and before/after transitions as audit metadata
- [x] `src/transitive-runtime-correspondence.js`

Formal/runtime bridge:
- [x] `formal/PatchCallRuntime.lean`
- [x] `checkedObservedTransitiveRuntimeRefinesCallerSignature`
- [x] feed runtime-derived observed effects directly through `evalCallTreeStmtEqBool`
- [x] reuse beta.30 exact binding, rank, call-tree coverage and caller-signature import
- [x] self-contained `GeneratedTransitiveRuntimeCertificate.lean` embeds beta.30 generated evidence
- [x] focused pinned-Lean beta.31 gate
- [x] standard Formal CI generates/verifies beta.31
- [x] Windows/macOS/Linux CI executes direct Wasm and regenerates beta.31 evidence
- [x] Change IR remains **0.10**

Beta.31 establishes conservative **call-aware direct-Wasm correspondence for unambiguous validated scoped traces**. It is supporting assurance, not a full compiler/runtime refinement theorem.

Explicit beta.31 evidence boundaries remain:
- runtime capture;
- correctness/completeness of the independent JavaScript trace/effect validator;
- **scoped-slice attribution** from the validated effect stream to one concrete invocation;
- parser/extractor correctness;
- JavaScript-to-Wasm lowering correctness;
- Wasm engine correctness.

## Product priorities

### Studio / Designer
- [x] semantic input `changed` without hidden persistent assignment
- [x] source-backed control selection/property inspector
- [x] property changes write directly to `main.patch`
- [x] id renames propagate to matching event headers
- [x] Delete removes matching event blocks
- [ ] drag positioning/resizing
- [ ] richer controls/event editing
- [ ] project import/export
- [ ] immediate mode and provenance timeline

### Desktop
- [x] ready Windows/macOS/Linux Console packages
- [x] ready Windows/macOS/Linux Window packages
- [x] FreeBSD Console via portable C99
- [x] project-specific sealed Console executable packaging
- [x] sandboxed/validated Window runtime path
- [ ] AppKit/Win32/portable Unix native widget lowering
- [ ] FreeBSD Window package
- [ ] signing/notarization/installers
- [ ] direct-native AOT backend

## Highest-value remaining research work

1. [ ] replace unique scoped-slice attribution with **independent concrete invocation-frame reconstruction**, so repeated identical calls can be disambiguated without compiler-emitted trusted call events;
2. [ ] extend the call-aware runtime theorem to richer repeated/branching call scenarios after invocation-frame evidence exists;
3. [ ] semantic-security/plugin case studies for bounded semantic authority;
4. [ ] certificate/checker/backend overhead evaluation;
5. [ ] systematic related-work review;
6. [ ] reproducibility bundle.

## High-venue artifact gate

- [x] State-Change Factorization + Mutation Transparency
- [x] Change Signature Soundness + semantic policy containment
- [x] machine-checked integer range fragment
- [x] source/guard translation validation
- [x] direct compiled execution + independent effect validation
- [x] guard-aware runtime/capability correspondence
- [x] finite abstract call composition
- [x] exact call binding and arithmetic
- [x] guarded structured exact callee traces
- [x] finite transitive exact call trees
- [x] **call-aware direct-Wasm correspondence for unambiguous validated scoped traces**
- [x] portable C99 evidence on Linux/macOS/FreeBSD
- [x] semantic GUI input route
- [ ] invocation-frame runtime attribution
- [ ] security/engineering case studies
- [ ] overhead evaluation
- [ ] systematic related work
- [ ] reproducibility bundle

## Design constraints

1. Advanced assurance machinery stays ignorable by beginners.
2. Platform complexity belongs in compiler/runtime, not Patch source.
3. Console and GUI applications share state/change semantics.
4. High-venue claims come from formal properties and measured evidence, not product polish.
5. Unsupported assurance cases fail conservatively.
6. Translation validation does not imply parser correctness.
7. Proof-free runtime/call witnesses remain evidence; Lean checks only explicit supported obligations.
8. Beta.30 proves exact finite transitive call-tree semantics, not production runtime equivalence.
9. Beta.31 connects unambiguous independently validated direct-Wasm semantic-effect slices to beta.30 call trees but still keeps runtime capture, validator correctness and scoped-slice attribution explicit.
10. Direct-Wasm/C99 support remains narrower than the full language.
