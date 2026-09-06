# Patch Studio 1.0 RAD Master Backlog

Status synchronized: **2026-09-06**

This is the long-term execution backlog for Patch Studio. `docs/ROADMAP.md` is the shorter current product-status view. Issue **#282** records the completed R0 responsiveness/correctness milestone; issue **#308** tracks active R0.1 maintainability and measurement-driven follow-ups. Issue **#319** tracks the now-completed native Window-icon implementation/promotion sequence and can close with the Current Ready v1.10 promotion. `docs/OFFLINE_STUDIO.md` owns the installed/offline IDE contract.

## Product goal

Patch Studio 1.0 should provide a Delphi / Visual Basic class RAD workflow without copying either product's hidden architecture. Patch keeps its own advantages:

- explicit semantic `change` for persistent mutation;
- source-backed visual authoring instead of a hidden form graph;
- one versioned component/property/event contract across Studio and runtimes;
- deterministic and reproducible artifacts;
- fail-closed target parity rather than silent feature loss;
- inspectable Change IR, event history and later causal debugging;
- normal offline authoring, Run and host-native local Build without GitHub or a token.

## Non-negotiable architecture rules

1. **Source-backed by default.** Designer changes round-trip through Patch source or a documented versioned project/resource manifest.
2. **No silent parity gaps.** A component is not Ready if Studio can place it but a claimed target silently drops it.
3. **One semantic model.** Hosted Studio, Offline Studio, Web, Win32, AppKit and GTK consume the same versioned contracts where applicable.
4. **Fail closed.** Unsupported properties, events, resources and targets produce explicit diagnostics.
5. **Large-project stability.** RAD features must survive real-Chrome stress, multi-Form projects and CI.
6. **Cross-platform release gate.** Windows, Linux and macOS remain first-class. FreeBSD may remain console-only until a GUI backend exists.
7. **Accessibility and keyboard parity.** Major Designer actions need keyboard-accessible equivalents.
8. **Offline core.** Network services are optional accelerators, not requirements for normal installed-IDE use.
9. **No general privileged browser bridge.** Installed-IDE filesystem/process authority must be exposed only through narrow, authenticated, versioned operations.
10. **Implementation is not promotion.** New native contracts remain separate from Current Ready until release assets, digests, linker/offline paths and product metadata are all verified.

## Current baseline

### Current product contract

- Patch **0.2.0-beta.36**;
- Change IR **0.10**;
- Current Ready Native GUI IR **1.9**, payload **v19**, runtime **v1.10**;
- Studio project/resource bundle **v4**;
- Component Registry **0.10**;
- source-backed multi-Form Designer, Component Palette and Object Inspector;
- Button, Input, Text, Memo, Checkbox, Radio, ComboBox, ListBox, Slider, Table, TreeView, Tabs, Picture, Shape, PaintBox, StatusBar, Timer, ImageList, Menu and Panel authoring, plus source-backed PasswordEdit, MaskedEdit, CheckedListBox and ProgressBar presentation contracts;
- source-backed Anchors/Dock, independent TabOrder, alignment/sizing/distribution, configurable grid snap, edge/center/equal-spacing Smart Guides, z-order commands, Layers/Object Tree, Lock Controls and Undo/Redo transactions;
- local-only Smart Guides visibility preference with Alt/Option temporary bypass;
- Workspace Layout v2 Source/Result splitter with keyboard/ARIA support, ratio persistence, desktop geometry recapture and narrow-screen fallback;
- project Resource Manager with deterministic resource metadata and recovery/export/import;
- canonical multi-file Project-v4 Patch Studio Showcase, explicitly loadable in hosted and Offline Studio;
- Standalone Web and Current Ready native Windows/macOS/Linux paths;
- token-free Offline Compiler/linker with Current Ready v1.10 plus explicit v17/runtime-v1.8 compatibility;
- public content-addressed PWA plus real-Chrome startup/Workshop checks;
- seven-Form Workshop Desk acceptance/stress application;
- Offline Studio rolling channel **`offline-studio-v0.2`** with authenticated Stage 2 localhost host-build foundation;
- Offline Compiler rolling release channel **`offline-compiler-v0.2`**.

