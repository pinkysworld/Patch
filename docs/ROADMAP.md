# Patch roadmap

Current development beta: **0.2.0-beta.36**

This roadmap is the concise current product-status view. `docs/RAD_STUDIO_MASTER_BACKLOG.md` owns the longer RAD execution backlog. Repository-controlled implementation is kept separate from release, credential and external-evidence gates.

## Current product contract

- Patch package: **0.2.0-beta.36**
- public product surface: **0.2 beta.36+**
- Change IR: **0.10**
- Native GUI IR: **1.7**
- current sealed native GUI payload: **v17**
- current token-free Ready/offline runtime: **v1.8** on Windows, macOS and Linux
- Studio project format: **multi-file/resource bundle v4**
- Component Registry: **0.8**
- Offline Studio manifest: **v1**, rolling channel **`offline-studio-v0.2`**
- Offline Compiler rolling channel: **`offline-compiler-v0.2`**
- formal runtime-correspondence milestone: **beta.32**

`src/native-current-contract.js` remains the authoritative product-facing native boundary. New native contracts do not become Ready merely because their implementation tests are green.

### Preserved native compatibility evidence

Older versioned contracts remain reproducibility and compatibility evidence even when they are not product defaults. In particular, the frozen **Native GUI IR 0.8 / payload v9 / runtime v1.0 Table line** remains the direct-Table compatibility origin. The frozen TreeView compatibility line: Native GUI IR **1.2** / payload **v12** / runtime **v1.3** remains preserved as well. Retaining these lines is intentional and does not make them current targets; they preserve the historical backend/runtime evidence that later native contracts build on.

## Implemented next native contracts

Two additive desktop lines are implemented beyond Current Ready:

- **Native GUI IR 1.8 / payload v18 / runtime v1.9**: Button `ImageList` asset transport plus Win32, AppKit and GTK Button-image consumers. The complete prior v1.8 runtime behavior is preserved underneath it.
- **Native GUI IR 1.9 / payload v19 / runtime v1.10**: application/Form Window-icon transport and Win32, AppKit and GTK consumers over the complete Button/ImageList line.

The Window-icon line also has platform packaging evidence:

- `native-window-icon-packaging/0.1` produces deterministic cross-platform application-icon artifacts;
- `native-window-icon-package-v110/0.2` builds the experimental v1.10 package plans;
- `windows-pe-icon-v110/0.1` embeds the project application icon into a fixed reserved Windows PE resource slot without moving sections or changing executable length;
- the normal Windows runtime-v1.10 template carries and verifies that reserved slot;
- Windows CI verifies the same packaged EXE with `ExtractAssociatedIcon` and `--patch-smoke`;
- macOS packaging emits `.icns` + `CFBundleIconFile` inside an `.app` plan;
- Linux packaging emits hicolor PNG + `.desktop` metadata;
- Windows/macOS/Linux runtime and package-contract workflows are green.

These lines remain **experimental next contracts** until the release/digest/Offline-Compiler promotion gate is complete.

## Current product milestone: RAD R0 hardening + native R1 promotion

The two previously open native R1 resource-consumer implementations are now complete. Near-term work is therefore split between:

1. completing the remaining R0 Studio architecture/reliability work;
2. promoting the already implemented IR 1.9 / payload v19 / runtime v1.10 stack through release assets, digests, Offline Compiler linking and product metadata;
3. starting Offline Studio Stage 2 local-native-build integration;
4. moving into broader R2+ RAD parity only after those boundaries are stable.

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

Remaining R0 work:

- [ ] virtualize very large Table/Tree previews where measurements justify it
- [ ] define and implement a versioned Worker boundary for parse/compile/design-model work
- [ ] bound any remaining design-time expression evaluation
- [ ] extend incremental reconciliation to adapter-owned top-level controls where a canonical adapter state contract exists
- [ ] split runtime lifecycle, Window rendering, transient UI state and Build controller out of `web/playground.js`
- [ ] make Pages deployment release-aware so expected runtime-publication races do not generate failure noise
- [ ] reduce CI notification noise and shrink Offline Compiler triggers to the real dependency closure

## RAD R1 graphics/resources status

Implemented:

- [x] project bundle v4 resource inventory and Resource Manager
- [x] PNG/JPEG/WebP/SVG Studio/Web project resources
- [x] Picture source-backed authoring and Standalone Web embedding
- [x] native PNG/JPEG Picture decoding with explicit deferred WebP/SVG policy
- [x] Shape native lowering/runtime parity through preserved IR 1.5+
- [x] PaintBox native parity through IR 1.6+
- [x] PaintBox `draw image` through Current Ready IR 1.7 / payload v17 / runtime v1.8
- [x] ImageList Stage 1 authoring/Web consumer and `native-imagelist-asset-plan/0.1`
- [x] ImageList/Button native transport through IR 1.8 / payload v18 / runtime v1.9
- [x] Win32/AppKit/GTK Button ImageList consumers
- [x] source/Web Window icon contract `window-icon/1.0`
- [x] native Window icon transport through IR 1.9 / payload v19 / runtime v1.10
- [x] Win32/AppKit/GTK runtime Window-icon consumers
- [x] Windows PE, macOS app-bundle and Linux desktop application-icon packaging contracts
- [x] generated component capability matrix infrastructure

