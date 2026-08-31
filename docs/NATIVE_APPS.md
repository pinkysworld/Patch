# Application builds

Status: **0.2.0-beta.36+** · Change IR **0.10** · Current Ready Native GUI IR **1.7** · sealed payload **v17** · runtime **v1.8**

Patch keeps Console, direct-native Window, token-free sealed Window and explicit compatibility Window paths separate. Product GUI work does not expand the beta.32 research assurance claims.

## Current build matrix

```text
Console
  Web     -> direct Patch Wasm + browser host
  Windows -> project-named sealed .exe
  macOS   -> project-named sealed .app
  Linux   -> project-named sealed executable
  FreeBSD -> portable C99 + native cc

Window / GUI
  Web     -> Standalone Window Web App
  Windows -> direct Win32 AOT or token-free sealed Win32 runtime v1.8
  macOS   -> direct AppKit AOT or token-free sealed AppKit runtime v1.8
  Linux   -> direct GTK3 AOT or token-free sealed GTK3 runtime v1.8
  FreeBSD -> not yet supported
```

Windows/macOS/Linux ordinary Studio downloads use **Ready app download (no token)** by default. That path lowers project-specific Native GUI IR **1.7** through `src/native-current-contract.js`, verifies the platform runtime template, seals payload **v17** into runtime **v1.8** and downloads the result. The frozen TreeView contract remains Native GUI IR **1.2** / payload **v12** / runtime **v1.3** through `src/native-frozen-contract.js`.

## Current Ready versus implemented next line

The product boundary is intentionally conservative:

| Role | Native GUI IR | Payload | Runtime | Status |
|---|---:|---:|---:|---|
| Current Ready | **1.7** | **v17** | **v1.8** | published, digest-verified, used by Studio and Offline Compiler |
| Button/ImageList next layer | **1.8** | **v18** | **v1.9** | implemented and cross-platform runtime-smoked |
| Window/application icon next layer | **1.9** | **v19** | **v1.10** | implemented, packaged and cross-platform runtime-smoked |

The v1.10 line preserves the complete v1.9 Button/ImageList layer. It also has deterministic Windows/macOS/Linux application-icon packaging. Windows uses `windows-pe-icon-v110/0.1` to patch the project icon into the reserved PE resource slot of the normal v1.10 runtime template, and CI verifies the finished executable with `ExtractAssociatedIcon` and `--patch-smoke`. macOS packages `.icns` plus `CFBundleIconFile`; Linux packages hicolor PNG plus `.desktop` metadata.

These next contracts are **not Current Ready yet**. Promotion still requires versioned v1.10 release assets, verified SHA-256 digests, browser runtime lookup, Offline Compiler linking, public capability metadata and only then a `src/native-current-contract.js` change.

## Versioned native layers

Published and preserved compatibility contracts are not redefined in place:

- **Native GUI IR 0.7**: frozen base Forms/control/menu/dialog surface.
- **Native GUI IR 0.8**: additive Table extension with source-backed columns/rows and transient `text-list` Table events.
- **Native GUI IR 1.1**: persistent text-list state and list-backed multi-select ListBox semantics.
- **Native GUI IR 1.2 / payload v12 / runtime v1.3**: frozen TreeView compatibility line.
- **Native GUI IR 1.3 / payload v13 / runtime v1.4**: Slider compatibility line.
- **Native GUI IR 1.4 / payload v14 / runtime v1.5**: Chrome Stage 1 compatibility line.
- **Native GUI IR 1.5 / payload v15 / runtime v1.6**: Shape compatibility line.
- **Native GUI IR 1.6 / payload v16 / runtime v1.7**: PaintBox Stage 1 compatibility line.
- **Native GUI IR 1.7 / payload v17 / runtime v1.8**: current Ready PaintBox `draw image` line.
- **Native GUI IR 1.8 / payload v18 / runtime v1.9**: implemented Button/ImageList layer, not promoted.
- **Native GUI IR 1.9 / payload v19 / runtime v1.10**: implemented Window/application icon layer, not promoted.
- **payload v11 / runtime v1.2**: frozen Menu+list compatibility.
- **payload v10 / runtime v1.1**: frozen persistent-list compatibility.
- **payload v9 / runtime v1.0**: frozen Table compatibility.
- **payload v8 / runtime v0.9**: frozen responsive compatibility.

A newer runtime or backend therefore does not silently redefine an older payload or IR format.

## Native UI semantics

GUI interaction alone does not persist Patch state.

- Input `changed` exposes transient text `value`.
- Checkbox `changed` exposes transient Boolean `value`.
- ComboBox/Radio and text-backed ListBox `changed` expose transient text `value`.
- list-backed ListBox `changed` exposes a transient copied text-list `value`.
- Table `changed` exposes the selected row as transient list-valued `value`.
- TreeView `changed` exposes the selected root-to-node display path as transient text-list `value`.
- Slider `changed` exposes a finite numeric `value` inside the declared range.
- MenuItem `clicked` has no value.
- Tabs page selection is renderer/toolkit-local and exposes no Patch event.
- Confirm emits `confirmed` or `cancelled`.
- Open/Save emit `chosen` with transient text `value`, or `cancelled`.