### Promoted native resource line

The combined native R1 line is now Current Ready:

- **IR 1.8 / payload v18 / runtime v1.9**: ImageList/Button image transport plus Win32/AppKit/GTK Button consumers;
- **IR 1.9 / payload v19 / runtime v1.10**: application/Form Window-icon transport plus Win32/AppKit/GTK consumers, preserving the complete v1.9 layer;
- `native-window-icon-packaging/0.1`: deterministic application-icon packaging artifacts;
- `native-window-icon-package-v110/0.2`: Current Ready Windows/macOS/Linux runtime-v1.10 package plans;
- `windows-pe-icon-v110/0.1`: bounded in-place project-icon embedding into a reserved Windows PE application-icon slot;
- normal Windows runtime-v1.10 artifact reserves/verifies that PE slot;
- real Windows `ExtractAssociatedIcon` + `--patch-smoke` evidence is green;
- macOS `.icns` + `CFBundleIconFile` package plan is green;
- Linux hicolor + `.desktop` package plan is green;
- versioned v1.10 releases, SHA-256/GitHub digests and source binding are verified;
- dual-runtime Offline Compiler evidence is green on Windows, Linux, macOS Apple Silicon and macOS Intel.

`src/native-current-contract.js` now owns the promoted **1.9 / 19 / 1.10** boundary. Explicit payload v17/runtime v1.8 remains a compatibility path, not Current Ready.

## Priority model

- **P0 correctness/stability:** required before broad component expansion.
- **P1 core RAD parity:** expected in a serious visual application builder.
- **P2 professional IDE:** daily-development productivity.
- **P3 ecosystem/advanced tooling:** packages, extensibility and enterprise-scale workflows.

---

# Milestone R0 - RAD foundation hardening

The R0 responsiveness/correctness milestone is complete and preserved in issue **#282** plus `docs/R0_COMPLETION.md`. Issue **#308** carries the active post-R0 maintainability, Worker-adoption and measurement-driven rendering follow-ups without reopening the completed milestone.

## P0.1 Global UI name namespace

Status: **substantially implemented**.

- [x] shared namespace enumeration across core controls, nested Panel/Tabs controls, MenuItems and result-dialog targets;
- [x] Object Inspector collision guard;
- [x] shared namespace guard on the generic duplicate/copy/paste and Form-duplicate paths;
- [ ] explicit regression coverage for every future nested/new component family.

## P0.2 Undo/Redo transaction model

Status: **core transaction model implemented**.

- [x] source-backed Designer transaction boundary;
- [x] Ctrl/Cmd+Z and Ctrl/Cmd+Shift+Z;
- [x] coalesce one drag/resize into one history entry;
- [x] editor/Designer Undo/Redo for typing and atomic source rewrites;
- [x] project/resource replacement boundaries reset stale history;
- [ ] close remaining adapter-specific mutations that bypass the canonical transaction path;
- [ ] add a long mixed-operation recovery/Undo regression.

## P0.3 Designer model, cache and virtualization

Completed:

- [x] Run reuses the compiler AST and Change IR formatting is lazy;
- [x] hidden runtime Forms defer control DOM materialization until opened;
- [x] Run re-entry guard and transactional runtime replacement;
- [x] `studio-design-model/0.1` declaration-only initial design model;
- [x] bounded top-level design-model budget;
- [x] `studio-design-cache/0.1` bounded LRU source-revision cache;
- [x] seven-Form Workshop Desk preserved by the declaration-only model;
- [x] 10-Form / 200-control acceptance fixture;
- [x] primary `refreshDesigner()` consumes the bounded declaration-only design snapshot cache;
- [x] hosted and Offline Studio package the same design-model/cache modules;
- [x] `studio-form-materialization/0.1` fully materializes only the active Designer Form;
- [x] PaintBox, Shape, Panel, StatusBar and Table adapters obey the active-Form boundary;
- [x] `studio-design-snapshots/0.1` shares exact-source snapshots and reuses parsed AST descriptors;
- [x] Designer selection, Object Inspector, Table/Tree structural editing and Project Tree state survive Form materialization transitions.

Remaining:

- [ ] virtualize very large Table/Tree previews where measurements justify it;
- [ ] define a versioned Web Worker boundary for parse/compile/design-model work;
- [ ] bound any expression evaluation that remains necessary at design time.

## P0.4 Incremental runtime renderer

- [x] stable keyed Form/control identities;
- [x] event reconciliation reuses unchanged Form DOM;
- [x] bounded focus, caret, scroll and unchanged-model multi-selection restoration;
- [x] Tabs page changes reconcile only their local panel;
- [x] `keyed-control-v2` reconciles changed core controls while retaining unchanged sibling DOM;
- [x] transient Table/Tree selection survives safe rebuilds;
- [x] deterministic `?patch-runtime-render=full` recovery/diagnostics fallback;
- [x] real-Chrome event-to-paint performance gate;
- [ ] extend incremental reconciliation to adapter-owned top-level controls where a canonical adapter state contract exists.

## P0.5 Performance gates

- [x] Workshop Run click-to-first-app-paint measurement;
- [x] 10-Form / 200-control initial Run timing;
- [x] large-Form Workshop event-to-paint timing;
- [x] active-Form switch timing;
- [x] hosted-runner CI thresholds through `patch-studio-browser-performance/0.1`.

## P0.6 Consistent selection and property ownership

- [x] shared primary selection contract for core controls and specialized adapters;
- [x] shared dirty/apply/error contract for Object Inspector adapters adopted by the converged specialized inspectors;
- [x] shared delete/duplicate/reveal-source command IDs and dispatch path;
- [ ] finish removing any remaining adapter-specific behavior that can diverge.

## P0.7 Studio module boundaries

`web/playground.js` is now substantially reduced to orchestration, while bounded modules own the major runtime/build surfaces.

- [x] extract Studio Run/runtime lifecycle;
- [x] extract Window/control DOM renderer;
- [x] extract bounded transient runtime selection/state helpers;
- [x] extract Build controller;
- [x] keep `playground.js` as orchestration rather than a second framework for the extracted paths;
- [ ] remove obsolete duplicate Workshop/Harbor compatibility source once migration coverage no longer needs it.

## P0.8 CI/deployment reliability

- [x] make Pages deployment release-aware so just-publishing runtime assets do not create expected red workflows;
- [x] retain fail-closed runtime/digest verification;
- [x] live HTTP/Chrome verification after deploy;
- [x] deployed Tutorials/Examples handbook surfaces live-smoked after Pages deployment;
- [x] reduce PR notification noise with draft suppression and one canonical ready-PR Patch CI matrix;
- [x] shrink Offline Compiler triggers/package closure to the real compiler dependency graph.

**R0 exit criterion:** Designer editing and Form switching are bounded, do not execute unrelated application behavior, typical events do not rebuild the complete visible app tree, and regressions are measured in CI. The milestone itself is complete; unchecked entries above are post-R0 follow-ups tracked by #308 unless another owner is named.

---

# Milestone R1 - Graphics, images and visual resources

## P1.1 Resource Manager

Status: **implemented foundation**.

- [x] PNG/JPEG/WebP/SVG project resources;
- [x] stable logical IDs and project-relative paths;
- [x] size/media/SHA-256 metadata;
- [x] preview/add/remove and resource-backed Object Inspector flows;
- [x] project v4 export/import/recovery persistence;
- [x] deterministic Web/native resource packaging where supported;
- [ ] richer rename/reference refactoring;
- [x] drag asset directly onto Form as Picture, with `Place on Form` keyboard/touch parity and ordinary visible source output;
- [ ] visual application-branding workflow.

## P1.2 Picture / Image

- [x] source-backed Picture authoring/resource picker;
- [x] Studio and Standalone Web rendering;
- [x] fit/scale, proportional/aspect, center, opacity and accessible description on Web;
- [x] native PNG/JPEG decode on Win32/AppKit/GTK;
- [x] explicit `native-picture-formats/1.0` policy with deferred WebP/SVG;
- [ ] broaden native display-property combinations only through a versioned contract;
- [ ] OnLoad/OnError only if a stable portable event contract is justified.

## P1.3 ImageList

Status: **Current Ready for Button images on Web, Windows, macOS and Linux**.

