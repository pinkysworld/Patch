# Patch offline compiler

Current product version: **0.2.0-beta.35+**  
Offline compiler distribution contract: **0.1**

The Patch offline compiler is the command-line counterpart to Patch Studio's token-free local build path. Windows, macOS and Linux downloads package the Patch source compiler with the runtime pieces needed for local development. Once downloaded, normal source checking/building and supported `patch link` operations do not require GitHub or Patch Studio. Windows, Linux and macOS Apple Silicon require no installed Node runtime; the macOS Intel kit includes its own Intel Node runtime. FreeBSD uses a portable kit with local Node and `cc` requirements.

## Downloads and verification

The canonical download page is `https://minh.systems/Patch/downloads.html`.

The rolling beta release tag is `offline-compiler-v0.1` with stable asset names:

- `patch-windows-x64.exe`
- `patch-macos-arm64`
- `patch-macos-x64.tar.gz`
- `patch-linux-x64`
- `patch-freebsd-x64.tar.gz`
- `SHA256SUMS`

Verify downloaded bytes before first use or after replacing a rolling-beta asset. SHA-256 verifies release-byte consistency; it does not imply Authenticode, Developer ID/notarization or an independent signing authority.

## Main commands

```text
patch check app.patch
patch run app.patch
patch changes app.patch
patch formal app.patch
patch build app.patch --target portable
patch build app.patch --target wasm-direct
patch build app.patch --target c99
patch build app.patch --target web --out App.html
patch link app.patch --out App
patch doctor
```

`patch build` preserves the normal compiler targets. `patch link` is the host-local application linker. `patch doctor` reports environment probes and self-checks the interpreter, direct Wasm and C99 numeric subset, including that Things fail closed on those backends. On Unix hosts with a C compiler it also compiles and runs the numeric C99 program.

## Current `patch link` contract

`patch link program.patch [--out App] [--name AppName]` compiles the source through the ordinary `src/compiler.js` pipeline and infers Console versus Window from source.

### Console

Windows, Linux and macOS Apple Silicon lower supported Console programs through direct Wasm and seal the module into the embedded generic Console runtime. macOS Intel creates a portable `.app` containing the direct Patch Wasm module, a small runner and the kit's embedded Intel Node runtime.

### Window / GUI

Current Windows, macOS and Linux linking lowers supported Window programs through Native GUI IR **1.3** and seals payload **v13** into native Win32, AppKit or GTK3 runtime **v1.4**. Product JavaScript for that line imports `src/native-current-contract.js`. The frozen TreeView line remains Native GUI IR **1.2** / payload **v12** / runtime **v1.3** through `src/native-frozen-contract.js` and stays Slider fail-closed. Electron is not selected implicitly.

Payload v13 preserves the complete earlier responsive/Table/list/Menu/TreeView contract and adds explicit Slider range/step/numeric-event metadata. The current surface includes:

- Forms, controls, dialogs and responsive Anchor/Dock metadata;
- Table/Grid columns, rows and transient `text-list` row-selection events;
- persistent text-list state and list-backed native multi-select ListBox semantics;
- Menu separators, portable shortcuts and source-backed `enabled` / `checked` projections;
- hierarchical TreeView nodes and transient root-to-node text-list selection paths;
- Slider range/step plus finite numeric transient `changed` values.

The ordinary Window event rule does not change: toolkit interaction is transient. Persistent Patch state changes only through explicit semantic `change`.

The offline-compiler matrix builds and executes on Windows, Linux, Apple Silicon macOS and Intel macOS:

1. a Console application;
2. a responsive Window application;
3. the Table/Grid example;
4. the list-backed multi-select ListBox example;
5. the decorated Menu example;
6. the hierarchical TreeView example;
7. the native Slider example.

Every current Window smoke verifies the current payload **v13** where applicable. Unsupported GUI combinations or explicitly selected older contracts continue to fail closed rather than silently degrading semantics.

## Slider

Slider is supported by the current offline Window linker:

```patch
create number volume = 50
window "Mixer" as main size 560, 300:
  slider 0..100 as volume step 5 at 24, 80 size 300, 44
when volume changed:
  change volume:
    set = value
```

Native mappings are Win32 `TRACKBAR`, AppKit `NSSlider` and GTK3 `GtkScale`. The event-local `value` is finite and bounded by the declared range. The native runtime does not mutate persistent `volume` merely because the toolkit Slider moved; persistence occurs only because the handler executes `change volume`.

The frozen Native GUI IR 1.2 / payload v12 / runtime v1.3 line remains Slider fail-closed.

## TreeView

TreeView remains supported by the current offline Window linker. Selecting a node exposes its root-to-node display path as transient text-list `value`. Native mappings are Win32 TreeView, AppKit `NSOutlineView` and GTK3 `GtkTreeView` + `GtkTreeStore`.

Native GUI IR 1.3 / payload v13 / runtime v1.4 preserves the TreeView ABI introduced by Native GUI IR 1.2 / payload v12 / runtime v1.3.

## Table / Grid

Table/Grid remains supported throughout the current stack:

- language, Designer, Studio App Preview and Standalone Web expose transient selected-row semantics;
- direct native support uses the versioned Native GUI stack;
- current Ready/offline linking carries the Table contract inside payload **v13** / runtime **v1.4**;
- Win32 maps to report-mode `WC_LISTVIEWW`;
- AppKit maps to multi-column `NSTableView`;
- GTK3 maps to `GtkTreeView` + `GtkListStore`.

Table `changed` exposes the selected row as transient list-valued `value`; persistence still requires explicit Patch `change`.

