# Patch offline compiler

Current product version: **0.2.0-beta.33**  
Offline compiler distribution contract: **0.1**

The Patch offline compiler is the command-line counterpart to Patch Studio's token-free local build path. Windows, macOS and Linux distributions package the existing Patch source compiler and the platform's tested native runtime templates into one downloadable compiler executable. Once downloaded, normal source checking/building and supported `patch link` operations do not require GitHub, Patch Studio or an installed Node.js runtime.

## Downloads

The canonical download page is `https://minh.systems/Patch/downloads.html`.

The release tag is `offline-compiler-v0.1`. Published asset names are stable:

- `patch-windows-x64.exe`
- `patch-macos-arm64`
- `patch-macos-x64`
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

`patch build` preserves the normal Patch compiler targets. `patch link` is the new host-local application linker.

## `patch link`

`patch link program.patch [--out App] [--name AppName]` first compiles the Patch source with the same `src/compiler.js` pipeline used by the project. Project kind is inferred from source.

### Console

On Windows, macOS and Linux the linker lowers the supported Console program through the existing direct-Wasm backend and seals that module into the embedded generic Console runtime. This is the same compiled/sealed model used by the no-token ready Console path in Patch Studio.

### Window / GUI

On Windows, macOS and Linux the linker validates the current Window contract, lowers it to Native GUI IR and seals that checked GUI payload into the embedded native Win32, AppKit or GTK3 runtime. No Electron compatibility runtime is selected implicitly.

Unsupported GUI behavior fails closed during the existing Native GUI IR/preflight stages.

### FreeBSD

FreeBSD currently supports Console projects only. The FreeBSD offline kit carries the Patch CLI/source compiler and uses the portable C99 backend followed by the local system `cc` compiler. The kit is usable without network access after download, but requires:

- Node.js 22 or newer on the FreeBSD host;
- a C99-compatible `cc` toolchain.

Native FreeBSD Window/GUI linking is not claimed.

## Platform output

| Host | Console output | Window output | Local runtime requirement |
| --- | --- | --- | --- |
| Windows x64 | `.exe` | native Win32 `.exe` | none for compiler; generated app uses Windows APIs |
| macOS arm64/x64 | `.app` | native AppKit `.app` | none for compiler; generated app uses AppKit |
| Linux x64 | executable | native GTK3 executable | compatible system libraries; GUI output expects GTK3 |
| FreeBSD x64 | executable via C99 + `cc` | unsupported | Node 22+ and `cc` for the portable kit |

macOS development compiler binaries are ad-hoc signed by the build workflow. This is not Developer ID signing/notarization. Windows compiler releases are not claimed to be Authenticode-signed unless separate signing evidence is published.

## Single-executable implementation

The Windows/macOS/Linux download uses Node's single-executable application support as a small launcher. `scripts/build-offline-compiler.js` embeds the exact Patch `src/*.js` graph plus gzip-compressed copies of a plain Node runtime and the platform runtime templates as SEA assets. `scripts/offline-compiler-runner.cjs` extracts those assets into a source/runtime-content-addressed temporary cache and starts the ordinary `src/cli-entry.js` with that embedded plain Node runtime.

This launcher arrangement is intentional: Node's SEA main module may load built-ins and embedded assets but does not directly import arbitrary modules from the filesystem. The extracted ordinary Node runtime therefore executes the normal Patch ESM module graph without requiring Node to be installed on the user's machine.

The offline compiler does **not** maintain a second parser, compiler, Change IR implementation or native linker model.

## Runtime inputs

The distribution build binds to the existing published runtime lines:

- Console runtime: host-built generic Patch SEA runtime compatible with the current compiler
- Win32 GUI runtime: `native-win32-runtime-v0.8`
- AppKit GUI runtime: `native-macos-runtime-v0.8`
- GTK3 GUI runtime: `native-linux-runtime-v0.8`

The runtime versions and the offline compiler distribution version are independent contracts.

## Security and trust boundary

The offline compiler removes the GitHub-token/cloud-build requirement from normal local compilation and supported native linking. It does not remove the ordinary trust boundary in the JavaScript parser/compiler, Native GUI IR lowering, native runtime implementations, Node SEA packaging, the embedded Node runtime or local FreeBSD C compiler.

No claim of a fully verified compiler is implied by the offline distribution.