- [x] nonvisual component tray and source syntax;
- [x] logical image names/sizes and Resource Manager integration;
- [x] compiler/registry metadata;
- [x] Button `image list.item` consumer on Studio/Web;
- [x] `native-imagelist-asset-plan/0.1` validation/deduplication;
- [x] Native GUI IR **1.8** transport for used Button ImageList assets;
- [x] sealed payload **v18** `BIMG` transport;
- [x] runtime **v1.9** compatibility layer;
- [x] Win32 Button image consumer;
- [x] AppKit Button image consumer;
- [x] GTK Button image consumer;
- [x] dedicated cross-platform runtime evidence;
- [x] promoted through the combined IR 1.9 / payload v19 / runtime v1.10 release line;
- [ ] reuse transport for ToolBar/ToolButton/Menu/Tree consumers only after those contracts exist;
- [ ] optional DPI variants only after a portable resource-selection rule is defined.

## P1.4 Shape

- [x] Rectangle/RoundedRectangle/Ellipse/Line source/Designer/Web contract;
- [x] fill/stroke/stroke width/radius/opacity/layout authoring;
- [x] native Win32/AppKit/GTK lowering/runtime parity through preserved IR 1.5+ contract;
- [ ] richer interactions only when required by real applications.

## P1.5 PaintBox / Canvas

- [x] source/Designer/Web PaintBox;
- [x] pure paint-event drawing program;
- [x] clear/line/rectangle/ellipse/text;
- [x] `draw image` with bounded PNG/JPEG project resources, preserved into Current Ready IR 1.9 / payload v19 / runtime v1.10;
- [ ] pointer/mouse event contract;
- [ ] paths/transforms/gradients;
- [ ] higher-DPI drawing model beyond current basics.

## P1.6 Icons and application branding

Status: **Current Ready native runtime and platform packaging implemented**.

- [x] source-backed Form/window icon declaration;
- [x] Web favicon/chrome packaging under `window-icon/1.0`;
- [x] `native-window-icon-asset-plan/0.1`;
- [x] Native GUI IR **1.9** Form/application icon transport;
- [x] sealed payload **v19 / WICO** transport over the exact payload-v18 prefix;
- [x] runtime **v1.10** Win32/AppKit/GTK consumers;
- [x] `native-window-icon-packaging/0.1`;
- [x] `native-window-icon-package-v110/0.2`;
- [x] deterministic Windows `.ico` generation;
- [x] `windows-pe-icon-v110/0.1` self-contained Windows PE application-icon embedding;
- [x] standard Windows v1.10 runtime artifact reserves/verifies the PE icon slot;
- [x] real Windows associated-icon extraction and runtime smoke from the same packaged EXE;
- [x] macOS `.icns` + `CFBundleIconFile` package plan;
- [x] Linux hicolor + `.desktop` package plan;
- [x] Windows/macOS/Linux package-contract workflow;
- [x] versioned v1.10 releases, digest verification and Offline Compiler promotion;
- [ ] PWA icon-set generation;
- [ ] visual branding editor in Project Settings.

### R1 native promotion gate

Complete:

- [x] publish versioned runtime-v1.10 release assets for Windows, macOS and Linux;
- [x] publish and verify SHA-256 and GitHub release-asset digests;
- [x] bind the runtime release tags to the expected source commit;
- [x] wire browser/native Ready runtime lookup to those verified assets;
- [x] wire Offline Compiler default linking to IR 1.9 / payload v19 / runtime v1.10;
- [x] retain explicit payload-v17/runtime-v1.8 compatibility without mixing runtime generations;
- [x] update generated component capability metadata and public release/download surfaces;
- [x] move `src/native-current-contract.js` from 1.7 / 17 / 1.8 to 1.9 / 19 / 1.10.

**R1 native implementation exit:** complete. **R1 product-promotion exit:** complete. Future native feature expansion requires a new explicit contract rather than widening v19 in place.

---

# Milestone R2 - Full Form Designer parity

## P1.7 Independent TabOrder

