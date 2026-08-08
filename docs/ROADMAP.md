# Roadmap

## 0.1 beta: language feel

- [x] `create`, `change`, `set`, `add`, `remove`, `clear`
- [x] `show`, conditions, repeat, things, recipes
- [x] semantic history, inverse generation, undo/redo, preview, watch
- [x] conservative conflict helper
- [x] browser playground and Windows/macOS/Linux CI
- [x] initial paper

## 0.2 beta: compiler + Studio + semantic contracts

- [x] compiler front end and Change IR
- [x] portable `.patchapp`
- [x] bootstrap WebAssembly
- [x] CLI run/check/changes/formal/certify/build
- [x] browser-first Patch Studio PWA and iPhone/iPad layout
- [x] Change IR and Change Contract views
- [x] first Patch UI and visual Designer slice
- [x] semantic Change Signatures
- [x] `allow` Change Capabilities
- [x] numeric `up to` bounds
- [x] transitive simple-call production signature substitution
- [x] deterministic Pages build and site integrity CI

### beta.3: range, provenance and first Lean model

- [x] ranged recipe parameters such as `bonus number 0..10`
- [x] interval arithmetic for bounded production expressions
- [x] runtime guards for declared parameter ranges
- [x] source/recipe/event provenance
- [x] `why value` and `why condition`
- [x] Lean 4 formal project
- [x] State-Change Factorization proof
- [x] Mutation Transparency proof
- [x] semantic Change Contract composition theorem

### beta.4: formal signature soundness

- [x] structured Lean control-flow core
- [x] executable formal `inferSignature`
- [x] machine-checked Change Signature Soundness
- [x] machine-checked end-to-end formal Change Capability Soundness

### beta.5: production/formal bridge

- [x] independent AST → semantic formal bridge for conservative subset
- [x] independent formal-style signature reconstruction
- [x] production/formal signature comparison
- [x] compiler failure on supported mismatches
- [x] explicit unsupported reasons
- [x] `patch formal` coverage reporting

### beta.6: verified policy checker

- [x] executable Lean semantic policy checker
- [x] checker soundness proofs
- [x] `checkedExecutionCannotEscape`
- [x] production-generated Lean certificates
- [x] source SHA-256 binding
- [x] explicit Lean target-build CI

### beta.7: proof-free semantic evidence

- [x] `EvidenceAmount`, `EvidenceEffect`, `EvidenceStmt`
- [x] Lean validation of raw interval ordering
- [x] Lean evidence → `CoreStmt` decoding
- [x] separately emitted production Change Signature claim
- [x] canonical semantic-effect deduplication
- [x] `checkEvidenceSignature`
- [x] `checkedEvidenceSignatureCorresponds`
- [x] evidence-level policy checking
- [x] `checkedEvidenceExecutionCannotEscape`
- [x] certificates no longer directly trust producer-created `CoreStmt`

### beta.8: formal source-core correspondence

- [x] `SourceChangeKind = add | remove | set | clear`
- [x] proof-free `SourceChange` and structured `SourceStmt`
- [x] production `src/formal-source.js` preserving source mutation verbs
- [x] separate source-core and semantic-bridge producer paths
- [x] Lean source semantic normalization to increase/decrease/set/clear
- [x] Lean handling of negative add/remove direction by revalidated mirrored bounds
- [x] conservative rejection of mixed-sign source amount ranges
- [x] `checkSourceEvidence` and `checkSourceEvidence_sound`
- [x] `checkSourceSignature` and `checkSourceSignature_sound`
- [x] `SourceExecutes` formal relation
- [x] `checkedSourceExecutionCannotEscape`
- [x] `checkedSourceSignatureAndPolicy`
- [x] generated certificates carrying SourceStmt + EvidenceStmt + production signature + policy
- [x] Change IR 0.6 with `formalSource`
- [x] `patch formal` reports both source-core and semantic bridge coverage
- [x] formal CI explicitly builds `PatchSource`

### beta.9: machine-checked integer range-analysis soundness

- [x] formal `RangeExpr` fragment in Lean
- [x] formal concrete evaluator `evalRangeExpr`
- [x] executable formal interval analyzer `analyzeRange`
- [x] machine-checked `rangeAnalysisSound`
- [x] integer literals and ranged variables
- [x] addition, subtraction and negation
- [x] multiplication by a non-negative integer constant via `scale`
- [x] motivating theorem for `bonus in 0..5` and `bonus * 2 in 0..10`
- [x] independent production `src/formal-range.js` extractor
- [x] independent formal-range calculation compared with production range analysis
- [x] conservative refusal of division, decimals and general multiplication in beta.9 certification
- [x] formal range claims embedded with formal Source-core metadata
- [x] generated certificates emit `RangeExpr`, environment, inferred interval and Lean soundness theorem
- [x] Change IR 0.7
- [x] formal CI builds `PatchRange`
- [x] formal CI certificate example exercises dynamic `bonus * 2`
- [x] Windows/macOS/Linux tests for formal range extraction and certification boundaries

Still open in product/tooling:

