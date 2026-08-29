# Patch Studio code review · 2026-08-29

Review baseline: `main` at `d90521e4f1d33fa916cf20c8c6b1c081ec90cfb2` (`0.2.0-beta.36`, Native GUI IR 1.7 / payload v17 / runtime v1.8).

This review focuses on Patch Studio browser responsiveness, source-backed RAD architecture, runtime parity, CI/deployment reliability and the path toward a Delphi / Visual Basic class RAD environment.

## Executive summary

Patch Studio already has a unusually broad RAD foundation for the beta stage: source-backed Forms, Object Inspector, Component Palette, multi-form projects, resources, cross-platform native Window builds, multiple standard controls, graphics controls and a substantial Workshop acceptance application.

The most important gap is no longer raw component count. It is keeping the Studio architecture responsive and coherent as the component and project surface grows. The next phase should therefore treat performance, editor/runtime separation, incremental rendering and one canonical component/event contract as first-class product features.

## Findings

### P0 · Studio Run did redundant synchronous work

Before this review, `Run` compiled the source and then passed the same source to `PatchInterpreter.run()`, which parsed it a second time. It then synchronously formatted the complete Change IR as pretty JSON before exposing the running application.

Status in this branch:

- added `PatchInterpreter.runAst()`;
- Studio Run reuses `compile(...).ast`;
- IR pretty-printing is lazy and occurs when the IR tab is opened;
- the new runtime instance becomes active only after successful execution;
- Run has a re-entry guard.

### P0 · Hidden runtime Forms were fully materialized

The runtime renderer created every control for every Form during initial Run and only then applied `hidden` to inactive Forms. Large multi-form applications therefore paid the DOM construction cost for windows the user had not opened.

Status in this branch:

- inactive runtime Forms keep their window shell and identity but defer control DOM construction;
- opening a Form materializes it on the next runtime render;
- the real-Chrome Workshop regression checks this behavior.

This is deliberately runtime-side first. The Designer still needs a stronger virtualization pass because design-time adapters currently assume the complete source-backed surface exists.

### P0 · Studio ListBox behavior had fallen behind Standalone Web

Standalone Web already recognizes a ListBox bound to Patch list state as a multiple-selection control and sends a text-list event value. Studio Run still rendered the same control as single-select and emitted a string.

That was a semantic parity bug in the Workshop `services` control.

Status in this branch:

- Studio Run now enables `multiple` for list-backed ListBox controls;
- selected values round-trip as a string array;
- accessibility exposes `aria-multiselectable`;
- the Chrome Workshop test covers two selected services.

### P0 · Designer preview execution boundary

Status after the R0 follow-up: **primary path resolved**. `refreshDesigner()` now consumes the bounded `studio-design-cache/0.1`, which builds `studio-design-model/0.1` snapshots from declarations and initial state without executing calls, changes, loops, conditionals, preview blocks or Form visibility actions. The same modules are packaged in hosted and Offline Studio.

Remaining follow-up:

1. share revision snapshots across remaining Designer adapters instead of repeated local parsing;
2. move heavy parse/compile/design-model work to a Worker once the worker boundary is versioned;
3. keep a bounded policy for any design-time expression evaluation that remains necessary;
4. record edit-to-preview and Form-switch latency in the 10-Form / 200-control stress fixture.

### P0 · Active-Form Designer rendering is not true virtualization yet

The current active-Form layer hides inactive Form shells after the base Designer has already constructed them. That improves visible complexity but does not remove the initial DOM construction cost.

Required follow-up:

- make the base renderer accept an active Form/materialization policy;
- retain cheap shells for Project Explorer/Form switching;
- materialize only the active Form controls;
- preserve source-backed selection, structural editing and Object Inspector ownership when switching Forms.

The public roadmap should call this active-Form visibility/materialization groundwork until true virtualization is complete.

### P1 · Runtime event handling rebuilds the complete visible application DOM

`trigger()` calls `renderWindows()` after each event. This is simple and deterministic, but it is O(application UI size) and can lose focus/selection state. Tabs also re-render the complete window set when their selected page changes.

Recommended direction:

- keyed window/control identities;
- update only Forms whose visibility or model changed;
- update stateful control properties in place when possible;
- preserve focus, caret, scroll position and transient Table/Tree selections;
- keep full deterministic rerender as a fallback/debug mode.

### P1 · `web/playground.js` is carrying too many responsibilities