- [x] explicit source-backed `TabOrder` independent from source/z-order;
- [x] Object Inspector property;
- [x] visual Tab Order overlay/mode;
- [x] keyboard reorder and reset-to-source-order;
- [ ] verify one explicit focus-order transport contract across Web/Win32/AppKit/GTK before calling target parity complete.

## P1.8 Layers and z-order

- [x] front/back/forward/backward source-backed actions;
- [x] Layers/Object Tree view;
- [x] explicit Panel/Tabs containment visualization;
- [ ] source-backed z-order metadata only where source order is insufficient;
- [x] keyboard-accessible Layers navigation and existing source-backed z-order commands.

## P1.9 Grid and smart guides

- [x] configurable design-grid snap and alignment actions;
- [x] richer edge/center/equal-spacing smart guides;
- [x] temporary Alt/Option bypass;
- [ ] optional rulers;
- [x] design-only guide visibility preferences.

## P1.10 Clipboard and cross-Form operations

- [x] versioned clipboard schema;
- [x] copy/cut/paste controls and nested content;
- [x] collision-safe ID rewriting;
- [x] optional event-handler copy;
- [x] paste into another Form/project;
- [x] duplicate with offset;
- [x] source-backed presentation metadata follows delete/copy/cut/paste/duplicate as one control unit;
- [x] clipboard v2 carries explicit backing-state records while remaining backward-readable for v1 payloads;
- [x] CheckedListBox duplication creates an explicit fresh backing `create list` state and collision-free TabOrder;
- [x] ProgressBar duplication creates an explicit fresh backing `create number` state and collision-free TabOrder.

## P1.11 Lock Controls

- [x] lock drag/resize without preventing selection/inspection;
- [x] per-control source-backed design metadata via `# @locked`;
- [x] command/visual indication through the Designer surface.

---

# Milestone R3 - Containers and layout

## P1.12 Panel Stage 2 native containment

Implemented source/Web foundation:

- [x] child coordinates relative to Panel;
- [x] Web DOM nesting parity for positioned children;
- [x] mixed legacy-flow and positioned Panel children remain source-backed;
- [x] Current Ready native fails closed for Panel Stage 2 relative child layout instead of flattening it.

Still open:

- [ ] child Anchors/Dock relative to container;
- [ ] clipping parity contract;
- [ ] nested Panels;
- [ ] visual move into/out of Panel with drop highlighting;
- [ ] true Win32/AppKit/GTK parent-child containment through a new explicit native contract.

## P1.13 GroupBox

- [ ] captioned container;
- [ ] child coordinates/layout;
- [ ] accessibility group semantics.

## P1.14 ScrollBox / ScrollPanel

- [ ] scrollable container and AutoScroll;
- [ ] horizontal/vertical policies;
- [ ] nested content;
- [ ] wheel/touch parity.

## P1.15 Splitter / SplitContainer

- [ ] orientation and resizable panes;
- [ ] min sizes;
- [ ] source-backed initial split;
- [ ] runtime resize;
- [ ] optional persisted UI state later.

## P2.16 Flow/Grid layout containers

- [ ] FlowPanel;
- [ ] GridPanel;
- [ ] gap/padding/alignment;
- [ ] row/column definitions;
- [ ] responsive authoring.

---

# Milestone R4 - Standard component library

Stage-1 controls may be checked here while still having an explicit native fail-closed boundary. “Ready” remains governed by the cross-target matrix below.

## P1 controls

- [x] Memo/TextArea Stage 1: source-backed Studio/Web `changed(value)` control, Current Ready native unsupported/fail-closed;
- [x] MaskedEdit Stage 1: ordinary Input plus `# @input-mask`, Studio/Web supported, Current Ready native unsupported/fail-closed;
- [x] PasswordEdit Stage 1: ordinary Input plus `# @input-mode password`, Studio/Web supported, Current Ready native unsupported/fail-closed;
- [x] CheckedListBox Stage 1: list-backed ListBox plus `# @listbox-mode checked`, Studio/Web supported, Current Ready native unsupported/fail-closed;
- [x] ProgressBar Stage 1: number-backed Slider plus `# @slider-mode progress`, passive Studio/Web presentation with no control event, Current Ready native unsupported/fail-closed;
- [ ] SpinEdit/NumberEdit;
- [ ] DatePicker;
- [ ] TimePicker;
- [ ] Calendar;
- [ ] LinkLabel;
- [ ] Separator;
- [ ] standalone ScrollBar where useful.

