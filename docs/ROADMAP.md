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
- [x] CLI run/check/changes/build
- [x] browser-first Patch Studio PWA and iPhone/iPad layout
- [x] Change IR and Change Contract views
- [x] first Patch UI and visual Designer slice
- [x] semantic Change Signatures
- [x] `allow` Change Capabilities
- [x] numeric `up to` bounds
- [x] transitive simple-call signature substitution
- [x] deterministic Pages build and site integrity CI

### beta.3 research additions

- [x] ranged recipe parameters such as `bonus number 0..10`
- [x] interval arithmetic for bounded change expressions
- [x] runtime guards for declared parameter ranges
- [x] source/recipe/event provenance on committed changes
- [x] `why value` and `why condition` prototype
- [x] Lean 4 formal project
- [x] machine-checked State-Change Factorization for the formal step model
- [x] machine-checked Mutation Transparency corollary
- [x] machine-checked interval-containment transitivity
- [x] machine-checked Semantic Change Contract composition theorem

### beta.4 formal soundness additions

- [x] structured Lean control-flow core with `seq`, branch choice and bounded `repeat`
- [x] executable formal `inferSignature` function
- [x] machine-checked **Change Signature Soundness** for the formal core
- [x] machine-checked **end-to-end Change Capability Soundness** for the formal core
- [x] explicit separation between formal-core soundness and production-compiler correspondence

### beta.5 production/formal bridge

- [x] independent production-AST -> Lean-like `CoreStmt` bridge for a conservative subset
- [x] independent formal-style signature reconstruction
- [x] supported-case comparison against production Change Signatures
- [x] compiler failure on supported signature mismatches
- [x] explicit unsupported reasons rather than false verification claims
- [x] `formalBridge` evidence embedded in Change IR, `.patchapp`, and bootstrap Wasm payloads
- [x] `patch formal program.patch` coverage report
- [x] dedicated formal-bridge tests
- [x] formal bridge smoke check on Windows/macOS/Linux CI

### beta.6 verified checker / certificates

- [x] executable Lean semantic policy checker
- [x] machine-checked soundness of interval, rule, policy and protected-statement checker stages
- [x] `checkedExecutionCannotEscape` theorem connecting a successful checker result to runtime policy containment
- [x] `patch certify program.patch` Lean certificate generation
- [x] source SHA-256 embedded in generated certificate artifacts
- [x] conservative refusal to certify protected recipes outside the formal bridge subset
- [x] production-generated certificate compiled by Lean in formal CI
- [x] explicit `lake build PatchFormal PatchSignature PatchChecker` CI gate
- [x] repair latent Lean 4.30 compatibility issues exposed by the stronger CI gate
- [x] syntax-aware unfinished-proof gate instead of matching prose comments
- [x] beta.6 research/docs/site/paper synchronization

Still open in the 0.2/0.3 line:

- [ ] typed AST
- [ ] expression IR instead of expression strings
- [ ] serialized `.patchlog` and explicit `replay`
- [ ] property-based inverse/composition/range tests
- [ ] Studio timeline/provenance graph
- [ ] control selection, drag/resize, properties and event editing in Designer
- [ ] richer Patch UI controls and two-way input binding
- [ ] project import/export and immediate mode

## 0.3 research hardening

- [x] first machine-readable compiler/formal bridge artifact
- [x] first conformance tests for direct changes, branches, bounded repetition and ranged amounts
- [x] small Lean-verified semantic policy checker
- [x] generated Lean certificate path from production Patch source
- [ ] define/prove a stable source/Change-IR-to-`CoreStmt` correspondence relation
- [ ] extend bridge/certificate coverage to non-recursive recipe calls and parameter substitution
- [ ] formalize the ranged expression language in Lean
- [ ] prove production interval-analysis soundness for that fragment
- [ ] connect production runtime traces to formal `Executes` traces for a restricted core
- [ ] derive stronger source-level end-to-end Change Capability Soundness
- [ ] package checker evidence in a stable machine-readable certificate/container format
- [ ] richer path-sensitive and call-graph analysis
- [ ] recursive fixed-point analysis where it can be made sound
- [ ] richer `why` provenance graph and source navigation
- [ ] distinguish historical provenance from counterfactual explanation in tooling
- [ ] two or three security/engineering case studies centered on semantic authority

## 0.4 direct portable execution backend

- [ ] typed core suitable for direct lowering
- [ ] direct Change IR-to-WebAssembly lowering
- [ ] preserve semantic contract/formal evidence across lowering
- [ ] WASI console runtime
- [ ] runnable `.patchapp` host
- [ ] browser Wasm runner executing lowered code
- [ ] Patch UI host-call interface
- [ ] compiler benchmark harness
- [ ] Rust compiler migration where it materially improves the toolchain

## 0.5 native application packaging

- [ ] Windows console `.exe`
- [ ] Windows GUI-subsystem `.exe`
- [ ] macOS CLI executable and `.app`
- [ ] macOS Universal packaging where practical
- [ ] Linux CLI and GUI executable
- [ ] FreeBSD/OpenBSD/NetBSD runtime targets
- [ ] generic Unix C99 fallback for console applications
- [ ] native Windows/macOS Patch UI backends
- [ ] SDL3 portable GUI backend for Linux/BSD/other supported Unix

## 0.6 build service

- [ ] **Build for...** dialog in Patch Studio
- [ ] GitHub Actions remote build integration
- [ ] Windows/macOS/Linux artifact matrix
- [ ] iPhone/iPad can request native desktop builds
- [ ] signing/notarization hooks
- [ ] release artifact delivery back into Patch Studio

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

- [ ] systematic related-work review across Plaid, Worlds, effect/capability systems, graded/refinement effects, behavioral permissions, proof-carrying/certifying systems, provenance/why debugging, update calculi and reversible systems
- [x] formal State-Change Factorization core
- [x] machine-checked factorization and Mutation Transparency
- [x] machine-checked Change Signature Soundness for a structured formal core
- [x] machine-checked end-to-end capability containment for that formal core
- [x] production/formal translation-validation artifact and CI boundary
- [x] Lean-verified semantic policy checker over translated evidence
- [x] production-generated Lean certificate smoke path
- [ ] machine-checked source/IR-to-formal correspondence for a useful executable subset
- [ ] interval-analyzer soundness proof if magnitude-aware contracts remain central
- [ ] direct compiled execution
- [ ] benchmark suite and semantic-security case studies
- [ ] certificate/checker overhead evaluation
- [ ] novice study with ethics/consent if retained
- [ ] reproducibility bundle

## Design constraints

1. Every advanced feature must remain ignorable by a beginner writing ordinary Patch.
2. Platform complexity belongs in the compiler/runtime, not Patch source.
3. Patch Studio must remain practical on phone, tablet and desktop.
4. Console and GUI applications share the same state/change semantics.
5. High-venue claims come from formal semantics and measured evidence, not product polish alone.
6. Bootstrap Wasm must not be described as direct Wasm lowering.
7. Semantic capability/range analysis must fail conservatively when it cannot prove safety.
8. `why` must distinguish recorded provenance from stronger causal claims.
9. A successful verified-checker result applies to the translated formal evidence; it must not be presented as full source-level compiler verification until correspondence is proved.
10. Formal bridge/certificate support must be explicit: unsupported code is never silently labeled verified.
