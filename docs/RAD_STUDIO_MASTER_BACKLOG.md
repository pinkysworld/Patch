# Patch Studio 1.0 RAD Master Backlog

## Product goal

Patch Studio 1.0 should be a complete source-backed RAD IDE for Patch: visually build desktop/web applications, edit properties and events, manage project resources, debug and package applications, while every designer action remains representable in ordinary Patch source or an explicit versioned project/resource contract.

The goal is not to clone Delphi file-for-file. The goal is to reach the same class of workflow: place components, edit properties/events, manage resources, run/debug quickly, and build deployable native applications without a hidden second application model.

## Non-negotiable architecture rules

1. **Source-backed by default.** Designer changes must round-trip through Patch source or a documented versioned project/resource manifest.
2. **No silent parity gaps.** A component is not marked Ready if Studio can place it but Web/native output silently drops it.
3. **One semantic model.** Studio, Web runtime, Win32, AppKit and GTK consume the same versioned control/property/event contract where applicable.
4. **Fail closed.** Unsupported properties/events/build targets produce an explicit diagnostic.
5. **Large-project stability.** Every RAD feature must survive real Chrome stress, multi-form projects and the complete CI matrix.
6. **Cross-platform release gate.** Windows, Linux and macOS must remain first-class. FreeBSD may stay console-only until a GUI backend exists.
7. **Accessibility and keyboard parity.** All designer operations must have keyboard-accessible equivalents.

## Current baseline

Already available or substantially implemented:

- multi-form Window projects;
- source-backed visual Form Designer;
- searchable Component Palette;
- Object Inspector with Properties and Events;
- Button, Input, Text, Checkbox, Radio, ComboBox, ListBox, Slider, Table, TreeView and Tabs authoring;
- StatusBar authoring;
- nonvisual Timer tray with OnTick;
- Panel Stage 1 authoring with structural child editor;
- visual Menu Designer with MenuItems, separators, shortcuts, enabled/checked bindings and OnClick;
- multi-select alignment, sizing and distribution;
- Anchors and Docking in the Object Inspector;
- Focus Order Stage 1 based on source order;
- drag/resize cancellation hardening;
- large Workshop Desk browser stress test;
- native Windows/macOS/Linux runtime line v1.5 and payload v14;
- token-free/offline compiler builds;
- public Patch Studio/PWA with content-addressed module graph.

## Priority model

- **P0 - correctness/stability:** must be done before broadening the component surface.
- **P1 - core RAD parity:** expected in a serious visual application builder.
- **P2 - professional IDE:** makes Patch Studio competitive as a daily development environment.
- **P3 - ecosystem/advanced tooling:** packages, extensibility and enterprise-scale workflows.

---

# Milestone R0 - RAD foundation hardening

Target: make the current designer safe enough to keep expanding.

## P0.1 Global UI name namespace

- validate IDs across top-level controls, Panel children, Tabs children, MenuItems and result dialogs;
- block collisions directly in Object Inspector before compiler/build time;
- use the same check for duplicate, paste and structural editors;
- add regression tests and PWA packaging.

**Done when:** no designer operation can create two UI/event targets with the same effective Patch name.

## P0.2 Undo/Redo transaction model

- source-backed Designer transaction boundary;
- Ctrl/Cmd+Z and Ctrl/Cmd+Shift+Z;
- coalesce one drag/resize into one history entry;
- coalesce Object Inspector Apply into one entry;
- form/component/menu structural operations are atomic;
- recovery stack must not corrupt project persistence.

**Done when:** every visual edit can be reversed and replayed predictably.

## P0.3 Designer performance and virtualization

- source/AST snapshot cache shared across designer adapters;
- render active Form by default instead of all forms at full cost;
- virtualize large Table/Tree designer previews where useful;
- benchmark Workshop Desk plus a 10-form/200-control stress fixture;
- worker-based parse/compile investigation for very large projects.

## P0.4 Consistent selection and property ownership

- one selection contract for core controls, Table, TreeView, Panel, StatusBar and future PictureBox;
- one dirty/apply/error state contract for Object Inspector adapters;
- one delete/duplicate/reveal-source command path;
- remove remaining adapter-specific behavior that can diverge.

