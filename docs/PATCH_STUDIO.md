# Patch Studio

Patch Studio is the browser-first RAD IDE for Patch. Its product goal is QuickBASIC / Visual Basic / Delphi-style immediacy while keeping one readable source-backed application model across browser and desktop targets.

## Current status

Patch Studio currently tracks:

- Patch package **0.2.0-beta.36**;
- Change IR **0.10**;
- Studio project bundle **v4**;
- Component Registry **0.8**;
- Native GUI IR **1.8**;
- sealed payload **v18**;
- Ready/offline desktop runtime **v1.9** on Windows, macOS and Linux;
- formal runtime-correspondence milestone **beta.32**.

Product/native/RAD work after beta.32 does not widen that formal claim.

## Product model

Ordinary `.patch` source is authoritative for Forms, controls, handlers, layout directives and structural control content. Project-level binary/image assets live in the explicit versioned **project-v4 resource store**. There is no hidden `.dfm`, `.frm` or private persistent component graph.

Transient IDE state such as selection, panel widths, workspace split, search text and tabs does not become Patch application state. Persistent application state changes only through explicit semantic `change` operations in source.

## Project bundle v4 and Resource Manager

The canonical browser project is `patch-studio-project` version **4**. It contains project name/kind, entry file, build settings, bounded `.patch` source files and bounded project resources. Versions 1, 2 and 3 migrate explicitly to v4. Unknown future versions fail closed.

Before Run/Build, Studio synchronizes the active editor file into the canonical project and deterministically composes all `.patch` files. Composition metadata maps diagnostics back to the owning `file:line`.

The Resource Manager supports PNG, JPEG, WebP and SVG with stable ids, project-relative paths, media type, byte size, SHA-256 and canonical project bytes. Controls use readable logical locators such as:

```patch
picture as logo from "patch-resource:app.logo"

imagelist as toolbar_images size 16, 16:
  image open from "patch-resource:icons.open"
```

Per-resource, total-size and count limits are validated. Export, import, local save and recovery preserve source plus resources together.

## Current Designer component surface

The searchable Component Palette is driven from the canonical registry, not an independent Designer catalog.

- Basic: Text, Button, Input, Checkbox
- Choices: Radio group, ComboBox, ListBox, Slider
- Data: Table, TreeView
- Containers: Tabs, Panel
- Graphics: Picture, Shape, PaintBox
- Chrome: StatusBar
- Nonvisual: Timer, ImageList

`Ctrl/Cmd+Shift+A` focuses component search. Component descriptors carry property, event, design-renderer and target-support metadata.

## Object Inspector and events

Properties and Events share the source-backed Object Inspector. Current behavior includes object selection, component-specific property editing, Create handler, Open handler and default event navigation. Handlers are ordinary visible `when ...:` blocks.

Current event families include Button/Picture `OnClick`, Input/Checkbox/Radio/ComboBox/ListBox/Slider/Table/TreeView `OnChange`, Timer `OnTick` and PaintBox `OnPaint`. ImageList exposes no event in Stage 1.

## Layout and Form Designer operations

Current source-backed operations include:

- add/select/duplicate/delete Form;
- pointer and keyboard move/resize;
- default size / Fit controls;
- Center H / Center V;
- align left/right/top/bottom and center axes;
- same width/height;
- equal horizontal/vertical distribution;
- collision-aware Auto place;
- Bring to front / Send to back;
- Move forward / Move backward one z-order step;
- 8 px design grid with optional snap;
- source-backed Anchors and Dock;
- Focus Order Stage 1.

Timer and ImageList are nonvisual and never expose Form geometry, Anchors or Dock. StatusBar owns its bottom-docked contract. Independent Delphi-style `TabOrder` remains a later source/runtime contract.

## Undo/Redo and large-project behavior

Studio has a bounded source-backed Undo/Redo history. Trusted editor typing coalesces, while atomic Designer source rewrites remain one transaction. Project/resource replacement boundaries reset source history so stale edits cannot be replayed into a different project. Resource/non-source transactions remain a later extension.

