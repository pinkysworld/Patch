# Patch roadmap

Current development beta: **0.2.0-beta.33**

Checked items are implemented and must pass final exact-head gates before merge. Unchecked items are not presented as finished features or measured results.

## Completed research milestones

### beta.25–27: call composition and exact binding
- [x] Change IR **0.10** with finite ranked `formalCalls`
- [x] exact safe-integer positional binding and quantitative effect refinement
- [x] integer `RangeExpr` arithmetic certificate coverage

### beta.28–29: exact structured and guard-aware callee traces
- [x] direct quantitative emit, sequence and literal/static repeat
- [x] exact formal `GuardExpr` selection under exact recipe-parameter bindings
- [x] generated regression certificates

### beta.30: finite transitive exact call-tree traces
- [x] `formal/PatchCallTree.lean`
- [x] exact nested bindings and strict rank decrease
- [x] selected guards/static repeats/direct effects
- [x] edge-by-edge semantic-signature import
- [x] `checkedConcreteTransitiveCallTreeRefinesCallerSignature`

### beta.31: first call-aware direct-Wasm bridge
- [x] execute the existing direct-Wasm backend unchanged
- [x] independently validate complete raw target/before/after transitions
- [x] reconstruct semantic operation identity and recipe scope
- [x] re-evaluate runtime-derived observed effects against beta.30 in Lean

### beta.32: independent invocation frames
- [x] reconstruct every concrete `DO` invocation frame independently of backend call markers
- [x] invocation frames carry caller/callee, dynamic ordinal, parent/depth, exact bindings and transition interval
- [x] repeated identical calls are distinguishable
- [x] runtime-frame `BindingList = beta.30 exact BindingList` checked in generated Lean evidence
- [x] frame-selected effects re-evaluated through `evalCallTreeStmtEqBool`
- [x] single and repeated runtime certificates in standard Formal/Cross-platform CI
- [x] Change IR remains **0.10**

Beta.32 establishes invocation-frame-aware direct-Wasm correspondence for the supported finite safe-integer call-tree fragment, including **repeated identical calls**. Runtime capture and independent validator/frame-reconstruction correctness remain explicit proof-free boundaries.

## Evaluation infrastructure

### Assurance overhead/scaling harness
- [x] deterministic depth/invocation corpus
- [x] compiler / execution / independent validation / correspondence / certificate-generation timing
- [x] raw samples + min/median/mean/p95/max
- [x] source/Wasm/trace/frame/certificate metadata
- [x] JSON/CSV and environment manifest
- [x] separate manual-only Lean checker timing
- [x] `docs/EVALUATION.md`
- [ ] **controlled paper-quality benchmark runs** on fixed hardware
- [ ] statistical analysis / plots
- [ ] measured results synchronized into manuscript

No empirical performance result is claimed until controlled measurements are collected.

### Semantic-authority security ablation
- [x] eight reproducible micro cases under `case-studies/security/`
- [x] real Patch compiler decisions plus deliberately coarse target-write internal ablation
- [x] magnitude, direction, transitive-helper, fail-closed and target-control cases
- [x] mechanized JSON/CSV/Markdown report
- [x] exact **3 both-accept / 4 Patch-only-reject / 1 both-reject** matrix
- [x] `docs/SECURITY_CASE_STUDIES.md`

The coarse baseline is an internal ablation, not a representation of any named prior effect/capability system.

### Realistic checkout/loyalty extension case
- [x] coherent multi-state checkout application under `case-studies/checkout-extension/`
- [x] protected `checkout_extension` composes `apply_discount` and `grant_loyalty` helpers
- [x] safe case executes through real direct Wasm to `balance=80`, `points=8`, `cashback=0`
- [x] protected entry signature must contain both transitive helper effects and their bounds
- [x] reward-magnitude escalation variant
- [x] balance-direction escalation variant
- [x] unauthorized cashback-target variant
- [x] same internal coarse target-write ablation reused for controlled comparison
- [x] application-level JSON/Markdown evaluator and regression tests
- [x] `docs/CHECKOUT_EXTENSION_CASE.md`
- [ ] broader externally motivated extension corpus or real plugin integration
- [ ] literature-grounded comparison dimensions against named related systems

This case is a larger engineering/motivating example, not a complete plugin sandbox or malicious-code containment result.

## Product priorities

