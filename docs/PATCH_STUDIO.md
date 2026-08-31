# Patch Studio

Patch Studio is the browser-first RAD IDE for Patch, with a downloadable Offline IDE beta. Its product goal is QuickBASIC / Visual Basic / Delphi-style immediacy while keeping one readable source-backed application model across browser and desktop targets.

## Current status

Patch Studio currently tracks:

- Patch package **0.2.0-beta.36**;
- Change IR **0.10**;
- Studio project bundle **v4**;
- Component Registry **0.8**;
- Current Ready Native GUI IR **1.7**;
- Current Ready sealed payload **v17**;
- Ready/offline desktop runtime **v1.8** on Windows, macOS and Linux;
- Offline Studio manifest **v1** and rolling download channel **`offline-studio-v0.2`**;
- formal runtime-correspondence milestone **beta.32**.

Two newer native layers are implemented but deliberately not promoted yet:

- **IR 1.8 / payload v18 / runtime v1.9**: Button/ImageList native asset transport and Win32/AppKit/GTK consumers;
- **IR 1.9 / payload v19 / runtime v1.10**: application/Form Window icons, preserving the complete Button/ImageList layer, plus deterministic Windows/macOS/Linux application-icon packaging.

Product/native/RAD work after beta.32 does not widen that formal claim. `src/native-current-contract.js` remains 1.7/17/1.8 until the v1.10 release, digest, Offline Compiler and public-metadata promotion gate is complete.

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

## Object Inspector, events and structural editors

Properties and Events share the source-backed Object Inspector. Current behavior includes object selection, component-specific property editing, Create handler, Open handler and default event navigation. Handlers are ordinary visible `when ...:` blocks.

Current event families include Button/Picture `OnClick`, Input/Checkbox/Radio/ComboBox/ListBox/Slider/Table/TreeView `OnChange`, Timer `OnTick` and PaintBox `OnPaint`. ImageList exposes no event in Stage 1.

Table, TreeView and Tabs structural editors rewrite the selected source block directly and validate the result before accepting it. Current workflows cover common add/edit/reorder/duplicate/remove operations. Nested Table and TreeView editors use the same source-backed semantics.

**Table: text-list for the selected row.** The selected Table row is a transient event value in Studio App Preview, Standalone Web and supported native paths. TreeView likewise exposes its selected root-to-node path as a transient text-list. Neither becomes persistent application state unless a handler explicitly commits the event value through `change`.

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
- design grid and alignment assistance;
- source-backed Anchors and Dock;
- Focus Order Stage 1.

Timer and ImageList are nonvisual and never expose Form geometry, Anchors or Dock. StatusBar owns its bottom-docked contract. Independent Delphi-style `TabOrder` remains a later source/runtime contract.

## Undo/Redo and large-project behavior

Studio has a bounded source-backed Undo/Redo history. Trusted editor typing coalesces, while atomic Designer source rewrites remain one transaction. Project/resource replacement boundaries reset source history so stale edits cannot be replayed into a different project.

The R0 architecture foundation now includes `studio-design-model/0.1`, the bounded declaration-only design snapshot cache, shared exact-source snapshots, active-Form materialization and keyed incremental runtime reconciliation. Primary `refreshDesigner()` consumes the shared declaration-only design cache rather than executing application behavior for design time.

Multi-Form projects keep all Form shells structurally present but render only the active Form at full browser cost. The performance harness includes a deterministic **10-Form / 200-control** stress fixture and real-Chrome Workshop measurements. Remaining R0 work is focused on module boundaries, the versioned Worker boundary, adapter-owned incremental reconciliation and measurement-driven Table/Tree preview virtualization.

## Nonvisual tray and ImageList

Timer and ImageList appear in the nonvisual component tray beneath the Form canvas.

```patch
timer as refresh_clock interval 1000
when refresh_clock ticked:
  show "tick"
```

ImageList is an ordered collection of named project-resource references. The Object Inspector can edit logical size and add/replace/rename/reorder/remove entries through the Resource Manager. Buttons may bind one item with `image list.item` on Studio and Standalone Web.

Current Ready Native GUI IR 1.7 deliberately fails closed for ImageList/Button-image bindings. The native consumer is nevertheless implemented on IR **1.8** / payload **v18** / runtime **v1.9**, and is preserved by the experimental v1.10 Window-icon line. Promotion, not implementation, is the remaining gap.

## Picture, Shape and PaintBox

Picture supports source-backed id/source/layout plus fit, center, opacity and accessible description. Browser preview and Standalone Web resolve project resources and apply the full current Web display model.

Native Ready Picture follows `native-picture-formats/1.0`: PNG/JPEG are supported through Win32/WIC, AppKit/NSImage and GTK/GdkPixbuf. WebP/SVG remain deferred. The inherited native Picture display contract keeps default contain/centered/opaque behavior and fails closed for unsupported non-default display combinations.