---

# Milestone R1 - Graphics, images and visual resources

Target: provide the graphical component family expected from RAD Studio.

This milestone is intentionally early because graphical resources are a major missing part of the current Window stack.

## P1.1 Asset Manager

Create a project-level **Resources / Assets** tool window.

Required capabilities:

- add PNG, JPEG, WebP, SVG and ICO resources;
- preview image dimensions, format and file size;
- stable logical asset names independent of local source paths;
- rename/remove with reference validation;
- drag asset onto a Form to create a PictureBox;
- copy/paste asset references;
- project export/import includes resources;
- PWA/offline projects retain resources;
- release builds embed or package resources deterministically;
- SHA-256/resource manifest for reproducible builds.

Suggested explicit project contract:

```text
assets/
  logo.png
  toolbar/save.svg
patch.project.json
```

The project manifest may map logical names to files, but controls should reference logical asset IDs, not machine-specific absolute paths.

## P1.2 PictureBox / Image component

Promote the existing PictureBox Stage 1 syntax to a complete authoring/runtime contract.

Properties:

- Name;
- Source / Asset;
- X, Y, Width, Height;
- Visible;
- Enabled where meaningful;
- ScaleMode: `contain`, `cover`, `stretch`, `center`, `tile`;
- PreserveAspectRatio;
- TransparentBackground where backend permits;
- AltText / accessibility label;
- Anchors and Docking.

Events:

- OnClick;
- optional later OnLoad / OnError if a stable runtime event contract is added.

Runtime requirements:

- Web: native `<img>`/SVG rendering;
- Win32: real bitmap/icon decode and paint;
- AppKit: NSImage-backed rendering;
- GTK: GdkPixbuf/GtkPicture-backed rendering;
- deterministic asset lookup from packaged resources;
- explicit diagnostic for unsupported formats.

**Done when:** the same project logo displays in Studio preview, standalone Web App, Windows EXE, macOS app and Linux GUI build.

## P1.3 ImageList

A nonvisual RAD component similar in spirit to Delphi `TImageList`.

- lives in the nonvisual component tray;
- ordered logical images;
- key/name per image;
- standard logical size, e.g. 16/20/24/32;
- optional DPI variants;
- consumed by Toolbar/Menu/Button/Tree components;
- asset-manager backed, never duplicate raw image blobs in control source.

## P1.4 Shape component

Lightweight visual design component for common UI decoration.

Properties:

- Rectangle, RoundedRectangle, Ellipse, Line;
- Fill;
- Stroke;
- StrokeWidth;
- Radius;
- opacity;
- Anchors/Dock;
- optional OnClick.

Implement first in Web and the three desktop runtime adapters using native/simple drawing primitives.

## P1.5 PaintBox / Canvas component

A deliberate drawing surface for custom graphics rather than abusing PictureBox.

Stage 1:

- canvas/paintbox control;
- width/height/anchors/dock;
- OnPaint event contract;
- basic drawing operations: clear, line, rectangle, ellipse, text, image;
- deterministic coordinate system;
- clipping.

Stage 2:

- pointer/mouse events;
- paths;
- transforms;
- gradients;
- high-DPI scaling.

This requires a versioned drawing command contract shared by Web/Win32/AppKit/GTK.

## P1.6 Icons and application branding

- source-backed Form/window `icon` and Standalone Web favicon under `window-icon/1.0` (Studio/Web);
- Windows `.ico` packaging;
- macOS app icon/resource packaging;
- Linux desktop icon;
- PWA icons;
- visual project branding editor.

---

# Milestone R2 - Full Form Designer parity

## P1.7 Independent TabOrder

Replace Focus Order Stage 1 with a true source-backed independent focus order.

- explicit versioned `taborder`/focus metadata;
- Object Inspector `TabOrder` property;
- visual Tab Order mode overlay;
- keyboard reorder;
- source order/z-order unaffected;
- Web/Win32/AppKit/GTK honor the same order.

## P1.8 Z-order editor

- Bring to Front;
- Send to Back;
- Move Forward;
- Move Backward;
- explicit source-backed z-order where source order is insufficient;
- Layers/Object Tree view.