- [ ] typed AST
- [ ] expression IR instead of expression strings
- [ ] serialized `.patchlog` and explicit `replay`
- [ ] property-based inverse/composition/range tests
- [ ] Studio timeline/provenance graph
- [ ] Designer selection, drag/resize, properties and event editing
- [ ] richer Patch UI controls and two-way input binding
- [ ] project import/export and immediate mode

## 0.3 research hardening

Completed foundation:

- [x] formal factorization core
- [x] formal signature/runtime soundness
- [x] verified policy checker
- [x] proof-free semantic evidence boundary
- [x] formal Source core preserving source mutation verbs
- [x] machine-checked SourceStmt → EvidenceStmt correspondence for generated artifacts
- [x] machine-checked source → formal-signature correspondence for generated artifacts
- [x] formal source-runtime capability containment
- [x] formal integer expression fragment
- [x] machine-checked interval-analysis soundness for that formal fragment
- [x] independent production expression extraction and range-agreement validation

Highest-priority remaining work:

- [ ] **prove or independently validate production AST → `RangeExpr` / `SourceStmt` extraction for the supported source subset**
- [ ] **connect production runtime traces to `evalRangeExpr` / `SourceExecutes` / `Executes`**
- [ ] extend the verified arithmetic fragment only where semantics are explicit and useful
- [ ] extend certification to non-recursive recipe calls and parameter substitution
- [ ] stable machine-readable certificate/container format beyond generated Lean source
- [ ] richer path-sensitive/call-graph analysis
- [ ] recursive fixed-point analysis where sound
- [ ] richer `why` provenance graph and source navigation
- [ ] two or three semantic-security/engineering case studies

## 0.4 direct portable execution backend

- [ ] typed core suitable for direct lowering
- [ ] direct Change IR-to-WebAssembly lowering
- [ ] preserve semantic contract/range/source/evidence certificates across lowering
- [ ] WASI console runtime
- [ ] runnable `.patchapp` host
- [ ] browser Wasm runner executing lowered code
- [ ] Patch UI host-call interface
- [ ] compiler benchmark harness

## 0.5 native application packaging

- [ ] Windows console `.exe`
- [ ] Windows GUI-subsystem `.exe`
- [ ] macOS CLI executable and `.app`
- [ ] macOS Universal packaging where practical
- [ ] Linux CLI and GUI executable
- [ ] FreeBSD/OpenBSD/NetBSD runtime targets
- [ ] generic Unix C99 fallback
- [ ] native Windows/macOS Patch UI backends
- [ ] SDL3 portable GUI backend for Linux/BSD/other Unix

## 0.6 build service

- [ ] **Build for...** dialog in Patch Studio
- [ ] GitHub Actions remote build integration
- [ ] Windows/macOS/Linux artifact matrix
- [ ] iPhone/iPad request native desktop builds
- [ ] signing/notarization hooks
- [ ] artifact delivery into Patch Studio

## 0.7 collaboration semantics

- [ ] branchable state histories
- [ ] explicit semantic merge
- [ ] conflict explanations
- [ ] safe commuting changes
- [ ] optional CRDT-backed types for well-understood cases
- [ ] offline/local persistence
- [ ] capability-aware collaboration policies

## Research artifact gate

Before a high-venue submission:

- [ ] systematic related-work review across state-transition languages, effects/capabilities, quantitative/refinement systems, certifying systems, abstract interpretation, update calculi, provenance and reversible systems
- [x] State-Change Factorization formal core
- [x] factorization and Mutation Transparency proofs
- [x] Change Signature Soundness for structured formal core
- [x] end-to-end formal capability containment
- [x] production/formal validation artifact
- [x] Lean-verified semantic policy checker
- [x] proof-free semantic evidence validated/decoded by Lean
- [x] evidence/formal-signature correspondence
- [x] formal source mutation vocabulary
- [x] SourceStmt→EvidenceStmt and source→signature checked correspondence for certificate artifacts
- [x] machine-checked range-analysis soundness for a useful integer fragment
- [x] production/formal range-agreement boundary for supported expressions
- [ ] production AST→RangeExpr/SourceStmt extraction assurance for a useful subset
- [ ] production runtime/formal evaluation and trace correspondence
- [ ] direct compiled execution
- [ ] benchmark suite and semantic-security case studies
- [ ] source/range/evidence/certificate/checker overhead evaluation
- [ ] reproducibility bundle
- [ ] novice study with ethics/consent only if retained as a headline claim

## Design constraints

1. Advanced machinery must remain ignorable by a beginner.
2. Platform complexity belongs in compiler/runtime, not Patch source.
3. Patch Studio should remain practical on phone, tablet and desktop.
4. Console and GUI applications share state/change semantics.
5. High-venue claims come from formal properties and measured evidence, not product polish.
6. Bootstrap Wasm must never be described as direct Wasm lowering.
7. Capability/range analysis must fail conservatively when safety cannot be proved.
8. `why` must distinguish recorded provenance from stronger causal claims.
9. JavaScript source/AST→RangeExpr/SourceStmt extraction is not yet machine proved.
10. Beta 9 range soundness applies only to the explicitly modeled integer expression fragment.
11. Division, decimal/floating-point semantics and general multiplication are not silently labeled verified.
12. Unsupported certification constructs are never silently labeled verified.
