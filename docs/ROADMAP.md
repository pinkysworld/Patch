# Patch roadmap

Current development beta: **0.2.0-beta.18**

Checked items are implemented and tested in the repository. Unchecked items are not presented as finished features.

## Milestones completed

### 0.1–beta.2: language, compiler, Studio and semantic contracts

- [x] beginner-facing `create`, `change`, `show`, conditions, repeat, things and recipes
- [x] semantic history, inverse generation, undo/redo, preview, watch and provenance foundations
- [x] compiler front end and normalized Change IR
- [x] portable `.patchapp` and bootstrap Wasm carrier
- [x] browser-first Patch Studio PWA and first Window Designer slice
- [x] semantic Change Signatures
- [x] magnitude-aware `allow` Change Capabilities
- [x] deterministic Pages/site CI

### beta.3–beta.9: formal core and quantitative assurance

- [x] ranged recipe parameters and interval analysis
- [x] source/recipe/event provenance and `why`
- [x] Lean State-Change Factorization and Mutation Transparency
- [x] structured formal execution and Change Signature Soundness
- [x] formal capability containment
- [x] production/formal bridge with explicit unsupported cases
- [x] verified Lean semantic-policy checker
- [x] proof-free semantic evidence decoded by Lean
- [x] SourceStmt → EvidenceStmt / signature correspondence
- [x] formal source-runtime capability containment
- [x] machine-checked integer `rangeAnalysisSound`
- [x] Change IR 0.7

### beta.10–beta.13: direct WebAssembly execution

- [x] separate `wasm-direct` backend with no interpreter fallback
- [x] top-level numeric state and numeric `set/add/remove/clear`
- [x] direct numeric `show`, arithmetic and mutable state
- [x] direct `if` / `else`
- [x] literal `repeat` and 1-based `count`
- [x] non-recursive / acyclic numeric recipes and calls
- [x] ranged parameter guards at Wasm function boundaries
- [x] stable numeric transition callback and target table
- [x] output/final-state/transition differential tests

### beta.14–beta.15: independent direct-runtime validation

- [x] independent Change-IR transition execution model
- [x] stable lexical Change-site contract
- [x] expected transition sequence reconstructed independently from Change IR
- [x] order/target/before/after validation against observed Wasm execution
- [x] independent concrete `increase/decrease/set/clear` reconstruction
- [x] concrete magnitude reconstruction
- [x] runtime effects checked against static Change Signatures
- [x] protected runtime effects checked against Change Capabilities
- [x] tamper tests for transitions, signatures and capabilities

See [DIRECT_TRACE_VALIDATION.md](DIRECT_TRACE_VALIDATION.md) and [DIRECT_EFFECT_VALIDATION.md](DIRECT_EFFECT_VALIDATION.md).

### beta.16: standalone browser and native Console applications

- [x] standalone single-file Web App target
- [x] direct Wasm clearly separated from bootstrap Wasm in UI/docs
- [x] Windows `.exe` Console package
- [x] macOS `.app` Console package
- [x] Linux native Console executable
- [x] Windows/macOS/Linux native Console smoke matrix

### beta.17: cross-platform builds from Patch Studio

- [x] Windows, macOS and Linux build targets in Studio
- [x] current unsaved editor source submitted through GitHub Actions
- [x] automatic artifact download back into Studio
- [x] Console builds through direct-Wasm/native-host path
- [x] Windows/macOS/Linux standalone Window packages
- [x] generated desktop player for current `window`, `text`, `button`, `input` model
- [x] supported button-click events through the Patch runtime
- [x] separate Console and Window smoke matrices on all three operating systems
- [x] remote desktop builds usable from iPhone/iPad Studio
- [x] CI gate keeping README, website, version and roadmap synchronized

### beta.18: portable C99 and FreeBSD Console

- [x] portable C99 backend for the conservative direct numeric Console subset
- [x] C99 lowering from normalized Change IR after direct-subset validation
- [x] numeric create/change/show and `+ - * /`
- [x] supported comparisons and `if` / `else`
- [x] literal `repeat` and 1-based `count`
- [x] acyclic numeric recipes and ranged runtime guards
- [x] block-level transition hook in generated C
- [x] `patch build ... --target c99`
- [x] C99 compile/run smoke tests on Linux and macOS
- [x] **FreeBSD 15.1 compile/run with the FreeBSD base-system `cc`**
- [x] **FreeBSD Console target from Patch Studio**
- [x] FreeBSD artifact returned through GitHub Actions
- [x] explicit rejection of FreeBSD Window projects until a Unix GUI path exists

## Current product priorities

### Studio / Designer

- [ ] control selection
- [ ] drag positioning and resizing
- [ ] property inspector
- [ ] event editing
- [ ] richer controls
- [ ] two-way input binding
- [ ] project import/export
- [ ] immediate mode against a running app
- [ ] timeline / provenance visualization

### Desktop platform quality

