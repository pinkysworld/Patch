# Patch Native GUI

Status: **executable native backend and Current Ready sealed runtime on Windows, macOS and Linux**

Patch lowers the same source-backed Window syntax into operating-system-native GUI code. Patch source does not import Win32, AppKit or GTK.

## Product contract

The native stack separates semantic IR, direct AOT generation and token-free sealed distribution. Older contracts remain frozen instead of being redefined in place.

| Layer | Current / compatibility role |
|---|---|
| Change IR | **0.10**, unchanged by GUI extensions |
| Native GUI IR 0.8 / payload v9 / runtime v1.0 | frozen Table/Grid compatibility |
| Native GUI IR 1.2 / payload v12 / runtime v1.3 | frozen TreeView compatibility |
| Native GUI IR 1.3 / payload v13 / runtime v1.4 | historical Slider line |
| Native GUI IR 1.4 / payload v14 / runtime v1.5 | historical Chrome Stage 1 line |
| Native GUI IR 1.5 / payload v15 / runtime v1.6 | historical Shape line |
| Native GUI IR 1.6 / payload v16 / runtime v1.7 | historical PaintBox Stage 1 line |
| Native GUI IR 1.7 / payload v17 / runtime v1.8 | explicit Offline Compiler compatibility line, PaintBox `draw image` |
| Native GUI IR 1.8 / payload v18 / runtime v1.9 | Button/ImageList transport underlay |
| Native GUI IR **1.9** / payload **v19** / runtime **v1.10** | **Current Ready** Window/application icon line |

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

Current token-free Ready/offline Window builds use **Native GUI IR 1.9**, **sealed payload v19** and **runtime v1.10** through `src/native-current-contract.js`. The frozen TreeView line is Native GUI IR **1.2** / payload **v12** / runtime **v1.3** through `src/native-frozen-contract.js`. The Offline Compiler keeps **payload v17/runtime v1.8** as an explicit compatibility option.

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
- Button ImageList bindings through the preserved IR1.8/BIMG layer;
- application/Form icons through IR1.9/WICO;
- structural Window menus, separators, shortcuts and Boolean enabled/checked projections;
- informational and result-bearing Confirm/Open/Save dialogs;
- named Form `open` / `close` lifecycle.

Unsupported native behavior fails closed. There is no implicit Electron fallback.

## Button/ImageList and Window icons

IR 1.8 / payload v18 / runtime v1.9 carries deduplicated project image assets for Button `ImageList` bindings and consumes them on Win32, AppKit and GTK. Current Ready v1.10 preserves this entire transport as the prefix beneath payload v19.

IR 1.9 / payload v19 / runtime v1.10 adds application/Form Window icons on all three native hosts. The application-icon packaging contract is platform-specific but deterministic:

- Windows: project application icon is embedded in-place into the reserved PE icon resource slot and verified by Windows icon extraction plus runtime smoke;
- macOS: `.icns` is installed into the `.app` bundle and referenced through `CFBundleIconFile`;
- Linux: hicolor PNG and `.desktop` metadata are emitted alongside the sealed runtime.

See `docs/WINDOW_ICONS.md` for the detailed contract.

## Selection and input semantics

GUI interaction is transient unless Patch source explicitly persists it:

```text
native interaction -> transient event value -> when <id> changed -> explicit Patch change
```

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

## Preserved component semantics

Table was introduced at Native GUI IR **0.8**. Native mappings remain report-mode `WC_LISTVIEWW` on Windows, multi-column `NSTableView` inside `NSScrollView` on macOS and `GtkTreeView` + `GtkListStore` inside `GtkScrolledWindow` on Linux. The selected row remains a transient text-list event value in Current Ready v19/v1.10.

TreeView was introduced at Native GUI IR **1.2**. Native mappings remain common-controls TreeView on Windows, `NSOutlineView` on macOS and `GtkTreeView` + `GtkTreeStore` on Linux. Selecting a node exposes the root-to-node text-list path. Payload v12/runtime v1.3 remains the frozen origin line.

