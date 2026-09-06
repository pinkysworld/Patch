# Patch roadmap

Current development beta: **0.2.0-beta.36**

This roadmap is the concise current product-status view. `docs/RAD_STUDIO_MASTER_BACKLOG.md` owns the longer RAD execution backlog. Repository-controlled implementation is kept separate from release, credential and external-evidence gates.

## Current product contract

- Patch package: **0.2.0-beta.36**
- public product surface: **0.2 beta.36+**
- Change IR: **0.10**
- Native GUI IR: **1.9**
- current sealed native GUI payload: **v19**
- current token-free Ready/offline runtime: **v1.10** on Windows, macOS and Linux
- Studio project format: **multi-file/resource bundle v4**
- Component Registry: **0.10**
- Offline Studio manifest: **v1**, rolling channel **`offline-studio-v0.2`**
- Offline Compiler rolling channel: **`offline-compiler-v0.2`**
- formal runtime-correspondence milestone: **beta.32**

`src/native-current-contract.js` is the authoritative product-facing native boundary. Native contracts become Ready only after their cross-platform runtime, release-integrity, packaging and Offline Compiler gates pass.

### Preserved native compatibility evidence

Older versioned contracts remain reproducibility and compatibility evidence even when they are not product defaults. In particular, the frozen **Native GUI IR 0.8 / payload v9 / runtime v1.0 Table line** and **Native GUI IR 1.2 / payload v12 / runtime v1.3 TreeView line** remain preserved. Payload v17/runtime v1.8 also remains available as an explicit Offline Compiler compatibility path after the v1.10 promotion. Retaining these lines is intentional and does not make them current targets.

## Promoted native stack

The additive desktop stack is now Current Ready:

- **Native GUI IR 1.8 / payload v18 / runtime v1.9** introduced Button `ImageList` asset transport plus Win32, AppKit and GTK Button-image consumers.
- **Native GUI IR 1.9 / payload v19 / runtime v1.10** adds application/Form Window-icon transport and Win32, AppKit and GTK consumers over the complete Button/ImageList line.

The Current Ready Window-icon line includes platform packaging evidence:

- `native-window-icon-packaging/0.1` produces deterministic cross-platform application-icon artifacts;
- `native-window-icon-package-v110/0.2` builds the Current Ready v1.10 package plans;
- `windows-pe-icon-v110/0.1` embeds the project application icon into a fixed reserved Windows PE resource slot without moving sections or changing executable length;
- the normal Windows runtime-v1.10 template carries and verifies that reserved slot;
- Windows CI verifies the packaged EXE with `ExtractAssociatedIcon` and `--patch-smoke`;
- macOS packaging emits `.icns` + `CFBundleIconFile` inside the `.app` plan;
- Linux packaging emits hicolor PNG + `.desktop` metadata;
- immutable v1.10 runtime release assets, SHA-256/GitHub digests and source-commit binding are verified;
- the normal Offline Compiler carries Current Ready v1.10 plus a separate v1.8 compatibility underlay;
- Windows, Linux, macOS Apple Silicon and macOS Intel promotion smokes are green.

## Current product milestone: RAD R0 hardening + R2/R4 follow-through

The native R1 promotion gate is complete. Near-term work is now split between:

1. completing the remaining R0 Studio architecture/reliability work;
2. extending the now-shipped R2 Designer workflow contracts and Panel Stage 2 foundation without weakening the promoted native boundary;
3. extending Offline Studio Stage 2 local-native-build integration;
4. moving through R4 component parity with explicit Studio/Web contracts and fail-closed native boundaries until a later native contract is promoted.

### RAD R0 architecture hardening (#282)

Completed foundations include:

- [x] Run reuses the compiler AST and Change IR formatting is lazy
- [x] declaration-only `studio-design-model/0.1`
- [x] bounded `studio-design-cache/0.1`
- [x] primary `refreshDesigner()` consumes the shared declaration-only design cache
- [x] shared `studio-design-snapshots/0.1`
- [x] `studio-form-materialization/0.1` with one active fully materialized Designer Form
- [x] keyed runtime Form/control identities and `keyed-control-v2`
- [x] bounded transient Table/Tree selection restoration
- [x] deterministic full-render diagnostics fallback
- [x] real-Chrome Workshop and 10-Form/200-control performance gates
- [x] local Tabs reconciliation
- [x] Designer selection/Object Inspector/structural-editor state survives Form materialization transitions
- [x] Build controller and Studio Window renderer extracted from the main playground orchestration path