### Studio / Designer
- [x] semantic Input `changed` without hidden persistent assignment
- [x] source-backed control selection/property inspector
- [x] source-backed Form dimensions and multiple-Form selection/properties
- [x] source-backed control `at X, Y size W, H` geometry
- [x] drag positioning and resize handle rewrite `main.patch`
- [x] Standalone Web and Windows/macOS/Linux Window runtimes preserve Form geometry
- [x] Checkbox control with source-backed label/id/layout and transient Boolean `value`
- [x] named Forms with simple transient `open name` / `close name` lifecycle
- [x] ComboBox with source-backed options and transient text `value`
- [x] single-selection ListBox with source-backed options and transient text `value`
- [x] grouped Radio with source-backed options and transient text `value`
- [x] Tabs with nested pages, transient renderer-local selection and source-backed container geometry
- [x] structural Window menus with named MenuItems and informational dialogs
- [x] named Confirm/Open/Save result dialogs with confirmed/chosen/cancelled events
- [x] project import/export with versioned project bundle migrations
- [x] Studio keyboard/focus/responsive accessibility baseline
- [x] keyboard arrow-key positioning for selected controls with source-backed X/Y updates
- [x] drag alignment guides with edge/center snapping and an Alt bypass
- [x] source-backed Designer multi-select with shared pointer/keyboard movement and primary-relative alignment commands
- [x] source-backed Anchor/Dock policies with Designer resizing and runtime reflow in Standalone Web, direct Win32/AppKit/GTK AOT and token-free sealed Ready Apps
- [x] read-only source-backed Table/Grid Stage 1 in language, Designer, Studio preview and Standalone Web
- [x] transient Table row-selection contract in shared Window events and Standalone Web, with list-valued `value` and no implicit persistent state
- [x] opt-in Native GUI IR **0.8** Table representation with source-backed columns/rows and transient `text-list` event type
- [x] direct AOT backend **0.9** native Table widgets on Win32/AppKit/GTK with real compile/runtime/selection smokes
- [ ] Studio App-preview dispatch parity for Table row selection
- [ ] sealed Ready/offline Table payload/runtime contract and consumer switch
- [ ] richer data controls beyond Table/Grid
- [ ] ListBox multi-selection with an explicit list-valued event contract
- [ ] Menu separators, shortcuts and source-backed enabled/checked state
- [ ] project tree and separate source files/forms

All current input/selection/result events expose transient values only. Persistent application state still changes through ordinary semantic `change`. Runtime layout reflow is UI behavior only and does not create Patch state or Change History. Table `changed` exposes the selected row as a transient list of display strings; renderer/native-toolkit selection is UI state and does not itself mutate Patch state.

### Desktop
- [x] ready Windows/macOS/Linux Console packages
- [x] ready Windows/macOS/Linux Window packages for the current sealed Native GUI IR 0.7 surface
- [x] explicit compatibility Window backend consumes a source-free compiled Window artifact instead of reparsing `main.patch`
- [x] token-free compatibility payload v0.4 with `studio-runtime-v0.6`
- [x] FreeBSD Console via portable C99
- [x] Native GUI IR **0.7** for Forms, Text/Button/Input/Checkbox, ComboBox/ListBox/Radio, Tabs, menus, informational dialogs and result-bearing Confirm/Open/Save dialogs
- [x] direct-native AOT Win32/AppKit/GTK backends for the Native GUI IR 0.7 surface
- [x] AOT backend **0.8** native accessibility naming/readback on Win32/AppKit/GTK
- [x] direct-native runtime-responsive Anchor/Dock handling on Win32/AppKit/GTK
- [x] Native GUI IR **0.8** Table extension remains opt-in and does not redefine the stable sealed IR 0.7 contract
- [x] AOT backend **0.9** Table widgets compile and execute on Windows/MSVC, macOS/AppKit and Linux/GTK3
- [x] frozen sealed native GUI payload **v7** / runtime **v0.8** compatibility line with result dialogs and accessibility
- [x] sealed native GUI payload **v8** with source-backed Anchor/Dock transport
- [x] token-free responsive sealed Win32 runtime `native-win32-runtime-v0.9`
- [x] token-free responsive sealed GTK3 runtime `native-linux-runtime-v0.9`
- [x] token-free responsive sealed AppKit runtime `native-macos-runtime-v0.9`
- [x] sealed runtime v0.9 preserves v0.8 accessibility parity while adding runtime reflow
- [x] fail-closed final-artifact Windows/macOS signing/notarization machinery
- [x] Linux packaging expectations documented
- [x] downloadable offline compiler/linker for Windows, macOS and Linux plus a FreeBSD portable C99 kit
- [x] offline compiler embeds runtime v0.9 and executes responsive Window-link smokes on Windows/Linux/Apple Silicon/macOS Intel for the sealed Native GUI IR 0.7 surface
- [ ] sealed payload/runtime Table representation and token-free Ready/offline Table linking
- [ ] real credentialed Windows signing evidence
- [ ] real credentialed macOS signing/notarization evidence
- [ ] installer/package formats with explicit uninstall path
- [ ] verify release integrity before install/update
- [ ] fresh remote native build service without a user-supplied GitHub token
- [ ] FreeBSD native GUI backend
- [ ] more self-contained Linux distribution formats where justified