## P1.9 Grid and snapping

- configurable design grid;
- snap to grid;
- smart alignment guides;
- equal spacing guides;
- edge/center snapping;
- temporary Alt/Option bypass;
- rulers optional.

## P1.10 Clipboard and cross-form operations

- copy/cut/paste controls;
- preserve/rewrite IDs safely;
- copy nested Panel/Tabs content;
- copy event handlers when requested;
- paste into another Form/project;
- duplicate with offset;
- serialized clipboard schema version.

## P1.11 Locking and design-only properties

- Lock Controls;
- hide/show design guides;
- prevent accidental drag/resize;
- component tree selection still works;
- design-only preferences stay IDE state, not app semantics.

---

# Milestone R3 - Containers and layout

## P1.12 Panel Stage 2 native containment

Upgrade Panel from flow grouping to a true container contract.

- independent child coordinates relative to Panel;
- child Anchors/Docking relative to container;
- clipping;
- nested Panels;
- move controls into/out of Panel visually;
- drop target highlighting;
- runtime native parent/child containment on Win32/AppKit/GTK;
- Web DOM nesting parity.

## P1.13 GroupBox

- captioned container;
- child coordinates;
- anchors/docking;
- accessibility group semantics.

## P1.14 ScrollBox / ScrollPanel

- scrollable container;
- AutoScroll;
- horizontal/vertical scroll policies;
- nested content;
- mouse wheel/touch parity.

## P1.15 Splitter / SplitContainer

- resizable panes;
- orientation;
- min sizes;
- source-backed initial split;
- runtime user resize;
- optional persisted UI state later.

## P2.16 Flow/Grid layout containers

- FlowPanel;
- GridPanel;
- gap, padding and alignment;
- row/column definitions;
- responsive authoring.

---

# Milestone R4 - Standard component library

## P1 controls

- Label/Text;
- Button;
- Edit/Input;
- Memo/TextArea;
- MaskedEdit;
- PasswordEdit;
- Checkbox;
- RadioButton/RadioGroup;
- ComboBox;
- ListBox;
- CheckedListBox;
- Slider/TrackBar;
- ProgressBar;
- SpinEdit/NumberEdit;
- DatePicker;
- TimePicker;
- Calendar;
- LinkLabel;
- Separator;
- ScrollBar where standalone control is useful.

## P1 data/view controls

- Table/DataGrid advanced columns;
- TreeView icons and richer node metadata;
- ListView with icon/detail modes;
- Header control;
- property-driven sorting/filtering hooks.

## P2 shell/chrome controls

- ToolBar;
- ToolButton;
- ContextMenu/PopupMenu;
- richer StatusBar panels;
- PageControl/Tabs designer parity;
- CoolBar-style grouping only if it maps cleanly cross-platform.

Every component needs a parity matrix:

`Syntax | Designer | Object Inspector | Events | Web | Win32 | AppKit | GTK | Offline build | Accessibility | Tests`.

A component is Ready only when required columns are green.

---

# Milestone R5 - Actions, commands and dialogs

## P1.17 ActionList-style command model

Introduce a nonvisual reusable command/action abstraction.

- Name;
- Caption;
- Enabled;
- Checked;
- Shortcut;
- Icon/ImageList key;
- OnExecute;
- bind MenuItem, ToolButton and Button to one Action.

This prevents duplicate menu/toolbar command wiring and is a major Delphi-style productivity feature.

## P1.18 Dialog components

- OpenFileDialog;
- SaveFileDialog;
- SelectFolderDialog;
- Confirm/Message dialogs;
- ColorDialog;
- FontDialog where portable behavior is reasonable;
- standard Object Inspector representation for nonvisual dialogs.

---

# Milestone R6 - Project and resource system

## P1.19 Project Explorer 2.0

- Forms;
- source modules;
- assets/resources;
- generated artifacts;
- build configurations;
- dependencies/packages;
- drag/reorder where semantic;
- rename refactoring.

## P1.20 Project settings UI

- application name/version;
- app identifier;
- entry Form;
- output name;
- icons;
- target platforms;
- optimization/debug mode;
- Window defaults;
- reproducibility manifest.