Slider maps to Win32 `TRACKBAR`, AppKit `NSSlider` and GTK3 `GtkScale`. A ListBox backed by `create list` uses the text-list event contract. Menus use native `HMENU`, `NSMenu` and GTK menu primitives.

## Graphics and resource policy

Native Picture and PaintBox image resources use `native-picture-formats/1.0`. Current Ready supports bounded PNG/JPEG project resources and data URIs through WIC, NSImage and GdkPixbuf. Native WebP/SVG remain deferred and fail closed.

PaintBox `paint` handlers are rendering-only. Persistent mutation is rejected inside them. Shape and PaintBox runtime drawing reuse the platform-native GDI+/AppKit/GTK drawing stacks.

## Current token-free runtime integrity

All three Current Ready Window builds use the `PCHGUI01` envelope with payload **v19** and runtime **v1.10**. Current release tags are:

- `native-win32-runtime-v1.10`;
- `native-macos-runtime-v1.10`;
- `native-linux-runtime-v1.10`.

Pages waits for all three release assets plus `studio-runtime-v0.6`, verifies GitHub-recorded SHA-256 asset digests and publishes the runtime integrity manifest. Patch Studio independently re-hashes the selected runtime with Web Crypto before sealing.

The downloadable Offline Compiler defaults to IR1.9/payload-v19/runtime-v1.10 and carries a separate runtime-v1.8 asset for explicit `--gui-payload-version 17` compatibility. Runtime selection fails closed if the required embedded runtime is absent.

## Compatibility chain

```text
Native GUI IR 0.8 / payload v9  / runtime v1.0   Table
Native GUI IR 1.1 / payload v10 / runtime v1.1   persistent list + multi-select ListBox
payload v11 / runtime v1.2                          Menu + list
Native GUI IR 1.2 / payload v12 / runtime v1.3   frozen TreeView
Native GUI IR 1.3 / payload v13 / runtime v1.4   Slider
Native GUI IR 1.4 / payload v14 / runtime v1.5   Chrome Stage 1
Native GUI IR 1.5 / payload v15 / runtime v1.6   Shape
Native GUI IR 1.6 / payload v16 / runtime v1.7   PaintBox Stage 1
Native GUI IR 1.7 / payload v17 / runtime v1.8   PaintBox draw image, explicit compatibility
Native GUI IR 1.8 / payload v18 / runtime v1.9   Button/ImageList underlay
Native GUI IR 1.9 / payload v19 / runtime v1.10  Current Ready Window/application icons
```

Explicit legacy linking remains fail-closed when source needs a newer capability.

## Executable evidence

Native behavior is covered by independent paths:

1. direct AOT Win32/AppKit/GTK compilation and runtime smokes;
2. frozen compatibility workflow coverage;
3. versioned payload/runtime regression smokes;
4. cross-platform runtime-v1.9 Button/ImageList smokes;
5. cross-platform runtime-v1.10 Window-icon and packaging smokes;
6. immutable v1.10 release assets with SHA-256/GitHub digest and source-binding verification;
7. dual-runtime Offline Compiler tests on Windows, Linux, macOS Apple Silicon and macOS Intel;
8. real Windows PE associated-icon extraction plus runtime smoke from the packaged EXE.

The native GUI artifacts do not use Electron, Chromium or Node.js as their GUI runtime. The explicit compatibility package remains separate and labeled as Electron-based.

## Current boundary

Linux native GUI requires compatible GTK3 system libraries. Stable installers, real credentialed Windows signing, real macOS signing/notarization evidence, richer distribution/update channels, FreeBSD native GUI and manual assistive-technology validation remain open distribution/validation work.

None of this changes Change IR 0.10 or expands the beta.32 formal research assurance claims. See `docs/NATIVE_COMPATIBILITY.md`, `docs/OFFLINE_COMPILER.md`, `docs/NATIVE_APPS.md`, `docs/WINDOW_ICONS.md` and `docs/ROADMAP.md` for related contracts.