The v0.9 sealed-runtime item and the backend-v0.9 Table item are different contracts. Runtime v0.9 is the responsive payload-v8 consumer for the Native GUI IR 0.7 control surface. Backend v0.9 is the direct-AOT Table extension over Native GUI IR 0.8. Table is not claimed for Ready/offline linking until an explicit sealed Table contract passes its own Windows/macOS/Linux link-and-run gate.

## Highest-value remaining research work

1. [ ] collect controlled overhead/scaling measurements using the completed evaluation harness;
2. [ ] systematic related-work review and literature-grounded comparison dimensions;
3. [ ] broader externally motivated extension/security corpus beyond the checkout case;
4. [ ] reproducibility bundle;
5. [ ] reduce parser/lowering/runtime trust boundaries without overstating full verification;
6. [ ] extend invocation-frame evidence to richer branching/repeated-call scenarios.

## High-venue artifact gate

- [x] State-Change Factorization + Mutation Transparency
- [x] Change Signature Soundness + semantic policy containment
- [x] machine-checked integer range fragment
- [x] source/guard translation validation
- [x] direct compiled execution + independent effect validation
- [x] finite abstract/exact/transitive call assurance
- [x] call-aware direct-Wasm correspondence
- [x] invocation frames for repeated identical calls
- [x] portable C99 and semantic GUI input evidence
- [x] **Assurance overhead/scaling harness**
- [x] **Semantic-authority security ablation**
- [x] **realistic checkout/loyalty security/engineering case study**
- [ ] controlled measured overhead results
- [ ] systematic related work
- [ ] broader externally motivated application corpus
- [ ] reproducibility bundle

## Design constraints

1. Advanced assurance machinery stays ignorable by beginners.
2. Platform complexity belongs in compiler/runtime, not Patch source.
3. High-venue claims come from formal properties and measured evidence, not product polish.
4. Unsupported assurance cases fail conservatively.
5. Translation validation does not imply parser correctness.
6. Proof-free runtime/call witnesses remain explicit evidence boundaries.
7. Benchmark infrastructure is not a performance claim until controlled results exist.
8. Security ablations and application cases must not be presented as claims about unnamed or named prior systems.
9. Direct-Wasm/C99 support remains narrower than the full language.
10. Visual Form metadata remains source-backed UI structure and does not redefine semantic Change IR.
11. GUI input/selection/result widgets expose transient event values; persistent application state changes only through ordinary semantic `change`.
12. Desktop GUI apps must consume a build-time compiled Patch artifact or checked Native GUI IR; runtime reparsing is legacy compatibility only, not the native build path.
13. Form lifecycle must stay simple and transient: no hidden persistent visibility variable and no framework-style Form object boilerplate.
14. Unsupported native controls and containers fail closed during Native GUI IR preflight rather than being dropped or triggering an implicit Electron fallback.
15. Tabs page selection is transient renderer/native-toolkit state unless a future explicit language contract deliberately exposes it.
16. Backend, Native GUI IR and sealed payload versions are independent contracts; an implementation-only backend/runtime change must not silently bump semantic/payload formats.
17. Automated accessibility smoke evidence does not substitute for manual assistive-technology testing or imply WCAG conformance.
18. Responsive layout metadata remains non-semantic UI metadata; runtime resize must not create hidden persistent state or Change History.
19. A direct-AOT control extension is not a sealed-runtime support claim until the payload format and token-free consumer independently encode and execute it.