## List-backed multi-select ListBox

A ListBox bound to `create list` has native parity on the supported desktop hosts. Native GUI IR 1.1 introduced the persistent text-list state/event ABI. The current Native GUI IR **1.3** / payload **v13** / runtime **v1.4** contract preserves it unchanged while composing later Menu, TreeView and Slider extensions. Text-backed ListBox remains single-select.

## Frozen compatibility lines

Versioned runtime formats are not redefined after publication:

- Native GUI IR **1.2** / payload **v12** / runtime **v1.3** is the frozen TreeView line and stays Slider fail-closed;
- payload **v11** / runtime **v1.2** is the frozen Menu+list compatibility line;
- payload **v10** / runtime **v1.1** is the frozen persistent-list/multi-select line;
- payload **v9** / runtime **v1.0** is the frozen Table-capable line;
- payload **v8** / runtime **v0.9** is the frozen responsive Native GUI IR 0.7 line;
- payload **v7** / runtime **v0.8** is the older accessibility/result-dialog compatibility line.

The current compiler defaults to Native GUI IR 1.3 / payload v13 / runtime v1.4. `patch link --gui-payload-version` accepts **12** (frozen TreeView) or **13** (current Slider). Older payload versions fail closed rather than silently degrading semantics.

## FreeBSD

FreeBSD currently supports Console projects only. The portable kit carries the Patch CLI/source compiler and uses the portable C99 backend followed by the local system `cc` compiler. It is usable without network access after download but requires Node.js 22+ and a C99-compatible compiler. Native FreeBSD Window/GUI linking is not claimed.

## Platform output

| Host | Console output | Window output | Local runtime requirement |
| --- | --- | --- | --- |
| Windows x64 | `.exe` | native Win32 `.exe` with responsive layout, Table, multi-select ListBox, Menu, TreeView and Slider | none for compiler |
| macOS arm64 | `.app` | native AppKit `.app` with the current v1.4 GUI contract | none |
| macOS Intel | portable `.app` with embedded Node + Wasm | native AppKit `.app` through runtime v1.4 | none; Intel Node ships in kit |
| Linux x64 | executable | native GTK3 executable through runtime v1.4 | compatible system GTK3/system libraries |
| FreeBSD x64 | executable via C99 + `cc` | unsupported | Node 22+ and `cc` |

The Apple Silicon compiler binary is ad-hoc signed by the build workflow. Neither macOS distribution is claimed to be Developer ID notarized. Windows compiler releases are not claimed to be Authenticode-signed unless separate signing evidence is published.

## Standalone implementation

Windows, Linux and macOS Apple Silicon use Node single-executable application support as a launcher. `scripts/build-offline-compiler.js` embeds the exact Patch source graph plus compressed copies of a plain Node runtime and platform runtime templates. `scripts/offline-compiler-runner.cjs` extracts those assets into a content-addressed temporary cache and starts the ordinary `src/cli-entry.js`.

The offline-compiler workflow builds native Window runtime **v1.4** from repository source on each target runner before embedding it. macOS Intel deliberately uses a portable tar.gz kit with an Intel Node runtime and x86-64 AppKit runtime v1.4. The workflow then exercises responsive, Table, ListBox, Menu, TreeView and Slider link paths before publishing the rolling download assets.

The offline compiler does **not** maintain a second parser, compiler, Change IR implementation or native linker model.

## Runtime inputs

Current Window linking contracts are:

- Win32 GUI runtime: runtime **v1.4**, sealed payload **v13**, Native GUI IR **1.3**;
- AppKit GUI runtime: runtime **v1.4**, sealed payload **v13**, Native GUI IR **1.3**;
- GTK3 GUI runtime: runtime **v1.4**, sealed payload **v13**, Native GUI IR **1.3**;
- Console runtime on SEA-supported hosts: host-built generic Patch SEA runtime compatible with the current compiler;
- frozen TreeView compatibility: Native GUI IR **1.2** / payload **v12** / runtime **v1.3**;
- frozen Menu+list compatibility: payload **v11** / runtime **v1.2**;
- frozen list compatibility: payload **v10** / runtime **v1.1**;
- frozen Table compatibility: payload **v9** / runtime **v1.0**;
- older compatibility lines remain versioned for reproducibility.

Runtime versions, direct AOT backend versions, Native GUI IR versions and offline compiler distribution versions remain independent contracts.

## Relationship to Patch Studio runtime integrity

The offline compiler is self-contained and does not fetch browser Ready runtime templates while linking. Its release assets are covered by the rolling channel's `SHA256SUMS` file.

Patch Studio's browser Ready path has a separate integrity gate. Pages requires `studio-runtime-v0.6` plus the three native runtime-v1.4 releases, verifies every downloaded release asset against GitHub's recorded SHA-256 digest, publishes `runtime-manifest.json`, and the browser re-hashes the selected runtime with Web Crypto before sealing. Same-origin `/runtimes/` requests are fresh-first while online with offline cache fallback only after successful fetches.

This validates byte consistency inside the existing GitHub Release -> Pages -> browser trust path. It is separate from code signing/notarization.

## Security and trust boundary

The offline compiler removes the GitHub-token/cloud-build requirement from normal local compilation and supported native linking. It does not remove the ordinary trust boundary in the JavaScript parser/compiler, Native GUI IR lowering, sealed payload adapter, native runtime implementations, Node SEA packaging where used, embedded Node runtimes or the local FreeBSD C compiler.

No claim of a fully verified compiler is implied by the offline distribution. Native v1.4 product work does not widen the beta.32 formal assurance boundary.
