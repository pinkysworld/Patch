# Patch Studio 1.0 RAD Master Backlog

Status synchronized: **2026-08-31**

This is the long-term execution backlog for Patch Studio. `docs/ROADMAP.md` is the shorter current product-status view. Issue **#282** tracks R0 architecture hardening. Issue **#319** tracks the native Window-icon implementation/promotion sequence. `docs/OFFLINE_STUDIO.md` owns the installed/offline IDE contract.

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
10. **Implementation is not promotion.** Experimental native contracts remain separate from Current Ready until release assets, digests, linker/offline paths and product metadata are all verified.

## Current baseline

### Current product contract

- Patch **0.2.0-beta.36**;
- Change IR **0.10**;
- Current Ready Native GUI IR **1.7**, payload **v17**, runtime **v1.8**;
- Studio project/resource bundle **v4**;
- Component Registry **0.8**;
- source-backed multi-Form Designer, Component Palette and Object Inspector;
- Button, Input, Text, Checkbox, Radio, ComboBox, ListBox, Slider, Table, TreeView, Tabs, Picture, Shape, PaintBox, StatusBar, Timer, ImageList, Menu and Panel Stage 1 authoring;
- source-backed Anchors/Dock, alignment/sizing/distribution, grid snap, z-order commands, Focus Order Stage 1 and Undo/Redo transactions;
- project Resource Manager with deterministic resource metadata and recovery/export/import;
- Standalone Web and Ready native Windows/macOS/Linux paths for the current native component contract;
- token-free Offline Compiler/linker and sealed native runtime templates;
- public content-addressed PWA plus real-Chrome startup/Workshop checks;
- six-Form Workshop Desk acceptance/stress application;
- Offline Studio rolling Stage 1 release channel **`offline-studio-v0.2`**;
- Offline Compiler rolling release channel **`offline-compiler-v0.2`**.

### Implemented next native contracts, not yet Current Ready

- **IR 1.8 / payload v18 / runtime v1.9**: ImageList/Button image transport plus Win32/AppKit/GTK Button consumers;
- **IR 1.9 / payload v19 / runtime v1.10**: application/Form Window-icon transport plus Win32/AppKit/GTK consumers, preserving the complete v1.9 layer;
- `native-window-icon-packaging/0.1`: deterministic application-icon packaging artifacts;
- `native-window-icon-package-v110/0.2`: Windows/macOS/Linux runtime-v1.10 package plans;
- `windows-pe-icon-v110/0.1`: bounded in-place project-icon embedding into a reserved Windows PE application-icon slot;
- normal Windows runtime-v1.10 artifact carries and verifies that reserved PE slot;
- real Windows `ExtractAssociatedIcon` + `--patch-smoke` evidence is green;
- macOS `.icns` + `CFBundleIconFile` package plan is green;
- Linux hicolor + `.desktop` package plan is green.

`src/native-current-contract.js` intentionally remains **1.7 / 17 / 1.8** until the release/digest/Offline-Compiler promotion gate is complete.

## Priority model

- **P0 correctness/stability:** required before broad component expansion.
- **P1 core RAD parity:** expected in a serious visual application builder.
- **P2 professional IDE:** daily-development productivity.
- **P3 ecosystem/advanced tooling:** packages, extensibility and enterprise-scale workflows.

---

# Milestone R0 - RAD foundation hardening

Target: keep the source-backed Studio responsive and coherent as projects and component count grow. Issue **#282** is the active tracker.

## P0.1 Global UI name namespace

Status: **substantially implemented**.

- [x] shared namespace enumeration across core controls, nested Panel/Tabs controls, MenuItems and result-dialog targets;
- [x] Object Inspector collision guard;
- [ ] use the same namespace guard for every duplicate/paste/structural-editor path;
- [ ] explicit regression coverage for every nested/new component family.

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
- [x] six-Form Workshop Desk preserved by the declaration-only model;
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

- [ ] one selection contract for core controls and specialized adapters;
- [ ] one dirty/apply/error contract for Object Inspector adapters;
- [ ] one delete/duplicate/reveal-source command path;
- [ ] remove adapter-specific behavior that can diverge.

## P0.7 Studio module boundaries

`web/playground.js` still owns too much orchestration and runtime behavior.

