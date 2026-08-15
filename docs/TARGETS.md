# Patch Build Targets

Patch uses one source language and one compiler pipeline for console and window applications. Target support is versioned by language/compiler surface, Native GUI IR, AOT backend and sealed runtime rather than treating every desktop path as interchangeable.

## Current portable targets

Patch 0.2 beta currently builds:

| Target | Status | Purpose |
|---|---|---|
| `.patchapp` | implemented | transparent portable Patch application bundle containing manifest, source and Change IR |
| bootstrap `.wasm` | implemented | instantiable WebAssembly module carrying the compiled Patch payload for a Patch host |
| direct `.wasm` | implemented subset | direct Change IR-to-Wasm execution for the supported numeric/formal subset |
| C99 | implemented subset | portable console code generation and FreeBSD escape hatch |
| standalone Web | implemented | single-file Console and Window web applications |
| native desktop | implemented with explicit surfaces | Win32, AppKit and GTK3 direct AOT plus token-free sealed Ready apps for their documented control surfaces |

## Canonical target matrix

| Application | Windows | macOS | Linux | FreeBSD | Browser |
|---|---|---|---|---|---|
| Console | sealed `.exe` | native `.app`/CLI package | sealed executable | C99 + `cc` | direct Wasm/runtime |
| Window, token-free Ready/offline surface | payload v9 / runtime v1.0 | payload v9 / runtime v1.0 | payload v9 / runtime v1.0 | unsupported | Standalone Web |
| Window, direct AOT | backend 0.8 base + backend 0.9 Table | backend 0.8 base + backend 0.9 Table | backend 0.8 base + backend 0.9 Table | unsupported | Standalone Web |
| Portable | `.patchapp` / `.wasm` | `.patchapp` / `.wasm` | `.patchapp` / `.wasm` | `.patchapp` / C99 where applicable | `.patchapp` / `.wasm` |
| IDE | browser/PWA | browser/PWA | browser/PWA | browser where available | browser/PWA |

## Native Window contracts

The direct and sealed desktop paths share language semantics but retain separate versioned artifacts.

### Native GUI IR 0.7 base surface

Native GUI IR **0.7** covers Forms, Text, Button, Input, Checkbox, ComboBox, ListBox, Radio, Tabs, menus, informational dialogs and Confirm/Open/Save result dialogs. Direct AOT backend **0.8** maps that surface to Win32, AppKit and GTK3.

Sealed payload **v8** / runtime **v0.9** remains the frozen responsive compatibility line for this control surface. It carries source-backed Anchor/Dock metadata but intentionally does not grow Table retroactively.

### Native GUI IR 0.8 Table extension

Native GUI IR **0.8** extends the native contract with Table/Grid. It preserves columns/rows and gives Table `changed` a transient `text-list` event value without adding persistent native list state.

Direct AOT backend **0.9** maps that Table contract to:

- Windows: report-mode `WC_LISTVIEWW`;
- macOS: multi-column `NSTableView` inside `NSScrollView`;
- Linux: `GtkTreeView` + `GtkListStore` inside `GtkScrolledWindow`.

The dedicated `Native Table v0.9` workflow compiles and executes the same Table source on Windows/MSVC, macOS/AppKit and Linux/GTK3 and checks native selection dispatch.

### Sealed payload v9 / runtime v1.0

Token-free Ready apps and offline `patch link` on Windows, macOS and Linux now carry Native GUI IR **0.8** through sealed payload **v9** / runtime **v1.0**. Payload v9 preserves the v8 responsive-layout contract and adds explicit Table columns, rows and transient `text-list` event typing.

The dedicated sealed-runtime matrix builds runtime v1.0 on all three platforms, seals and starts the Table example, then repeats the same operation through the ordinary offline `patch link` path. The downloadable offline compiler matrix also links and starts Table on Windows, Linux, Apple Silicon macOS and Intel macOS.

## Windows

Current Windows paths include:

- Console: project-named sealed PE executable;
- Window Ready/offline: native Win32 runtime v1.0 consuming payload v9 / Native GUI IR 0.8;
- direct AOT: backend 0.8 base controls and backend 0.9 Table;
- Table: real report-mode `WC_LISTVIEWW` on both direct AOT and sealed runtime v1.0 paths;
- architecture: x86-64 is the primary release target;
- signing: machinery exists, but real credentialed signing evidence is still separate work.

## macOS

Current macOS paths include:

- Console: native package/CLI path;
- Window Ready/offline: AppKit runtime v1.0 consuming payload v9 / Native GUI IR 0.8;
- direct AOT: backend 0.8 base controls and backend 0.9 Table;
- Table: real multi-column `NSTableView` on both direct AOT and sealed runtime v1.0 paths;
- Apple Silicon offline compiler: standalone binary;
- Intel offline compiler: portable kit with bundled Intel Node runtime and x86-64 AppKit runtime v1.0;
- Developer ID notarization is not claimed without separate evidence.

## Linux

Current Linux paths include:

- Console: native executable;
- Window Ready/offline: GTK3 runtime v1.0 consuming payload v9 / Native GUI IR 0.8;
- direct AOT: backend 0.8 base controls and backend 0.9 Table;
- Table: real `GtkTreeView` + `GtkListStore` on both direct AOT and sealed runtime v1.0 paths;
- generated GUI output expects compatible normal system GTK3 libraries.

Additional package formats such as AppImage remain future distribution work rather than a language requirement.

## FreeBSD and other Unix-like systems

Patch does not pretend that there is one universal Unix GUI API. FreeBSD currently has a tested Console path through portable C99 followed by local `cc`. Native FreeBSD Window/GUI output is not claimed.

Future Unix GUI work can use a dedicated host backend where justified, while Web/PWA remains available wherever a suitable browser exists.

## Web

The browser target uses the same Change IR/application semantics while mapping Patch UI to browser primitives.

Current paths include:

```text
Patch source -> Change IR -> Standalone Window Web runtime
Patch source -> direct Wasm subset -> browser host
```

Table/Grid display and transient row-selection events are implemented in Standalone Web. Patch Studio App Preview exposes the same transient selected-row list through the shared semantic Window event adapter, with mouse and keyboard selection and no implicit persistent state.

## `.patchapp`

`.patchapp` is the canonical transparent portable application unit. Its logical bundle contains:

- manifest;
- Patch language/version metadata;
- application kind (`console` or `window`);
- source/IR as appropriate;
- assets;
- declared runtime capabilities.

The 0.2 format remains JSON for transparency. A compact archive/container can be introduced later without changing the logical model.

## Bootstrap `.wasm`

`patch build ... --target wasm` emits an instantiable WebAssembly module with exported memory and metadata locating an embedded compiled Patch payload. Browser/native Patch hosts can recover the same project + Change IR representation from this artifact.

This is distinct from the narrower direct-Wasm backend, which executes supported operations directly as WebAssembly instructions and is used by the current assurance pipeline.

## Build from phones/tablets

Patch Studio on iOS/Android can run browser-compatible programs and generate portable/Web artifacts locally. Token-free Ready desktop artifacts use published platform runtime templates. The current Ready Window path lowers Native GUI IR 0.8 in the browser and seals payload v9 into runtime v1.0. The optional direct AOT cloud path delegates project-specific code generation to the corresponding GitHub-hosted platform runner:

```text
Build for Windows -> Windows runner
Build for macOS   -> macOS runner
Build for Linux   -> Linux runner
```

This keeps the IDE browser-first while platform-specific native toolchains remain isolated behind explicit build paths.
