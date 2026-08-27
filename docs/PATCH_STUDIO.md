# Patch Studio

Patch Studio is the browser-first RAD IDE for Patch. Its product goal is QuickBASIC / Visual Basic / Delphi-style immediacy while keeping one readable source-backed application model across browser and desktop targets.

## Current status

Patch Studio currently tracks:

- Patch package **0.2.0-beta.36**;
- Change IR **0.10**;
- Studio project bundle **v4**;
- Component Registry **0.8**;
- Native GUI IR **1.4**;
- sealed payload **v14**;
- Ready/offline desktop runtime **v1.5** on Windows, macOS and Linux;
- formal runtime-correspondence milestone **beta.32**.

Product/native/RAD work after beta.32 does not widen that formal claim.

## Product model

Patch Studio keeps ordinary `.patch` source authoritative for Forms, controls, handlers, layout directives and structural control content. Project-level binary/image assets live in the explicit versioned **project-v4 resource store**.

There is no hidden `.dfm`, `.frm` or private persistent component graph.

Transient IDE state such as selection, panel widths, workspace split, search text and tabs does not become Patch application state. Persistent application state changes only through explicit semantic `change` operations in source.

## Project bundle v4

The canonical browser project is `patch-studio-project` version **4**.

It contains:

- project name and Console/Window kind;
- entry file;
- build target/native build mode;
- bounded `.patch` source files;
- bounded project resources.

Versions 1, 2 and 3 migrate explicitly to v4. Unknown future versions fail closed.

Before Run/Build, Studio synchronizes the active editor file into the canonical project and deterministically composes all `.patch` files. Composition metadata maps diagnostics back to the owning `file:line`.

Resources are supplied separately to build/runtime consumers and are never concatenated into source.

See `docs/STUDIO_PROJECTS.md`.

## Resource Manager

The Resource Manager is the project-level graphics asset tool for the current RAD milestone.

Current image-resource support:

- PNG;
- JPEG;
- WebP;
- SVG.

Each resource has:

- stable logical id;
- normalized project-relative path;
- media type;
- byte size;
- SHA-256 digest;
- canonical base64 project bytes.

Per-resource, total-byte and resource-count limits are validated. Duplicate ids/paths and malformed resource metadata fail closed.

Source-backed controls use logical locators such as:

```patch
picture as logo from "patch-resource:app.logo"

imagelist as toolbar_images size 16, 16:
  image open from "patch-resource:icons.open"
```

The locator stays readable in `.patch` source while bytes remain in the explicit v4 project resource store.

## Source-backed Designer

The Designer supports named Forms and a searchable, categorized Component Palette.

Current palette groups:

### Basic

- Text
- Button
- Input
- Checkbox

### Choices

- Radio group
- ComboBox
- ListBox
- Slider

### Data

- Table
- TreeView

### Containers

- Tabs
- Panel

### Graphics

- Picture
- Shape
- PaintBox

### Chrome

- StatusBar

### Nonvisual

- Timer
- ImageList

`Ctrl/Cmd+Shift+A` focuses Component Palette search.

## Canonical component registry

The Component Palette consumes the same canonical registry metadata used for component discovery and capability reporting. Registry descriptors include:

- type and label;
- category;
- visual/nonvisual status;
- default size;
- property schema;
- event schema;
- design renderer;
- target support metadata.

The registry is metadata, not another persistent UI model.

## Object Inspector

The source-backed properties pane is an Object Inspector with **Properties** and **Events** views.

Current behavior includes:

- object selection;
- common identity/text/layout properties;
- component-specific property editors;
- event discovery from component metadata/adapter contracts;
- Create handler;
- Open handler;
- default event navigation for supported controls.

Handlers are ordinary visible `when ...:` blocks in source.

Current event examples include:

- Button/Picture `OnClick`;
- Input/Checkbox/Radio/ComboBox/ListBox/Slider/Table/TreeView `OnChange`;
- Timer `OnTick`;
- PaintBox `OnPaint`.

ImageList exposes no event in Stage 1.

## Layout and Form Designer operations

Current source-backed operations include:

- add/select/duplicate/delete Form;
- pointer and keyboard move/resize;
- default size / Fit controls;
- Center H / Center V;
- align left/right/top/bottom;
- align horizontal/vertical centers;
- same width/height;
- equal horizontal/vertical distribution;
- collision-aware Auto place;
- Bring to front / Send to back;
- 8 px grid support;
- source-backed Anchors;
- source-backed Dock;
- Focus Order Stage 1.

Timer and ImageList are nonvisual and therefore never expose Form X/Y/Width/Height, Anchors or Dock. StatusBar owns a read-only bottom dock contract.

Independent Delphi-style `TabOrder` remains a later source/runtime contract; current Focus Order Stage 1 follows source order.

## Nonvisual component tray

Patch Studio includes a nonvisual tray beneath the Form canvas.

### Timer

Timer authoring is source-backed end to end:

```patch
timer as refresh_clock interval 1000

when refresh_clock ticked:
  show "tick"
```

The Object Inspector edits interval. Renaming/deleting Timer keeps its source-visible handler lifecycle consistent.

### ImageList

ImageList is a nonvisual ordered collection of named project-resource references:

```patch
imagelist as app_images size 16, 16:
  image open from "patch-resource:icons.open"
  image save from "patch-resource:icons.save"
```

The Object Inspector can:

- edit logical width/height;
- add images from Resource Manager;
- replace resources;
- rename image keys;
- reorder items;
- remove items;
- open Resource Manager.

ImageList Stage 1 is **authoring-only** until a real runtime consumer such as ToolBar/ToolButton, TreeView or Button image binding exists. Standalone Web/native Window targets fail closed rather than silently dropping it.