- [ ] extract Studio Run/runtime lifecycle;
- [ ] extract Window/control DOM renderer;
- [ ] extract transient runtime selection/state;
- [ ] extract Build controller;
- [ ] keep `playground.js` as orchestration rather than a second framework;
- [ ] remove obsolete duplicate Workshop/Harbor compatibility source once migration coverage no longer needs it.

## P0.8 CI/deployment reliability

- [ ] make Pages deployment release-aware so just-publishing runtime assets do not create expected red workflows;
- [x] retain fail-closed runtime/digest verification;
- [x] live HTTP/Chrome verification after deploy;
- [x] deployed Tutorials/Examples handbook surfaces live-smoked after Pages deployment;
- [ ] reduce notification noise without weakening gates;
- [ ] shrink Offline Compiler triggers/package closure so unrelated source changes do not rebuild every platform.

**R0 exit criterion:** Designer editing and Form switching are bounded, do not execute unrelated application behavior, typical events do not rebuild the complete visible app tree, and regressions are measured in CI.

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
- [ ] drag asset directly onto Form as Picture;
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

Status: **authoring/Web and first native Button consumer implemented; product promotion still pending**.

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
- [ ] promote through the combined IR 1.9 / payload v19 / runtime v1.10 release line;
- [ ] reuse transport for ToolBar/ToolButton/Menu/Tree consumers only after those contracts exist;
- [ ] optional DPI variants after the base cross-platform transport is promoted.

Current Ready IR 1.7 still fails closed for ImageList/Button images by design.

## P1.4 Shape

- [x] Rectangle/RoundedRectangle/Ellipse/Line source/Designer/Web contract;
- [x] fill/stroke/stroke width/radius/opacity/layout authoring;
- [x] native Win32/AppKit/GTK lowering/runtime parity through preserved IR 1.5+ contract;
- [ ] richer interactions only when required by real applications.

## P1.5 PaintBox / Canvas

- [x] source/Designer/Web PaintBox;
- [x] pure paint-event drawing program;
- [x] clear/line/rectangle/ellipse/text;
- [x] `draw image` with bounded PNG/JPEG project resources through Current Ready IR 1.7 / payload v17 / runtime v1.8;
- [ ] pointer/mouse event contract;
- [ ] paths/transforms/gradients;
- [ ] higher-DPI drawing model beyond current basics.

## P1.6 Icons and application branding

Status: **native runtime and platform packaging implemented; product promotion open**.

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
- [ ] PWA icon-set generation;
- [ ] visual branding editor in Project Settings;
- [ ] Current Ready promotion after release/digest/Offline-Compiler gates.

### R1 native promotion gate

The implementation side of native ImageList/Button and Window/application icons is complete. Current Ready promotion still requires:

- [ ] publish versioned runtime-v1.10 release assets for Windows, macOS and Linux;
- [ ] publish and verify their SHA-256 digests;
- [ ] wire browser/native Ready runtime lookup to those verified assets;
- [ ] wire Offline Compiler linking to IR 1.9 / payload v19 / runtime v1.10;
- [ ] update generated component capability metadata and public release/download surfaces;
- [ ] only then move `src/native-current-contract.js` from 1.7 / 17 / 1.8 to 1.9 / 19 / 1.10.

**R1 native implementation exit:** complete. **R1 product-promotion exit:** open until every unchecked promotion item above is green.

---

# Milestone R2 - Full Form Designer parity

## P1.7 Independent TabOrder

- [ ] explicit source-backed `TabOrder` independent from source/z-order;
- [ ] Object Inspector property;
- [ ] visual Tab Order overlay/mode;
- [ ] keyboard reorder;
- [ ] Web/Win32/AppKit/GTK honor one order.

## P1.8 Layers and z-order

- [x] front/back/forward/backward source-backed actions;
- [ ] Layers/Object Tree view;
- [ ] explicit containment visualization;
- [ ] source-backed z-order metadata only where source order is insufficient;
- [ ] keyboard layer operations.

## P1.9 Grid and smart guides

- [x] configurable design-grid snap and alignment actions;
- [ ] richer edge/center/equal-spacing smart guides;
- [ ] temporary Alt/Option bypass;
- [ ] optional rulers;
- [ ] design-only guide visibility preferences.

