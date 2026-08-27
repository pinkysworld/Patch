# Patch 0.2.0-beta.36

Patch beta.36 is the current integration and RAD-authoring development line. It aligns Patch Studio with project bundle v4 resources, the Native GUI IR 1.4 desktop contract, and the first graphics/resource RAD milestone while preserving the rule that ordinary `.patch` source remains authoritative for Form/component authoring.

## Current contracts

- Patch package: `0.2.0-beta.36`
- Change IR: `0.10`
- Studio project bundle: `v4`
- Component Registry: `0.8`
- Native GUI IR: `1.4`
- sealed payload: `v14`
- desktop runtime: `v1.5`
- Win32 release: `native-win32-runtime-v1.5`
- AppKit release: `native-macos-runtime-v1.5`
- GTK release: `native-linux-runtime-v1.5`
- offline compiler line: `offline-compiler-v0.2`

Older project/native versions remain explicit migration/compatibility inputs and are never silently reinterpreted.

## Studio project bundle v4 and resources

Project bundle v4 extends the multi-file project model with bounded project resources. Existing v1, v2 and v3 projects migrate explicitly to v4; unknown future versions fail closed.

The Resource Manager provides:

- stable logical resource ids and project-relative paths;
- PNG, JPEG, WebP and SVG image resources;
- deterministic SHA-256 metadata;
- per-resource, total-size and resource-count bounds;
- preview, import, replace, rename/remove validation and resource selection;
- persistence through project export/import, local saves and recovery snapshots.

Resources are explicit project data, not a hidden `.dfm`/`.frm` visual state model. Controls reference logical `patch-resource:<id>` locators.

## Current Native Window line

Native GUI IR 1.4 / payload v14 / runtime v1.5 is the current Ready/offline desktop line for Windows, macOS and Linux. It composes the previous Table, list, menu, TreeView and Slider capabilities with Chrome Stage 1 Panel, Timer, Picture and StatusBar transport.

Current native Picture resource support includes bounded PNG/JPEG decoding through Win32/WIC, AppKit/NSImage and GTK/GdkPixbuf. WebP/SVG are not silently treated as current native-supported formats. The browser/Standalone Web path can embed project resources directly.

The previous Slider line Native GUI IR 1.3 / payload v13 / runtime v1.4 and the frozen TreeView line Native GUI IR 1.2 / payload v12 / runtime v1.3 remain compatibility evidence.

## Patch Studio RAD authoring

### Searchable Component Palette and canonical registry

The Component Palette is driven from the canonical component registry instead of an independent hard-coded component model. Registry metadata includes component type, label/category, visual/nonvisual status, default size, property schemas, event schemas, design renderer and target-support metadata.

The current palette contains:

- Basic: Text, Button, Input, Checkbox
- Choices: Radio group, ComboBox, ListBox, Slider
- Data: Table, TreeView
- Containers: Tabs, Panel
- Graphics: Picture, Shape, PaintBox
- Chrome: StatusBar
- Nonvisual: Timer, ImageList

`Ctrl/Cmd+Shift+A` focuses component search. Search matches label, source type and category.

### Object Inspector

The source-backed Properties pane is now an Object Inspector with Properties and Events views. It supports handler creation/navigation for the component events currently exposed by Patch source, including `OnClick`, `OnChange`, `OnTick` and PaintBox `OnPaint`.

Generated handlers remain ordinary visible `when ...:` source. ImageList is eventless in Stage 1.

### Layout and Designer operations

Current source-backed Form Designer operations include:

- pointer/keyboard move and resize;
- multi-select alignment and center operations;
- same width/height;
- equal horizontal/vertical distribution;
- Center H / Center V;
- Default size and collision-aware Auto place;
- Bring to front / Send to back;
- 8 px grid support;
- source-backed Anchors and Docking;
- Focus Order Stage 1 based on source order.

Timer and ImageList are nonvisual and therefore never receive Form geometry, Anchors or Dock. StatusBar owns its bottom-docked contract.

### Nonvisual tray

Patch Studio has a Delphi/VB-style nonvisual component tray. Timer and ImageList are projections of ordinary Form source and share the central Designer selection model.

Timer exposes interval editing and `OnTick`. ImageList exposes logical image size plus ordered named resource references.

### Panel Stage 1

Panel is a source-backed top-level container with a structural child editor for the currently supported flow-layout child controls. Stage 1 deliberately does not claim independent nested coordinates/native child containment. Panel Stage 2 remains a later contract.

### Picture and Resource Manager

Picture is a first-class Graphics component. Its source expression can use a project resource locator and the Object Inspector can choose project images. Browser preview/Standalone Web resolve bundled resources. Current native PNG/JPEG resource decoding is covered by platform smoke tests.

Richer display properties such as portable scale mode, aspect/center behavior, opacity and accessible description remain explicit follow-up work and are not presented as finished cross-target parity.

### Shape Stage 1

Shape supports deterministic rectangle/rounded/ellipse/line source declarations with fill, stroke, stroke width, radius and opacity. Studio authoring and Standalone Web rendering are implemented. Current native targets remain explicitly unsupported until Win32/AppKit/GTK lowering/rendering is versioned and tested.

### PaintBox Stage 1

PaintBox is a source-backed drawing surface with a pure `paint` event and deterministic drawing commands. Stage 1 permits drawing logic without creating a hidden persistent mutation path; persistent `change` operations are rejected from the paint handler.

Studio authoring and Standalone Web rendering are implemented. Native drawing parity remains explicitly fail-closed until a shared versioned drawing-command contract is consumed by the desktop backends.

### ImageList Stage 1

ImageList is the first richer reusable nonvisual graphics component:

```patch
imagelist as toolbar_images size 16, 16:
  image open from "patch-resource:icons.open"
  image save from "patch-resource:icons.save"
```

It provides named ordered project-resource references and a logical size. The Object Inspector can add/replace/reorder/rename/remove entries through the existing Resource Manager. It consumes no Form geometry and exposes no event in Stage 1.

ImageList is intentionally authoring-only until a real consumer such as ToolBar/ToolButton, TreeView or Button image binding exists. Standalone Web and native Window builds fail closed instead of silently dropping it.

## Website, PWA and CI

The public Studio uses the beta.36 product contract and a content-addressed browser module graph. Service Worker routing is type-safe: missing JavaScript/CSS/runtime assets never receive `index.html` as a substitute. Real Chrome startup/responsiveness checks exercise Studio before a public deployment is considered healthy.

The site/offline closure now includes the graphics/resource modules used by Picture, Shape, PaintBox and ImageList authoring.

## Offline compiler v0.2

Windows x64, Linux x64, macOS Apple Silicon and macOS Intel kits use runtime v1.5 and assert payload v14. FreeBSD remains Console-only through portable C99.

Ready/offline Windows/macOS/Linux builds require no user GitHub token. Optional cloud/AOT workflows remain separate from the default download/link experience.

## Formal and review boundary

beta.36 product work does not widen the beta.32 formal runtime-correspondence claim. Patch does not claim full compiler/runtime verification.

Likewise, target capability metadata is intentionally truthful: Shape/PaintBox native runtime support and ImageList consumers are not advertised until their contracts and tests exist. See `docs/ROADMAP.md`, `docs/RAD_STUDIO_MASTERPLAN.md` and `docs/RAD_STUDIO_MASTER_BACKLOG.md` for the remaining work.
