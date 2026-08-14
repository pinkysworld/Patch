# Patch offline compiler

Current product version: **0.2.0-beta.33**  
Offline compiler distribution contract: **0.1**

The Patch offline compiler is the command-line counterpart to Patch Studio's token-free local build path. Windows, macOS and Linux downloads package the existing Patch source compiler with the runtime pieces needed for local development. Once downloaded, normal source checking/building and supported `patch link` operations do not require GitHub or Patch Studio. Windows, Linux and macOS Apple Silicon require no installed Node runtime; the macOS Intel kit includes its own Intel Node runtime. FreeBSD uses a portable kit with local Node and `cc` requirements.

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

On Windows, macOS and Linux the linker validates the current Window contract, lowers it to Native GUI IR and seals payload **v8** into the embedded native Win32, AppKit or GTK3 runtime **v0.9**. No Electron compatibility runtime is selected implicitly.

Source-backed `# @layout anchor ...` and `# @layout dock ...` policies are carried into payload v8. A linked native app therefore responds to real runtime window resizing with the same Anchor/Dock rules used by Standalone Web and direct AOT builds. Fixed controls remain fixed. Layout metadata does not create Patch state or Change History.

The offline-compiler workflow proves this path by linking and executing a responsive Window smoke app on Windows, Linux, Apple Silicon macOS and Intel macOS. Unsupported GUI behavior still fails closed during the existing Native GUI IR/preflight stages.

### FreeBSD

FreeBSD currently supports Console projects only. The FreeBSD offline kit carries the Patch CLI/source compiler and uses the portable C99 backend followed by the local system `cc` compiler. The kit is usable without network access after download, but requires:

- Node.js 22 or newer on the FreeBSD host;
- a C99-compatible `cc` toolchain.

Native FreeBSD Window/GUI linking is not claimed.

## Platform output

| Host | Console output | Window output | Local runtime requirement |
| --- | --- | --- | --- |
| Windows x64 | `.exe` | responsive native Win32 `.exe` | none for compiler; generated app uses Windows APIs |
| macOS arm64 | `.app` | responsive native AppKit `.app` | none |
| macOS Intel | portable `.app` with embedded Node + Wasm | responsive native AppKit `.app` | none; Intel Node ships in the kit |
| Linux x64 | executable | responsive native GTK3 executable | compatible system libraries; GUI output expects GTK3 |
| FreeBSD x64 | executable via C99 + `cc` | unsupported | Node 22+ and `cc` for the portable kit |

The Apple Silicon compiler binary is ad-hoc signed by the build workflow. The Intel kit is an archive of ordinary executable/runtime files. Neither is claimed to be Developer ID notarized. Windows compiler releases are not claimed to be Authenticode-signed unless separate signing evidence is published.

## Standalone implementation

Windows, Linux and macOS Apple Silicon use Node's single-executable application support as a small launcher. `scripts/build-offline-compiler.js` embeds the exact Patch `src/*.js` graph plus gzip-compressed copies of a plain Node runtime and the platform runtime templates as SEA assets. `scripts/offline-compiler-runner.cjs` extracts those assets into a source/runtime-content-addressed temporary cache and starts the ordinary `src/cli-entry.js` with that embedded plain Node runtime.

This launcher arrangement is intentional: Node's SEA main module may load built-ins and embedded assets but does not directly import arbitrary modules from the filesystem. The extracted ordinary Node runtime therefore executes the normal Patch ESM module graph without requiring Node to be installed on the user's machine.

macOS Intel deliberately uses a portable tar.gz kit instead of SEA. The kit contains the same Patch ESM graph, a plain Intel Node runtime and the checked AppKit runtime.

The offline compiler does **not** maintain a second parser, compiler, Change IR implementation or native linker model.

## Runtime inputs

The distribution build binds to the existing published runtime lines:

- Console runtime on SEA-supported hosts: host-built generic Patch SEA runtime compatible with the current compiler
- Win32 GUI runtime: `native-win32-runtime-v0.9`
- AppKit GUI runtime: `native-macos-runtime-v0.9`
- GTK3 GUI runtime: `native-linux-runtime-v0.9`
- sealed native GUI payload: **v8**

Runtime v0.9 preserves the v0.8 accessibility behavior and adds live Anchor/Dock reflow. Payload v7 remains supported only for the frozen v0.8 runtime compatibility line. The runtime versions and the offline compiler distribution version are independent contracts.

## Security and trust boundary

The offline compiler removes the GitHub-token/cloud-build requirement from normal local compilation and supported native linking. It does not remove the ordinary trust boundary in the JavaScript parser/compiler, Native GUI IR lowering, native runtime implementations, Node SEA packaging where used, embedded Node runtimes or the local FreeBSD C compiler.

No claim of a fully verified compiler is implied by the offline distribution.
