# Patch roadmap

Current development beta: **0.2.0-beta.17**

This file separates completed milestones from the remaining research and product work. Checked items are implemented in `main`; unchecked items are not presented as finished features.

## Completed foundation

### 0.1: language feel

- [x] `create`, `change`, `set`, `add`, `remove`, `clear`
- [x] `show`, conditions, repeat, things and recipes
- [x] semantic history, inverse generation, undo/redo, preview and watch
- [x] conservative conflict helper
- [x] browser playground and Windows/macOS/Linux CI
- [x] initial research manuscript

### 0.2 beta.1–beta.2: compiler, Studio and semantic contracts

- [x] compiler front end and normalized Change IR
- [x] portable `.patchapp`
- [x] bootstrap WebAssembly carrier
- [x] CLI run/check/changes/formal/certify/build
- [x] browser-first Patch Studio PWA and iPhone/iPad layout
- [x] Change IR and Change Contract views
- [x] first Patch UI and visual Designer slice
- [x] semantic Change Signatures
- [x] `allow` Change Capabilities
- [x] operation-sensitive numeric `up to` bounds
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
- [x] formal Change Capability containment

### beta.5: production/formal bridge

- [x] independent AST → semantic formal bridge for a conservative subset
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
- [x] Lean Evidence → `CoreStmt` decoding
- [x] separately emitted production Change Signature claim
- [x] evidence/signature correspondence checks
- [x] evidence-level policy checking

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
- [x] concrete evaluator `evalRangeExpr`
- [x] executable interval analyzer `analyzeRange`
- [x] machine-checked `rangeAnalysisSound`
- [x] integer literals and ranged variables
- [x] addition, subtraction and negation
- [x] non-negative integer constant scaling
- [x] independent production formal-range extractor
- [x] production/formal range agreement before certification
- [x] Change IR 0.7

### beta.10: direct WebAssembly execution core

- [x] separate `wasm-direct` backend with no interpreter fallback
- [x] top-level numeric state
- [x] numeric `set/add/remove/clear`
- [x] direct numeric `show`
- [x] numeric literals, bindings, parentheses and `+ - * /`
- [x] mutable Wasm globals
- [x] `patch.show_number(f64)` host ABI
- [x] `patch run-wasm`
- [x] `patch build --target wasm-direct`
- [x] interpreter-vs-Wasm output/final-state differential tests

### beta.11: direct Wasm control flow

- [x] Wasm `if` / `else`
- [x] numeric comparisons and boolean expressions
- [x] literal `repeat` using Wasm `block` / `loop`
- [x] 1-based Patch `count`
- [x] nested repeat `count` shadowing
- [x] explicit rejection of unsupported dynamic repeat/bare numeric truthiness

### beta.12: direct Wasm recipes and ranged guards

- [x] one Wasm function per supported numeric recipe
- [x] `do` lowered to Wasm calls
- [x] numeric recipe parameters
- [x] acyclic recipe-to-recipe calls
- [x] recursive-cycle rejection
- [x] call-arity checks
- [x] protected recipes after production capability validation
- [x] ranged parameter min/max guards at the Wasm function boundary
- [x] static rejection when an invalid call can already be proved

### beta.13: direct semantic transition trace

- [x] `patch.change_number(i32,f64,f64)` host callback
- [x] stable numeric target-id table
- [x] one transition event per committed supported `change` block
- [x] target/before/after trace data
- [x] structured direct-host trace
- [x] loops and recipe calls preserve transition order
- [x] differential trace comparison against interpreter history

### beta.14: independent Change-IR transition validation

- [x] independent validator-side execution model for the direct subset
- [x] deterministic Change-site contract and lexical `siteId`
- [x] expected transition sequence reconstructed from Change IR
- [x] observed direct-Wasm transitions checked for order/target/before/after
- [x] tamper tests for missing, extra, reordered and modified transitions
- [x] dedicated `npm run validate:wasm-direct` CI gate

See [DIRECT_TRACE_VALIDATION.md](DIRECT_TRACE_VALIDATION.md).

### beta.15: semantic-effect and capability validation