Shape supports rectangle, rounded rectangle, ellipse and line with fill, stroke, stroke width, radius and opacity. Studio, Standalone Web and Current Ready Windows/macOS/Linux support Shape. Native GUI IR 1.5 introduced the Shape transport; Current Ready IR 1.7 / payload v17 / runtime v1.8 preserves it.

PaintBox is the source-backed custom-drawing surface. Its `paint` handler is pure UI drawing and rejects persistent `change`. Studio, Standalone Web and Current Ready Windows/macOS/Linux implement `clear`, `line`, `rectangle`, `ellipse`, `text` and bounded PNG/JPEG `draw image`. The image operation is carried by Native GUI IR **1.7**, payload **v17** and runtime **v1.8**.

## Window/application icons

Forms may declare a source-backed resource icon:

```patch
window "Counter" as counter size 520, 360 icon "patch-resource:app.icon":
```

Studio preview shows it in Form chrome and Standalone Web packages the first Form icon as the favicon under `window-icon/1.0`.

Current Ready IR 1.7 still fails closed for Form icons. The experimental **IR 1.9 / payload v19 / runtime v1.10** line now implements application/Form icons on Win32, AppKit and GTK. Packaging is also implemented:

- Windows `.ico` generation and project-icon embedding into the normal v1.10 runtime PE resource slot;
- macOS `.icns` plus `CFBundleIconFile` in the `.app` bundle;
- Linux hicolor PNG plus `.desktop` metadata.

Windows CI verifies the packaged EXE with `ExtractAssociatedIcon` and `--patch-smoke`. The remaining work is release/digest/Offline-Compiler/product promotion, not native icon implementation.

## Workshop Desk acceptance example

`examples/workshop-desk.patch` is the Current Ready cross-platform showcase. It uses every integrated component family that Current Ready can transport together: Forms, Text, Button, Input, Checkbox, Radio, ComboBox, ListBox, Slider, Table, TreeView, Tabs, Picture, Panel, Shape, PaintBox including `draw image`, StatusBar and Timer.

The canonical Ready source intentionally omits ImageList/Button images and a Window icon because Current Ready 1.7 fails closed for those features. Dedicated experimental fixtures prove the implemented v1.9/v1.10 consumers without making the Current Ready showcase target-dependent.

## Run and Build

Studio supports Standalone Web, Windows, macOS, Linux, FreeBSD Console, portable `.patchapp` and direct/bootstrap WebAssembly where applicable. The default Windows/macOS/Linux workflow is **Ready app download / offline link with no user GitHub token**. Optional cloud/AOT remains a separate advanced route.

The Current Ready/offline Window contract is Native GUI IR **1.7**, sealed payload **v17**, runtime **v1.8**. Product paths import stable `native-current-contract.js` / `native-frozen-contract.js` facades and unsupported selected-contract behavior fails closed.

The frozen TreeView line is 1.2/v12/v1.3. The previous Slider line is 1.3/v13/v1.4, Chrome line 1.4/v14/v1.5, Shape line 1.5/v15/v1.6 and PaintBox Stage 1 line 1.6/v16/v1.7.

## Offline Studio and Offline Compiler

The rolling **`offline-studio-v0.2`** channel publishes Stage 1 self-contained IDE builds for Windows x64, macOS Apple Silicon and Linux x64 plus the deterministic manifest and SHA256SUMS. Stage 1 provides offline authoring, Designer/Run and browser-local build targets. Host-native desktop Build from inside the installed IDE is still Stage 2.

The rolling `offline-compiler-v0.2` covers Windows x64, Linux x64, macOS Apple Silicon and macOS Intel. Current Window linking uses payload v17/runtime v1.8. FreeBSD remains Console-only via portable C99.

Patch Studio uses deterministic site revisioning and a content-addressed browser module graph. Pages verifies the published v1.8 runtime release digests, produces the runtime manifest, and the browser re-hashes the selected runtime before sealing.

## Current capability boundary

| Component | Studio | Standalone Web | Current Ready native 1.7/v17/v1.8 | Implemented next native line |
|---|---|---|---|---|
| Picture | supported | supported | bounded PNG/JPEG + default display contract | preserved |
| Shape | supported | supported | supported | preserved |
| PaintBox | supported | supported | clear/line/rectangle/ellipse/text + PNG/JPEG `draw image` | preserved |
| ImageList | authoring | Button image consumer supported | fail-closed | IR 1.8/v18/runtime v1.9 consumer implemented |
| Window icon | authoring | chrome + favicon supported | fail-closed | IR 1.9/v19/runtime v1.10 + packaging implemented |

Authoring is not runtime parity, and implementation is not promotion. The remaining native R1 gate is publishing/verifying v1.10 assets, switching browser and Offline Compiler linking, synchronizing public capability metadata, and only then moving the Current Ready facade. See `docs/ROADMAP.md`, `docs/WINDOW_ICONS.md` and `docs/RAD_STUDIO_MASTER_BACKLOG.md`.