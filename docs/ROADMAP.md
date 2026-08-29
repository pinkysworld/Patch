# Patch roadmap

Current development beta: **0.2.0-beta.36**

This roadmap separates repository-controlled product work from credential/manual distribution work and research evidence that cannot be manufactured by CI.

## Current contract

- Patch package: **0.2.0-beta.36**
- public product surface: **0.2 beta.36+**
- Change IR: **0.10**
- Native GUI IR: **1.7**
- current sealed native GUI payload: **v17**
- current token-free Ready/offline runtime: **v1.8** on Windows, macOS and Linux
- Studio design model/cache: **0.1**, with primary browser Designer refresh using the declaration-only cached snapshot path
- Studio Form materialization: **0.1**, with exactly one active Designer Form fully materialized and inactive Forms retained as lightweight source-backed shells
- native ImageList asset pretransport plan: **0.1** (not a Ready native runtime contract)
- Offline Studio manifest: **v1**, rolling Stage 1 release channel **`offline-studio-v0.2`**
- previous PaintBox Stage 1 line: Native GUI IR **1.6** / payload **v16** / runtime **v1.7**
- previous Shape line: Native GUI IR **1.5** / payload **v15** / runtime **v1.6**
- previous Chrome line: Native GUI IR **1.4** / payload **v14** / runtime **v1.5**
- frozen TreeView compatibility line: Native GUI IR **1.2** / payload **v12** / runtime **v1.3**
- previous Slider compatibility line: Native GUI IR **1.3** / payload **v13** / runtime **v1.4**
- Studio project format: **multi-file/resource bundle v4** with explicit v1-v3 migration
- Component Registry: **0.8**
- formal runtime-correspondence milestone: **beta.32**

Product, Studio and native work after beta.32 does not widen the formal assurance claim.

### Preserved native compatibility evidence

Older versioned native contracts remain reproducibility/compatibility evidence even when they are no longer product defaults. In particular, the **Native GUI IR 0.8 / payload v9 / runtime v1.0 Table line** remains the frozen Table compatibility origin. Its platform evidence is preserved separately from the current Native GUI IR 1.7 / payload v17 / runtime v1.8 product line. Retaining this history is intentional and does not make payload v9 or runtime v1.0 current targets.

## Current product milestone: RAD R0 hardening + final RAD R1 parity

