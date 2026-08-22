# Patch Build Targets

Patch uses one source language and one compiler pipeline for Console and Window applications. Target support is versioned by language/compiler surface, Native GUI IR, AOT backend and sealed runtime rather than treating every desktop path as interchangeable.

Current product baseline: **0.2.0-beta.35+** · Change IR **0.10** · Native GUI IR **1.3** · sealed desktop payload **v13** / runtime **v1.4**.

## Current portable targets

| Target | Status | Purpose |
|---|---|---|
| `.patchapp` | implemented | transparent portable Patch application bundle containing manifest, source and Change IR |
| bootstrap `.wasm` | implemented | instantiable WebAssembly module carrying the compiled Patch payload for a Patch host |
| direct `.wasm` | implemented subset | direct Change IR-to-Wasm execution for the supported numeric/formal subset |
| C99 | implemented subset | portable Console code generation and FreeBSD escape hatch |
| standalone Web | implemented | single-file Console and Window web applications |
| native desktop | implemented with explicit surfaces | Win32, AppKit and GTK3 direct AOT plus token-free sealed Ready/offline apps for the documented control surface |

## Canonical target matrix

| Application | Windows | macOS | Linux | FreeBSD | Browser |
|---|---|---|---|---|---|
| Console | sealed `.exe` | native `.app`/CLI package | sealed executable | C99 + `cc` | direct Wasm/runtime |
| Window, token-free Ready/offline | payload v13 / runtime v1.4 | payload v13 / runtime v1.4 | payload v13 / runtime v1.4 | unsupported | Standalone Web |
| Window, direct AOT | current Win32 backend 1.4 | current AppKit backend 1.4 | current GTK3 backend 1.4 | unsupported | Standalone Web |
| Portable | `.patchapp` / `.wasm` | `.patchapp` / `.wasm` | `.patchapp` / `.wasm` | `.patchapp` / C99 where applicable | `.patchapp` / `.wasm` |
| IDE | browser/PWA | browser/PWA | browser/PWA | browser where available | browser/PWA |

The current Window surface includes source-backed Form geometry and responsive Anchor/Dock policies, Text/Button/Input/Checkbox/ComboBox/ListBox/Radio/Tabs, Table/Grid, menus/dialogs, persistent list-backed multi-select ListBox, hierarchical TreeView and Slider. Unsupported native constructs fail closed rather than selecting Electron implicitly.

## Native Window contracts

The direct and sealed desktop paths share Patch semantics but retain separate versioned artifacts.

### Frozen base and Table layers

Native GUI IR **0.7** covers the frozen base Forms/control/menu/dialog surface. Native GUI IR **0.8** introduced Table/Grid with source-backed columns/rows and a transient `text-list` selected-row event value. Direct AOT backend **0.9** established the native Table mappings.

Sealed payload **v8** / runtime **v0.9** remains the responsive compatibility line. Payload **v9** / runtime **v1.0** remains the frozen Table line.

### List, Menu and TreeView compatibility layers

Native GUI IR **1.1** added persistent text-list state and list-backed multi-select ListBox semantics. The frozen sealed compatibility lines are:

- payload **v10** / runtime **v1.1**: persistent-list/multi-select ListBox;
- payload **v11** / runtime **v1.2**: Menu+list, including separators, portable shortcuts and source-backed Boolean `enabled` / `checked` projections;
- Native GUI IR **1.2** / payload **v12** / runtime **v1.3**: hierarchical TreeView, preserving earlier contracts and intentionally Slider fail-closed.

These formats remain independently smoke-tested and are not redefined by newer runtimes.

### Current Native GUI IR 1.3 / payload v13 / runtime v1.4

Native GUI IR **1.3** adds Slider range, step, optional numeric binding and numeric `changed` event metadata while preserving all earlier supported semantics. Current token-free Ready apps and ordinary offline `patch link` on Windows, macOS and Linux seal **payload v13** into **runtime v1.4**.

Slider interaction exposes a finite numeric transient `value` inside the declared range. TreeView selection exposes a transient root-to-node text-list path. Table and list-backed ListBox selections remain transient list-valued events. Persistent application state changes only through an explicit semantic Patch `change`.

Current native Slider mappings are:

- Windows: common-controls `TRACKBAR`;
- macOS: `NSSlider`;
- Linux: GTK3 `GtkScale`.

TreeView mappings remain common-controls TreeView, `NSOutlineView`, and `GtkTreeView` + `GtkTreeStore` respectively.

The v1.4 runtime workflow builds, seals and executes the canonical Slider program independently on all three desktop hosts and verifies that the existing Table/ListBox/Menu/Tree action engine remains intact.

## Windows

Current Windows paths include:

- Console: project-named sealed PE executable;
- Window Ready/offline: native Win32 runtime v1.4 consuming payload v13 / Native GUI IR 1.3;
- direct AOT: native Win32 backend 1.4;
- Table: report-mode `WC_LISTVIEWW`;
- list-backed ListBox: `LBS_EXTENDEDSEL` with semantic text-list event values;
- TreeView: native common-controls hierarchy with transient root-to-node path events;
- Slider: native `TRACKBAR` with bounded numeric event values;
- architecture: x86-64 is the primary release target;
- signing: fail-closed machinery exists, but real credentialed signing evidence is separate work.

## macOS

Current macOS paths include:

- Console: native package/CLI path;
- Window Ready/offline: AppKit runtime v1.4 consuming payload v13 / Native GUI IR 1.3;
- direct AOT: native AppKit backend 1.4;
- Table: multi-column `NSTableView`;
- multi-select ListBox: AppKit multi-selection;
- TreeView: `NSOutlineView`;
- Slider: `NSSlider`;
- Apple Silicon offline compiler: standalone binary;
- Intel offline compiler: portable kit with bundled Intel Node runtime and x86-64 AppKit runtime v1.4;
- Developer ID notarization is not claimed without separate evidence.

The browser-sealed Ready `.app` is unsigned because sealing changes the executable after the generic runtime template was built.

## Linux

Current Linux paths include:

- Console: native executable;
- Window Ready/offline: GTK3 runtime v1.4 consuming payload v13 / Native GUI IR 1.3;
- direct AOT: native GTK3 backend 1.4;
- Table: `GtkTreeView` + `GtkListStore`;
- list-backed ListBox: GTK multi-selection;
- TreeView: `GtkTreeView` + `GtkTreeStore`;
- Slider: GTK3 `GtkScale`;
- generated GUI output expects compatible normal system GTK3 libraries.

Additional self-contained package formats remain future distribution work rather than a language requirement.

## FreeBSD and other Unix-like systems

Patch does not pretend there is one universal Unix GUI API. FreeBSD currently has a tested Console path through portable C99 followed by local `cc`. Native FreeBSD Window/GUI output is not claimed.

Future Unix GUI work can use a dedicated host backend where justified, while Web/PWA remains available wherever a suitable browser exists.

## Web

The browser target uses the same Change-oriented application semantics while mapping Patch UI to browser primitives.

Current paths include:

```text
Patch source -> Change IR -> Standalone Window Web runtime
Patch source -> direct Wasm subset -> browser host
```

Table/Grid display and transient row-selection events are implemented in Standalone Web. Patch Studio App Preview exposes the same transient selected-row list through the shared semantic Window event adapter. List-backed ListBox is multi-select. TreeView exposes the same transient root-to-node display path used by native targets. Slider exposes the same bounded numeric transient value contract as current native v1.4. None of these interactions implicitly persists Patch state.

## `.patchapp`

`.patchapp` is the canonical transparent portable application unit. Its logical bundle contains manifest, Patch language/version metadata, application kind, source/IR as appropriate, assets and declared runtime capabilities.

The 0.2 format remains JSON for transparency. A compact archive/container can be introduced later without changing the logical model.

## Bootstrap `.wasm`

`patch build ... --target wasm` emits an instantiable WebAssembly module with exported memory and metadata locating an embedded compiled Patch payload. Browser/native Patch hosts can recover the same project + Change IR representation from this artifact.

This is distinct from the narrower direct-Wasm backend, which executes supported operations directly as WebAssembly instructions and is used by the current assurance pipeline.

## Build from phones/tablets

Patch Studio on iOS/Android can run browser-compatible programs and generate portable/Web artifacts locally. Token-free Ready desktop artifacts use published platform runtime templates. The current Ready Window path lowers Native GUI IR **1.3** in the browser and seals payload **v13** into runtime **v1.4**. Runtime bytes are SHA-256 checked against the Pages deployment integrity manifest before sealing.

The optional direct AOT cloud path delegates project-specific code generation to the corresponding GitHub-hosted platform runner. The ordinary Ready path does not need the user's GitHub token.

## Current release/integrity boundary

Current native Ready runtime release tags are:

- `native-win32-runtime-v1.4`;
- `native-macos-runtime-v1.4`;
- `native-linux-runtime-v1.4`.

Pages waits for all three runtime assets plus the compatibility/Console `studio-runtime-v0.6` release, validates their GitHub-recorded SHA-256 digests against the downloaded bytes and publishes the runtime integrity manifest. Patch Studio re-hashes the selected template in the browser before packaging.

SHA-256 consistency is distinct from platform signing/notarization. Real credentialed Windows signing, macOS Developer ID/notarization, installer/uninstall formats, richer Linux packaging and FreeBSD native GUI remain separate backlog items. Native Slider parity is implemented and is no longer a future target item.
