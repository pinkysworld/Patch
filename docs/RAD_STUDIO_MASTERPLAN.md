# Patch Studio RAD masterplan

Status: proposed implementation plan
Target: turn Patch Studio into a complete source-backed RAD environment in the spirit of Delphi / RAD Studio while preserving Patch's explicit-change semantics and cross-platform compiler model.

## Product goal

Patch Studio should support the complete desktop RAD loop:

1. create a project from a template;
2. visually design one or more Forms;
3. drag components from a context-aware Component Palette;
4. edit Properties and Events in an Object Inspector;
5. manage images, icons, strings, data and other project resources;
6. navigate between Form, Code, Events and project structure;
7. Run / Debug instantly;
8. Build a self-contained application for the selected target;
9. package and distribute the result without requiring users to understand the underlying compiler pipeline.

The design must remain source-backed. The visual designer edits Patch source/project resources rather than maintaining a second hidden UI model.

## Design principles

- Source is authoritative. Designer operations must serialize deterministically to Patch source or explicit project resources.
- One component metadata model. Parser, Designer, Object Inspector, browser preview, native lowering, documentation and tests should consume the same component descriptors where practical.
- Visual and nonvisual components share the same design-time ownership model.
- Persistent application state still changes through Patch semantic `change`; UI event state remains transient unless application code explicitly changes state.
- Unsupported native features fail closed rather than silently degrading.
- Browser preview and native runtimes should share a documented capability matrix.
- Designer-only metadata must be clearly separated from runtime semantics.
- Every new component needs parser, serializer/designer, inspector, preview/runtime and regression coverage before it is called complete.

## Target IDE shell

### Main surfaces

- Project Manager / Project Tree
- Form Designer
- Code Editor
- Object Inspector
- Component Palette
- Structure / Component Tree
- Events view
- Resources view
- Data Module Designer
- Debug panels
- Build / Deployment panels
- Problems / Diagnostics panel
- Output / Console
- Search / Replace results
- Command Palette

### Workspace behavior

- dockable panels;
- tabbed documents;
- remembered workspace layouts;
- Reset Layout command;
- keyboard-accessible pane switching;
- multi-monitor-ready desktop shell later;
- responsive web fallback for smaller screens;
- command and component search everywhere.

## Unified component architecture

Introduce a component registry as the canonical design-time catalog. A descriptor should include at least:

- type id;
- display name;
- category;
- visual / nonvisual;
- container capability;
- default size;
- icon;
- source syntax serializer/parser hooks;
- property schema;
- event schema;
- design-time renderer;
- browser runtime renderer;
- native support matrix;
- accessibility metadata;
- default anchors / docking policy;
- minimum supported runtime contract.

This replaces scattered hard-coded lists as the component surface grows.

## Component Palette target

### Standard

- Label / Text
- Button
- Edit / Input
- Memo
- Masked Edit
- Password Edit
- Checkbox
- RadioButton
- RadioGroup
- ComboBox
- ListBox
- CheckListBox
- Slider / TrackBar
- ProgressBar
- SpinEdit / NumericEdit
- DatePicker
- TimePicker
- Calendar
- LinkLabel

### Containers

- Panel
- GroupBox
- ScrollBox
- Tabs / PageControl
- SplitView / Splitter
- FlowPanel
- GridPanel
- Frame / reusable visual component
- Card / Surface

### Navigation and chrome

- MainMenu
- PopupMenu / ContextMenu
- ToolBar
- StatusBar
- ActionList
- ImageList
- NavigationBar

### Lists and data presentation

- Table / Grid
- Virtual Grid
- TreeView
- ListView
- HeaderControl
- PropertyGrid later
- Chart

### Graphics and images

This is the first new component family to implement.

#### Picture / Image

Patch already has `picture` language/runtime groundwork. Complete the RAD surface with:

- Component Palette entry;
- drag/drop and click-to-add;
- source-backed Designer creation;
- Object Inspector properties;
- resource picker;
- preview rendering;
- native parity tests.

Target properties:

- Name
- Source
- Resource
- Stretch
- Proportional
- Center
- Fit mode: contain / cover / fill / none
- Opacity
- Visible
- Enabled where meaningful
- Hint / accessible description
- X / Y / Width / Height
- Anchors / Dock

#### Shape