- [x] independently reconstruct concrete `increase/decrease/set/clear` effects
- [x] concrete magnitude reconstruction
- [x] validate concrete effects against static Change Signatures
- [x] validate protected effects against Change Capabilities
- [x] tamper tests for signatures, capabilities and transition data
- [x] keep semantic labels outside the Wasm lowerer's self-reporting path

See [DIRECT_EFFECT_VALIDATION.md](DIRECT_EFFECT_VALIDATION.md).

### beta.16: standalone browser and native Console applications

- [x] standalone single-file Web App target
- [x] distinguish bootstrap Wasm from direct Wasm in Studio/docs
- [x] native Console packaging on Windows, macOS and Linux
- [x] Windows `.exe`
- [x] macOS `.app`
- [x] Linux executable
- [x] GitHub Actions native Console smoke matrix

### beta.17: cross-platform builds from Patch Studio

- [x] Windows, macOS and Linux targets in Patch Studio
- [x] current unsaved Studio source submitted through `workflow_dispatch`
- [x] artifact download back into Studio
- [x] Console project builds through the direct-Wasm/native-host path
- [x] standalone Window/GUI packages for Windows, macOS and Linux
- [x] current `window`, `text`, `button`, `input` desktop player
- [x] supported button-click events through the Patch runtime
- [x] separate Console and Window smoke matrices on all three OSes
- [x] iPhone/iPad can request desktop builds remotely
- [x] beta.17 website, README, PWA cache and build docs

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
- [ ] native AppKit Window backend
- [ ] native Win32/Windows UI backend
- [ ] portable Linux/BSD GUI backend, likely SDL3 or a similarly small portability layer
- [ ] Windows code signing
- [ ] macOS Developer ID signing/notarization
- [ ] installer formats
- [ ] application icons/resources/version metadata workflow
- [ ] organization-level build service so end users do not need a personal GitHub token

### Additional platforms

- [ ] FreeBSD Console target
- [ ] OpenBSD/NetBSD runtime targets
- [ ] generic Unix C99 fallback where the native host toolchain is unavailable
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
- [x] direct numeric Wasm execution
- [x] direct control flow and numeric recipes
- [x] runtime ranged-parameter enforcement
- [x] output/final-state differential validation
- [x] ordered transition validation
- [x] independent Change-IR transition validator
- [x] independent semantic-effect reconstruction
- [x] direct runtime effect checks against Change Signatures and Capabilities

Highest-priority remaining work:

- [ ] **assure production source/AST → `RangeExpr` / `SourceStmt` extraction for the supported source subset**
- [ ] **connect independently reconstructed runtime effect occurrences to Lean `SourceExecutes` / `Executes`**
- [ ] typed expression/core IR or an independently checked lowering input
- [ ] extend formal call/substitution semantics for the direct recipe subset
- [ ] stable machine-readable certificate/container format
- [ ] semantic-security case studies
- [ ] backend/certificate/checker overhead evaluation
- [ ] systematic related-work review for submission
- [ ] reproducibility bundle
- [ ] novice study only if retained as a headline claim and ethics/consent are in place

## Direct backend remaining work

- [ ] typed expression/core IR
- [ ] bounded dynamic loop semantics
- [ ] return-valued recipes
- [ ] preserve certificate/capability artifacts through all backend packages
- [ ] WASI console runtime
- [ ] runnable `.patchapp` direct host
- [ ] broaden direct values beyond the numeric subset
- [ ] direct Patch UI host-call interface
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
- [x] direct compiled execution for numeric state/control/recipes
- [x] direct ranged-parameter runtime guards
- [x] output/final-state differential gate
- [x] independent ordered transition validation
- [x] independent semantic-effect / Change Contract validation
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
12. Direct-Wasm support is narrower than the full Patch language and unsupported constructs fail explicitly.
13. Differential and translation-validation tests are evidence, not compiler-correctness theorems.
14. Runtime guards complement compile-time analysis; they do not imply full lowering verification.
15. Window desktop packages are standalone, but beta.17 does not claim native-widget code generation.
16. Unsupported certification constructs are never silently labeled verified.
