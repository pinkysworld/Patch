# Application builds

Status: **0.2.0-beta.36+** · Change IR **0.10** · Current Ready Native GUI IR **1.9** · sealed payload **v19** · runtime **v1.10**

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
  Windows -> direct Win32 AOT or token-free sealed Win32 runtime v1.10
  macOS   -> direct AppKit AOT or token-free sealed AppKit runtime v1.10
  Linux   -> direct GTK3 AOT or token-free sealed GTK3 runtime v1.10
  FreeBSD -> not yet supported
```

Windows/macOS/Linux ordinary Studio downloads use **Ready app download (no token)** by default. That path lowers project-specific Native GUI IR **1.9** through `src/native-current-contract.js`, verifies the platform runtime template, seals payload **v19** into runtime **v1.10** and downloads the result. The frozen TreeView contract remains Native GUI IR **1.2** / payload **v12** / runtime **v1.3** through `src/native-frozen-contract.js`.

## Current Ready and compatibility layers

| Role | Native GUI IR | Payload | Runtime | Status |
|---|---:|---:|---:|---|
| explicit compatibility | 1.7 | v17 | v1.8 | retained by Offline Compiler |
| Button/ImageList underlay | 1.8 | v18 | v1.9 | preserved inside Current Ready |
| **Current Ready** | **1.9** | **v19** | **v1.10** | Studio, Pages and Offline Compiler default |

The v1.10 line preserves the complete v1.9 Button/ImageList layer and adds deterministic Windows/macOS/Linux application-icon packaging. Windows uses `windows-pe-icon-v110/0.1` to patch the project icon into the reserved PE resource slot of the normal v1.10 runtime template; CI verifies the finished executable with `ExtractAssociatedIcon` and `--patch-smoke`. macOS packages `.icns` plus `CFBundleIconFile`; Linux packages hicolor PNG plus `.desktop` metadata.

Published v1.10 release assets, SHA-256/GitHub digests, source binding, browser runtime lookup and dual-runtime Offline Compiler evidence are part of the Current Ready promotion evidence.

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
- **Native GUI IR 1.7 / payload v17 / runtime v1.8**: PaintBox `draw image`, explicit desktop compatibility line.
- **Native GUI IR 1.8 / payload v18 / runtime v1.9**: Button/ImageList underlay.
- **Native GUI IR 1.9 / payload v19 / runtime v1.10**: Current Ready Window/application icon line.
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

Standalone Web and Studio App Preview expose the selected row as a transient row list through the shared semantic Window event adapter. Direct AOT and Current Ready sealed/offline paths preserve the same selected-row contract. Current payload v19/runtime v1.10 carries the unchanged Table representation through its compatibility prefixes; payload v9/runtime v1.0 remains the frozen Table compatibility line.

## TreeView, Slider and multi-select ListBox

TreeView is source-backed and hierarchical. Selecting a node exposes its root-to-node display path as transient text-list `value`. Current mappings are Win32 common-controls TreeView, AppKit `NSOutlineView`, and GTK3 `GtkTreeView` + `GtkTreeStore`.

Slider is supported across Studio preview, Standalone Web, direct AOT and Current Ready sealed/offline paths. Native mappings are Win32 `TRACKBAR`, AppKit `NSSlider` and GTK3 `GtkScale`.

List-backed ListBox uses the text-list event contract. Native GUI IR 1.1 introduced this ABI; Current Ready IR1.9/payload-v19/runtime-v1.10 preserves it unchanged.

## Graphics and resources

Current Ready desktop behavior includes:

- Picture PNG/JPEG decoding through Win32/WIC, AppKit/NSImage and GTK/GdkPixbuf under `native-picture-formats/1.0`;
- Shape rectangle/rounded/ellipse/line rendering;
- PaintBox clear/line/rectangle/ellipse/text and bounded PNG/JPEG `draw image`;
- source-backed project resources carried through the project-v4 resource store;
- Button ImageList project resources consumed by Win32/AppKit/GTK;
- application/Form icons consumed at runtime and packaged through native platform icon metadata.

Native WebP/SVG remain deferred and fail closed rather than being silently decoded with platform-dependent behavior.

## Token-free sealed runtimes and integrity

Current Ready Window builds use **payload v19 / runtime v1.10** on Windows, macOS and Linux. Runtime release tags are:

- `native-win32-runtime-v1.10`;
- `native-linux-runtime-v1.10`;
- `native-macos-runtime-v1.10`.

Pages requires the three v1.10 native releases plus `studio-runtime-v0.6`, verifies the GitHub-recorded SHA-256 digests, publishes `runtimes/runtime-manifest.json`, and Patch Studio re-hashes the selected runtime with Web Crypto before sealing.

This establishes byte consistency across the GitHub Release -> Pages -> browser path. It does not claim Authenticode, Developer ID/notarization, a transparency log or an independent signing trust root.

## Offline compiler

The rolling `offline-compiler-v0.2` line embeds/packages Current Ready runtime **v1.10** and defaults Window output to payload **v19** on Windows, Linux, Apple Silicon macOS and Intel macOS. The same compiler carries a separate runtime **v1.8** underlay for explicit `--gui-payload-version 17` compatibility.

Its promotion matrix exercises both generations and verifies runtime-release digests/source binding, Current Ready native smoke, legacy compatibility, Button/ImageList transport and Window/application-icon packaging. FreeBSD remains Console-only through portable C99 + local `cc`.

## Direct AOT and compatibility path

Project-specific direct AOT remains available through Win32, AppKit and GTK3 backends. Patch also retains the Electron-based compatibility backend as an explicit fallback, never as a silent native fallback. The compatibility runtime remains `studio-runtime-v0.6`.

## Accessibility and distribution boundary

Direct and sealed native paths implement deterministic accessible naming where toolkit defaults are insufficient. This is an automated engineering baseline, not a WCAG conformance claim. Manual Narrator/VoiceOver/Orca validation remains open.

Stable installers, real credentialed Windows signing, real macOS Developer ID/notarization evidence, richer Linux distribution formats, FreeBSD native GUI and update channels remain distribution work.

## Research boundary

Current Ready IR1.9/payload-v19/runtime-v1.10 product work does not alter the beta.32 assurance evidence. Product runtime version numbers must not be read as expanded proof coverage.
