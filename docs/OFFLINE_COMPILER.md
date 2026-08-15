# Patch offline compiler

Current product version: **0.2.0-beta.33**  
Offline compiler distribution contract: **0.1**

The Patch offline compiler is the command-line counterpart to Patch Studio's token-free local build path. Windows, macOS and Linux downloads package the Patch source compiler with the runtime pieces needed for local development. Once downloaded, normal source checking/building and supported `patch link` operations do not require GitHub or Patch Studio. Windows, Linux and macOS Apple Silicon require no installed Node runtime; the macOS Intel kit includes its own Intel Node runtime. FreeBSD uses a portable kit with local Node and `cc` requirements.

## Downloads

The canonical download page is `https://minh.systems/Patch/downloads.html`.

The release tag is `offline-compiler-v0.1`. Published asset names are stable:

- `patch-windows-x64.exe`
- `patch-macos-arm64`
- `patch-macos-x64.tar.gz`
- `patch-linux-x64`
- `patch-freebsd-x64.tar.gz`
- `SHA256SUMS`

Always compare a downloaded asset with `SHA256SUMS` when integrity matters.

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

`patch build` preserves the normal Patch compiler targets. `patch link` is the host-local application linker.

## `patch link`

`patch link program.patch [--out App] [--name AppName]` first compiles the Patch source with the same `src/compiler.js` pipeline used by the project. Project kind is inferred from source.

### Console

On Windows, Linux and macOS Apple Silicon the linker lowers the supported Console program through the existing direct-Wasm backend and seals that module into the embedded generic Console runtime.

On macOS Intel, where Node SEA is not currently reliable, the portable kit instead creates a ready `.app` bundle containing the direct Patch Wasm module, a tiny runner and the kit's embedded Intel Node runtime. No installed Node runtime is required for that generated app.

### Window / GUI

On Windows, macOS and Linux the linker validates the current Window contract, lowers supported controls through Native GUI IR **0.8** and seals payload **v9** into native Win32, AppKit or GTK3 runtime **v1.0**. No Electron compatibility runtime is selected implicitly.

Payload v9 preserves source-backed `# @layout anchor ...` and `# @layout dock ...` policy and adds explicit Table/Grid columns, rows and transient `text-list` event typing. A linked native app therefore responds to real runtime window resizing with the same Anchor/Dock rules used by Standalone Web and exposes Table row selection without introducing hidden persistent list state.

The offline-compiler workflow proves this path by linking and executing a Console app, a responsive Window app and a Table/Grid Window app on Windows, Linux, Apple Silicon macOS and Intel macOS. Unsupported GUI behavior still fails closed during Native GUI IR/preflight.

### Table / Grid

Table/Grid is supported by the ordinary Windows/macOS/Linux offline linker:

- language, Designer, Studio App Preview and Standalone Web implement the transient selected-row contract;
- direct native AOT uses Native GUI IR **0.8** plus backend **0.9**;
- sealed Ready/offline Window linking uses Native GUI IR **0.8** plus payload **v9** / runtime **v1.0**;
- Win32 uses report-mode `WC_LISTVIEWW`;
- AppKit uses a multi-column `NSTableView`;
- GTK3 uses `GtkTreeView` + `GtkListStore`;
- `changed` exposes the selected row as transient list-valued `value`; persistence still requires an explicit Patch `change`.

The dedicated sealed-runtime matrix compiles runtime v1.0 on Windows/macOS/Linux, seals the Table example, starts the finished application and then repeats the operation through the normal offline `patch link` code path. The downloadable compiler matrix repeats Table linking on Windows, Linux, Apple Silicon macOS and Intel macOS.

Payload **v8** / runtime **v0.9** remains an explicit older responsive compatibility line for Native GUI IR 0.7. It is not silently redefined to mean Table support.

### FreeBSD

FreeBSD currently supports Console projects only. The FreeBSD offline kit carries the Patch CLI/source compiler and uses the portable C99 backend followed by the local system `cc` compiler. The kit is usable without network access after download, but requires:

- Node.js 22 or newer on the FreeBSD host;
- a C99-compatible `cc` toolchain.

Native FreeBSD Window/GUI linking is not claimed.

## Platform output

| Host | Console output | Window output | Local runtime requirement |
| --- | --- | --- | --- |
| Windows x64 | `.exe` | native Win32 `.exe`, including Table/Grid + responsive layout | none for compiler; generated app uses Windows APIs |
| macOS arm64 | `.app` | native AppKit `.app`, including Table/Grid + responsive layout | none |
| macOS Intel | portable `.app` with embedded Node + Wasm | native AppKit `.app`, including Table/Grid + responsive layout | none; Intel Node ships in the kit |
| Linux x64 | executable | native GTK3 executable, including Table/Grid + responsive layout | compatible system libraries; GUI output expects GTK3 |
| FreeBSD x64 | executable via C99 + `cc` | unsupported | Node 22+ and `cc` for the portable kit |

The Apple Silicon compiler binary is ad-hoc signed by the build workflow. The Intel kit is an archive of ordinary executable/runtime files. Neither is claimed to be Developer ID notarized. Windows compiler releases are not claimed to be Authenticode-signed unless separate signing evidence is published.

## Standalone implementation

Windows, Linux and macOS Apple Silicon use Node's single-executable application support as a small launcher. `scripts/build-offline-compiler.js` embeds the exact Patch `src/*.js` graph plus gzip-compressed copies of a plain Node runtime and the platform runtime templates as SEA assets. `scripts/offline-compiler-runner.cjs` extracts those assets into a source/runtime-content-addressed temporary cache and starts the ordinary `src/cli-entry.js` with that embedded plain Node runtime.

The offline compiler workflow now builds native Window runtime **v1.0 from the same repository source** on each target runner before embedding it. This avoids a release-tag ordering dependency while still publishing the same proven runtime contract.

macOS Intel deliberately uses a portable tar.gz kit instead of SEA. The kit contains the same Patch ESM graph, a plain Intel Node runtime and an x86-64 AppKit runtime v1.0 built in the Intel runner.

The offline compiler does **not** maintain a second parser, compiler, Change IR implementation or native linker model.

## Runtime inputs

Current Window linking contracts are:

- Win32 GUI runtime: runtime **v1.0**, sealed payload **v9**, Native GUI IR **0.8**;
- AppKit GUI runtime: runtime **v1.0**, sealed payload **v9**, Native GUI IR **0.8**;
- GTK3 GUI runtime: runtime **v1.0**, sealed payload **v9**, Native GUI IR **0.8**;
- Console runtime on SEA-supported hosts: host-built generic Patch SEA runtime compatible with the current compiler;
- compatibility/reproducibility line: payload **v8** / runtime **v0.9** for the Native GUI IR 0.7 responsive surface;
- older compatibility line: payload **v7** / runtime **v0.8**.

Runtime versions, AOT backend versions, Native GUI IR versions and offline compiler distribution versions remain independent contracts.

## Security and trust boundary

The offline compiler removes the GitHub-token/cloud-build requirement from normal local compilation and supported native linking. It does not remove the ordinary trust boundary in the JavaScript parser/compiler, Native GUI IR lowering, sealed payload adapter, native runtime implementations, Node SEA packaging where used, embedded Node runtimes or the local FreeBSD C compiler.

No claim of a fully verified compiler is implied by the offline distribution.