## P1 data/view controls

- [ ] advanced Table/DataGrid columns;
- [ ] TreeView icons/richer node metadata;
- [ ] ListView icon/detail modes;
- [ ] Header control;
- [ ] property-driven sorting/filtering hooks.

## P2 shell/chrome controls

- [ ] ToolBar;
- [ ] ToolButton;
- [ ] ContextMenu/PopupMenu;
- [ ] richer StatusBar panels;
- [ ] complete PageControl/Tabs Designer parity.

Every component must report:

`Syntax | Designer | Object Inspector | Events | Web | Win32 | AppKit | GTK | Offline build | Accessibility | Tests`

A component is Ready only when the required columns are green.

The canonical multi-file Project-v4 **Patch Studio Showcase** is the current Studio/Web acceptance project and is explicitly selectable in hosted and Offline Studio. New standard controls should extend that fixture as part of their Stage-1 acceptance work.

---

# Milestone R5 - Actions, commands and dialogs

## P1.17 ActionList-style command model

- [ ] Name/Caption/Enabled/Checked/Shortcut/Icon;
- [ ] OnExecute;
- [ ] bind MenuItem, ToolButton and Button to one Action;
- [ ] keep command state visible in ordinary Patch semantics rather than a hidden observer graph.

## P1.18 Dialog components

- [ ] OpenFileDialog;
- [ ] SaveFileDialog;
- [ ] SelectFolderDialog;
- [ ] Confirm/Message dialogs as first-class nonvisual components where useful;
- [ ] ColorDialog;
- [ ] FontDialog only where portable behavior is credible;
- [ ] common Object Inspector representation.

---

# Milestone R6 - Project and resource system

## P1.19 Project Explorer 2.0

- [ ] Forms and source modules;
- [ ] resources/assets;
- [ ] generated artifacts;
- [ ] build configurations;
- [ ] dependencies/packages;
- [ ] semantic drag/reorder;
- [ ] rename refactoring.

## P1.20 Project Settings

- [ ] application name/version/id;
- [ ] entry Form/output name;
- [ ] icons/branding;
- [ ] target platforms;
- [ ] optimization/debug mode;
- [ ] Window defaults;
- [ ] reproducibility manifest view.

## P2.21 Templates

- [ ] Blank Window App;
- [ ] Multi-Form desktop app;
- [ ] Dashboard;
- [ ] CRUD-style app;
- [ ] Tool/utility app;
- [ ] Graphics/PaintBox demo;
- [x] maintained Project-v4 Patch Studio Showcase acceptance project;
- [ ] reusable Form/component templates.

---

# Milestone R7 - Code IDE parity

## P1.22 Professional code editor

- [ ] syntax highlighting;
- [ ] bracket/indent support;
- [ ] code folding;
- [ ] semantic diagnostics;
- [ ] autocomplete/event-handler completion;
- [ ] signature help;
- [ ] go to definition;
- [ ] find references;
- [ ] symbol rename;
- [ ] format document/selection;
- [ ] quick fixes.

## P1.23 Designer-Code navigation

- [x] F12/View Source and Designer return path;
- [ ] double-click control opens default event;
- [x] Object Inspector event double-click creates/opens the source-visible handler;
- [x] Form > Control > Event breadcrumb;
- [x] synchronize selected control/source symbol where the target is unambiguous.

## P2.24 Refactoring

- [ ] rename Form/control/thing/recipe safely;
- [ ] extract recipe;
- [ ] move source module;
- [ ] convert literal to thing;
- [ ] safe handler rename.

---

# Milestone R8 - Debugger and runtime inspection

## P1.25 Debugger Stage 1

- [ ] breakpoint gutter;
- [ ] Run/Continue/Pause;
- [ ] Step Into/Over/Out;
- [ ] current source line;
- [ ] locals/things/watch values;
- [ ] event-handler breakpoints.

## P2.26 Patch semantic event/change trace