Multi-Form projects keep all Form shells structurally present but render only the active Form at full browser cost. The current performance harness includes a deterministic **10-Form / 200-control** stress fixture plus parsed-model reuse and coordinated Designer observer reconciliation.

## Structural editors

Table, TreeView and Tabs structural editors rewrite the selected source block directly and validate the result before accepting it. Current workflows cover common add/edit/reorder/duplicate/remove operations.

**Table: text-list for the selected row.** The selected Table row is a transient event value in Studio App Preview, Standalone Web and supported native paths. TreeView likewise exposes its selected root-to-node path as a transient text-list. Neither becomes persistent application state unless a handler explicitly commits the event value through `change`.

Panel Stage 1 is a source-backed visual group with structural child editing. It does not yet claim Delphi-style independent nested coordinates, clipping or native child-container semantics; those belong to Panel Stage 2.

## Nonvisual tray

Timer and ImageList appear in the nonvisual component tray beneath the Form canvas.

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

Buttons bind one ImageList item with source-backed `image list.item`:

```patch
button "Open" as open_button image app_images.open
```

Standalone Web and current native Ready/offline Windows, macOS and Linux render the bound PNG/JPEG image on the Button. Native WebP/SVG fail closed. ToolBar/ToolButton and TreeView image bindings remain later consumers.

## Window and application icons

Forms may declare an optional source-backed `icon` on the window line:

```patch
window "Counter" as counter size 520, 360 icon "patch-resource:app.icon":
  text "Hello"
```

The Object Inspector Form tools edit the quoted resource locator. Studio preview shows the icon in Form chrome. Standalone Web also packages the first Form that declares `icon` as the document favicon. Native GUI IR 1.8 has no Form icon field and fail-closes under `window-icon/1.0` rather than silently dropping the source. This slice does not add ICO/ICNS to Resource Manager and does not claim Win32 `.ico`, AppKit or Linux desktop packaging.

## Picture

Picture supports source-backed id/source/layout plus fit, center, opacity and accessible description. Browser preview and Standalone Web resolve project resources and apply the full current Web display model.

Native Ready Picture follows `native-picture-formats/1.0`: PNG/JPEG are supported through Win32/WIC, AppKit/NSImage and GTK/GdkPixbuf. WebP/SVG remain deferred. The inherited native Picture display contract keeps default contain/centered/opaque behavior and fails closed for unsupported non-default display combinations.

## Shape

Shape supports rectangle, rounded rectangle, ellipse and line with fill, stroke, stroke width, radius and opacity. Studio, Standalone Web and current Ready Windows/macOS/Linux support Shape. Native GUI IR 1.5 introduced the Shape transport; current IR 1.7 / payload v17 / runtime v1.8 preserves it.

## PaintBox

PaintBox is the source-backed custom-drawing surface:

```patch
paintbox as canvas at 24, 24 size 320, 200

when canvas paint:
  draw clear #ffffff
  draw rectangle 10, 12 size 100, 50 fill #ff0000 stroke #000000 width 2
  draw line 0, 0 to 100, 100 stroke #000000 width 1
  draw image "patch-resource:app.logo" at 140, 12 size 48, 48
  draw text "Ready" at 20, 100 color #111827 size 16
```

The `paint` handler is pure UI drawing. Persistent `change` operations are rejected inside it. Studio, Standalone Web and current Ready Windows/macOS/Linux implement `clear`, `line`, `rectangle`, `ellipse`, `text` and `draw image`. The image operation was added by Native GUI IR **1.7**, payload **v17** and runtime **v1.8** while the previous five-operation PaintBox Stage 1 contract remains frozen at 1.6/v16/v1.7.

Native PaintBox expressions intentionally use a bounded subset: literals, `count` inside `repeat`, and simple number/text/boolean state names. Invalid or unsupported state references fail closed. Native `draw image` accepts quoted `patch-resource:` or `data:` locators; PNG/JPEG are Ready under `native-picture-formats/1.0`, while native WebP/SVG fail closed.

## Window/application icons

Forms may declare a source-backed resource icon:

```patch
window "Counter" as counter size 520, 360 icon "patch-resource:app.icon":
```