- rectangle;
- rounded rectangle;
- ellipse;
- line;
- fill;
- stroke;
- stroke width;
- corner radius;
- opacity.

#### PaintBox / Canvas

Provide an explicit drawing surface comparable to Delphi `TPaintBox`.

Initial drawing API:

- clear;
- line;
- rectangle;
- ellipse;
- text;
- image;
- path later;
- fill/stroke colors;
- line width;
- clipping later.

Events:

- paint;
- clicked;
- pointer down / move / up in a later input stage.

The paint event must not create hidden persistent state. Application code explicitly changes state where persistence is intended.

#### ImageList

Nonvisual project component for reusable icons and bitmaps:

- named images;
- logical sizes;
- multi-resolution variants;
- light/dark variants later;
- use from Button, ToolBar, TreeView, ListView, Menu and Tabs.

#### Icon / SVG

- SVG resource display;
- project icon selection;
- component glyphs;
- scalable rendering;
- safe SVG handling in browser preview.

### Dialogs

- OpenFileDialog
- SaveFileDialog
- SelectFolderDialog
- ColorDialog
- FontDialog
- Message / Confirm dialog
- FindDialog later

### Nonvisual system components

- Timer
- FileSystem / File watcher
- HTTP client
- Process launcher with explicit capability policy
- Clipboard
- Notification
- Settings / Preferences
- ApplicationEvents

### Data access

A Delphi-like RAD environment eventually needs data-aware development, but Patch should not copy VCL coupling blindly.

Stage 1:

- Data Module
- DataSource
- in-memory Dataset
- JSON Dataset
- CSV Dataset
- REST Dataset

Stage 2:

- SQLite connection
- SQL query
- parameters
- transactions
- data-aware Grid / Edit / ComboBox

Stage 3:

- PostgreSQL / MySQL adapters through explicit packages;
- schema browser;
- query designer;
- migrations.

Persistent writes should integrate with Patch change authority instead of bypassing the semantic model.

## Object Inspector target

The Object Inspector should become schema-driven.

### Properties tab

Categories:

- Identity
- Appearance
- Layout
- Behavior
- Data
- Accessibility
- Resources
- Advanced

Editors:

- text;
- number;
- boolean;
- enum dropdown;
- color picker;
- font editor;
- resource picker;
- collection editor;
- string-list editor;
- image editor;
- anchors editor;
- docking editor;
- expression editor.

Features:

- property search;
- favorites;
- reset to default;
- multi-selection common properties;
- modified-property indication;
- copy/paste properties;
- component references;
- expandable nested properties.

### Events tab

- all events declared from component metadata;
- double-click creates/navigates to handler;
- dropdown lists compatible existing handlers;
- remove binding without deleting code;
- event handler rename support;
- navigation back to component;
- event documentation tooltip.

## Form Designer target

Already implemented foundations should be extended into a complete visual designer.

Required capabilities:

- drag from Component Palette;
- draw-to-size placement;
- click-to-add placement;
- multi-select;
- marquee select;
- move / resize;
- keyboard move / resize;
- alignment guides;
- grid / snap;
- align left/right/top/bottom;
- distribute horizontally/vertically;
- same width / same height / same size;
- center on Form;
- z-order;
- anchors;
- docking;
- parent/child reparenting by drag;
- container-aware placement;
- copy / cut / paste;
- duplicate;
- undo / redo of designer edits;
- tab order / focus order;
- lock controls;
- hide controls at design time;
- component tree synchronized with canvas;
- context menu;
- zoom;
- rulers optional;
- responsive/device preview later.

## Form inheritance and reusable UI

To approach Delphi productivity, Patch needs reusable design units.

### Frames

First milestone:

- reusable visual component tree;
- source-backed Frame definition;
- insert Frame onto Forms;
- parameter/property exposure;
- events.

### Form templates

- Blank Form
- Dialog
- Settings window
- Master/detail
- Dashboard
- Data browser

True visual inheritance can follow Frames after the source serialization and override rules are stable.

## Resources subsystem

Add an explicit project resource manifest instead of embedding arbitrary binary data in source.

Resource kinds:

- image;
- SVG;
- icon;
- cursor later;
- text/string table;
- JSON;
- binary asset;
- localization catalog.

Resource Manager features:

- import files;
- drag/drop;
- preview;
- rename logical resource id;
- detect unused resources;
- replace resource without changing code;
- variant support for DPI and themes;
- deterministic hashes;
- build embedding;
- project export/import.

Suggested project syntax uses logical references, not machine-local paths, for example:

```patch
picture as logo from resource("app.logo")
```

Exact syntax should be specified before implementation.

## Graphics API

Create a cross-platform graphics abstraction used by Picture, Shape, PaintBox, Chart and future custom controls.

Core concepts:

- Color
- Point
- Size
- Rect
- Brush
- Pen
- Font
- Bitmap/Image
- Canvas
- Path later

Backends:

- browser Canvas/SVG as appropriate;
- Win32 graphics backend;
- AppKit/CoreGraphics;
- GTK/Cairo or selected GTK drawing API.

Do not expose backend-specific handles in ordinary Patch source.

## Events and input model

Standardize component events rather than extending parser regexes independently for every control.

Families:

- clicked;
- changed;
- selected;
- opened / closed;
- focus gained / lost;
- key down / key up;
- pointer down / move / up;
- double clicked;
- drag/drop later;
- paint;
- ticked for Timer.

Event capability should be declared in component metadata so the Event Inspector only offers valid events.

## Menus, actions and commands

Add Delphi-like reusable actions:

- ActionList nonvisual component;
- action Name, Caption, Enabled, Checked, Shortcut, Image;
- Button/Menu/ToolBar items bind to an action;
- one event handler can drive multiple UI surfaces;
- application commands become easier to enable/disable consistently.

This should reuse Patch semantic state rather than introduce hidden mutable action state.

## Data Module Designer

Nonvisual design surface for:

- Timer;
- ImageList;
- ActionList;
- DataSource;
- Dataset;
- database connections;
- HTTP clients;
- services.

The existing nonvisual tray is a useful bridge, but a dedicated Data Module becomes preferable once the number of nonvisual components grows.

## Code editor and language tooling

RAD productivity also depends on editor intelligence.

Target:

- syntax highlighting;
- diagnostics while typing;
- completion;
- hover documentation;
- go to definition;
- find references;
- rename symbol;
- outline;
- semantic selection;
- parameter hints;
- code actions;
- format document;
- snippets;
- event-handler generation;
- component name completion;
- resource id completion;
- project-wide search/replace.

Longer term: expose these through a Patch Language Server so Studio and external editors share the same intelligence.

## Debugger target

A complete RAD Studio needs integrated debugging.

Milestones:

1. Run with structured console/output.
2. Source-line runtime errors and stack trace.
3. Breakpoints in interpreter/browser runtime.
4. Step over / into / out.
5. Locals / watches.
6. Change history and Patch-specific semantic change timeline.
7. Native debug adapter integration later.

Patch can differentiate itself by making Change IR / change signatures visible in the debugger as a first-class semantic timeline.

## Project system

Extend multi-file bundle v3 into explicit project concepts:

- project settings;
- Forms list;
- startup Form;
- source units/modules;
- resources;
- Data Modules;
- dependencies/packages;
- target platforms;
- build configurations;
- app metadata;
- application icon;
- version information;
- signing settings;
- deployment assets.

## Packages and third-party components

A Delphi-like ecosystem requires installable libraries/components.

Package stages:

1. source library packages;
2. component metadata packages;
3. custom visual components using approved drawing primitives;
4. package registry/index;
5. version constraints and lock file;
6. signed package metadata later.

Third-party components must not be able to bypass Patch change/capability rules simply because they are visual.

## Build and deployment UX

The user-facing workflow should be:

- Run
- Build
- Build Release
- Package

Target profiles:

- Web
- Windows
- macOS
- Linux
- FreeBSD where supported

Later:

- Android
- iOS

Each target page should show supported component/runtime capabilities before build and fail early on unsupported controls.

Build output should include:

- executable/application bundle;
- embedded resources;
- version metadata;
- icon;
- optional installer/package;
- reproducibility manifest;
- hashes.

## Mobile / multi-device stage

Do not begin with a separate incompatible widget library. Reuse the component registry and add target capability flags.

Needed later:

- device preview sizes;
- orientation;
- safe areas;
- touch events;
- DPI scaling;
- adaptive layouts;
- mobile packaging/signing.

## Accessibility

Every standard component descriptor should declare:

- role;
- accessible name strategy;
- keyboard behavior;
- focusability;
- state exposure.