Still open inside the broader R1/R2 product surface:

- [ ] promote the implemented next native line into Current Ready only after release/integrity gates
- [ ] extend ImageList transport to ToolBar/ToolButton/Menu/Tree consumers only when those component contracts exist
- [ ] PWA icon-set generation and visual application-branding editor
- [ ] richer Picture native display-property combinations only through a new explicit versioned contract
- [ ] PaintBox pointer/path/transform/gradient expansion

## Native promotion gate

Before `src/native-current-contract.js` can move from **1.7 / 17 / 1.8** to **1.9 / 19 / 1.10**:

- [x] IR 1.8 / payload v18 / runtime v1.9 Button/ImageList implementation
- [x] IR 1.9 / payload v19 / runtime v1.10 Window-icon implementation
- [x] Win32/AppKit/GTK v1.10 runtime smoke evidence
- [x] deterministic Windows/macOS/Linux application-icon package plans
- [x] self-contained Windows PE icon embedding and real Windows extraction evidence
- [x] standard Windows v1.10 runtime artifact carries the reserved PE icon slot
- [ ] publish versioned v1.10 runtime release assets
- [ ] publish and verify SHA-256 digests for those assets
- [ ] switch browser/native build runtime lookup to the verified v1.10 assets
- [ ] switch Offline Compiler linking to payload v19/runtime v1.10
- [ ] update generated capability metadata and public release/download surfaces
- [ ] only then change `src/native-current-contract.js`

The Current Ready line remains 1.7 / 17 / 1.8 until every unchecked item above is complete.

## RAD R2: Form Designer parity

After the R0 architecture and native-promotion gates are stable:

- [ ] independent source-backed `TabOrder` that does not alter source/z-order
- [ ] visual Tab Order mode
- [ ] richer smart-guide configuration beyond the current grid/alignment guides
- [ ] source-backed clipboard schema for copy/cut/paste across Forms/projects
- [ ] Lock Controls and design-only guide visibility
- [ ] Layers/Object Tree for visual z-order and containment
- [ ] complete Panel Stage 2 native child containment with relative coordinates, clipping and nested Panels

## RAD R3-R6: component and project expansion

Near-term component/project priorities after R2:

- [ ] GroupBox, ScrollBox and SplitContainer
- [ ] Memo/TextArea, PasswordEdit, ProgressBar, SpinEdit/NumberEdit, Date/Time controls
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

### Stage 2: fully local native IDE

- [ ] embed/install the offline compiler and host-native sealed runtimes beside Offline Studio
- [ ] authenticated narrow localhost build bridge rather than a general shell API
- [ ] host-native local Windows/macOS/Linux builds without GitHub or network access
- [ ] artifact pane integration for outputs, diagnostics and checksums
- [ ] explicit local-vs-remote build selector, with local as the offline path

### Stage 3: installed-IDE integration

- [ ] direct project-folder/file open/save with workspace permission boundaries
- [ ] recent projects/file associations and OS integration
- [ ] packaged installers/uninstall path
- [ ] optional updates that never block offline use

## Desktop / distribution status

Implemented repository-controlled surface:

- [x] Current Ready Windows/macOS/Linux Console and Window packages
- [x] direct-native Win32/AppKit/GTK backends
- [x] token-free Current Ready runtime v1.8 release workflows
- [x] browser runtime templates verified against release SHA-256 digests before sealing
- [x] downloadable Offline Compiler kits
- [x] downloadable Offline Studio Stage 1 channel
- [x] fail-closed Windows signing and macOS signing/notarization machinery
- [x] experimental v1.10 cross-platform Window-icon runtime/package implementation

External or future distribution work:

- [ ] real credentialed Windows signing evidence
- [ ] real credentialed macOS signing/notarization evidence
- [ ] production-signed/notarized Offline Studio release evidence
- [ ] installer/package formats with explicit uninstall path
- [ ] release-integrity verification across future installer/update channels
- [ ] fresh remote native build service without a user-supplied GitHub token
- [ ] fully local Offline Studio native build bridge
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
- **beta.36:** project bundle v4 resources, Current Ready progression through Native GUI IR 1.7 / payload v17 / runtime v1.8, expanded RAD authoring and graphics/resource R1 work
- **beta.36+ experimental:** Button/ImageList IR 1.8 / payload v18 / runtime v1.9 and Window-icon IR 1.9 / payload v19 / runtime v1.10, including cross-platform application-icon packaging and Windows PE embedding
- **current:** R0 architecture hardening, native v1.10 release/Offline-Compiler promotion, Offline Studio Stage 2, then broader R2 expansion
