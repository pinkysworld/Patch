# Patch roadmap

Current development beta: **0.2.0-beta.35**

This roadmap distinguishes three different things that were previously mixed together:

1. **core product backlog** that can be implemented and verified inside the Patch repository;
2. **externally gated distribution/validation work** that requires credentials, real platform testing or deployment decisions;
3. **research evidence work** that must not be marked complete without new empirical or third-party evidence.

Checked items are implemented. Unchecked items are deliberately not presented as finished features or measured results.

## Current contract

- Patch package: **0.2.0-beta.35**
- public product surface: **0.2 beta.35+**
- Change IR: **0.10**
- Window event adapter: **0.9**
- Native GUI IR: **1.2**
- current sealed native GUI payload: **v12**
- current token-free Ready/offline native runtime: **v1.3** on Windows, macOS and Linux
- formal runtime-correspondence milestone: **beta.32**
- project format: **multi-file bundle v3**

Product/Studio work after beta.32 does not widen the formal assurance claim.

## Core product backlog status

**The current beta.35+ Studio/compiler product backlog is closed.** There are no open GitHub Issues in the repository at this status point. New feature ideas can create a new milestone, but they are not silently carried as unfinished beta.35 work.

### Studio / Designer

- [x] canonical multi-file project bundle v3 with Project Tree, deterministic Run/Build composition, full-project recovery and explicit migrations
- [x] source-backed Form add/select/resize/fit/default-size/duplicate/delete lifecycle
- [x] source-backed control selection, common Properties actions, source reveal, delete and duplicate
- [x] pointer and keyboard positioning/resizing plus Center H / Center V, Default size and collision-aware Auto place
- [x] transient Designer multi-select with shared movement/alignment
- [x] source-backed Anchor/Dock layout policy and runtime reflow
- [x] Text, Button, Input, Checkbox, Radio, ComboBox and ListBox authoring
- [x] browser and native list-backed multi-select ListBox with transient text-list values and explicit `change` persistence
- [x] read-only source-backed Table/Grid Stage 1 with row selection and structural Properties editing
- [x] Studio App-preview dispatch parity for Table row selection through the shared semantic Window event adapter
- [x] TreeView Stage 1 language/IR, Studio preview, Standalone Web and native parity
- [x] sealed payload v12 / runtime v1.3 TreeView parity with root-to-node text-list selection and Windows/macOS/Linux smoke execution
- [x] token-free Ready/offline consumer switch to TreeView-capable payload v12 / runtime v1.3
- [x] first-class source-backed TreeView tool and wider/resizable/collapsible Properties workspace
- [x] source-backed top-level Table grid and TreeView hierarchy structural Properties editors
- [x] source-backed Tabs page add/rename/reorder/delete/duplicate editing
- [x] source-backed nested Tabs insertion/removal/reorder/duplicate for Text, Button, Input, Checkbox, Radio, ComboBox, ListBox, Slider, Table and TreeView
- [x] dedicated nested Table column/row and TreeView hierarchy structural editing inside Tabs Properties
- [x] categorized Add control picker plus active Form navigation and source-backed sizing workflow
- [x] structural Properties summary/filter/empty-state polish
- [x] shared Designer selection/event architecture cleanup across core/Tabs/Table/TreeView
- [x] unify core/Tabs/Table/TreeView behind one shared primary-selection/event and common Properties action architecture
- [x] **richer data-control surface beyond Table/Grid, ListBox and TreeView via source-backed Slider Stage 1**
- [x] Slider Stage 1 source syntax, compiler lowering, bounded finite numeric transient `changed` value, Designer integration, Tabs insertion, Studio preview and Standalone Window Web
- [x] structural/nested accessibility and keyboard refinement: roving Tree/Tabs selection, source-backed structural shortcuts, `Ctrl/Cmd+Enter`, Escape close/focus restoration and focus-visible treatment
- [x] documentation drift gates for current Studio/native contracts
- [x] deterministic public site bundle and PWA cache include the complete current Studio authoring surface

All current input/selection/result events remain transient. Persistent application state changes through ordinary semantic `change` only. Slider `changed` exposes a finite in-range number; Table/ListBox/TreeView expose their documented transient list/text-list values. Renderer or native-toolkit selection never becomes hidden Patch state.

### Compiler / language / assurance infrastructure

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

## Frozen native compatibility evidence

These historical lines remain part of the compatibility evidence even though the current consumer is Native GUI IR 1.2 / payload v12 / runtime v1.3:

- [x] **Native GUI IR 0.8** introduced the Table compatibility representation and the direct AOT backend preserves the frozen Table semantics on Win32, AppKit and GTK.
- [x] frozen sealed native GUI payload **v9** / runtime **v1.0** Table compatibility line remains tested across Windows, macOS and Linux.
- [x] payload **v10** / runtime **v1.1** preserves persistent text-list state and list-backed ListBox compatibility.
- [x] payload **v11** / runtime **v1.2** preserves Menu + list compatibility.
- [x] Native GUI IR **1.2** / payload **v12** / runtime **v1.3** adds TreeView while preserving the earlier Table/ListBox/Menu contracts.

