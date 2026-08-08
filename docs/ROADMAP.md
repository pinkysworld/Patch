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
- [x] evidence/signature correspondence checks
- [x] evidence-level policy checking
- [x] certificates no longer directly trust producer-created `CoreStmt`

### beta.8: formal source-core correspondence

- [x] proof-free source mutation vocabulary `add | remove | set | clear`
- [x] structured `SourceStmt`
- [x] production source-core extractor
- [x] Lean source semantic normalization
- [x] source/evidence and source/signature checked correspondence
- [x] formal `SourceExecutes`
- [x] source-runtime capability containment

### beta.9: machine-checked integer range-analysis soundness

- [x] formal `RangeExpr` fragment in Lean
- [x] formal concrete evaluator `evalRangeExpr`
- [x] executable formal interval analyzer `analyzeRange`
- [x] machine-checked `rangeAnalysisSound`
- [x] integer literals and ranged variables
- [x] addition, subtraction and negation
- [x] multiplication by a non-negative integer constant via `scale`
- [x] independent production formal-range extractor
- [x] production/formal range agreement before certification
- [x] conservative refusal of unsupported arithmetic in certification
- [x] Change IR 0.7
- [x] formal CI builds `PatchRange`
- [x] formal CI certificate example exercises dynamic `bonus * 2`

### beta.10: first direct WebAssembly execution core

- [x] separate `wasm-direct` backend with no interpreter fallback
- [x] direct lowering of top-level `create number`
- [x] direct numeric `change` set/add/remove/clear
- [x] direct numeric `show`
- [x] numeric literals, bindings, parentheses and `+ - * /`
- [x] mutable Wasm state globals
- [x] minimal `patch.show_number(f64)` ABI
- [x] `patch run-wasm`
- [x] `patch build --target wasm-direct`
- [x] interpreter-vs-Wasm output/final-state differential tests
- [x] cross-platform direct build/execution CI

### beta.11: direct WebAssembly control flow

- [x] Wasm `if` / `else` lowering
- [x] direct expression kinds `f64-number` / `i32-bool`
- [x] numeric comparisons
- [x] boolean `true`, `false`, `not`, `and`, `or`
- [x] literal repeat to Wasm `block` / `loop`
- [x] 1-based Patch `count` as Wasm local
- [x] nested repeat `count` shadowing
- [x] `if` inside `repeat`
- [x] explicit rejection of dynamic repeat and bare numeric truthiness

### beta.12: direct WebAssembly recipes + ranged guards

- [x] one real Wasm function per supported numeric recipe
- [x] `do` lowered to Wasm `call`
- [x] numeric recipe parameters as Wasm `f64` parameters
- [x] recipe parameters usable in arithmetic and conditions
- [x] acyclic recipe-to-recipe calls
- [x] cycle detection and recursive-recipe rejection
- [x] exact call-arity checking
- [x] repeat `count` passed as recipe argument
- [x] protected numeric recipes execute directly after production capability validation
- [x] ranged numeric recipe parameters receive Wasm min/max runtime guards
- [x] statically provable bad calls rejected before Wasm generation
- [x] runtime-unproven bad values trap before recipe body
- [x] cross-platform protected-recipe direct build/execution CI

### beta.13: direct semantic transition trace

- [x] second direct host ABI import `patch.change_number(i32,f64,f64)`
- [x] stable numeric target-id table in direct metadata
- [x] one trace event per committed supported Patch `change` block
- [x] trace granularity matches interpreter history rather than individual operations
- [x] trace includes target, before value and after value
- [x] direct host returns structured `trace`
- [x] optional direct-host `changeNumber(event)` callback
- [x] multi-operation change block emits one event
- [x] loops produce ordered transition sequences
- [x] recipes and nested recipe calls produce ordered transition sequences
- [x] differential suite compares trace against normalized interpreter history
- [x] backend validation now checks output + final state + ordered transition trace
- [ ] enrich trace with semantic operation/effect identity
- [ ] enrich trace with source/version/provenance only where needed for correspondence
- [ ] translation validation from Change IR effect to emitted Wasm trace
- [ ] machine-checked direct-lowering correspondence

Still open in product/tooling:

- [ ] typed AST / typed expression IR
- [ ] serialized `.patchlog` and explicit `replay`
- [ ] property-based inverse/composition/range tests
- [ ] Studio timeline/provenance graph
- [ ] Designer selection, drag/resize, properties and event editing
- [ ] richer Patch UI controls and two-way input binding
- [ ] project import/export and immediate mode

