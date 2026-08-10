# Patch roadmap

Current development beta: **0.2.0-beta.32**

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
- [x] semantic input `changed` without hidden persistent assignment
- [x] source-backed control selection/property inspector
- [x] source-backed Form dimensions and multiple-Form selection/properties
- [x] source-backed control `at X, Y size W, H` geometry
- [x] drag positioning and resize handle rewrite `main.patch`
- [x] Standalone Web and Windows/macOS/Linux Window runtimes preserve Form geometry
- [x] Checkbox control with source-backed label/id/layout
- [x] Checkbox `changed` exposes a typed transient Boolean `value`
- [x] Checkbox persistence still requires explicit semantic `change`
- [x] Boolean `clear` deterministically resets to `false`
- [x] named Forms use beginner syntax `window ... as name`
- [x] first named Form visible, additional named Forms hidden until `open name`
- [x] simple `open name` / `close name` lifecycle is transient UI state, not persistent mutation
- [x] Designer auto-names new Forms and exposes editable Form name
- [x] build validation rejects unknown/duplicate Form names before packaging
- [x] ComboBox with source-backed options, typed transient text `value`, Studio/Web rendering and native v0.2 parity
- [x] single-selection ListBox with source-backed options, typed transient text `value`, Studio/Web rendering and native v0.3 parity
- [x] Tabs Stage 1 with nested pages, transient renderer-local page selection, Studio/Standalone Web/compatibility rendering and source-backed container geometry
- [ ] native Tabs parity through a versioned Native GUI container contract
- [ ] richer controls/event editing: radio, menu, dialogs, table/grid
- [ ] ListBox multi-selection with an explicit list-valued event contract
- [ ] project tree and separate source files/forms
- [ ] project import/export
- [ ] alignment guides, multi-select, anchors/docking and keyboard layout editing

### Desktop
- [x] ready Windows/macOS/Linux Console packages
- [x] ready Windows/macOS/Linux Window packages
- [x] Window build produces `patch-compiled-window-program` before compatibility desktop packaging
- [x] local/cloud compatibility Window apps execute the compiled artifact instead of reparsing `main.patch`
- [x] compiled Window artifact v0.2 carries named Form lifecycle instructions while Change IR remains 0.10
- [x] token-free compatibility payload v0.4 links the same source-free compiled Window artifact into the sandboxed runtime
- [x] compatibility runtime-template release `studio-runtime-v0.6` renders named Forms, ComboBox, ListBox and Tabs while retaining payload v0.4
- [x] project-specific Windows/macOS/Linux smoke builds the named-Forms example and exercises open/close in the packaged app
- [x] independent compatibility runtime-template smoke exercises open, typed Checkbox change and close on all three desktop OSes
- [x] FreeBSD Console via portable C99
- [x] Native GUI IR v0.3 lowers Text, Button, Input, Checkbox, ComboBox and ListBox plus Form lifecycle to Win32, AppKit and GTK3
- [x] direct-native AOT GUI backend for the supported Native GUI IR v0.3 subset on Windows, macOS and Linux
- [x] native ComboBox parity: Win32 `COMBOBOX`, AppKit `NSPopUpButton`, GTK3 `GtkComboBoxText`
- [x] native ListBox parity: Win32 `LISTBOX`, AppKit `NSTableView`, GTK3 `GtkListBox`
- [x] sealed native GUI payload v3 carries ListBox option arrays and is checked by all three native runtime workflows
- [x] token-free sealed native Win32 Studio Window download
- [x] token-free sealed native GTK3 Studio Window download
- [x] token-free sealed native AppKit Studio Window download using an unsigned universal Mach-O runtime
- [ ] native Tabs parity through Native GUI IR and all six native AOT/sealed implementations
- [ ] richer native controls: radio, menus, dialogs, table/grid
- [ ] signing/notarization/installers
- [ ] portable Linux distribution bundle with GTK dependencies or equivalent packaging

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
11. GUI input/selection widgets expose transient event values; persistent application state changes only through ordinary semantic `change`.
12. Desktop GUI apps must consume a build-time compiled Patch artifact or checked Native GUI IR; runtime reparsing is legacy compatibility only, not the native build path.
13. Form lifecycle must stay simple and transient: no hidden persistent visibility variable and no framework-style Form object boilerplate.
14. Unsupported native controls and containers fail closed during Native GUI IR preflight rather than being dropped or triggering an implicit Electron fallback.
15. Tabs page selection is transient renderer state unless a future explicit language contract deliberately exposes it.