Patch Studio has enough component breadth that responsiveness and architecture now gate further RAD expansion. Work therefore proceeds on **R0 architecture hardening (#282)** in parallel with the final two **R1 native resource-consumer** gaps. R2 should not become the primary focus until the R0 Designer/runtime boundaries are stable.

### RAD R0 architecture hardening (#282)

Completed or landed as concrete foundations:

- [x] Studio Run reuses the compiler AST instead of parsing source twice
- [x] Change IR pretty-printing is lazy and only occurs when the IR view is requested
- [x] hidden runtime Forms defer control DOM materialization until opened
- [x] Studio list-backed ListBox multi-selection matches Standalone Web semantics
- [x] Run re-entry guard and transactional runtime replacement
- [x] real-Chrome Workshop regression for the Run/freeze path
- [x] `studio-design-model/0.1`: bounded design-time declaration model that does not execute calls, changes, loops, conditionals, previews or Form visibility actions
- [x] deterministic tests proving the design model retains initial UI state while skipping application behavior
- [x] `studio-design-cache/0.1`: bounded source-revision snapshot cache with Workshop and 10-Form/200-control acceptance coverage
- [x] primary `refreshDesigner()` consumes the shared declaration-only design cache instead of executing the Patch application; hosted/Offline Studio package the same design-model/cache modules
- [x] `studio-form-materialization/0.1`: only the active Designer Form materializes control DOM while inactive Forms remain lightweight shells
- [x] PaintBox, Shape, Panel, StatusBar and Table Designer adapters respect the same active-Form boundary; StatusBar design-time rendering now consumes a declaration-only snapshot rather than executing the application
- [x] real-Chrome Workshop Form 1 → Form 2 → Form 1 switching proves inactive Forms settle with zero Designer controls
- [x] Run yields to the browser task queue before the large compile/execute/render pipeline, keeping the command surface responsive
- [x] Workshop Desk expanded from three to six Forms as the canonical large RAD showcase/stress fixture
- [x] Stage 1 keyed runtime Form/control identities reuse unchanged Form DOM across events and restore bounded focus, caret, scroll and unchanged-model multi-selection state when a changed Form is replaced
- [x] Tabs page switches update only their local tab panel instead of rebuilding the complete runtime window tree

Remaining R0 work:
- [ ] share parsed/compiled AST/design snapshots across Designer adapters by project revision
- [ ] preserve Object Inspector, selection, structural editing and Project Explorer across Form materialization
- [ ] define and implement the Worker boundary for parse/compile/design-model work
- [ ] bounded evaluation policy for any remaining design-time expressions
- [ ] fine-grained keyed control reconciliation inside a changed Form rather than replacing that whole Form shell
- [ ] Workshop click-to-first-app-paint, large-form event-to-paint and Form-switch performance gates
- [ ] split runtime lifecycle, Window rendering, transient UI state and Build controller out of `web/playground.js`
- [ ] make Pages deployment release-aware so expected runtime-publication races do not generate failure noise

### Completed RAD foundation / R1 work

- [x] canonical multi-file Studio project model with deterministic Run/Build composition and `file:line` provenance
- [x] **project bundle v4** with bounded project resources and explicit migration from v1/v2/v3
- [x] project-level Resource Manager for PNG/JPEG/WebP/SVG with logical ids, paths, deterministic SHA-256 metadata, preview and bounded storage
- [x] deterministic resource export/import/recovery persistence
- [x] Picture source-backed Designer authoring and resource picker
- [x] Standalone Web Picture resource embedding
- [x] bounded native PNG/JPEG Picture decoding on Win32/WIC, AppKit/NSImage and GTK/GdkPixbuf with unsupported formats fail-closed
- [x] canonical Component Registry carrying property/event/renderer/target-support metadata
- [x] searchable Component Palette and Object Inspector Properties/Events views
- [x] source-backed Anchors/Dock, multi-select alignment/sizing/distribution, configurable design-grid snap, complete front/back/forward/backward z-order actions and Focus Order Stage 1
- [x] source-backed editor/Designer Undo/Redo transactions for typing and atomic source rewrites
- [x] active-Form full-cost rendering plus deterministic 10-Form / 200-control Studio stress benchmark
- [x] Panel Stage 1, StatusBar and nonvisual Timer authoring
- [x] Shape Stage 1 source syntax, Designer authoring, Standalone Web rendering and native Win32/AppKit/GTK lowering
- [x] PaintBox Stage 1 source syntax, pure `paint` event/drawing commands, Designer/Web rendering and native Win32/AppKit/GTK lowering for clear/line/rectangle/ellipse/text
- [x] PaintBox `draw image` with quoted `patch-resource:` / `data:` locators, Studio/Web rendering and native PNG/JPEG transport on Win32/AppKit/GTK through IR 1.7 / payload v17 / runtime v1.8
- [x] ImageList Stage 1 source syntax, compiler transport, registry metadata, nonvisual tray and Resource Manager-backed Object Inspector
- [x] ImageList Web metadata for Button `image list.item`; current Native GUI IR 1.7 still fails closed for ImageList and Button images
- [x] deterministic `native-imagelist-asset-plan/0.1` resolving used Button ImageList assets, deduplicating payloads and enforcing the existing PNG/JPEG native picture policy without widening Native GUI IR 1.7
- [x] application/window icon source declaration and Studio/Web favicon/chrome packaging under `window-icon/1.0`; current Native GUI IR 1.7 remains fail-closed
- [x] generated component capability matrix from canonical registry metadata
- [x] content-addressed public site, PWA/offline closure validation and real Chrome startup/responsiveness gate
- [x] token-free Ready/offline Native GUI IR 1.7 / payload v17 / runtime v1.8 Windows/macOS/Linux paths
- [x] Command Palette, project-file/symbol quick-open, editor tabs, Workspace Layout v2 and startup diagnostics v2
- [x] six-Form Workshop Desk acceptance showcase covering every integrated cross-platform Ready visual/control family, including PaintBox `draw image`, while native-fail-closed ImageList/Button-image and Window-icon consumers remain separate demonstrations

### RAD R1 remaining work

These are real remaining gaps and must not be advertised as complete until their target tests are green.

- [x] Picture display properties: fit/scale mode, proportional/aspect behavior, center, opacity and accessible description across authoring/Web; current native Ready keeps default contain/centered/opaque PictureBox and fail-closes unsupported display combinations
- [x] decide and version native SVG/WebP policy rather than broadening format support implicitly (`native-picture-formats/1.0`: Ready PNG/JPEG, deferred WebP/SVG, no IR bump)
- [x] first ImageList consumer: Button `image list.item` on Studio/Web; current Native GUI IR 1.7 fail-closes ImageList and Button images
- [x] native ImageList pretransport resource planner with validation/deduplication; this is preparation only and does not count as desktop support
- [x] component capability matrix generated from canonical registry metadata rather than duplicated documentation
- [x] application/window icon resource packaging (`window-icon/1.0`: source-backed Form icon and Web favicon; current native Ready fail-closes)
- [x] Shape native lowering/runtime parity for Win32, AppKit and GTK (IR 1.5 / payload v15 / runtime v1.6, preserved by current IR 1.7)
- [x] PaintBox drawing-command contract and native lowering/runtime parity for Win32, AppKit and GTK (IR 1.6 / payload v16 / runtime v1.7)
- [x] PaintBox `draw image` resource consumption with native PNG/JPEG parity (IR 1.7 / payload v17 / runtime v1.8)
- [ ] version and transport ImageList/Button assets through the next Native GUI IR/payload/runtime line, then implement Win32/AppKit/GTK consumers
- [ ] extend the same ImageList transport to ToolBar/ToolButton only when those controls exist; no empty standalone ImageList native claim
- [ ] native application/window icon packaging for Win32 `.ico`, AppKit and Linux desktop after a versioned native contract

## RAD R2: Form Designer parity

After the R0 architecture gate is stable and R1 is closed:

- [ ] independent source-backed `TabOrder` that does not alter source/z-order
- [ ] visual Tab Order mode
- [ ] richer smart-guide configuration beyond the current grid/alignment guides
- [ ] source-backed clipboard schema for copy/cut/paste across Forms/projects
- [ ] Lock Controls and design-only guide visibility
- [ ] Layers/Object Tree for visual z-order and containment
- [ ] complete Panel Stage 2 native child containment with relative coordinates, clipping and nested Panels

## RAD R3-R6: component and project expansion

See `docs/RAD_STUDIO_MASTER_BACKLOG.md` for the complete long-term list. Near-term priorities are:

- [ ] GroupBox, ScrollBox and SplitContainer
- [ ] Memo/TextArea, PasswordEdit, ProgressBar, SpinEdit/NumberEdit, Date/Time controls
- [ ] richer TreeView/ListView/Table metadata and image bindings
- [ ] ToolBar / ToolButton / PopupMenu
- [ ] ActionList-style reusable commands
- [ ] nonvisual standard dialogs
- [ ] Project Explorer 2.0 with resources/build configurations/dependencies
- [ ] project settings, application branding and templates

## RAD R7-R11: professional IDE

- [ ] syntax highlighting and semantic completion
- [ ] go to definition / find references / rename
- [ ] formatting and quick fixes
- [ ] breakpoint debugger with Step Into/Over/Out
- [ ] Patch semantic change/event timeline
- [ ] watch/locals/state inspection
- [ ] safe hot reload boundary
- [ ] property/data binding contracts
- [ ] dockable/persisted IDE layouts
- [ ] package/component ecosystem

## Offline IDE track

Patch Studio is available as an installed/offline Stage 1 beta, not only as a hosted PWA. See `docs/OFFLINE_STUDIO.md` and the public Downloads page.

### Stage 1 repository-controlled release channel

- [x] deterministic Offline Studio manifest v1 with per-file SHA-256 and whole-site closure hash
- [x] self-contained Node SEA builder using the generated Patch Studio site as the single UI implementation
- [x] loopback-only `127.0.0.1` runtime with random per-launch URL prefix, traversal protection and restrictive CSP
- [x] no outbound network requirement for authoring, Designer/Run and existing browser-local build targets
- [x] manifest/closure regression tests independent of SEA availability
- [x] Windows x64, macOS Apple Silicon and Linux x64 executables built and self-smoked on their own CI platform
- [x] exact release bundle assembled and cross-platform manifest equality checked before merge/publication
- [x] rolling **`offline-studio-v0.2`** GitHub Release assets with stable names, `offline-studio-manifest.json` and `SHA256SUMS`
- [x] public Downloads page and README/Patch Studio docs reference the same release asset contract
- [ ] production Authenticode / Developer ID signing and macOS notarization for Offline Studio releases

Stage 1 is a downloadable Offline IDE beta for authoring, Designer/Run and current browser-local build targets. It does not yet claim host-native desktop compilation from inside the IDE.

### Stage 2 fully local native IDE

- [ ] embed/install the current offline compiler and host-native sealed GUI runtime beside Offline Studio
- [ ] authenticated, narrow localhost build bridge rather than a general shell API
- [ ] host-native local Windows/macOS/Linux app builds without GitHub or network access
- [ ] artifact pane integration for local outputs, diagnostics and checksums
- [ ] explicit local-vs-remote build selector, with local as the offline path

### Stage 3 installed-IDE integration

- [ ] direct project-folder/file open/save with workspace permission boundaries
- [ ] recent projects/file associations and OS integration
- [ ] packaged installers/uninstall path
- [ ] optional updates that never block offline use

## Desktop / distribution status

### Implemented repository-controlled surface

- [x] Ready Windows/macOS/Linux Console packages
- [x] Ready Windows/macOS/Linux Window packages for the current native GUI surface
- [x] direct-native Win32/AppKit/GTK backends
- [x] token-free runtime v1.8 release workflows for Windows/macOS/Linux
- [x] ordinary offline `patch link` defaults to payload v17/runtime v1.8
- [x] browser Ready runtime templates verified against GitHub Release SHA-256 digests before sealing
- [x] downloadable offline compiler/linker for Windows, macOS and Linux plus FreeBSD portable C99 kit
- [x] downloadable and CI-self-smoked Offline Studio Stage 1 release channel for Windows x64, macOS ARM64 and Linux x64
- [x] deterministic Offline Studio manifest equality and SHA-256 release-bundle gate
- [x] fail-closed Windows signing and macOS signing/notarization machinery
- [x] truthful Pages deployment status with required-runtime checks, HTTP asset verification and live Chrome behavior verification

### Externally gated / not-yet-complete distribution work

- [ ] real credentialed Windows signing evidence
- [ ] real credentialed macOS signing/notarization evidence
- [ ] production-signed/notarized Offline Studio release evidence
- [ ] installer/package formats with explicit uninstall path after a distribution-format decision
- [ ] release-integrity verification across any future installer/update channel
- [ ] fresh remote native build service without a user-supplied GitHub token
- [ ] fully local Offline Studio native build bridge (Stage 2)
- [ ] FreeBSD native GUI backend
- [ ] more self-contained Linux distribution formats where deployment evidence justifies them
- [ ] manual assistive-technology validation with Narrator, VoiceOver, Orca or comparable tools; no WCAG conformance claim is made without that work

## Compiler / language / assurance infrastructure

- [x] Change IR **0.10** with semantic Change Signatures and magnitude-aware authority
- [x] exact safe-integer positional binding and quantitative effect refinement
- [x] integer `RangeExpr` arithmetic certificate coverage
- [x] guard-aware structured callee traces
- [x] finite transitive exact call-tree traces
- [x] call-aware direct-Wasm bridge
- [x] beta.32 independently reconstructed invocation frames including repeated identical calls
- [x] mixed-guard repeated-call regression and Lean re-checking
- [x] raw-source static call-site identity validation
- [x] deterministic grammar fuzzing and Interpreter/direct-Wasm/C99 differential corpus
- [x] commit-bound reproducibility bundle
- [x] semantic-authority security ablation
- [x] internally authored checkout/loyalty and usage/quota extension corpus
- [x] process-isolated controlled-measurement protocol and aggregation tooling

## Research evidence gates

### Controlled evaluation

- [x] deterministic depth/invocation corpus
- [x] compiler / execution / independent validation / correspondence / certificate-generation timing harness
- [x] raw samples plus min/median/mean/p95/max and robust Q1/Q3/MAD/IQR aggregation
- [x] environment/commit/scenario consistency checks
- [x] explicit `development` / `hosted-ci` / `controlled` measurement classes
- [x] fixed-machine procedure in `docs/CONTROLLED_EVALUATION.md`
- [ ] controlled paper-quality benchmark runs on fixed hardware
- [ ] statistical model/plots over the controlled dataset
- [ ] measured results synchronized into the manuscript

No empirical performance result is claimed until those measurements actually exist.

### External integration evidence

- [x] internally authored multi-domain checkout/loyalty and usage/quota application corpus
- [x] literature-grounded comparison dimensions in `docs/RELATED_WORK.md`
- [ ] genuine external/third-party plugin or extension integration study

### Venue/expert validation

- [ ] obtain expert/venue feedback on whether the architectural conjunction is sufficiently distinct and useful
- [ ] reduce remaining parser/lowering/runtime trust boundaries without overstating full compiler verification

## High-venue artifact gate

Repository-side evidence already includes State-Change Factorization, Mutation Transparency, semantic policy containment, machine-checked integer range evidence, source/range/guard validation, raw-source call-site identity validation, direct compiled execution plus independent effect validation, finite call assurance, invocation frames, repeated-call correspondence, portable C99 and GUI evidence, assurance measurement tooling, semantic-authority security cases, commit-bound reproducibility and structured related work.

Evidence still requiring new data or external participation:

- [ ] controlled measured overhead results
- [ ] genuine external/third-party application or plugin integration evidence
- [ ] expert/venue feedback

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
- **beta.36:** project bundle v4 resources, native progression through Native GUI IR 1.7 / payload v17 / runtime v1.8, expanded RAD authoring and graphics/resource R1 work
- **current:** R0 architecture hardening (#282), finish the two native resource-consumer R1 gaps, Stage 2 Offline Studio local-native-build integration, and later production signing/packaging before broad R2 expansion
