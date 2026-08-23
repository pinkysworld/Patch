# Patch roadmap

Current development beta: **0.2.0-beta.35**

The roadmap separates repository-controlled product work from credential/manual distribution work and research evidence that cannot be manufactured by CI.

## Current contract

- Patch package: **0.2.0-beta.35**
- public product surface: **0.2 beta.35+**
- Change IR: **0.10**
- Window event adapter: **0.9**
- Native GUI IR: **1.3**
- current sealed native GUI payload: **v13**
- current token-free Ready/offline runtime: **v1.4** on Windows, macOS and Linux
- frozen TreeView compatibility line: Native GUI IR **1.2** / payload **v12** / runtime **v1.3**
- project format: **multi-file bundle v3**
- formal runtime-correspondence milestone: **beta.32**

Product, Studio and native work after beta.32 does not widen the formal assurance claim.

## Active UX and reliability milestone

The previous beta.35+ feature milestone closed the planned source-backed Designer, multi-file project, Table/TreeView/Tabs, ListBox and Slider work. A new repository-controlled milestone is now active for product polish, browser reliability and faster IDE navigation.

### Completed in the current milestone

- [x] real Headless Chrome startup/responsiveness test that loads Studio, runs the default Window application and probes the main thread after the delayed-freeze window
- [x] production Pages gate that runs the same Chrome behavior test against `https://minh.systems/Patch/` before `patch-studio/public-site` can become healthy
- [x] prevent self-triggering Designer `MutationObserver` reconciliation loops from starving the browser main thread
- [x] make `studio-bootstrap.js` the **single service-worker registration and revision-refresh owner**
- [x] remove late service-worker registration from Playground and Accessibility modules
- [x] type-safe offline routing: missing JavaScript/CSS/runtime assets never receive `index.html`; only real document navigation may fall back to the cached Studio shell
- [x] site-wide responsive visual polish for Studio, Documentation, Language, Downloads and Help
- [x] balanced Documentation contract layout with 3-column desktop, 2-column medium and 1-column narrow behavior instead of the squeezed four-plus-one card row
- [x] keyboard-first **Command Palette** (`Ctrl/Cmd+K`) delegating to existing Run, Build, Editor, Designer, result views, Recovery, Documentation, Downloads and Help actions
- [x] Command Palette kept transient and navigation-only, with no second project/mutation model or local persistent state
- [x] **Command Palette v2: project-file and symbol quick-open** using the existing multi-file bundle v3, parser and Project Outline models; fuzzy token-aware filtering, exact file/line editor navigation, keyboard-only operation and no second persistent project index
- [x] **Workspace Layout v2** with pointer/keyboard source-result resizing, real constrained ARIA separator values, editor/Designer minimums, one local IDE-only preference, reset and narrow-screen fallback
- [x] **Studio startup diagnostics v2** with bootstrap-time module/error/rejection/timeout capture, visible non-blocking redacted details, local copy support, handoff into ordinary `.patchreport` diagnostics and production Chrome exercise of the failure path
- [x] README, public Documentation and Help synchronized to the current UX/reliability and native/runtime boundaries
- [x] CI/site validation expanded for Command Palette packaging, single-worker ownership and type-safe offline fallback
- [x] Windows Chrome smoke isolated from the 12-minute full suite; DevTools waits abort and a hung browser tree is killed
- [x] Windows Chrome profile cleanup is best-effort after the browser tree is killed so leftover user-data-dir file locks cannot fail the smoke
- [x] Window Web structural equality matches the interpreter own-field contract; event-local values reuse the prototype-preserving clone
- [x] Public language/docs/README name Things as prototype-free own-field records; direct Wasm/C99 fail closed and stay outside beta.32

### Next repository-controlled backlog

The reliability backlog is intentionally not being extended with another control or runtime tier. Native two-contract collapse is complete: **current** (IR 1.3 / payload v13 / runtime v1.4) and **frozen** (IR 1.2 / payload v12 / runtime v1.3) are the only product import surfaces. Remaining repository-controlled work is specification/documentation synchronization, semantic object hardening and CI maintenance before any new product surface is added.

Native collapse means keeping **current** (IR 1.3 / payload v13 / runtime v1.4) and **frozen** (IR 1.2 / payload v12 / runtime v1.3) as the only product import surfaces. Current and frozen lowering/sealing use standalone snapshots instead of importing versioned v07–v11 modules. Product JavaScript, the Studio site bundle and Ready/offline linking no longer consume those versioned modules. Unversioned `native-gui-ir.js` / `native-runtime/*-sealed-gui.cpp` files remain the historical include-chain base, not the Ready runtime. Historical v0.8 runtime workflows are named as such, require an explicit payload v7/v8 sealer, and do not gate Pages or Ready releases.