- [ ] live click/change/tick/menu/action stream;
- [ ] pre/post semantic state;
- [ ] Change IR/signature link;
- [ ] causal chain from UI event to committed change;
- [ ] replay selected deterministic events;
- [ ] surface denied/out-of-authority changes explicitly.

## P2.27 Hot Reload

- [ ] apply safe UI/source changes without restart;
- [ ] preserve compatible semantic state;
- [ ] restart when declarations/signatures make hot reload unsafe;
- [ ] visible change classification.

---

# Milestone R9 - Binding and richer declarative UI

- [ ] explicit source-visible property binding contract;
- [ ] one-way and two-way binding only where mutation ownership is unambiguous;
- [ ] converter/validation hooks without hidden persistent observers;
- [ ] deterministic target parity and diagnostics.

---

# Milestone R10 - Testing and UI automation

- [ ] integrated unit-test runner;
- [ ] source-backed UI test actions;
- [ ] deterministic control lookup by source ID;
- [ ] event/change assertions;
- [ ] headless browser and native smoke integration.

---

# Milestone R11 - Packages and component ecosystem

- [ ] signed/versioned package manifest;
- [ ] dependency resolution and lockfile;
- [ ] component registration schema;
- [ ] target capability declaration;
- [ ] sandbox/trust policy;
- [ ] third-party integration study before claiming ecosystem readiness.

---

# Milestone R12 - Localization and accessibility tooling

- [ ] string-resource/localization workflow;
- [ ] RTL-aware layout where supported;
- [ ] accessibility inspector for names/roles/focus order;
- [ ] contrast/keyboard diagnostics;
- [ ] manual assistive-technology validation gate before conformance claims.

---

# Milestone R13 - Dockable professional workspace

- [ ] dockable/persisted panels;
- [ ] workspace presets;
- [ ] multi-monitor installed-IDE layout persistence;
- [ ] reset/recovery path for corrupt layout state.

---

# Milestone R14 - Installed IDE and distribution maturity

## Offline Studio Stage 2

Implemented foundation:

- [x] authenticated narrow localhost build bridge rather than a general shell API;
- [x] project-v4 workspace snapshots with resource-integrity validation;
- [x] embedded/matching offline compiler path on supported installed hosts;
- [x] host-native installed Build path for Windows x64, Linux x64 and macOS Apple Silicon;
- [x] structured compiler diagnostics returned through the narrow bridge;
- [x] deterministic Offline Studio release-bundle verification across Windows x64/ARM64, Linux x64/ARM64, macOS Apple Silicon/Intel, portable Unix and FreeBSD compatibility evidence.

Still open:

- [ ] artifact pane with user-facing output/diagnostic/checksum workflow;
- [ ] explicit local-vs-remote build selector with local as the offline path;
- [ ] broaden host-native local Build only where a real supported host compiler/runtime exists.

## Distribution maturity

- [ ] production Authenticode evidence;
- [ ] Developer ID signing/notarization evidence;
- [ ] installers/uninstallers;
- [ ] optional update channel that never blocks offline use;
- [ ] richer Linux packaging where deployment evidence justifies it;
- [ ] FreeBSD native GUI only with an explicit supported toolkit/backend contract.

---

# Execution order from the current baseline

1. Finish the remaining R0.1 Worker/adapter-specific maintainability follow-ups without reopening R0.
2. Finish the user-facing Offline Studio Stage 2 artifact/build-selection workflow on top of the implemented narrow host-build bridge.
3. Close the remaining R2/R3 gaps: explicit cross-target TabOrder parity, Panel child Anchors/Dock, reparenting and later native containment.
4. Continue R4 standard controls from the implemented Memo/PasswordEdit/MaskedEdit/CheckedListBox/ProgressBar Stage-1 baseline, updating the canonical Showcase with each addition.
5. Add ActionList/dialog/project-setting infrastructure and application branding.
6. Build professional editor/debugger/refactoring features only on top of the stable source-backed model.
7. Add packages, localization, accessibility inspection and installed-workspace maturity after core contracts are versioned.

The native R1 promotion is no longer a blocker. Future native features must introduce a new explicit contract and repeat the same implementation -> release -> digest -> Offline Compiler -> public metadata -> Current Ready promotion sequence.