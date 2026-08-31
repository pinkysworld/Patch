# Patch Native GUI

Status: **experimental but executable native backend, working on Windows, macOS and Linux**

Patch lowers the same source-backed Window syntax into operating-system-native GUI code. Patch source does not import Win32, AppKit or GTK.

## Product contract

The native stack separates semantic IR, direct AOT generation and token-free sealed distribution. Older contracts remain frozen instead of being redefined in place.

| Layer | Current / compatibility role |
|---|---|
| Change IR | **0.10**, unchanged by GUI extensions |
| Native GUI IR 0.7 | frozen base controls/dialog compatibility |
| Native GUI IR 0.8 | frozen Table/Grid extension |
| Native GUI IR 1.1 | persistent text-list state and multi-select ListBox ABI |
| Native GUI IR 1.2 | frozen TreeView-capable compatibility line |
| Native GUI IR 1.3 | previous Slider line |
| Native GUI IR 1.4 | previous Chrome Stage 1 line |
| Native GUI IR 1.5 | previous Shape line |
| Native GUI IR 1.6 | previous PaintBox Stage 1 line |
| Native GUI IR **1.7** | **Current Ready**, adds PaintBox `draw image` |
| Native GUI IR **1.8** | implemented next Button/ImageList transport, not promoted |
| Native GUI IR **1.9** | implemented next Window/application icon transport, not promoted |
| sealed payload v8 / runtime v0.9 | frozen responsive base compatibility |
| sealed payload v9 / runtime v1.0 | frozen Table compatibility |
| sealed payload v10 / runtime v1.1 | frozen persistent-list compatibility |
| sealed payload v11 / runtime v1.2 | frozen Menu+list compatibility |
| sealed payload v12 / runtime v1.3 | frozen TreeView compatibility, Slider fail-closed |
| sealed payload v13 / runtime v1.4 | previous Slider-capable line |
| sealed payload v14 / runtime v1.5 | previous Chrome line |
| sealed payload v15 / runtime v1.6 | previous Shape line |
| sealed payload v16 / runtime v1.7 | previous PaintBox Stage 1 line |
| sealed payload **v17 / runtime v1.8** | **Current Ready/offline desktop contract** |
| sealed payload **v18 / runtime v1.9** | implemented Button/ImageList line, not promoted |
| sealed payload **v19 / runtime v1.10** | implemented Window/application icon line, not promoted |

A backend or runtime version never silently redefines an older IR or payload format. A source program requiring a newer feature fails closed when explicitly linked against an older contract. Unversioned files such as `src/native-gui-ir.js` remain historical include-chain bases, not aliases of Current Ready.

## Build paths

The host-native command remains:

```bash
patch-app myapp.patch
```

It selects the host direct-native backend automatically:

```text
Windows -> Win32  -> .exe
macOS   -> AppKit -> .app
Linux   -> GTK3   -> executable
```

Patch Studio also supports token-free browser-side sealing into published native runtime templates. The downloadable Offline Compiler performs the same supported sealed linking locally. Project-specific remote AOT through GitHub Actions remains a separate optional route.

Current token-free Ready/offline Window builds use **Native GUI IR 1.7**, **sealed payload v17** and **runtime v1.8** through `src/native-current-contract.js`. The frozen TreeView line is Native GUI IR **1.2** / payload **v12** / runtime **v1.3** through `src/native-frozen-contract.js`.

## Implemented next native line

Two additive layers are already implemented beyond Current Ready:

1. **IR 1.8 / payload v18 / runtime v1.9** carries deduplicated project image assets for Button `ImageList` bindings and consumes them on Win32, AppKit and GTK.
2. **IR 1.9 / payload v19 / runtime v1.10** preserves the complete Button/ImageList layer and adds application/Form Window icons on all three native hosts.

The v1.10 packaging path is also implemented:

- Windows: deterministic `.ico` plus `windows-pe-icon-v110/0.1` in-place application-icon embedding into the reserved PE resource slot of the normal v1.10 runtime template;
- macOS: `.icns` installed into the `.app` bundle and named through `CFBundleIconFile`;
- Linux: hicolor PNG plus `.desktop` metadata.

Windows CI verifies the same packaged EXE with `ExtractAssociatedIcon` and `--patch-smoke`. Cross-platform runtime/package workflows are green.

Implementation is not promotion. These layers become Current Ready only after v1.10 release assets, SHA-256 digest verification, browser runtime selection, Offline Compiler linking and public capability metadata are updated together.

## Current Ready Window surface

The Current Ready native line includes:

- literal `number`, `text`, `boolean` and persistent `text-list` state;
- source-backed Form geometry and responsive Anchor/Dock metadata;
- Text, Button, Input, Checkbox, ComboBox, ListBox and Radio;
- Tabs containers with page-owned child controls;
- Table/Grid columns and rows;
- hierarchical TreeView nodes;
- Slider range, step, optional numeric binding and numeric `changed` event;
- Panel Stage 1, Timer, PictureBox and StatusBar;
- Shape rectangle, rounded rectangle, ellipse and line;
- PaintBox clear, line, rectangle, ellipse, text and bounded PNG/JPEG `draw image`;
- structural Window menus, separators, shortcuts and Boolean enabled/checked projections;
- informational and result-bearing Confirm/Open/Save dialogs;
- named Form `open` / `close` lifecycle.

Current Ready IR 1.7 deliberately fails closed for Button ImageList bindings and Form icons. That statement describes the published product boundary. The experimental 1.8/18/1.9 and 1.9/19/1.10 lines implement those features and await promotion.

Unsupported native behavior fails closed. There is no implicit Electron fallback.

## Selection and input semantics

GUI interaction is transient unless Patch source explicitly persists it:

```text
native interaction -> transient event value -> when <id> changed -> explicit Patch change
```

Current transient values are:

| Control | `changed` event value |
|---|---|
| Input | text |
| ComboBox | text |
| Radio | text |
| text-backed ListBox | text |
| list-backed ListBox | text-list of selected display strings |
| Checkbox | Boolean |
| Table | text-list containing the selected row's display strings |
| TreeView | text-list containing the selected root-to-node display path |
| Slider | finite number inside the declared range |

Tabs page selection remains renderer/toolkit-local and has no Patch event. Interaction itself does not create Patch state or Change History.

## Table / Grid

Table was introduced at Native GUI IR **0.8**. Native mappings remain report-mode `WC_LISTVIEWW` on Windows, multi-column `NSTableView` inside `NSScrollView` on macOS and `GtkTreeView` + `GtkListStore` inside `GtkScrolledWindow` on Linux.

The selected row is a transient text-list event value. Current v17/v1.8 preserves the frozen v9/v1.0 Table representation.

## TreeView

Native GUI IR 1.2 introduced hierarchical TreeView while keeping selection semantically transient. Native mappings remain common-controls TreeView on Windows, `NSOutlineView` inside `NSScrollView` on macOS and `GtkTreeView` + `GtkTreeStore` inside `GtkScrolledWindow` on Linux.

Selecting a node exposes the root-to-node text-list path. Current Native GUI IR 1.7 / payload v17 / runtime v1.8 preserves that contract. Payload v12/runtime v1.3 remains the frozen TreeView-origin line.

Canonical source uses colonless node labels:

```patch
tree as files:
  node "src"
    node "compiler.js"
    node "parser.js"
```

## Slider, list state and menus

Slider maps to Win32 `TRACKBAR`, AppKit `NSSlider` and GTK3 `GtkScale`. The runtime validates a finite numeric event-local value before executing the ordinary Patch handler.

A ListBox backed by `create list` uses the text-list event contract. The native toolkit owns transient selection; Patch persistence occurs only through explicit `change`.