Studio preview shows it in Form chrome and Standalone Web packages the first Form icon as the favicon under `window-icon/1.0`. Current Native GUI IR 1.7 fails closed for Form icons. Native `.ico`, AppKit and Linux desktop icon packaging remains an R1 gap.

## Workshop Desk acceptance example

`examples/workshop-desk.patch` is the current cross-platform Ready showcase. It deliberately uses every integrated component family that the current native Ready line can transport together: Forms, Text, Button, Input, Checkbox, Radio, ComboBox, ListBox, Slider, Table, TreeView, Tabs, Picture, Panel, Shape, PaintBox including `draw image`, StatusBar and Timer.

It intentionally does **not** add a Window icon to the native Ready acceptance source, because that consumer still fails closed on native targets. ImageList/Button images are now native Ready PNG/JPEG; Window-icon Studio/Web authoring remains covered separately rather than making the showcase target-dependent.

## Command Palette and navigation

`Ctrl/Cmd+K` opens the Command Palette. Search delegates to existing actions and includes Run/Build/navigation commands, project files, Forms/events/state/recipes, Thing fields and recipe parameters. Project Tree/Outline and editor tabs operate on the same canonical v4 project.

## Run and Build

Studio supports Standalone Web, Windows, macOS, Linux, FreeBSD Console, portable `.patchapp` and direct/bootstrap WebAssembly where applicable. The default Windows/macOS/Linux workflow is **Ready app download / offline link with no user GitHub token**. Optional cloud/AOT remains a separate advanced route.

The current Ready/offline Window contract is Native GUI IR **1.8**, sealed payload **v18**, runtime **v1.9**. Product paths import stable `native-current-contract.js` / `native-frozen-contract.js` facades and unsupported selected-contract behavior fails closed.

The previous PaintBox draw image line is 1.7/v17/v1.8, previous PaintBox Stage 1 line is 1.6/v16/v1.7, previous Shape line is 1.5/v15/v1.6, previous Chrome line is 1.4/v14/v1.5, previous Slider line is 1.3/v13/v1.4, and frozen TreeView line is 1.2/v12/v1.3.

## Offline compiler, PWA and diagnostics

The rolling `offline-compiler-v0.2` covers Windows x64, Linux x64, macOS Apple Silicon and macOS Intel. Current Window linking uses payload v18/runtime v1.9. FreeBSD remains Console-only via portable C99.

Patch Studio uses deterministic site revisioning and a content-addressed browser module graph. `studio-bootstrap.js` owns Service Worker registration/refresh.

Missing JavaScript/CSS/runtime requests never receive `index.html` as a substitute. Real Chrome startup/responsiveness tests exercise Studio in CI and production deployment gates.

Recovery snapshots protect the complete v4 project, including resources. Import/export/recovery all pass through the same validation rules.

Diagnostics remain privacy-redacted/local unless the user explicitly exports a report. Multi-file diagnostics map composed source positions back to owning `file:line`.

## Current capability boundary

| Component | Studio | Standalone Web | Windows/macOS/Linux native |
|---|---|---|---|
| Picture | supported | supported | supported for current bounded native image formats |
| Shape | supported | supported | supported (IR 1.5 / payload v15 / runtime v1.6, preserved by current 1.8/v18/v1.9) |
| PaintBox | supported | supported | supported (IR 1.7 / payload v17 / runtime v1.8, including `draw image`, preserved by current 1.8/v18/v1.9) |
| ImageList | authoring | supported as Button image metadata | supported (IR 1.8 / payload v18 / runtime v1.9, PNG/JPEG Button images) |
| Window icon | authoring | supported (chrome + favicon) | unsupported/fail-closed |

This table is intentionally conservative. A component is not called cross-platform Ready merely because the Designer can place it.

## Next work

The current execution order is maintained in `docs/ROADMAP.md` and the detailed RAD plans:

- `docs/RAD_STUDIO_MASTERPLAN.md`
- `docs/RAD_STUDIO_MASTER_BACKLOG.md`

The immediate remaining R1 gate is native application/window icon packaging.