Designer checks should flag:

- image without accessible description when meaningful;
- unlabeled input;
- broken focus order;
- insufficiently named action controls;
- inaccessible custom PaintBox where semantic alternatives are required.

## Testing contract for every component

A component is complete only when the following exist:

1. parser tests;
2. source serialization round-trip tests;
3. Designer add/edit/delete tests;
4. Object Inspector tests;
5. browser preview tests;
6. event tests where applicable;
7. accessibility tests;
8. native lowering tests;
9. Windows runtime tests where supported;
10. macOS runtime tests where supported;
11. Linux runtime tests where supported;
12. docs/example;
13. site packaging/offline-cache closure tests.

## Implementation phases

### Phase R1: component registry and graphics foundation

- canonical component metadata registry;
- migrate existing Component Palette catalog to registry;
- migrate default sizes and event capabilities gradually;
- complete Picture/Image RAD integration;
- Resource Manager Stage 1;
- Shape;
- PaintBox/Canvas Stage 1;
- ImageList Stage 1;
- graphics capability matrix;
- tests and examples.

Exit criterion: images and simple custom drawing can be added visually, configured in Object Inspector, previewed in browser and built on supported desktop targets.

### Phase R2: Delphi-grade Form Designer

- drag/drop palette;
- marquee select;
- full arrange/distribute/same-size commands;
- reparenting;
- component tree;
- undo/redo transaction model for designer edits;
- lock controls;
- zoom;
- improved context menus;
- collection editors.

Exit criterion: ordinary desktop forms can be built primarily without hand-editing layout source.

### Phase R3: standard desktop component expansion

- Memo;
- GroupBox;
- ProgressBar;
- SpinEdit;
- Date/Time controls;
- Calendar;
- Splitter;
- ScrollBox;
- ToolBar;
- PopupMenu;
- ActionList;
- richer StatusBar;
- ListView;
- Chart Stage 1.

### Phase R4: reusable UI and project architecture

- Frames;
- templates;
- project metadata UI;
- startup Form;
- resources and localization;
- package/library model Stage 1.

### Phase R5: data-aware RAD

- Data Module Designer;
- DataSource;
- in-memory/JSON/CSV/REST datasets;
- SQLite;
- query editor;
- data-aware controls;
- schema browser.

### Phase R6: debugging and language intelligence

- breakpoint debugger;
- watches;
- Patch semantic change timeline;
- rename/refactoring;
- completion;
- Language Server extraction.

### Phase R7: professional build/deployment

- build configurations;
- application metadata;
- icons/version resources;
- package/installer workflows;
- signing/notarization UX;
- update channel design;
- deterministic deployment manifest.

### Phase R8: extensibility ecosystem

- component packages;
- custom controls;
- package manager;
- templates repository;
- plugin API with capability boundaries.

### Phase R9: mobile and adaptive UI

- Android/iOS backends if strategically justified;
- device designer;
- touch and adaptive layout;
- mobile deployment.

## Immediate implementation order

The next concrete work should be:

1. Finish `Picture` as a first-class Designer component because parser/runtime groundwork already exists.
2. Add a component-registry module and have the palette consume it.
3. Add a schema-driven Picture inspector with resource/source and fit properties.
4. Add Resource Manager Stage 1.
5. Add Shape.
6. Add PaintBox/Canvas plus `paint` event.
7. Add ImageList as the first richer nonvisual resource component.
8. Add component capability matrix tests across Web/Windows/macOS/Linux.
9. Move existing hard-coded property/event declarations into the registry incrementally.
10. Then begin Phase R2 Designer interactions.

## Definition of a credible Delphi-like milestone

Patch Studio can reasonably describe itself as a complete desktop RAD environment when it has:

- a mature visual Form Designer;
- a broad standard component set;
- source-backed Object Inspector Properties/Events;
- resources/images/icons;
- menus/actions/toolbars;
- reusable Frames;
- nonvisual Data Modules;
- data access including SQLite;
- integrated debugging;
- intelligent code navigation/refactoring;
- packages/custom components;
- one-click native build and packaging for the supported desktop targets;
- stable documentation and regression coverage.

Matching Delphi component-for-component is not required. The goal is equivalent RAD workflow coverage with Patch's simpler language, explicit-change semantics and reproducible cross-platform compiler architecture.