Menus use native `HMENU`, `NSMenu` and GTK menu primitives. Separators, portable shortcuts and source-backed enabled/checked state are preserved by the current line.

## Graphics and resource policy

Native Picture and PaintBox image resources use `native-picture-formats/1.0`. Current Ready supports bounded PNG/JPEG project resources and data URIs through WIC, NSImage and GdkPixbuf. Native WebP/SVG remain deferred and fail closed.

PaintBox `paint` handlers are rendering-only. Persistent mutation is rejected inside them. Shape and PaintBox runtime drawing reuse the platform-native GDI+/AppKit/GTK drawing stacks.

## Current token-free runtime integrity

All three Current Ready Window builds use the `PCHGUI01` envelope with payload **v17** and runtime **v1.8**. Current release tags are:

- `native-win32-runtime-v1.8`;
- `native-macos-runtime-v1.8`;
- `native-linux-runtime-v1.8`.

Pages waits for all three v1.8 release assets plus `studio-runtime-v0.6`, obtains and verifies the GitHub release SHA-256 digest for every browser-consumed runtime asset, publishes the runtime integrity manifest and only then deploys. Patch Studio independently re-hashes the selected runtime with Web Crypto before sealing.

The downloadable Offline Compiler also links Current Ready IR 1.7/payload v17/runtime v1.8 locally. It does not yet select the experimental v1.10 line.

## Frozen compatibility chain

```text
Native GUI IR 0.8 / payload v9  / runtime v1.0  Table
Native GUI IR 1.1 / payload v10 / runtime v1.1  persistent list + multi-select ListBox
payload v11 / runtime v1.2                         Menu + list
Native GUI IR 1.2 / payload v12 / runtime v1.3  TreeView, Slider fail-closed
Native GUI IR 1.3 / payload v13 / runtime v1.4  Slider
Native GUI IR 1.4 / payload v14 / runtime v1.5  Chrome Stage 1
Native GUI IR 1.5 / payload v15 / runtime v1.6  Shape
Native GUI IR 1.6 / payload v16 / runtime v1.7  PaintBox Stage 1
Native GUI IR 1.7 / payload v17 / runtime v1.8  Current Ready PaintBox draw image
Native GUI IR 1.8 / payload v18 / runtime v1.9  implemented Button/ImageList, not promoted
Native GUI IR 1.9 / payload v19 / runtime v1.10 implemented Window icons, not promoted
```

Explicit legacy linking remains fail-closed when source needs a newer capability.

## Executable evidence

Native behavior is covered by independent paths:

1. direct AOT Win32/AppKit/GTK compilation and runtime smokes;
2. frozen compatibility workflow coverage;
3. payload-v17/runtime-v1.8 seal/link/run smokes on Windows, macOS and Linux;
4. Offline Compiler matrices for the Current Ready contract;
5. Pages release-integrity gating for browser-consumed v1.8 templates;
6. cross-platform runtime-v1.9 Button/ImageList smokes;
7. cross-platform runtime-v1.10 Window-icon smokes and package-contract tests;
8. real Windows v1.10 PE icon extraction plus runtime smoke from the packaged EXE.

The native GUI artifacts do not use Electron, Chromium or Node.js as their GUI runtime. The explicit compatibility package remains separate and labeled as Electron-based.

## Current boundary

Linux native GUI requires compatible GTK3 system libraries. Stable installers, real credentialed Windows signing, real macOS signing/notarization evidence, richer distribution/update channels, FreeBSD native GUI and manual assistive-technology validation remain open distribution/validation work.

None of this changes Change IR 0.10 or expands the beta.32 formal research assurance claims. See `docs/NATIVE_COMPATIBILITY.md`, `docs/OFFLINE_COMPILER.md`, `docs/NATIVE_APPS.md`, `docs/WINDOW_ICONS.md` and `docs/ROADMAP.md` for related contracts.