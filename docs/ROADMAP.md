# Patch roadmap

Current development beta: **0.2.0-beta.34**

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
- [x] fresh-process outer runner for independent benchmark repetitions
- [x] environment/commit/scenario consistency checks before cross-process aggregation
- [x] robust across-process statistics: Q1/Q3, MAD and IQR in addition to median/mean/p95
- [x] checksummed raw per-process JSON/CSV retained beside aggregate output
- [x] explicit `development` / `hosted-ci` / `controlled` measurement classes
- [x] fail closed when GitHub Actions timing is labelled `controlled`
- [x] fixed-machine controlled measurement procedure in `docs/CONTROLLED_EVALUATION.md`
- [x] `docs/EVALUATION.md`
- [ ] **controlled paper-quality benchmark runs** on fixed hardware
- [ ] statistical model/plots over the collected controlled dataset
- [ ] measured results synchronized into manuscript

No empirical performance result is claimed until controlled measurements are collected. The completed process-isolated protocol makes the future dataset auditable but is not itself a measured result.

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
- [x] literature-grounded comparison dimensions against named related systems in `docs/RELATED_WORK.md`
- [ ] broader externally motivated extension corpus or real plugin integration

This case is a larger engineering/motivating example, not a complete plugin sandbox or malicious-code containment result.

### Commit-bound reproducibility bundle
- [x] exact Patch version and 40-character source commit in the bundle manifest
- [x] snapshot all Git-tracked source plus explicitly regenerated formal/runtime and case-study evidence
- [x] SHA-256 and byte size recorded and re-verified for every copied source/evidence file
- [x] deterministic `SOURCE_DATE_EPOCH` support for security and checkout evidence timestamps
- [x] regenerate finite transitive call-tree, runtime and repeated-call invocation-frame certificates in CI
- [x] regenerate semantic-authority micro-case and checkout-extension reports in CI
- [x] environment provenance recorded separately from the reproducible claim boundary
- [x] deterministic sorted tar/gzip envelope plus archive SHA-256
- [x] 90-day GitHub Actions artifact from the exact checked-out commit
- [x] `docs/REPRODUCIBILITY_BUNDLE.md`

The bundle supports artifact identity and evidence reruns. It intentionally does not turn variable hosted-runner timings into paper performance results.

### Structured related work and manuscript synchronization
- [x] mechanism-oriented comparison across first-class state change, effects, capabilities, quantitative types, permissions, state specifications, explicit edits, assurance and provenance
- [x] explicit separation of expressibility from mandatory/default mutation architecture
- [x] primary-source bibliography expanded for the comparison systems
- [x] citation-ready `paper/related-work.tex`
- [x] novelty claim narrowed to mandatory semantic mutation factorization plus operation/magnitude authority from the same substrate
- [x] `paper/main.tex` synchronized from the old beta.28 state to beta.32 assurance / beta.34 artifact status
- [x] security, checkout, controlled-evaluation and reproducibility evidence integrated into the manuscript
- [ ] targeted follow-up for recent dependent/graded effect systems that may be an even closer architectural match

The literature pass does not claim that Patch policies are uniquely expressible or that the review is exhaustive. Rich refinement/effect systems can state stronger relations; the candidate claim is architectural and remains subject to expert/venue scrutiny.

## Product milestones

### beta.33: Studio and production-readiness layer
- [x] versioned v2 project bundle with build target/native mode persistence and migrations
- [x] managed recovery snapshots and privacy-redacted local diagnostics
- [x] source-backed Form resizing, scrollable Designer and project-level build configuration
- [x] split public Studio/Language/Documentation/Downloads/Help site
- [x] stable diagnostics/CLI result contracts, security gates, fuzzing, differential tests and logical release reproducibility

### beta.34: Studio correctness and runtime integrity
- [x] programmatic sample/Designer source edits normalize into the same canonical v2 project-persistence signals as manual editing
- [x] programmatic Project Type changes synchronize native-build UI state
- [x] same-origin `/runtimes/` service-worker requests are fresh-first with offline fallback
- [x] Pages derives a runtime integrity manifest from GitHub Release SHA-256 asset digests and independently verifies downloaded bytes
- [x] Patch Studio re-hashes native runtime templates with Web Crypto before token-free browser-side sealing and fails closed on mismatch
- [x] Downloads page documents SHA-256 verification and separates integrity checking from signing/notarization claims
- [x] Pages concurrency prevents runtime `workflow_run` events from cancelling a valid source-triggered deploy

Beta.34 does not change Change IR 0.10, Native GUI IR 0.8, direct Table backend 0.9 or sealed payload v9/runtime v1.0.

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
- [x] Studio App-preview dispatch parity for Table row selection through the shared semantic Window event adapter
- [x] sealed Ready/offline Table payload **v9** / runtime **v1.0** contract and Windows/macOS/Linux consumer switch with real seal/link/run smokes
- [x] canonical v2 persistence synchronization for programmatic sample/Designer edits
- [ ] richer data controls beyond Table/Grid
- [ ] ListBox multi-selection with an explicit list-valued event contract
- [ ] Menu separators, shortcuts and source-backed enabled/checked state
- [ ] project tree and separate source files/forms