## P1.10 Clipboard and cross-Form operations

- [ ] versioned clipboard schema;
- [ ] copy/cut/paste controls and nested content;
- [ ] collision-safe ID rewriting;
- [ ] optional event-handler copy;
- [ ] paste into another Form/project;
- [ ] duplicate with offset.

## P1.11 Lock Controls

- [ ] lock drag/resize without preventing selection/inspection;
- [ ] per-control/Form lock state as design-only IDE metadata;
- [ ] keyboard command and visual indication.

---

# Milestone R3 - Containers and layout

## P1.12 Panel Stage 2 native containment

- [ ] child coordinates relative to Panel;
- [ ] child Anchors/Dock relative to container;
- [ ] clipping;
- [ ] nested Panels;
- [ ] visual move into/out of Panel with drop highlighting;
- [ ] true Win32/AppKit/GTK parent-child containment;
- [ ] Web DOM nesting parity.

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

## P1 controls

- [ ] Memo/TextArea;
- [ ] MaskedEdit;
- [ ] PasswordEdit;
- [ ] CheckedListBox;
- [ ] ProgressBar;
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
- [ ] Workshop Desk Showcase;
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

- [ ] F12/View Source and View Form;
- [ ] double-click control opens default event;
- [ ] Object Inspector event double-click;
- [ ] Form > Control > Event breadcrumb;
- [ ] synchronize selected control/source symbol.

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
- [ ] explicit rebuild boundary;
- [ ] preserve runtime state only when semantically safe.

---

# Milestone R9 - Data binding and application state

## P2.28 Property bindings

- [ ] bind text/value/enabled/visible/checked to Patch values;
- [ ] one-way binding first;
- [ ] explicit two-way binding later;
- [ ] validation diagnostics;
- [ ] no hidden observer graph.

## P2.29 Collection/data source abstraction

- [ ] ListSource/TableSource-style nonvisual components;
- [ ] Table/ListBox/Combo/Tree binding;
- [ ] sorting/filtering adapters;
- [ ] keep data as ordinary Patch values where possible.

## P3.30 Database components

Only after the language/runtime security model is explicit:

- [ ] SQLite first;
- [ ] parameterized queries only;
- [ ] transactions;
- [ ] visual connection/query inspector;
- [ ] schema browser;
- [ ] never embed secrets in generated source artifacts by default.

---

# Milestone R10 - Build, packaging and deployment

## P1.31 One-click desktop build UX

Current Studio has target selection and Ready downloads for the current native contract. Remaining professional workflow:

- [ ] first-class artifact pane with direct outputs/checksums;
- [ ] explicit **Local / Remote** build mode;
- [ ] host-native offline build path using embedded/installable compiler/runtime;
- [ ] build diagnostics mapped to source;
- [ ] clear architecture selection where relevant.

## P2.32 App packaging

Application-icon packaging for the experimental v1.10 native line is implemented. Broader install/distribution packaging remains:

- [ ] Windows app folder and installer option;
- [ ] macOS `.app` distribution polish beyond the current deterministic package plan;
- [ ] Linux AppImage/tar or other justified format;
- [x] experimental Windows/macOS/Linux application-icon packaging contracts;
- [ ] release manifest/SHA256SUMS for the promoted v1.10 line;
- [ ] explicit uninstall path for installers.

## P2.33 Signing/notarization

- [x] fail-closed Windows signing hooks;
- [x] fail-closed macOS signing/notarization hooks;
- [ ] real Windows signing evidence;
- [ ] real macOS notarization evidence;
- [ ] production-signed/notarized Offline Studio releases.

---

# Horizontal Track O1 - Offline Patch Studio IDE

See `docs/OFFLINE_STUDIO.md` and `web/downloads.html`.

## O1.1 Stage 1 self-contained IDE

- [x] deterministic `patch-offline-studio-manifest` v1;
- [x] per-file SHA-256 plus whole-site closure hash;
- [x] Node SEA builder embedding the same generated Studio application used by the hosted site;
- [x] loopback-only `127.0.0.1` server;
- [x] random per-launch URL prefix;
- [x] restrictive CSP/security headers and no outbound requirement for core Studio use;
- [x] Windows, macOS and Linux platform executables built and self-smoked in CI;
- [x] pre-publication release-bundle gate comparing embedded manifests;
- [x] stable rolling `offline-studio-v0.2` release assets;
- [x] release `offline-studio-manifest.json` and `SHA256SUMS`;
- [x] public Downloads/README/Patch Studio/Offline Studio docs share the same asset contract.

