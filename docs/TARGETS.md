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
| Window, stable sealed surface | native Win32 `.exe` | AppKit `.app` | GTK3 executable | unsupported | Standalone Web |
| Window, direct AOT Table extension | backend 0.9 | backend 0.9 | backend 0.9 | unsupported | Standalone Web |
| Portable | `.patchapp` / `.wasm` | `.patchapp` / `.wasm` | `.patchapp` / `.wasm` | `.patchapp` / C99 where applicable | `.patchapp` / `.wasm` |
| IDE | browser/PWA | browser/PWA | browser/PWA | browser where available | browser/PWA |

## Native Window contracts

The stable direct and sealed desktop surfaces are intentionally separated.

### Stable Native GUI IR 0.7 surface

Native GUI IR **0.7** covers Forms, Text, Button, Input, Checkbox, ComboBox, ListBox, Radio, Tabs, menus, informational dialogs and Confirm/Open/Save result dialogs. Direct AOT backend **0.8** maps that surface to Win32, AppKit and GTK3. Token-free sealed payload **v8** / runtime **v0.9** carries the same control surface plus source-backed responsive Anchor/Dock metadata.

### Table direct-AOT extension

Native GUI IR **0.8** is an opt-in extension for Table/Grid. It preserves columns/rows and gives Table `changed` a transient `text-list` event value without adding persistent native list state.

AOT backend **0.9** maps that Table contract to:

- Windows: report-mode `WC_LISTVIEWW`;
- macOS: multi-column `NSTableView` inside `NSScrollView`;
- Linux: `GtkTreeView` + `GtkListStore` inside `GtkScrolledWindow`.

The dedicated `Native Table v0.9` workflow compiles and executes the same Table source on Windows/MSVC, macOS/AppKit and Linux/GTK3 and checks native selection dispatch.

**Table is not yet part of sealed payload v8/runtime v0.9 or offline `patch link`.** Those paths must fail closed for Table until an explicit sealed Table format and consumer are implemented and smoke-tested.

## Windows

Current Windows paths include:

- Console: project-named sealed PE executable;
- Window stable surface: direct Win32 AOT or token-free sealed Win32 runtime;
- Table: direct Win32 AOT backend 0.9 only at the current stage;
- architecture: x86-64 is the primary release target;
- signing: machinery exists, but real credentialed signing evidence is still separate work.

## macOS

Current macOS paths include:

- Console: native package/CLI path;
- Window stable surface: direct AppKit AOT or token-free sealed AppKit runtime;
- Table: direct AppKit AOT backend 0.9 only at the current stage;
- Apple Silicon offline compiler: standalone binary;
- Intel offline compiler: portable kit with bundled Intel Node runtime;
- Developer ID notarization is not claimed without separate evidence.

## Linux

Current Linux paths include:

- Console: native executable;
- Window stable surface: direct GTK3 AOT or token-free sealed GTK3 runtime;
- Table: direct GTK3 AOT backend 0.9 only at the current stage;
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

Table/Grid display and transient row-selection events are implemented in Standalone Web. Patch Studio App Preview now exposes the same transient selected-row list through the shared semantic Window event adapter, with mouse and keyboard selection and no implicit persistent state.

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

Patch Studio on iOS/Android can run browser-compatible programs and generate portable/Web artifacts locally. Token-free Ready desktop artifacts use published platform runtime templates. The optional direct AOT cloud path delegates compilation to the corresponding GitHub-hosted platform runner:

```text
Build for Windows -> Windows runner
Build for macOS   -> macOS runner
Build for Linux   -> Linux runner
```

This keeps the IDE browser-first while platform-specific native toolchains remain isolated behind explicit build paths.