## P2.21 Templates

- Blank Window App;
- Multi-form desktop app;
- Dashboard;
- CRUD-style app;
- Tool/utility app;
- Graphics/PaintBox demo;
- Workshop Desk Showcase;
- reusable Form/component templates.

---

# Milestone R7 - Code IDE parity

## P1.22 Professional code editor

- syntax highlighting;
- bracket/indent support;
- code folding;
- semantic diagnostics;
- autocomplete;
- event-handler completion;
- signature help;
- go to definition;
- find references;
- symbol rename;
- format document/selection;
- quick fixes.

## P1.23 Designer-Code navigation

- F12 / View Source;
- View Form;
- double-click control opens default event;
- Object Inspector event double-click;
- breadcrumb Form > Control > Event;
- synchronize selected control and source symbol.

## P2.24 Refactoring

- rename Form/control/thing/recipe safely;
- extract recipe;
- move source module;
- convert literal to thing;
- safe handler rename.

---

# Milestone R8 - Debugger and runtime inspection

## P1.25 Debugger Stage 1

- breakpoint gutter;
- Run/Continue;
- Pause;
- Step Into;
- Step Over;
- Step Out;
- current source line;
- locals/things/watch values;
- event-handler breakpoint support.

## P2.26 RAD event trace

- live event stream: click/change/tick/menu/action;
- inspect pre/post change state;
- Change IR trace link;
- replay selected event where deterministic.

## P2.27 Hot Reload

- apply safe UI/source changes without restarting application;
- explicit boundary for changes requiring rebuild;
- preserve runtime state when safe.

---

# Milestone R9 - Data binding and application state

## P2.28 Property bindings

- bind control text/value/enabled/visible/checked to Patch values;
- one-way binding first;
- explicit two-way binding later;
- validation diagnostics;
- no hidden observer graph.

## P2.29 Collection/data source abstraction

- ListSource/TableSource-like nonvisual components;
- Table/ListBox/Combo/Tree binding;
- sorting/filtering adapter;
- keep the data model ordinary Patch values where possible.

## P3.30 Database components

Only after the language/runtime security model is explicit:

- SQLite first;
- parameterized queries only;
- transaction component/API;
- visual connection/query inspector;
- schema browser;
- never embed secrets in generated source artifacts by default.

---

# Milestone R10 - Build, packaging and deployment

## P1.31 One-click desktop build UX

- Build/Run target selector;
- Windows x64;
- macOS ARM64/Intel or universal packaging;
- Linux x64;
- artifact pane with direct outputs;
- explicit local vs CI/cloud build mode;
- build diagnostics mapped to source.

## P2.32 App packaging

- Windows application folder and optional installer packaging;
- macOS `.app` bundle;
- Linux AppImage/tar package initially;
- assets/icons included automatically;
- release manifest and SHA256SUMS.

## P2.33 Signing/notarization hooks

- configurable signing inputs without storing secrets in the project;
- Windows code-sign hook;
- macOS signing/notarization hook;
- CI integration.

---

# Milestone R11 - Studio workspace and UX

## P1.34 Dockable IDE shell

- Project Explorer;
- Component Palette;
- Object Inspector;
- Code Editor;
- Form Designer;
- Output/Build;
- Diagnostics;
- Debugger panes;
- Assets;
- persistent layouts;
- reset layout;
- tabs and split editors.

## P1.35 Command system

- all major IDE actions represented as commands;
- Command Palette;
- configurable keyboard shortcuts;
- toolbar/menu reuse the same command IDs.

## P2.36 Themes and scaling

- light/dark/System;
- high-DPI Studio rendering;
- design-time DPI preview;
- font scaling/accessibility.

---

# Milestone R12 - Testing and quality tools

## P1.37 Integrated tests

- test explorer;
- run all/current test;
- pass/fail output;
- source navigation;
- GUI smoke-test fixtures.

## P2.38 UI test recorder

- optionally record component events into deterministic Patch test steps;
- replay against Web runtime first;
- cross-platform smoke subset later.

## P2.39 Coverage and diagnostics dashboard

