# Patch Build Targets

Patch uses one source language and one compiler pipeline for Console and Window applications. Target support is versioned by language/compiler surface, Native GUI IR, AOT backend and sealed runtime rather than treating every desktop path as interchangeable.

Current product baseline: **0.2.0-beta.36** · Change IR **0.10** · Native GUI IR **1.9** · sealed desktop payload **v19** / runtime **v1.10**.

## Current portable targets

| Target | Status | Purpose |
|---|---|---|
| `.patchapp` | implemented | transparent portable Patch application bundle containing manifest, source and Change IR |
| bootstrap `.wasm` | implemented | instantiable WebAssembly module carrying the compiled Patch payload for a Patch host |
| direct `.wasm` | implemented subset | direct Change IR-to-Wasm execution for the supported numeric/formal subset |
| C99 | implemented subset | portable Console code generation and FreeBSD escape hatch |
| standalone Web | implemented | single-file Console and Window web applications |
| native desktop | Current Ready with explicit compatibility lines | Win32, AppKit and GTK3 direct AOT plus token-free sealed Ready/offline apps |

## Canonical target matrix

| Application | Windows | macOS | Linux | FreeBSD | Browser |
|---|---|---|---|---|---|
| Console | sealed `.exe` | native `.app`/CLI package | sealed executable | C99 + `cc` | direct Wasm/runtime |
| Window, token-free Ready/offline | payload v19 / runtime v1.10 | payload v19 / runtime v1.10 | payload v19 / runtime v1.10 | unsupported | Standalone Web |
| Window, direct AOT | current Win32 AOT | current AppKit AOT | current GTK3 AOT | unsupported | Standalone Web |
| Portable | `.patchapp` / `.wasm` | `.patchapp` / `.wasm` | `.patchapp` / `.wasm` | `.patchapp` / C99 where applicable | `.patchapp` / `.wasm` |
| IDE | browser/PWA + Offline Studio | browser/PWA + Offline Studio | browser/PWA + Offline Studio | browser where available | browser/PWA |

The Current Ready Window surface includes source-backed Form geometry and responsive Anchor/Dock policies, Text/Button/Input/Checkbox/ComboBox/ListBox/Radio/Tabs, Table/Grid, menus/dialogs, persistent list-backed multi-select ListBox, hierarchical TreeView, Slider, Chrome Stage 1 Panel/Timer/PictureBox/StatusBar, Shape Stage 1, PaintBox including bounded PNG/JPEG `draw image`, Button ImageList images and Window/application icons. Unsupported native constructs fail closed rather than selecting Electron implicitly.

## Current Ready native line

| Role | Native GUI IR | Payload | Runtime | Product use |
|---|---:|---:|---:|---|
| explicit compatibility | 1.7 | v17 | v1.8 | Offline Compiler `--gui-payload-version 17` |
| Button/ImageList underlay | 1.8 | v18 | v1.9 | preserved beneath Current Ready |
| **Current Ready** | **1.9** | **v19** | **v1.10** | Studio Ready download, Pages integrity gate, Offline Compiler |

The v1.10 line includes deterministic Windows application-icon PE embedding, macOS `.icns` + `CFBundleIconFile`, and Linux hicolor PNG + `.desktop` metadata. Windows CI verifies the packaged executable with `ExtractAssociatedIcon` and `--patch-smoke`. Published runtime assets are SHA-256/GitHub-digest checked and bound to the expected release source commit.

## Native compatibility chain

Native GUI IR **0.7** covers the frozen base Forms/control/menu/dialog surface. Native GUI IR **0.8** introduced Table/Grid with source-backed columns/rows and a transient `text-list` selected-row event value. Direct AOT backend **0.9** established the native Table mappings.

Preserved lines include:

- payload **v8** / runtime **v0.9**: responsive compatibility;
- Native GUI IR **0.8** / payload **v9** / runtime **v1.0**: frozen Table line;
- payload **v10** / runtime **v1.1**: persistent-list/multi-select ListBox;
- payload **v11** / runtime **v1.2**: Menu+list;
- Native GUI IR **1.2** / payload **v12** / runtime **v1.3**: frozen TreeView line;
- Native GUI IR **1.3** / payload **v13** / runtime **v1.4**: Slider;
- Native GUI IR **1.4** / payload **v14** / runtime **v1.5**: Chrome Stage 1;
- Native GUI IR **1.5** / payload **v15** / runtime **v1.6**: Shape;
- Native GUI IR **1.6** / payload **v16** / runtime **v1.7**: PaintBox Stage 1;
- Native GUI IR **1.7** / payload **v17** / runtime **v1.8**: PaintBox `draw image`, explicit compatibility;
- Native GUI IR **1.8** / payload **v18** / runtime **v1.9**: Button/ImageList underlay;
- Native GUI IR **1.9** / payload **v19** / runtime **v1.10**: Current Ready Window/application icons.