## Picture

Picture is a first-class Graphics component with source-backed id/source/layout and project-resource selection.

Browser preview and Standalone Web can resolve project resources. Current native Picture resource support includes bounded PNG/JPEG decoding through Win32/WIC, AppKit/NSImage and GTK/GdkPixbuf.

WebP/SVG are not silently treated as current native-supported formats.

Still open for full Delphi-style parity:

- scale/fit mode;
- portable aspect behavior;
- center behavior;
- opacity;
- accessible description;
- complete cross-target property parity.

## Shape

Shape Stage 1 supports deterministic source-visible geometry/style:

```patch
shape rounded as card fill #dbeafe stroke #2563eb stroke-width 3 radius 18 opacity 0.75 at 24, 32 size 220, 140
```

Supported kinds are rectangle, rounded, ellipse and line.

Studio authoring and Standalone Web rendering are implemented. Windows/macOS/Linux native Shape runtime parity remains explicitly unsupported/fail-closed until versioned lowering/rendering exists.

## PaintBox

PaintBox is the custom-drawing surface:

```patch
paintbox as canvas at 24, 24 size 320, 200

when canvas paint:
  draw clear #ffffff
  draw rectangle 10, 12 size 100, 50 fill #ff0000 stroke #000000 width 2
  draw line 0, 0 to 100, 100 stroke #000000 width 1
```

The `paint` handler is intentionally pure UI drawing. Persistent `change` operations are rejected inside it, preventing PaintBox from creating another hidden mutation path.

Studio authoring and Standalone Web rendering are implemented. Native drawing parity remains fail-closed until a shared versioned drawing-command contract is consumed by Win32/AppKit/GTK.

## Panel

Panel Stage 1 is a source-backed top-level visual group with a structural child editor. Supported child operations reuse ordinary Patch source.

Stage 1 child layout remains source-order/flow based. Independent child coordinates, nested Panels, clipping and native parent/child containment belong to Panel Stage 2.

## Table, TreeView and Tabs

Table, TreeView and Tabs structural editors rewrite their selected source block directly and validate the resulting source before accepting changes.

**Table: text-list for the selected row.** The selected row is a transient event value in Studio App Preview, Standalone Web and supported native paths; it becomes persistent only when source explicitly commits it through `change`.

Current workflows cover common add/edit/reorder/duplicate/remove operations. Nested Tabs content remains intentionally bounded by the current source/runtime contract.

## Command Palette and navigation

`Ctrl/Cmd+K` opens the Command Palette.

It delegates to existing Studio actions rather than persisting a duplicate command/project model. Search includes:

- Run/Build/navigation commands;
- project files;
- Forms/events/state/recipes;
- Thing fields such as `player.score`;
- recipe parameters such as `reward.bonus`.

Project Tree/Outline and editor tabs operate on the same canonical v4 project.

## Run and Build

Studio can Run Console and Window projects and exposes build targets for:

- Standalone Web App;
- Windows App;
- macOS App;
- Linux App;
- FreeBSD Console;
- portable `.patchapp`;
- direct/bootstrap WebAssembly where applicable.

The default Windows/macOS/Linux workflow is **Ready app download / offline link with no user GitHub token**. Optional cloud/AOT is a separate advanced route.

## Native desktop contract

The current Ready/offline Window product contract is:

- Native GUI IR **1.4**;
- sealed payload **v14**;
- runtime **v1.5**.

The previous Slider compatibility line is Native GUI IR 1.3 / payload v13 / runtime v1.4. The frozen TreeView compatibility line is Native GUI IR 1.2 / payload v12 / runtime v1.3.

Product paths import the stable `native-current-contract.js` / `native-frozen-contract.js` facades. Unsupported selected-contract behavior fails closed.

## Offline compiler

The downloadable `offline-compiler-v0.2` supports current Windows x64, Linux x64, macOS Apple Silicon and macOS Intel kits. Current Window linking uses payload v14/runtime v1.5. FreeBSD remains Console-only via portable C99.

## PWA and website

Patch Studio uses deterministic site revisioning and a content-addressed browser module graph. `studio-bootstrap.js` owns Service Worker registration/refresh.

Missing JavaScript/CSS/runtime requests never receive `index.html` as a substitute. Real Chrome startup/responsiveness tests exercise Studio in CI and production deployment gates.

## Recovery and diagnostics

Recovery snapshots protect the complete v4 project, including resources. Import/export/recovery all pass through the same validation rules.

Diagnostics remain privacy-redacted/local unless the user explicitly exports a report. Multi-file diagnostics map composed source positions back to owning `file:line`.

## Current capability boundary

Patch Studio deliberately distinguishes **authoring** from **runtime support**:

| Component | Studio | Standalone Web | Windows/macOS/Linux native |
|---|---|---|---|
| Picture | supported | supported | supported for current bounded native image formats |
| Shape | authoring | supported | unsupported/fail-closed |
| PaintBox | authoring | supported | unsupported/fail-closed |
| ImageList | authoring | unsupported until consumer contract | unsupported until consumer contract |

This table is intentionally conservative. A component is not called cross-platform Ready merely because the Designer can place it.

## Next work

The current execution order is maintained in `docs/ROADMAP.md` and the detailed RAD plans:

- `docs/RAD_STUDIO_MASTERPLAN.md`
- `docs/RAD_STUDIO_MASTER_BACKLOG.md`

The immediate remaining R1 gates are Picture display-property parity, native Shape/PaintBox support, the first real ImageList consumer, application icons/branding and generation of a canonical component capability matrix.