- code coverage where supported;
- unused handler/control diagnostics;
- duplicate/unreachable UI action diagnostics;
- asset-reference diagnostics.

---

# Milestone R13 - Packages and component ecosystem

## P3.40 Package manager

- versioned Patch packages;
- dependency lock;
- offline cache;
- signed/checksummed packages;
- source package support first.

## P3.41 Custom RAD components

Define a supported component-extension contract:

- source grammar/lowering registration or declarative component schema;
- Designer metadata;
- Object Inspector properties/events;
- Web renderer;
- native backend adapters;
- icon/category;
- test contract.

Avoid arbitrary untrusted code execution inside Studio by default.

## P3.42 Component gallery

- discover/install components;
- version compatibility;
- security review metadata;
- remove/update safely.

---

# Milestone R14 - Localization, accessibility and production polish

## P2.43 Localization resources

- translatable strings resource table;
- locale preview;
- runtime locale selection;
- missing-string diagnostics.

## P2.44 Accessibility inspector

- accessible name/description;
- keyboard reachability;
- focus order checks;
- contrast hints for custom drawing;
- semantic roles where portable.

## P2.45 Error and crash UX

- no blank/hung Studio state;
- actionable parse/build diagnostics;
- recovery restore preview;
- safe-mode startup if a Studio module repeatedly crashes.

---

# Showcase and acceptance application

## Workshop Desk 2.0

Workshop Desk should evolve into the acceptance application for Patch Studio RAD.

It should eventually contain:

- 5+ Forms;
- menus and popup menus;
- toolbar/actions;
- status bar;
- Timer;
- nested Panels/GroupBoxes;
- Tabs;
- Table and TreeView;
- responsive Anchors/Docking;
- independent TabOrder;
- PictureBox with packaged logo/assets;
- ImageList icons;
- Shape/PaintBox graphics;
- file dialog;
- settings Form;
- data binding;
- tests;
- native Windows/macOS/Linux builds.

CI should build and smoke Workshop Desk on every supported GUI backend. It becomes the end-to-end proof that a RAD feature is real rather than Studio-only.

---

# Recommended execution order

## Immediate queue

1. Finish global UI-ID namespace guard.
2. Undo/Redo transaction model.
3. **Asset Manager foundation.**
4. **PictureBox/Image full cross-platform runtime.**
5. PictureBox RAD authoring and Object Inspector.
6. ImageList nonvisual component.
7. Shape component.
8. Independent TabOrder.
9. Grid/snap/clipboard designer improvements.
10. Panel Stage 2 native containment.

## Next queue

11. Toolbar + ActionList.
12. ContextMenu/PopupMenu.
13. Memo, ProgressBar, SpinEdit, Date/Time components.
14. ScrollBox, GroupBox, SplitContainer.
15. PaintBox/Canvas Stage 1.
16. Project Explorer 2.0 and project settings.
17. professional code editor features.
18. Debugger Stage 1.
19. one-click packaged desktop applications.

## Later queue

20. data binding;
21. test explorer;
22. Hot Reload;
23. SQLite/data components;
24. package/component ecosystem;
25. localization/accessibility tooling;
26. signing/notarization and production deployment workflows.

---

# Definition of "Patch Studio 1.0 RAD Complete"

Patch Studio can call itself a complete RAD Studio when all of the following are true:

- a new desktop GUI project can be created without editing boilerplate manually;
- Forms and standard visual/nonvisual components are fully authorable;
- images, icons and other resources are managed visually and packaged correctly;
- properties, events, anchors, docking, z-order and TabOrder are editable visually;
- nested containers work with real relative geometry;
- menus/toolbars/actions/dialogs are authorable;
- code navigation, completion and refactoring cover normal application development;
- breakpoints and step debugging work;
- Undo/Redo covers visual edits;
- projects can be built into functioning Windows, macOS and Linux applications through the Studio workflow;
- the same large acceptance project passes Web and native cross-platform CI;
- unsupported backend behavior is explicit rather than silently missing;
- there is no hidden second semantic application model that can drift from Patch source.

That is the release bar for Patch Studio 1.0 rather than simply accumulating more toolbox buttons.