- [x] Windows/macOS/Linux Console packages
- [x] Windows/macOS/Linux standalone Window packages
- [x] FreeBSD Console package through portable C99
- [ ] native AppKit Window backend
- [ ] native Win32/Windows UI backend
- [ ] portable Linux/BSD GUI backend
- [ ] FreeBSD Window package
- [ ] Windows code signing
- [ ] macOS Developer ID signing/notarization
- [ ] installer formats
- [ ] application icons/resources/version metadata workflow
- [ ] organization-level build service so end users do not need a personal GitHub token

### Additional Unix targets

- [x] generic C99 fallback architecture for the supported numeric Console subset
- [x] FreeBSD 15.1 compile/run gate
- [ ] OpenBSD compile/run gate before claiming OpenBSD support
- [ ] NetBSD compile/run gate before claiming NetBSD support
- [ ] portable Unix GUI package path
- [ ] WASI command target for raw standalone Wasm execution

## Research hardening priorities

Completed foundation:

- [x] formal factorization core
- [x] Change Signature Soundness for a structured formal core
- [x] verified policy checker
- [x] proof-free semantic evidence boundary
- [x] SourceStmt → EvidenceStmt and formal signature correspondence
- [x] source-runtime capability containment
- [x] machine-checked interval-analysis soundness for an integer fragment
- [x] direct numeric Wasm execution and ranged guards
- [x] independent transition validation
- [x] independent semantic-effect reconstruction
- [x] runtime effect checks against Change Signatures and Capabilities

Highest-priority remaining work:

- [ ] **assure production source/AST → `RangeExpr` / `SourceStmt` extraction for the supported source subset**
- [ ] **connect independently reconstructed runtime effect occurrences to Lean `SourceExecutes` / `Executes`**
- [ ] typed expression/core IR or independently checked lowering input
- [ ] extend formal call/substitution semantics for the direct recipe subset
- [ ] stable machine-readable certificate/container format
- [ ] semantic-security case studies
- [ ] backend/certificate/checker overhead evaluation
- [ ] systematic related-work review for submission
- [ ] reproducibility bundle

## Backend remaining work

- [ ] typed expression/core IR
- [ ] bounded dynamic loop semantics
- [ ] return-valued recipes
- [ ] preserve certificate/capability artifacts through all packages
- [ ] WASI Console runtime
- [ ] runnable `.patchapp` direct host
- [ ] broaden direct values beyond numeric subset
- [ ] direct Patch UI host-call interface
- [ ] native / portable Unix GUI backend
- [ ] compiler benchmark harness
- [ ] machine-checked or stronger independently checked lowering correspondence

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

- [x] State-Change Factorization formal core
- [x] factorization and Mutation Transparency proofs
- [x] Change Signature Soundness
- [x] formal capability containment
- [x] production/formal validation artifact
- [x] Lean-verified semantic policy checker
- [x] proof-free semantic evidence decoded by Lean
- [x] source-core correspondence checks
- [x] machine-checked range-analysis soundness for a useful integer fragment
- [x] direct compiled numeric state/control/recipe execution
- [x] direct ranged-parameter runtime guards
- [x] output/final-state differential gate
- [x] independent ordered transition validation
- [x] independent semantic-effect / Change Contract validation
- [x] portable C99 portability evidence on Linux/macOS/FreeBSD
- [ ] production source/AST extraction assurance
- [ ] production/direct-runtime/formal effect correspondence
- [ ] typed expression/core IR or independently checked lowering input
- [ ] benchmark suite and semantic-security case studies
- [ ] overhead evaluation
- [ ] systematic related-work review
- [ ] reproducibility bundle

## Design constraints

1. Advanced machinery must remain ignorable by a beginner.
2. Platform complexity belongs in compiler/runtime, not Patch source.
3. Patch Studio should remain practical on phone, tablet and desktop.
4. Console and GUI applications share state/change semantics.
5. High-venue claims come from formal properties and measured evidence, not product polish.
6. Bootstrap Wasm must never be described as direct Wasm lowering.
7. Capability/range analysis must fail conservatively when safety cannot be proved.
8. `why` describes recorded provenance, not universal causality.
9. JavaScript source/AST → formal extraction is not yet machine proved.
10. Range soundness applies only to the explicitly modeled integer fragment.
11. Division, floating-point semantics and general multiplication are not silently labeled formally verified.
12. Direct-Wasm and C99 support are narrower than the full Patch language; unsupported constructs fail explicitly.
13. Differential and translation-validation tests are evidence, not compiler-correctness theorems.
14. Runtime guards complement compile-time analysis; they do not imply full lowering verification.
15. Window desktop packages are standalone on Windows/macOS/Linux, but beta.18 does not claim native-widget code generation.
16. FreeBSD is a Console-only target in beta.18; OpenBSD/NetBSD are not claimed until separately tested.
17. Unsupported certification constructs are never silently labeled verified.