The module owns samples, Run/Build, Designer preview, DOM rendering, control implementations, Inspector bootstrap, persistence and diagnostics. This increases regression risk as the RAD surface grows.

Recommended extraction sequence:

1. `studio-runner.js` for compile/run/runtime lifecycle;
2. `studio-window-renderer.js` for Window/control DOM;
3. `studio-runtime-state.js` for transient tab/list/table/tree selection;
4. `studio-build-controller.js` for build target UX;
5. leave `playground.js` as orchestration only.

### P1 · Duplicate Workshop compatibility source creates drift risk

The repository has a canonical `examples/workshop-desk.patch`, a compatibility baseline in the beta Studio layer and an older `Harbor Desk` sample block in `playground.js`. The current upgrade layer protects the public sample, but three representations make maintenance harder.

Recommended direction:

- preserve only one explicitly versioned compatibility fixture for migrations;
- use the canonical Workshop source for current product behavior;
- remove the unused legacy sample once compatibility tests no longer require it.

### P0 CI · Pages deployment is coupled to release publication timing

The first Pages run for the current native v1.8 merge failed because the required Windows, Linux and macOS runtime release tags were not yet published. The runtime releases appeared immediately afterwards.

The fail-closed policy is correct, but the orchestration is race-prone.

Recommended direction:

- publish/seal required runtime releases first;
- trigger Pages from the successful runtime-release workflow or a single release-readiness workflow;
- avoid a normal push deployment that is expected to fail while release jobs are still publishing;
- retain the current digest/asset verification before deployment.

### P1 process · RAD tracking issue is stale

Issue #247 still describes Shape, PaintBox and ImageList as largely unstarted, while the current roadmap records substantial completion through PaintBox image support and ImageList Stage 1.

Required follow-up: refresh the issue so GitHub Issues, roadmap and generated capability matrix describe the same state.

## Recommended implementation order

### Gate A · responsiveness and architecture

- [x] single-parse Studio Run path
- [x] lazy Run IR formatting
- [x] lazy hidden runtime Form materialization
- [x] Studio list-backed ListBox parity
- [ ] true active-Form Designer virtualization
- [x] design-model path that does not execute the full application
- [x] bounded source-revision design snapshot cache wired to primary `refreshDesigner()`
- [ ] Worker compile/design-model boundary
- [ ] keyed/incremental runtime rendering
- [ ] Workshop click-to-first-app-paint benchmark

### Gate B · complete Form Designer workflow

- independent TabOrder and visual Tab Order mode;
- clipboard schema and cross-Form copy/cut/paste;
- Lock Controls;
- Layers/Object Tree;
- Panel Stage 2 with true child containment;
- GroupBox, ScrollBox and SplitContainer;
- smart guides beyond the current grid/alignment behavior.

### Gate C · Delphi/VB-class component library

- Memo/TextArea and PasswordEdit;
- ProgressBar and SpinEdit/NumberEdit;
- DatePicker, TimePicker and Calendar;
- richer Table, TreeView and ListView;
- ToolBar / ToolButton / PopupMenu;
- ActionList-style reusable commands;
- standard dialogs;
- native ImageList consumers and native application icons.

### Gate D · professional code IDE

- syntax highlighting and folding;
- semantic diagnostics and autocomplete;
- go to definition / references / rename;
- formatter and quick fixes;
- Designer to code and code to Designer navigation;
- safe source-backed refactoring.

### Gate E · debugger and live development

- breakpoint gutter;
- Run/Continue/Pause;
- Step Into/Over/Out;
- locals, watches and Patch state inspection;
- Change IR/event timeline;
- deterministic event replay where safe;
- explicit hot-reload safety boundary.

### Gate F · project, data and deployment ecosystem

- Project Explorer 2.0 and project settings;
- templates and reusable Forms/components;
- property/data binding;
- SQLite-first data components only behind explicit security contracts;
- native packaging/installers and signing/notarization evidence;
- package/component SDK and extension compatibility policy.

## Product definition for Patch Studio 1.0

Patch Studio should be called a complete RAD 1.0 only when a developer can create a multi-form project, visually place and configure a practical component set, wire events, navigate/edit/refactor code, debug state and events, manage resources, and produce deployable Windows/macOS/Linux/Web artifacts without leaving the Studio or relying on an undocumented secondary UI model.

The distinguishing Patch requirement remains stronger than Delphi/VB parity alone: visual actions must round-trip through ordinary Patch source or an explicit versioned project/resource contract, and runtime mutation must remain visible through Patch's change semantics rather than hidden behind the Designer.