Older payload/runtime contracts are frozen compatibility evidence, not obsolete current-product claims.

## Desktop / distribution status

### Implemented repository-controlled surface

- [x] Ready Windows/macOS/Linux Console packages
- [x] Ready Windows/macOS/Linux Window packages for the current native GUI surface
- [x] direct-native Win32/AppKit/GTK backends
- [x] current Native GUI IR **1.2** hierarchical TreeView line
- [x] frozen versioned payload/runtime compatibility lines rather than in-place redefinition
- [x] token-free v1.3 runtime release workflows for Windows/macOS/Linux
- [x] ordinary offline `patch link` defaults to payload v12/runtime v1.3
- [x] explicit payload v10/v11 compatibility for older non-Tree artifacts
- [x] browser Ready runtime templates verified against GitHub Release SHA-256 digests before sealing
- [x] downloadable offline compiler/linker for Windows, macOS and Linux plus FreeBSD portable C99 kit
- [x] fail-closed Windows signing and macOS signing/notarization machinery
- [x] Linux packaging expectations and removal documented

### Externally gated or deliberately future distribution work

These are **not unfinished core beta.35 implementation tasks**. They require credentials, platform/distribution choices or a new versioned runtime contract.

- [ ] real credentialed Windows signing evidence
- [ ] real credentialed macOS signing/notarization evidence
- [ ] installer/package formats with explicit uninstall path after a distribution-format decision
- [ ] release-integrity verification across any future installer/update channel
- [ ] fresh remote native build service without a user-supplied GitHub token
- [ ] FreeBSD native GUI backend
- [ ] more self-contained Linux distribution formats where deployment evidence justifies them
- [ ] native Slider parity through a **future versioned Native GUI IR/backend/payload/runtime contract**; runtime v1.3 intentionally remains Slider-free and fail-closed
- [ ] manual assistive-technology validation with Narrator, VoiceOver, Orca or comparable tools; no WCAG conformance claim is made without that work

## Research evidence gates

The following remain intentionally unchecked because the repository cannot truthfully manufacture the missing external evidence.

### Controlled evaluation

- [x] deterministic depth/invocation corpus
- [x] compiler / execution / independent validation / correspondence / certificate-generation timing harness
- [x] raw samples plus min/median/mean/p95/max and robust Q1/Q3/MAD/IQR aggregation
- [x] environment/commit/scenario consistency checks
- [x] explicit `development` / `hosted-ci` / `controlled` measurement classes
- [x] fail closed when GitHub Actions timing is labelled `controlled`
- [x] fixed-machine procedure in `docs/CONTROLLED_EVALUATION.md`
- [ ] **controlled paper-quality benchmark runs** on fixed hardware
- [ ] statistical model/plots over the collected controlled dataset
- [ ] measured results synchronized into the manuscript

No empirical performance result is claimed until those measurements actually exist.

### External integration evidence

- [x] internally authored multi-domain checkout/loyalty and usage/quota application corpus
- [x] literature-grounded comparison dimensions in `docs/RELATED_WORK.md`
- [ ] **genuine external/third-party plugin or extension integration study**

The internal examples are engineering/security evidence, not a substitute for evidence from an external extension ecosystem.

### Venue/expert validation

- [ ] obtain expert/venue feedback on whether the architectural conjunction is sufficiently distinct and useful
- [ ] reduce remaining parser/lowering/runtime trust boundaries without overstating full compiler verification

## High-venue artifact gate

Completed repository-side evidence:

- [x] State-Change Factorization + Mutation Transparency
- [x] Change Signature Soundness + semantic policy containment
- [x] machine-checked integer range fragment
- [x] source/range/guard translation validation
- [x] raw-source static call-site identity validation
- [x] direct compiled execution + independent effect validation
- [x] finite abstract/exact/transitive call assurance
- [x] call-aware direct-Wasm correspondence
- [x] invocation frames for repeated identical calls
- [x] mixed-guard repeated-call invocation-frame evidence with Lean re-checking
- [x] portable C99 and semantic GUI input evidence
- [x] assurance overhead/scaling harness
- [x] process-isolated controlled-measurement protocol
- [x] semantic-authority security ablation
- [x] realistic checkout/loyalty and usage/quota cases
- [x] commit-bound reproducibility bundle
- [x] structured related work with primary-source comparison dimensions
- [x] targeted 2025–2026 dependent/state-sensitive effect follow-up
- [x] main manuscript synchronized to beta.32 assurance / beta.35 artifact status

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
- **beta.35+ product work:** project bundle v3, current Designer architecture, Table/TreeView/Tabs completion and browser/Standalone-Web Slider Stage 1

## Rule for new backlog items

A new unchecked core-product item should be added only when it has a concrete implementation target and acceptance test. Credential-dependent deployment, manual validation and research-evidence requirements stay in their dedicated gated sections so the core product backlog cannot appear perpetually unfinished for reasons outside the repository.