## Research hardening

Completed foundation:

- [x] formal factorization core
- [x] formal signature/runtime soundness
- [x] verified policy checker
- [x] proof-free semantic evidence boundary
- [x] formal Source core preserving source mutation verbs
- [x] source→evidence→formal-signature checked correspondence
- [x] formal source-runtime capability containment
- [x] formal integer expression fragment
- [x] machine-checked interval-analysis soundness for that fragment
- [x] independent production expression extraction and range-agreement validation
- [x] direct numeric Wasm execution
- [x] direct branch/literal-loop execution
- [x] direct non-recursive numeric recipe calls
- [x] direct ranged-parameter runtime enforcement
- [x] differential output/final-state backend validation
- [x] differential ordered transition-trace backend validation

Highest-priority remaining work:

- [ ] **prove or independently validate production AST → `RangeExpr` / `SourceStmt` extraction for the supported source subset**
- [ ] **give direct trace events semantic operation/effect identity derived independently from lowering**
- [ ] **translation-validate Change IR expected effects against direct Wasm transition traces**
- [ ] connect production/direct traces to formal `SourceExecutes` / `Executes`
- [ ] typed expression/core IR to reduce duplicate parsing
- [ ] extend formal call/substitution semantics for the direct recipe subset
- [ ] stable machine-readable certificate/container format
- [ ] two or three semantic-security/engineering case studies
- [ ] backend/certificate/checker overhead evaluation

## Direct portable execution backend

Completed:

- [x] directly executable numeric Change IR-to-WebAssembly subset
- [x] explicit support boundary with no silent fallback
- [x] cross-platform direct-Wasm CI
- [x] structured `if` / `else`
- [x] literal `repeat` + Patch `count`
- [x] non-recursive numeric recipe/call lowering
- [x] ranged recipe parameter guards
- [x] block-level numeric transition-trace ABI

Remaining:

- [ ] typed expression/core IR
- [ ] semantic operation-aware direct trace
- [ ] lowering translation validation / machine-checked correspondence
- [ ] bounded dynamic loop semantics
- [ ] return-valued recipes
- [ ] preserve formal/capability artifacts through backend packaging
- [ ] WASI console runtime
- [ ] runnable `.patchapp` direct host
- [ ] browser direct-Wasm runner
- [ ] Patch UI host-call interface
- [ ] compiler benchmark harness

## Native application packaging

- [ ] Windows console `.exe`
- [ ] Windows GUI-subsystem `.exe`
- [ ] macOS CLI executable and `.app`
- [ ] macOS Universal packaging where practical
- [ ] Linux CLI and GUI executable
- [ ] FreeBSD/OpenBSD/NetBSD runtime targets
- [ ] generic Unix C99 fallback
- [ ] native Windows/macOS Patch UI backends
- [ ] SDL3 portable GUI backend for Linux/BSD/other Unix

## Build service

- [ ] **Build for...** dialog in Patch Studio
- [ ] GitHub Actions remote build integration
- [ ] Windows/macOS/Linux artifact matrix
- [ ] iPhone/iPad request native desktop builds
- [ ] signing/notarization hooks
- [ ] artifact delivery into Patch Studio

## Collaboration semantics

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
- [x] SourceStmt→EvidenceStmt and source→signature checked correspondence
- [x] machine-checked range-analysis soundness for a useful integer fragment
- [x] production/formal range-agreement boundary
- [x] direct compiled execution for numeric state/control/recipes
- [x] direct ranged-parameter runtime guards
- [x] direct output/final-state differential execution gate
- [x] direct ordered transition-trace differential execution gate
- [ ] production AST→RangeExpr/SourceStmt extraction assurance
- [ ] semantic effect-aware direct trace
- [ ] production/direct-Wasm/formal trace correspondence
- [ ] typed expression/core IR or independently checked lowering input
- [ ] benchmark suite and semantic-security case studies
- [ ] overhead evaluation
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
11. Division, decimal/floating-point semantics and general multiplication are not silently labeled formally verified.
12. Direct-Wasm support is narrower than the Patch language and unsupported constructs fail explicitly.
13. Differential backend testing is evidence, not a compiler-correctness theorem.
14. Direct numeric equality is not presented as proof of all non-finite JavaScript edge cases.
15. Runtime parameter guards complement compile-time analysis; they do not imply full lowering verification.
16. Beta.13 trace equivalence covers the recorded numeric target/before/after sequence, not yet the complete semantic Change object.
17. Unsupported certification constructs are never silently labeled verified.