All current input/selection/result events expose transient values only. Persistent application state still changes through ordinary semantic `change`. Runtime layout reflow is UI behavior only and does not create Patch state or Change History. Table `changed` exposes the selected row as a transient list of display strings; renderer/native-toolkit selection is UI state and does not itself mutate Patch state.

### Desktop
- [x] ready Windows/macOS/Linux Console packages
- [x] ready Windows/macOS/Linux Window packages for the Native GUI IR 0.7 base surface
- [x] explicit compatibility Window backend consumes a source-free compiled Window artifact instead of reparsing `main.patch`
- [x] token-free compatibility payload v0.4 with `studio-runtime-v0.6`
- [x] FreeBSD Console via portable C99
- [x] Native GUI IR **0.7** for Forms, Text/Button/Input/Checkbox, ComboBox/ListBox/Radio, Tabs, menus, informational dialogs and result-bearing Confirm/Open/Save dialogs
- [x] direct-native AOT Win32/AppKit/GTK backends for the Native GUI IR 0.7 surface
- [x] AOT backend **0.8** native accessibility naming/readback on Win32/AppKit/GTK
- [x] direct-native runtime-responsive Anchor/Dock handling on Win32/AppKit/GTK
- [x] Native GUI IR **0.8** Table extension remains explicit and does not redefine Native GUI IR 0.7
- [x] AOT backend **0.9** Table widgets compile and execute on Windows/MSVC, macOS/AppKit and Linux/GTK3
- [x] frozen sealed native GUI payload **v7** / runtime **v0.8** compatibility line with result dialogs and accessibility
- [x] frozen responsive sealed native GUI payload **v8** / runtime **v0.9** compatibility line with Anchor/Dock and Native GUI IR 0.7 controls
- [x] sealed native GUI payload **v9** carries Native GUI IR 0.8 Table columns/rows, transient `text-list` event typing and responsive layout metadata
- [x] token-free sealed Win32 runtime `native-win32-runtime-v1.0` with real Table/selection/accessibility/responsive smoke
- [x] token-free sealed GTK3 runtime `native-linux-runtime-v1.0` with real Table/selection/accessibility/responsive smoke
- [x] token-free sealed AppKit runtime `native-macos-runtime-v1.0` with real Table/selection/accessibility/responsive smoke
- [x] ordinary offline `patch link` creates and executes payload-v9/runtime-v1.0 Table apps on Windows/macOS/Linux
- [x] fail-closed final-artifact Windows/macOS signing/notarization machinery
- [x] Linux packaging expectations documented
- [x] downloadable offline compiler/linker for Windows, macOS and Linux plus a FreeBSD portable C99 kit
- [x] offline compiler builds/embeds runtime v1.0 and executes Console, responsive Window and Table Window link smokes on Windows/Linux/Apple Silicon/macOS Intel
- [x] browser Ready Window runtime templates are SHA-256 verified against release-asset digests before sealing
- [ ] real credentialed Windows signing evidence
- [ ] real credentialed macOS signing/notarization evidence
- [ ] installer/package formats with explicit uninstall path
- [ ] verify release integrity before install/update across future installer/update channels
- [ ] fresh remote native build service without a user-supplied GitHub token
- [ ] FreeBSD native GUI backend
- [ ] more self-contained Linux distribution formats where justified

The backend-v0.9 and sealed-runtime-v1.0 Table paths are independent contracts over Native GUI IR 0.8. Payload v8/runtime v0.9 remains the frozen responsive Native GUI IR 0.7 compatibility line; payload v9/runtime v1.0 is the explicit Table-capable Ready/offline contract. The Windows/macOS/Linux sealed-runtime matrix and ordinary offline-linker matrix independently encode and execute the new payload before it is presented as supported. Beta.34 additionally validates the byte identity of the native runtime templates used by the browser Ready path, without claiming platform code signing.

## Highest-value remaining research work

1. [ ] collect controlled overhead/scaling measurements using the completed process-isolated fixed-machine protocol;
2. [ ] statistical analysis/plots over the controlled dataset and measured-results manuscript update;
3. [ ] broader externally motivated extension/security corpus beyond the checkout case;
4. [ ] targeted recent dependent/graded-effect search for a closer architectural match;
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
- [x] **process-isolated controlled-measurement protocol**
- [x] **Semantic-authority security ablation**
- [x] **realistic checkout/loyalty security/engineering case study**
- [x] **commit-bound reproducibility bundle**
- [x] **structured related work with primary-source comparison dimensions**
- [x] **main manuscript synchronized to beta.32 assurance / beta.34 artifact status**
- [ ] controlled measured overhead results
- [ ] broader externally motivated application corpus

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
20. Browser-side Ready packaging must fail closed if the deployed native runtime bytes do not match the deployment's verified release-integrity manifest.
21. A reproducibility artifact may bind source and generated evidence to an exact commit without turning heterogeneous hosted-runner timing into a performance claim.
22. Hosted CI timing and controlled fixed-machine timing are distinct evidence classes and must never be pooled or relabelled implicitly.
23. Related-work comparisons must distinguish expressibility from whether a mechanism is the mandatory/default mutation substrate of the compared system.