Stage 1 supports offline authoring, Designer/Run and browser-local build targets. It does **not** yet claim host-native desktop compilation from inside the IDE.

## O1.2 Stage 2 host-native local build

- [ ] embed/install the Patch Offline Compiler beside the IDE;
- [ ] embed host-platform sealed GUI/console runtimes;
- [ ] narrow authenticated localhost build API, never a general shell API;
- [ ] workspace/path authorization;
- [ ] Windows host builds Windows locally;
- [ ] macOS host builds macOS locally;
- [ ] Linux host builds Linux locally;
- [ ] output/checksum/diagnostic integration in artifact pane;
- [ ] no GitHub token or network dependency.

Cross-compiling all desktop targets from every host is not required initially.

## O1.3 Stage 3 installed-IDE integration

- [ ] direct Open/Save/Project Folder flow;
- [ ] recent projects;
- [ ] file associations;
- [ ] workspace permission boundaries;
- [ ] OS packaging/installers;
- [ ] optional update checks that never block offline use.

A Tauri/Electron-style shell should only be adopted if it materially improves OS integration. Patch Studio should remain one browser-module-compatible application, not two diverging IDEs.

---

# Milestone R11 - Studio workspace and UX

## P1.34 Dockable IDE shell

- [ ] fully dockable/persisted Project Explorer, Palette, Inspector, Code, Designer, Output, Diagnostics, Debugger and Assets panes;
- [ ] split editors;
- [ ] named layouts/reset layout;
- [ ] keyboard-accessible docking.

## P1.35 Command system

- [x] Command Palette foundation;
- [ ] represent every major IDE action as a command ID;
- [ ] configurable keyboard shortcuts;
- [ ] menus/toolbars reuse the same command model.

## P2.36 Themes and scaling

- [ ] light/dark/System;
- [ ] high-DPI Studio rendering;
- [ ] design-time DPI preview;
- [ ] font scaling/accessibility.

---

# Milestone R12 - Testing and quality tools

## P1.37 Integrated tests

- [ ] Test Explorer;
- [ ] run all/current test;
- [ ] pass/fail output and source navigation;
- [ ] GUI smoke fixtures.

## P2.38 UI test recorder

- [ ] record component events into deterministic Patch test steps where safe;
- [ ] Web replay first;
- [ ] cross-platform smoke subset later.

## P2.39 Coverage and diagnostics dashboard

- [ ] coverage where supported;
- [ ] unused handler/control diagnostics;
- [ ] duplicate/unreachable UI action diagnostics;
- [ ] asset-reference diagnostics.

---

# Milestone R13 - Packages and component ecosystem

## P3.40 Package manager

- [ ] versioned Patch packages;
- [ ] dependency lock;
- [ ] offline cache;
- [ ] signed/checksummed packages;
- [ ] source package support first.

## P3.41 Custom RAD components

- [ ] supported declarative extension/component schema or tightly controlled registration model;
- [ ] Designer metadata;
- [ ] Object Inspector properties/events;
- [ ] Web renderer;
- [ ] native backend adapters;
- [ ] icon/category;
- [ ] mandatory compatibility/tests;
- [ ] avoid arbitrary untrusted Studio code execution by default.

## P3.42 Component gallery

- [ ] discover/install/update/remove components;
- [ ] version compatibility;
- [ ] security-review metadata;
- [ ] offline package import.

---

# Milestone R14 - Localization, accessibility and production polish

## P2.43 Localization resources

- [ ] translatable string table;
- [ ] locale preview/runtime selection;
- [ ] missing-string diagnostics.

## P2.44 Accessibility inspector

- [ ] accessible name/description;
- [ ] keyboard reachability;
- [ ] focus-order checks;
- [ ] contrast hints for custom drawing;
- [ ] portable semantic roles;
- [ ] manual Narrator/VoiceOver/Orca evidence before any conformance claim.

## P2.45 Error/crash UX

