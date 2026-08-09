# Patch roadmap

Current development beta: **0.2.0-beta.32**

Checked items are implemented and must pass final exact-head gates before merge. Unchecked items are not presented as finished features.

## Completed research milestones

### beta.25–27: call composition and exact binding
- [x] Change IR **0.10** with finite ranked `formalCalls`
- [x] `PatchCalls.lean` abstract argument-interval and semantic-signature composition
- [x] exact safe-integer positional binding through `concreteCallBinding`
- [x] exact quantitative direct leaf-effect refinement
- [x] integer `RangeExpr` arithmetic certificate coverage

### beta.28–29: exact structured and guard-aware callee traces
- [x] direct quantitative emit, sequence and literal/static repeat
- [x] exact formal `GuardExpr` selection under exact recipe-parameter bindings
- [x] both branch arms statically covered by callee signatures
- [x] generated beta.28/29 Lean regression certificates

### beta.30: finite transitive exact call-tree traces
- [x] `formal/PatchCallTree.lean`
- [x] exact nested `RangeExpr` arguments and positional `BindingList`s
- [x] strict rank decrease on outer and nested call edges
- [x] exact nested guards/static repeats/direct quantitative effects
- [x] edge-by-edge `SignatureCovers` import
- [x] `checkedConcreteTransitiveCallTreeRefinesCallerSignature`
- [x] `caller → outer → middle → leaf` depth-2 example
- [x] `GeneratedTransitiveCallBodyCertificate.lean`

### beta.31: first call-aware direct-Wasm bridge
- [x] execute the existing direct-Wasm backend unchanged
- [x] validate the complete raw target/before/after transition sequence independently
- [x] reconstruct semantic operation identity and recipe scope outside the backend trace
- [x] re-evaluate runtime-derived observed effects against the beta.30 call tree in Lean
- [x] `formal/PatchCallRuntime.lean`
- [x] `GeneratedTransitiveRuntimeCertificate.lean`
- [x] fail closed when repeated identical scoped traces make attribution ambiguous

### beta.32: independent invocation frames

Runtime evidence:
- [x] independent Change-IR execution reconstructs every concrete `DO` invocation frame
- [x] frame fields include `frameId`, parent frame, caller scope, callee, dynamic invocation ordinal, depth, exact arguments/bindings and transition interval
- [x] every validated transition/effect carries the active frame stack
- [x] correspondence selects effects by concrete frame identity rather than global trace uniqueness
- [x] repeated identical calls are distinguishable without backend call-enter/call-exit markers
- [x] frame exact parameter bindings are compared with the beta.30 expected callee binding
- [x] `examples/formal-transitive-calls-repeated.patch` exercises two identical `do caller(1)` calls

Formal/runtime bridge:
- [x] generated beta.32 certificate checks runtime-frame `BindingList = beta.30 exact BindingList`
- [x] frame-selected observed effects are re-evaluated through `evalCallTreeStmtEqBool`
- [x] caller-signature refinement still reuses `checkedObservedTransitiveRuntimeRefinesCallerSignature`
- [x] single-call `GeneratedTransitiveRuntimeCertificate.lean`
- [x] repeated-call `GeneratedRepeatedTransitiveRuntimeCertificate.lean`
- [x] standard Formal CI generates/verifies both certificates
- [x] Windows/macOS/Linux standard CI regenerates both runtime evidence artifacts
- [x] Change IR remains **0.10**

Beta.32 establishes invocation-frame-aware direct-Wasm correspondence for the supported finite safe-integer call-tree fragment, including repeated identical calls. Invocation-frame reconstruction is still proof-free evidence produced by the independent JavaScript validator, not a full compiler/runtime simulation theorem.

Explicit beta.32 boundaries remain:
- runtime trace capture;
- correctness/completeness of the independent JavaScript trace/effect validator and invocation-frame reconstruction;
- parser/extractor correctness;
- JavaScript-to-Wasm lowering correctness;
- Wasm engine correctness.

## Product priorities

### Studio / Designer
- [x] semantic input `changed` without hidden persistent assignment
- [x] source-backed control selection/property inspector
- [x] property changes write directly to `main.patch`
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

1. [ ] semantic-security/plugin case studies for bounded semantic authority;
2. [ ] certificate/checker/backend overhead evaluation;
3. [ ] systematic related-work review;
4. [ ] reproducibility bundle;
5. [ ] reduce parser/lowering/runtime trust boundaries without overstating full verification;
6. [ ] extend invocation-frame evidence to richer branching/repeated call scenarios.

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
- [x] call-aware direct-Wasm correspondence
- [x] **independent invocation frames for repeated identical calls**
- [x] portable C99 evidence on Linux/macOS/FreeBSD
- [x] semantic GUI input route
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
8. Beta.32 improves concrete invocation attribution but does not establish full compiler verification.
9. Direct-Wasm/C99 support remains narrower than the full language.
