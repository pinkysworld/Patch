# Patch 0.2.0-beta.36

Patch beta.36 is the current integration and RAD-authoring development line. It aligns Patch Studio with project bundle v4 resources, the promoted Current Ready Native GUI IR 1.9 desktop contract, and the graphics/resource RAD milestone while preserving the rule that ordinary `.patch` source remains authoritative for Form/component authoring.

## Current Ready contracts

- Patch package: `0.2.0-beta.36`
- Change IR: `0.10`
- Studio project bundle: `v4`
- Component Registry: `0.9`
- Native GUI IR: `1.9`
- sealed payload: `v19`
- desktop runtime: `v1.10`
- Win32 release: `native-win32-runtime-v1.10`
- AppKit release: `native-macos-runtime-v1.10`
- GTK release: `native-linux-runtime-v1.10`
- offline compiler line: `offline-compiler-v0.2`
- Offline Studio line: `offline-studio-v0.2`

Older project/native versions remain explicit migration/compatibility inputs and are never silently reinterpreted. In particular, payload v17/runtime v1.8 remains an explicit Offline Compiler compatibility path.

## Promoted native stack

Beta.36+ contains two additive native layers that are now part of Current Ready:

- **Native GUI IR 1.8 / payload v18 / runtime v1.9** implements Button `ImageList` asset transport and Win32/AppKit/GTK Button-image consumers.
- **Native GUI IR 1.9 / payload v19 / runtime v1.10** preserves the complete Button/ImageList layer and implements application/Form Window icons on Win32/AppKit/GTK.

The v1.10 packaging and release boundary includes:

- deterministic Windows `.ico` generation;
- in-place project application-icon embedding into the reserved PE resource slot of the normal v1.10 Windows runtime template;
- real Windows `ExtractAssociatedIcon` plus `--patch-smoke` verification from the packaged EXE;
- macOS `.icns` plus `CFBundleIconFile` app-bundle packaging;
- Linux hicolor PNG plus `.desktop` metadata;
- immutable versioned v1.10 runtime assets;
- SHA-256 and GitHub asset-digest verification plus release source-commit binding;
- dual-runtime Offline Compiler evidence on Windows, Linux, Apple Silicon macOS and Intel macOS;
- default Current Ready payload v19 linking with explicit v17/runtime-v1.8 compatibility.

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

Native GUI IR 1.9 / payload v19 / runtime v1.10 is the Current Ready/offline desktop line for Windows, macOS and Linux. It composes the previous Table, list, Menu, TreeView, Slider, Chrome Stage 1, Shape Stage 1, PaintBox Stage 1 and PaintBox `draw image` capabilities with Button/ImageList transport and application/Form icons.

Current native Picture/PaintBox resource support includes bounded PNG/JPEG decoding through Win32/WIC, AppKit/NSImage and GTK/GdkPixbuf under `native-picture-formats/1.0`. WebP/SVG remain deferred native formats and fail closed rather than being silently treated as Ready. The browser/Standalone Web path can embed PNG, JPEG, WebP and SVG project resources directly.

The frozen TreeView line Native GUI IR 1.2 / payload v12 / runtime v1.3 and the frozen Table line Native GUI IR 0.8 / payload v9 / runtime v1.0 remain explicit compatibility evidence. Payload v17/runtime v1.8 remains an additional explicit Offline Compiler compatibility path after promotion.

## Patch Studio RAD authoring

The current source-backed Designer includes:

- searchable Component Palette driven by the canonical component registry;
- Object Inspector Properties and Events views;
- multi-Form add/select/duplicate/delete workflows;
- pointer and keyboard move/resize;
- alignment, sizing, distribution, centering and z-order actions;
- source-backed Anchors and Dock;
- Focus Order Stage 1;
- bounded source-backed Undo/Redo;
- Table, TreeView and Tabs structural editors;
- nonvisual Timer/ImageList tray;
- project Resource Manager;
- Picture, Shape and PaintBox graphics authoring;
- Window icon source/Web/native authoring;
- active-Form materialization and keyed runtime reconciliation for large projects.

Beta.36 retains **multi-select alignment and center operations**, **same width/height**, and **equal horizontal/vertical distribution** as explicit source-backed Designer capabilities. These phrases remain stable release markers because CI uses them to prevent the public milestone description from drifting behind the implemented Studio surface.

R0 architecture work has already landed the declaration-only design model/cache, shared exact-source snapshots, active-Form materialization, real-Chrome Workshop/10-Form performance gates and primary Designer cache integration. Remaining R0 work is focused on module boundaries, the Worker boundary, adapter-owned incremental reconciliation and measurement-driven Table/Tree preview virtualization.

## ImageList

ImageList provides named ordered project-resource references and a logical size:

```patch
imagelist as toolbar_images size 16, 16:
  image open from "patch-resource:icons.open"
  image save from "patch-resource:icons.save"
```

Buttons bind one item with `image list.item`. Studio, Standalone Web and Current Ready Windows/macOS/Linux consume the binding. Native IR 1.8 / payload v18 / runtime v1.9 owns the transport, and Current Ready v1.10 preserves it beneath payload v19.

## Window icons

Forms may declare an optional icon:

```patch
window "Counter" as counter size 520, 360 icon "patch-resource:app.icon":
```

Studio preview shows the resource in Form chrome and Standalone Web packages the first icon-bearing Form as the application favicon under `window-icon/1.0`. Current Ready IR 1.9 / payload v19 / runtime v1.10 implements the same application/Form icon contract on native Windows, macOS and Linux, including platform application-icon packaging.

## Website, PWA and CI

The public Studio uses the beta.36 product contract and a content-addressed browser module graph. Service Worker routing is type-safe: missing JavaScript/CSS/runtime assets never receive `index.html` as a substitute. Real Chrome startup/responsiveness checks exercise Studio before a public deployment is considered healthy.

Pages gates the browser Ready path on the published **runtime v1.10** Windows/macOS/Linux releases and their GitHub-recorded SHA-256 asset digests. The generated runtime manifest is verified again in the browser before sealing a Ready app.

## Offline compiler and Offline Studio

The rolling `offline-compiler-v0.2` line defaults supported Window linking to Current Ready Native GUI IR 1.9 / payload v19 / runtime v1.10 on Windows, Linux, Apple Silicon macOS and Intel macOS. It carries a separate runtime-v1.8 underlay for explicit `--gui-payload-version 17` compatibility. FreeBSD remains Console-only through portable C99.

The rolling `offline-studio-v0.2` line provides self-contained Stage 1 IDE builds for Windows, Apple Silicon macOS and Linux. It supports offline authoring, Designer and Run. Host-native desktop Build directly inside the installed IDE remains the explicit Stage 2 boundary.

Ready/offline Windows/macOS/Linux builds require no user GitHub token. Optional cloud/AOT workflows remain separate from the default download/link experience.

## Formal and review boundary

Beta.36 product work does not widen the beta.32 formal runtime-correspondence claim. Patch does not claim full compiler/runtime verification.

Target capability metadata now advertises the promoted IR 1.9/payload v19/runtime v1.10 desktop line, including Button/ImageList and Window/application icons. See `docs/ROADMAP.md`, `docs/NATIVE_GUI.md`, `docs/WINDOW_ICONS.md` and `docs/RAD_STUDIO_MASTER_BACKLOG.md` for the exact boundary.