- [x] stable current native facade (`src/native-current-contract.js`)
- [x] stable frozen TreeView facade (`src/native-frozen-contract.js`)
- [x] README, public docs and Studio website name both live contracts and the include-chain rule
- [x] flatten current and frozen so they no longer import the v11→v07 chain
- [x] retire v07–v11 consumers, site-bundle copies and manual workflows together
- [x] keep unversioned historical bases from being mistaken for the Ready runtime

New product items should have a concrete implementation target and acceptance test before being added here.

## Completed beta.35+ product foundation

### Studio / Designer

- [x] canonical multi-file project bundle v3 with Project Tree/Outline, deterministic Run/Build composition, full-project recovery and explicit migrations
- [x] source-backed Form add/select/resize/fit/default-size/duplicate/delete lifecycle
- [x] shared top-level control selection and source-backed Properties actions
- [x] pointer and keyboard positioning/resizing, alignment, Center H / Center V, Default size and collision-aware Auto place
- [x] transient Designer multi-select with shared group movement/alignment
- [x] source-backed Anchor/Dock layout policy and runtime reflow
- [x] Text, Button, Input, Checkbox, Radio, ComboBox and ListBox authoring
- [x] list-backed multi-select ListBox with transient text-list semantics across browser and current native lines
- [x] Table/Grid Stage 1 with selected-row events and source-backed structural Properties editing
- [x] TreeView hierarchy, source-backed structural editing, browser preview and current native parity
- [x] Tabs page lifecycle plus nested Text/Button/Input/Checkbox/Radio/ComboBox/ListBox/Slider/Table/TreeView editing
- [x] Slider Stage 1 source syntax, Designer, Tabs, browser preview, Standalone Web and native Windows/macOS/Linux parity
- [x] Native GUI IR 1.3 / payload v13 / runtime v1.4 additive Slider line while v12/v1.3 remains frozen
- [x] structural/nested keyboard refinement, focus restoration and explicit focus-visible treatment
- [x] deterministic content-addressed public site and complete browser module/HTML asset closure validation
- [x] runtime-template SHA-256 integrity chain for token-free Ready builds

All current input/selection/result events remain transient. Persistent application state changes through ordinary semantic `change` only.

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

The current consumer is Native GUI IR 1.3 / payload v13 / runtime v1.4. Older lines remain tested compatibility evidence:

- [x] Native GUI IR 0.8 / payload v9 / runtime v1.0 Table line
- [x] payload v10 / runtime v1.1 persistent text-list state and list-backed ListBox line
- [x] payload v11 / runtime v1.2 Menu + list line
- [x] Native GUI IR 1.2 / payload v12 / runtime v1.3 TreeView line, intentionally Slider fail-closed
- [x] Native GUI IR 1.3 / payload v13 / runtime v1.4 additive Slider line

## Desktop / distribution status

### Implemented repository-controlled surface

- [x] Ready Windows/macOS/Linux Console packages
- [x] Ready Windows/macOS/Linux Window packages for the current native GUI surface
- [x] direct-native Win32/AppKit/GTK backends
- [x] token-free v1.4 runtime release workflows for Windows/macOS/Linux
- [x] ordinary offline `patch link` defaults to payload v13/runtime v1.4
- [x] browser Ready runtime templates verified against GitHub Release SHA-256 digests before sealing
- [x] downloadable offline compiler/linker for Windows, macOS and Linux plus FreeBSD portable C99 kit
- [x] fail-closed Windows signing and macOS signing/notarization machinery
- [x] truthful Pages deployment status with required-runtime checks, HTTP asset verification and live Chrome behavior verification

### Externally gated distribution work

These require credentials, real platform testing or a distribution decision and are not ordinary repository implementation claims.

- [ ] real credentialed Windows signing evidence
- [ ] real credentialed macOS signing/notarization evidence
- [ ] installer/package formats with explicit uninstall path after a distribution-format decision
- [ ] release-integrity verification across any future installer/update channel
- [ ] fresh remote native build service without a user-supplied GitHub token
- [ ] FreeBSD native GUI backend
- [ ] more self-contained Linux distribution formats where deployment evidence justifies them
- [ ] manual assistive-technology validation with Narrator, VoiceOver, Orca or comparable tools; no WCAG conformance claim is made without that work

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
- **beta.35+ foundation:** multi-file bundle v3, completed Designer structure workflows, Table/TreeView/Tabs, Slider and native runtime v1.4
- **current UX/reliability milestone:** MutationObserver freeze fix, live Chrome deployment gate, single service-worker ownership, type-safe offline fallback, site-wide visual polish, Command Palette, project-file/symbol quick-open, resizable Workspace Layout v2 and bootstrap-time startup diagnostics v2