Remaining R0 work:

- [ ] virtualize very large Table/Tree previews where measurements justify it
- [ ] define and implement a versioned Worker boundary for parse/compile/design-model work
- [ ] bound any remaining design-time expression evaluation
- [ ] extend incremental reconciliation to adapter-owned top-level controls where a canonical adapter state contract exists
- [ ] finish extracting runtime lifecycle and remaining transient UI state from `web/playground.js`
- [ ] make Pages deployment release-aware so expected runtime-publication races do not generate failure noise
- [ ] reduce CI notification noise and shrink Offline Compiler triggers to the real dependency closure

## RAD R1 graphics/resources status

Implemented:

- [x] project bundle v4 resource inventory and Resource Manager
- [x] Resource Manager drag-to-Form Picture placement plus keyboard/touch `Place on Form`
- [x] PNG/JPEG/WebP/SVG Studio/Web project resources
- [x] Picture source-backed authoring and Standalone Web embedding
- [x] native PNG/JPEG Picture decoding with explicit deferred WebP/SVG policy
- [x] Shape native lowering/runtime parity through preserved IR 1.5+
- [x] PaintBox native parity through IR 1.6+
- [x] PaintBox `draw image`, introduced in IR 1.7/payload v17/runtime v1.8 and preserved in Current Ready 1.9/19/1.10
- [x] ImageList Stage 1 authoring/Web consumer and `native-imagelist-asset-plan/0.1`
- [x] ImageList/Button native transport through IR 1.8 / payload v18 / runtime v1.9
- [x] Win32/AppKit/GTK Button ImageList consumers
- [x] source/Web Window icon contract `window-icon/1.0`
- [x] native Window icon transport through IR 1.9 / payload v19 / runtime v1.10
- [x] Win32/AppKit/GTK runtime Window-icon consumers
- [x] Windows PE, macOS app-bundle and Linux desktop application-icon packaging contracts
- [x] generated component capability matrix infrastructure
- [x] Current Ready promotion to IR 1.9 / payload v19 / runtime v1.10
- [x] circular shared Studio compiler mark with explicit browser clipping and refreshed non-maskable PWA icon contract

Still open inside the broader R1/R2 product surface:

- [ ] extend ImageList transport to ToolBar/ToolButton/Menu/Tree consumers only when those component contracts exist
- [ ] PWA icon-set generation and visual application-branding editor
- [ ] richer Picture native display-property combinations only through a new explicit versioned contract
- [ ] PaintBox pointer/path/transform/gradient expansion

## Native promotion gate

The promotion from **1.7 / 17 / 1.8** to **1.9 / 19 / 1.10** is complete:

- [x] IR 1.8 / payload v18 / runtime v1.9 Button/ImageList implementation
- [x] IR 1.9 / payload v19 / runtime v1.10 Window-icon implementation
- [x] Win32/AppKit/GTK v1.10 runtime smoke evidence
- [x] deterministic Windows/macOS/Linux application-icon package plans
- [x] self-contained Windows PE icon embedding and real Windows extraction evidence
- [x] standard Windows v1.10 runtime artifact carries the reserved PE icon slot
- [x] versioned v1.10 runtime release assets published
- [x] SHA-256, GitHub asset digests and release source binding verified
- [x] browser/native build runtime lookup switched to verified v1.10 assets
- [x] Offline Compiler defaults to payload v19/runtime v1.10 while retaining explicit v17/v1.8 compatibility
- [x] generated capability metadata and public product surfaces moved to the promoted contract
- [x] `src/native-current-contract.js` moved to 1.9 / 19 / 1.10

Future native feature work must use a new explicit versioned contract rather than widening v19 in place.

## RAD R2: Form Designer parity

Implemented:

