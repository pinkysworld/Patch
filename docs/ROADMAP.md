# Patch roadmap

Current development beta: **0.2.0-beta.36**

This roadmap separates repository-controlled product work from credential/manual distribution work and research evidence that cannot be manufactured by CI.

## Current contract

- Patch package: **0.2.0-beta.36**
- public product surface: **0.2 beta.36+**
- Change IR: **0.10**
- Native GUI IR: **1.4**
- current sealed native GUI payload: **v14**
- current token-free Ready/offline runtime: **v1.5** on Windows, macOS and Linux
- frozen TreeView compatibility line: Native GUI IR **1.2** / payload **v12** / runtime **v1.3**
- previous Slider compatibility line: Native GUI IR **1.3** / payload **v13** / runtime **v1.4**
- Studio project format: **multi-file/resource bundle v4** with explicit v1-v3 migration
- Component Registry: **0.8**
- formal runtime-correspondence milestone: **beta.32**

Product, Studio and native work after beta.32 does not widen the formal assurance claim.

### Preserved native compatibility evidence

Older versioned native contracts remain reproducibility/compatibility evidence even when they are no longer product defaults. In particular, the **Native GUI IR 0.8 / payload v9 / runtime v1.0 Table line** remains the frozen Table compatibility origin. Its platform evidence is preserved separately from the current Native GUI IR 1.4 / payload v14 / runtime v1.5 product line. Retaining this history is intentional and does not make payload v9 or runtime v1.0 current targets.

## Current product milestone: RAD R1

The beta.35+ multi-file/Designer foundation and the beta.36 native 1.4/v14/v1.5 integration are complete. Current repository-controlled work is the first graphics/resource RAD milestone from `docs/RAD_STUDIO_MASTERPLAN.md` and `docs/RAD_STUDIO_MASTER_BACKLOG.md`.

### Completed foundation

- [x] canonical multi-file Studio project model with deterministic Run/Build composition and `file:line` provenance
- [x] **project bundle v4** with bounded project resources and explicit migration from v1/v2/v3
- [x] project-level Resource Manager for PNG/JPEG/WebP/SVG with logical ids, paths, deterministic SHA-256 metadata, preview and bounded storage
- [x] deterministic resource export/import/recovery persistence
- [x] Picture source-backed Designer authoring and resource picker
- [x] Standalone Web Picture resource embedding
- [x] bounded native PNG/JPEG Picture decoding on Win32/WIC, AppKit/NSImage and GTK/GdkPixbuf with unsupported formats fail-closed
- [x] canonical Component Registry carrying property/event/renderer/target-support metadata
- [x] searchable Component Palette and Object Inspector Properties/Events views
- [x] source-backed Anchors/Dock, multi-select alignment/sizing/distribution, grid, z-order actions and Focus Order Stage 1
- [x] Panel Stage 1, StatusBar and nonvisual Timer authoring
- [x] Shape Stage 1 source syntax, Designer authoring and Standalone Web rendering
- [x] PaintBox Stage 1 source syntax, pure `paint` event/drawing commands, Designer authoring and Standalone Web rendering
- [x] ImageList Stage 1 source syntax, compiler transport, registry metadata, nonvisual tray and Resource Manager-backed Object Inspector
- [x] ImageList runtime targets fail closed until a consumer contract exists
- [x] content-addressed public site, PWA/offline closure validation and real Chrome startup/responsiveness gate
- [x] token-free Ready/offline Native GUI IR 1.4 / payload v14 / runtime v1.5 Windows/macOS/Linux paths
- [x] Command Palette, project-file/symbol quick-open, editor tabs, Workspace Layout v2 and startup diagnostics v2

### RAD R1 remaining work

These are real remaining gaps and must not be advertised as complete until their target tests are green.

- [ ] Picture display properties: fit/scale mode, proportional/aspect behavior, center, opacity and accessible description across authoring/runtime targets
- [ ] decide and version native SVG/WebP policy rather than broadening format support implicitly
- [ ] Shape native lowering/runtime parity for Win32, AppKit and GTK
- [ ] PaintBox drawing-command contract and native lowering/runtime parity for Win32, AppKit and GTK
- [ ] PaintBox `draw image` resource consumption after the image/drawing contract is versioned
- [ ] first ImageList consumer, preferably ToolBar/ToolButton or TreeView/Button image binding
- [ ] ImageList Web/native runtime contract only after a consumer exists; no empty standalone runtime claim
- [ ] application/window icon resource and packaging contract
- [x] component capability matrix generated from canonical registry metadata rather than duplicated documentation

## RAD R2: Form Designer parity

After R1 is closed:

- [ ] independent source-backed `TabOrder` that does not alter source/z-order
- [ ] visual Tab Order mode
- [ ] Move Forward / Move Backward in addition to current front/back actions
- [ ] configurable grid and richer smart guides
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

## Desktop / distribution status

### Implemented repository-controlled surface

- [x] Ready Windows/macOS/Linux Console packages
- [x] Ready Windows/macOS/Linux Window packages for the current native GUI surface
- [x] direct-native Win32/AppKit/GTK backends
- [x] token-free runtime v1.5 release workflows for Windows/macOS/Linux
- [x] ordinary offline `patch link` defaults to payload v14/runtime v1.5
- [x] browser Ready runtime templates verified against GitHub Release SHA-256 digests before sealing
- [x] downloadable offline compiler/linker for Windows, macOS and Linux plus FreeBSD portable C99 kit
- [x] fail-closed Windows signing and macOS signing/notarization machinery
- [x] truthful Pages deployment status with required-runtime checks, HTTP asset verification and live Chrome behavior verification

### Externally gated distribution work

- [ ] real credentialed Windows signing evidence
- [ ] real credentialed macOS signing/notarization evidence
- [ ] installer/package formats with explicit uninstall path after a distribution-format decision
- [ ] release-integrity verification across any future installer/update channel
- [ ] fresh remote native build service without a user-supplied GitHub token
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

- **beta.25–27:** finite call composition, exact binding and quantitative range evidence
- **beta.28–29:** structured and guard-aware exact callee traces
- **beta.30:** finite transitive exact call-tree traces
- **beta.31:** first call-aware direct-Wasm correspondence
- **beta.32:** independently reconstructed invocation frames and repeated-call correspondence
- **beta.33:** Studio/project/recovery/diagnostics production-readiness layer
- **beta.34:** canonical Studio state and runtime-integrity hardening
- **beta.35:** list-backed multi-select ListBox across browser and native lines
- **beta.35+ foundation:** multi-file bundle v3, completed Designer structure workflows, Table/TreeView/Tabs and Slider/native runtime v1.4
- **beta.36:** project bundle v4 resources, Native GUI IR 1.4 / payload v14 / runtime v1.5, expanded RAD authoring and graphics/resource R1 work
- **current:** finish truthful cross-target RAD R1 parity, then move into full Form Designer parity