- [ ] no blank/hung Studio state;
- [ ] actionable parse/build diagnostics;
- [ ] recovery restore preview;
- [ ] safe-mode startup for repeated module failures;
- [ ] local privacy-redacted crash/report workflow.

---

# Showcase and acceptance application

## Workshop Desk 2.0

- [x] six meaningful Forms and real browser Run;
- [x] current menus/status/Timer/Tabs/Table/TreeView/Anchors/Dock families where implemented;
- [x] Picture/Shape/PaintBox resource/graphics families including PaintBox `draw image`;
- [x] current Windows/macOS/Linux Ready native surface;
- [x] Offline Studio Stage 1 embeds and runs the same Studio application surface;
- [ ] add an experimental native ImageList/Button-image acceptance path before promotion;
- [ ] add an experimental Window-icon/package acceptance path to the canonical showcase rather than only dedicated fixtures;
- [ ] toolbar/actions/popup menus after those components exist;
- [ ] nested Panel Stage 2/GroupBox;
- [ ] independent TabOrder;
- [ ] standard file dialog;
- [ ] settings/project-state scenario;
- [ ] property/data binding;
- [ ] integrated tests;
- [ ] Offline Studio host-native build acceptance.

CI should use Workshop Desk to prove a feature is real across claimed targets rather than Studio-only.

---

# Current execution order

This queue is authoritative for sequencing. Completed architecture foundations and native R1 implementation work are intentionally absent from the open queue.

## Immediate queue

1. Finish R0 module boundaries: extract runtime lifecycle, Window renderer, transient UI state and Build controller from `web/playground.js`.
2. Define the Web Worker boundary and only then add Table/Tree preview virtualization where measurement justifies it.
3. Make Pages deployment release-aware and reduce expected CI notification noise without weakening fail-closed verification.
4. Publish and verify the **runtime v1.10** Windows/macOS/Linux release assets and SHA-256 digests.
5. Promote Offline Compiler/native linking through **IR 1.9 / payload v19 / runtime v1.10**, then switch `src/native-current-contract.js` only after the complete gate is green.
6. Start Offline Studio Stage 2 host-native local build bridge using the promoted compiler/runtime assets.

## Next queue

7. Independent TabOrder and visual Tab Order mode.
8. Clipboard/Lock Controls/Layers and richer smart guides.
9. Panel Stage 2, GroupBox, ScrollBox and SplitContainer.
10. ToolBar/ToolButton/PopupMenu plus ActionList, reusing the implemented ImageList transport where appropriate.
11. Memo, ProgressBar, SpinEdit and Date/Time controls.
12. Project Explorer 2.0, Project Settings, application branding/PWA icon-set generation and templates.
13. Professional code-editor services and Designer-code navigation.
14. Debugger Stage 1 plus Patch semantic event/change timeline.
15. One-click packaged desktop applications and installer workflow.

## Later queue

16. property/data binding;
17. Test Explorer/UI recorder;
18. safe Hot Reload;
19. SQLite/data components;
20. package/component ecosystem;
21. localization/accessibility tooling;
22. production signing/notarization/update/distribution evidence.

---

# Definition of "Patch Studio 1.0 RAD Complete"

Patch Studio can call itself a complete RAD Studio when all of the following are true:

- a new GUI project can be created without manual boilerplate;
- Forms and a practical visual/nonvisual component library are fully authorable;
- images/icons/resources are managed visually and packaged correctly;
- properties/events/anchors/docking/z-order/TabOrder are editable visually;
- nested containers have real relative geometry;
- menus/toolbars/actions/dialogs are authorable;
- normal code navigation/completion/refactoring works;
- breakpoints and step debugging work;
- Undo/Redo covers visual edits;
- projects build into functioning Windows/macOS/Linux/Web applications through Studio;
- the installed IDE can perform normal authoring, Run and host-native Build offline without GitHub or a token;
- the same large acceptance project passes Web and native cross-platform CI;
- unsupported backend behavior is explicit rather than silently missing;
- there is no hidden second semantic application model that can drift from Patch source;
- Patch-specific semantic change authority, Change IR and causal/event inspection remain visible advantages rather than being hidden behind the RAD UI.

That is the Patch Studio 1.0 bar. The objective is a Delphi/VB-class rapid workflow with Patch-native semantics, not a visual clone with a different logo.