Persistent application state changes only through an explicit semantic `change`.

## Table / Grid

Table/Grid uses the specialized representation introduced at Native GUI IR **0.8**. The frozen direct-native mappings remain explicit compatibility evidence:

- **Windows:** report-mode `WC_LISTVIEWW`;
- **macOS:** multi-column `NSTableView` inside `NSScrollView`;
- **Linux:** `GtkTreeView` + `GtkListStore` inside `GtkScrolledWindow`.

Standalone Web and Studio App Preview expose the selected row as a transient row list through the shared semantic Window event adapter. Direct AOT and current token-free sealed Ready/offline paths preserve the same selected-row contract. Current payload v17/runtime v1.8 carries the unchanged Table representation; payload v9/runtime v1.0 remains the frozen Table compatibility line.

## TreeView, Slider and multi-select ListBox

TreeView is source-backed and hierarchical. Selecting a node exposes its root-to-node display path as transient text-list `value`. Current mappings are Win32 common-controls TreeView, AppKit `NSOutlineView`, and GTK3 `GtkTreeView` + `GtkTreeStore`.

Slider is supported across Studio preview, Standalone Web, direct AOT and Current Ready sealed/offline paths. Native mappings are Win32 `TRACKBAR`, AppKit `NSSlider` and GTK3 `GtkScale`.

List-backed ListBox uses the text-list event contract. Native GUI IR 1.1 introduced this ABI; Current Ready IR 1.7/payload v17/runtime v1.8 preserves it unchanged.

## Graphics and resources

Current Ready desktop behavior includes:

- Picture PNG/JPEG decoding through Win32/WIC, AppKit/NSImage and GTK/GdkPixbuf under `native-picture-formats/1.0`;
- Shape rectangle/rounded/ellipse/line rendering;
- PaintBox clear/line/rectangle/ellipse/text and bounded PNG/JPEG `draw image`;
- source-backed project resources carried through the project-v4 resource store.

Current Ready IR 1.7 deliberately fails closed for Button ImageList bindings and Form icons. That fail-closed boundary describes the **published Ready line**, not implementation availability: the experimental 1.8/18/1.9 and 1.9/19/1.10 layers implement those features and await promotion.

## Token-free sealed runtimes and integrity

Current Ready Window builds use **payload v17 / runtime v1.8** on Windows, macOS and Linux. Runtime release tags are:

- `native-win32-runtime-v1.8`;
- `native-linux-runtime-v1.8`;
- `native-macos-runtime-v1.8`.

The v1.8 workflows build each runtime from source, seal canonical programs, execute native smoke tests and publish the generic runtime templates. Pages requires the three v1.8 native releases plus `studio-runtime-v0.6`, verifies the GitHub-recorded SHA-256 digests, publishes `runtimes/runtime-manifest.json`, and Patch Studio re-hashes the selected runtime with Web Crypto before sealing.

This establishes byte consistency across the GitHub Release -> Pages -> browser path. It does not claim Authenticode, Developer ID/notarization, a transparency log or an independent signing trust root.

## Offline compiler

The rolling `offline-compiler-v0.2` line embeds/packages Current Ready runtime **v1.8** and seals Window payload **v17** on Windows, Linux, Apple Silicon macOS and Intel macOS. Its matrix exercises Console, responsive Window, Table, native multi-select ListBox, decorated Menu, TreeView, Slider, Chrome, Shape, PaintBox and PaintBox image paths. FreeBSD remains Console-only through portable C99 + local `cc`.

The experimental v1.10 icon line is not yet used by the downloadable Offline Compiler. That switch is part of the explicit promotion gate.

## Direct AOT and compatibility path

Project-specific direct AOT remains available through Win32, AppKit and GTK3 backends. Patch also retains the Electron-based compatibility backend as an explicit fallback, never as a silent native fallback. The compatibility runtime remains `studio-runtime-v0.6`.

## Accessibility and distribution boundary

Direct and sealed native paths implement deterministic accessible naming where toolkit defaults are insufficient. This is an automated engineering baseline, not a WCAG conformance claim. Manual Narrator/VoiceOver/Orca validation remains open.

Stable installers, real credentialed Windows signing, real macOS Developer ID/notarization evidence, richer Linux distribution formats, FreeBSD native GUI and update channels remain distribution work.

## Research boundary

Current Ready IR 1.7/payload v17/runtime v1.8 and the implemented experimental 1.8/18/1.9 and 1.9/19/1.10 product work do not alter the beta.32 assurance evidence. Product runtime version numbers must not be read as expanded proof coverage.