- [x] independent source-backed `TabOrder` that does not alter source/z-order
- [x] visual Tab Order editor with keyboard reordering and reset-to-source-order
- [x] source-backed clipboard schema for copy/cut/paste across Forms/projects with id/event remapping
- [x] duplicate-with-offset and optional copied event handlers
- [x] Lock Controls with source-backed `# @locked` metadata
- [x] design-grid visibility/snap preference and smart alignment guides
- [x] Layers/Object Tree for visual z-order and Panel/Tabs containment inspection
- [x] Panel Stage 2 source-backed child coordinates relative to the Panel content area
- [x] mixed legacy-flow and positioned Panel children in Studio and Standalone Web DOM rendering
- [x] Current Ready native fails closed for positioned Panel children instead of flattening them silently
- [x] presentation metadata participates in the same source-backed lifecycle for Layout, TabOrder, Locked, delete, clipboard and duplicate

Still open:

- [ ] richer smart-guide configuration beyond the current grid/alignment guides
- [ ] Panel child Anchors/Dock relative to their container
- [ ] nested Panels
- [ ] visual move/reparent into and out of Panels
- [ ] true native Panel parent-child containment and clipping parity through a new explicit native contract

## RAD R4-R6: component and project expansion

Implemented R4 Stage 1 surfaces:

- [x] Memo/TextArea source-backed Studio/Web control with `changed(value)` and explicit native fail-closed boundary
- [x] PasswordEdit as `# @input-mode password` presentation of ordinary Input, Studio/Web supported and Current Ready native fail-closed
- [x] MaskedEdit as `# @input-mask "..."` presentation of ordinary Input, Studio/Web supported and Current Ready native fail-closed
- [x] CheckedListBox as `# @listbox-mode checked` presentation of list-backed ListBox, Studio/Web supported and Current Ready native fail-closed
- [x] ProgressBar as passive number-backed Slider presentation via `# @slider-mode progress`, Studio/Web supported with no control event and Current Ready native fail-closed
- [x] canonical Project-v4 Patch Studio Showcase covers the complete current Registry 0.10 Studio/Web surface, including current R4 presentation presets, and is explicitly loadable in hosted and Offline Studio

Next component/project priorities:

- [ ] GroupBox, ScrollBox and SplitContainer
- [ ] SpinEdit/NumberEdit and Date/Time controls
- [ ] richer TreeView/ListView/Table metadata and image bindings
- [ ] ToolBar / ToolButton / PopupMenu
- [ ] ActionList-style reusable commands
- [ ] nonvisual standard dialogs
- [ ] Project Explorer 2.0 with resources/build configurations/dependencies
- [ ] Project Settings, application branding and templates

See `docs/RAD_STUDIO_MASTER_BACKLOG.md` for the full long-term sequence.

## RAD R7-R14: professional IDE and ecosystem

Longer-term work includes:

- [ ] syntax highlighting and semantic completion
- [ ] go to definition / find references / rename / formatting / quick fixes
- [ ] breakpoint debugger with Step Into/Over/Out
- [ ] Patch semantic event/change timeline and state inspection
- [ ] safe hot reload
- [ ] property/data binding contracts
- [ ] dockable/persisted IDE layouts
- [ ] integrated tests and UI test tooling
- [ ] package/component ecosystem
- [ ] localization and accessibility inspection

## Offline IDE track

### Stage 1: implemented downloadable IDE beta

- [x] deterministic Offline Studio manifest v1
- [x] self-contained Node SEA builder using the generated hosted Studio application
- [x] loopback-only runtime and restrictive local security boundary
- [x] Windows x64, macOS Apple Silicon and Linux x64 self-smoked executables
- [x] exact release-bundle manifest equality and SHA-256 gate
- [x] rolling `offline-studio-v0.2` release assets
- [x] public Downloads/README/docs asset contract

Production Authenticode / Developer ID signing and macOS notarization remain external credential gates.

### Stage 2: local native-build integration

Implemented repository-controlled Stage 2 foundation:

- [x] authenticated narrow localhost build bridge rather than a general shell API
- [x] project-v4 workspace snapshots with resource integrity validation
- [x] installed host build path for supported desktop hosts
- [x] structured compiler diagnostics returned to the browser client
- [x] Windows x64, Linux x64 and macOS Apple Silicon self-smoke installed-build paths
- [x] Intel macOS runtime kit, Windows ARM64/Linux ARM64 bounded fallbacks and FreeBSD portable compatibility evidence
- [x] deterministic cross-platform Offline Studio release-bundle verification

Still open:

- [ ] complete user-facing artifact-pane integration for outputs, diagnostics and checksums
- [ ] explicit local-vs-remote build selector, with local as the offline path
- [ ] broaden host-native local build coverage only where a real supported host compiler/runtime exists

### Stage 3: installed-IDE integration

- [ ] direct project-folder/file open/save with workspace permission boundaries
- [ ] recent projects/file associations and OS integration
- [ ] packaged installers/uninstall path
- [ ] optional updates that never block offline use

## Desktop / distribution status

Implemented repository-controlled surface:

- [x] Current Ready Windows/macOS/Linux Console and Window packages
- [x] direct-native Win32/AppKit/GTK backends
- [x] token-free Current Ready runtime v1.10 release workflows
- [x] browser runtime templates verified against release SHA-256/GitHub digests before sealing
- [x] downloadable dual-runtime Offline Compiler kits
- [x] downloadable Offline Studio Stage 1 channel
- [x] fail-closed Windows signing and macOS signing/notarization machinery
- [x] Current Ready v1.10 cross-platform Window-icon runtime/package implementation

External or future distribution work:

- [ ] real credentialed Windows signing evidence
- [ ] real credentialed macOS signing/notarization evidence
- [ ] production-signed/notarized Offline Studio release evidence
- [ ] installer/package formats with explicit uninstall path
- [ ] release-integrity verification across future installer/update channels
- [ ] fresh remote native build service without a user-supplied GitHub token
- [ ] broader fully local Offline Studio host-native build coverage
- [ ] FreeBSD native GUI backend
- [ ] more self-contained Linux distribution formats where deployment evidence justifies them
- [ ] manual assistive-technology validation before any accessibility-conformance claim

## Compiler / language / assurance infrastructure

Implemented evidence includes Change IR 0.10, semantic Change Signatures, magnitude-aware authority, exact positional binding, range certificates, guard-aware/transitive call traces, call-aware direct Wasm correspondence, independently reconstructed invocation frames, deterministic grammar fuzzing, Interpreter/direct-Wasm/C99 differential testing, semantic-authority security ablation and commit-bound reproducibility bundles.

The formal runtime-correspondence milestone remains **beta.32**. Later Studio/native work does not silently widen its proof claim.

## Research evidence gates

Repository-side infrastructure is implemented for controlled evaluation, aggregation, reproducibility, internal application corpora and literature-grounded comparison dimensions. Still requiring new data or external participation:

- [ ] controlled paper-quality benchmark runs on fixed hardware
- [ ] statistical model/plots over the controlled dataset
- [ ] measured results synchronized into the manuscript
- [ ] genuine external/third-party plugin or extension integration study
- [ ] expert/venue feedback on architectural distinctness and usefulness

No empirical performance result is claimed until the corresponding measurements exist.

## Milestone history

- **beta.25-27:** finite call composition, exact binding and quantitative range evidence
- **beta.28-29:** structured and guard-aware exact callee traces
- **beta.30:** finite transitive exact call-tree traces
- **beta.31:** first call-aware direct-Wasm correspondence
- **beta.32:** independently reconstructed invocation frames and repeated-call correspondence
- **beta.33:** Studio/project/recovery/diagnostics production-readiness layer
- **beta.34:** canonical Studio state and runtime-integrity hardening
- **beta.35:** list-backed multi-select ListBox across browser and native lines
- **beta.35+ foundation:** multi-file bundle v3, completed Designer structure workflows, Table/TreeView/Tabs and Slider/native runtime v1.4
- **beta.36:** project bundle v4 resources, native progression through PaintBox/image IR 1.7 / payload v17 / runtime v1.8, expanded RAD authoring and graphics/resource R1 work
- **beta.36+ promoted:** Button/ImageList IR 1.8 / payload v18 / runtime v1.9 and Window-icon IR 1.9 / payload v19 / runtime v1.10, including cross-platform application-icon packaging, Windows PE embedding, immutable runtime release verification and dual-runtime Offline Compiler promotion
- **current:** R0 architecture hardening, Resource Manager drag-to-Form, Panel Stage 2 source/Web foundation, Offline Studio Stage 2 host-build integration, Registry 0.10, hosted/offline Project-v4 Showcase loading, and R4 Memo/PasswordEdit/MaskedEdit/CheckedListBox/ProgressBar Stage 1 with explicit native fail-closed boundaries
