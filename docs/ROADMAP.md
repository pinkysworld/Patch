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
- [x] dedicated formal CI rejecting `sorry`/`admit`

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

- [ ] formalize the ranged expression language in Lean
- [ ] prove executable interval-analysis soundness for that fragment
- [ ] formalize recipes/calls and simple substitution
- [ ] prove Change Signature soundness for a useful non-recursive core
- [ ] derive end-to-end Change Capability soundness
- [ ] establish compiler/analyzer-to-formal correspondence or a verified-checker boundary
- [ ] richer path-sensitive and call-graph analysis
- [ ] recursive fixed-point analysis where it can be made sound
- [ ] richer `why` provenance graph and source navigation
- [ ] distinguish historical provenance from counterfactual explanation in tooling

## 0.4 direct portable execution backend

- [ ] typed core suitable for direct lowering
- [ ] direct Change IR-to-WebAssembly lowering
- [ ] preserve semantic contract evidence across lowering
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

- [ ] systematic related-work review across Plaid, Worlds, effect/capability systems, behavioral permissions, provenance/why debugging, update calculi and reversible systems
- [x] formal State-Change Factorization core
- [x] initial machine-checked factorization and contract-composition results
- [ ] machine-checked executable Change Signature soundness
- [ ] compiler/formal correspondence
- [ ] direct compiled execution
- [ ] benchmark suite and semantic-security case studies
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