These formats remain independently smoke-tested and are not redefined by newer runtimes.

## Table / Grid and transient selection

Current direct mappings remain:

- Windows: report-mode `WC_LISTVIEWW`;
- macOS: multi-column `NSTableView`;
- Linux: `GtkTreeView` + `GtkListStore`.

Patch Studio App Preview exposes the same transient selected-row list through the shared semantic Window event adapter. List-backed ListBox uses a transient text-list; TreeView uses a transient root-to-node text-list path; Slider exposes a finite numeric transient value. Persistent application state changes only through an explicit semantic Patch `change`.

## Windows

Current Windows paths include:

- Console: project-named sealed PE executable;
- Window Ready/offline: native Win32 runtime v1.10 consuming payload v19 / Native GUI IR 1.9;
- direct AOT: current Win32 AOT;
- Table: report-mode `WC_LISTVIEWW`;
- list-backed ListBox: `LBS_EXTENDEDSEL`;
- TreeView: native common-controls hierarchy;
- Slider: native `TRACKBAR`;
- Picture/PaintBox/Button/icon image decoding through the documented PNG/JPEG native policy;
- application icon: reserved PE resource slot patched in-place by `windows-pe-icon-v110/0.1`;
- signing: fail-closed machinery exists, while real credentialed signing evidence remains separate work.

## macOS

Current macOS paths include:

- Console: native package/CLI path;
- Window Ready/offline: AppKit runtime v1.10 consuming payload v19 / Native GUI IR 1.9;
- direct AOT: current AppKit AOT;
- Table: multi-column `NSTableView`;
- multi-select ListBox: AppKit multi-selection;
- TreeView: `NSOutlineView`;
- Slider: `NSSlider`;
- bounded PNG/JPEG decoding through `NSImage`;
- `.icns` application icon packaging plus `CFBundleIconFile`;
- Apple Silicon standalone compiler and Intel portable dual-runtime kit;
- Developer ID notarization is not claimed without separate evidence.

## Linux

Current Linux paths include:

- Console: native executable;
- Window Ready/offline: GTK3 runtime v1.10 consuming payload v19 / Native GUI IR 1.9;
- direct AOT: current GTK3 AOT;
- Table: `GtkTreeView` + `GtkListStore`;
- list-backed ListBox: GTK multi-selection;
- TreeView: `GtkTreeView` + `GtkTreeStore`;
- Slider: GTK3 `GtkScale`;
- bounded PNG/JPEG decoding through GdkPixbuf;
- hicolor application PNG plus `.desktop` metadata;
- generated GUI output expects compatible normal system GTK3 libraries.

## FreeBSD and other Unix-like systems

Patch does not pretend there is one universal Unix GUI API. FreeBSD currently has a tested Console path through portable C99 followed by local `cc`. Native FreeBSD Window/GUI output is not claimed.

## Web

The browser target uses the same change-oriented application semantics while mapping Patch UI to browser primitives:

```text
Patch source -> Change IR -> Standalone Window Web runtime
Patch source -> direct Wasm subset -> browser host
```

Table/Grid display and transient row-selection events are implemented in Standalone Web. List-backed ListBox is multi-select. TreeView exposes the transient root-to-node path. Slider exposes the same bounded numeric transient value contract as Current Ready native desktop. ImageList Button images are supported on Web, and the first Form `icon` is packaged as the application favicon under `window-icon/1.0`.

## Build from phones/tablets

Patch Studio on iOS/Android can run browser-compatible programs and generate portable/Web artifacts locally. Token-free Ready desktop artifacts use published platform runtime templates. The current Ready Window path lowers Native GUI IR **1.9** in the browser and seals payload **v19** into runtime **v1.10**. Runtime bytes are SHA-256 checked against the Pages deployment integrity manifest before sealing.

The optional direct AOT cloud path delegates project-specific code generation to the corresponding GitHub-hosted platform runner. The ordinary Ready path does not need the user's GitHub token.

## Current release/integrity boundary

Current native Ready runtime release tags are:

- `native-win32-runtime-v1.10`;
- `native-macos-runtime-v1.10`;
- `native-linux-runtime-v1.10`.

Pages waits for all three runtime assets plus the compatibility/Console `studio-runtime-v0.6` release, validates their GitHub-recorded SHA-256 digests against the downloaded bytes and publishes the runtime integrity manifest. Patch Studio re-hashes the selected template in the browser before packaging.

The Offline Compiler performs the same Current Ready v19 linking locally and retains the real v1.8 runtime only for explicit v17 compatibility.

SHA-256 consistency is distinct from platform signing/notarization. Real credentialed Windows signing, macOS Developer ID/notarization, installer/uninstall formats, richer Linux packaging and FreeBSD native GUI remain separate backlog items.
