# Patch offline compiler

Current product version: **0.2.0-beta.36+**  
Offline compiler distribution contract: **0.2**

The Patch offline compiler is the command-line counterpart to Patch Studio's token-free local build path. Windows, macOS and Linux downloads package the Patch source compiler with the runtime pieces needed for local development. Once downloaded, normal source checking, building and supported `patch link` operations do not require GitHub or Patch Studio.

Windows, Linux and macOS Apple Silicon require no installed Node runtime. The macOS Intel kit includes its own Intel Node runtime. FreeBSD uses a portable Console-only kit with local Node and `cc` requirements.

## Downloads and verification

The canonical download page is `https://minh.systems/Patch/downloads.html`.

The current rolling beta release tag is `offline-compiler-v0.2` with stable asset names:

- `patch-windows-x64.exe`
- `patch-macos-arm64`
- `patch-macos-x64.tar.gz`
- `patch-linux-x64`
- `patch-freebsd-x64.tar.gz`
- `SHA256SUMS`

Verify downloaded bytes before first use or after replacing a rolling-beta asset. SHA-256 verifies release-byte consistency. It does not imply Authenticode, Developer ID/notarization or an independent signing authority.

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

`patch build` preserves the normal compiler targets. `patch link` is the host-local application linker. `patch doctor` reports environment probes and self-checks the interpreter, direct Wasm and C99 numeric subset.

## Current Window contract

Current Windows, macOS and Linux linking lowers supported Window projects through Native GUI IR **1.5** and seals payload **v15** into native Win32, AppKit or GTK3 runtime **v1.6**. Product JavaScript imports `src/native-current-contract.js`, so browser Ready builds and offline linking share one product-facing native contract.

The current surface contains the previous responsive/Table/list/Menu/TreeView/Slider/Chrome capabilities plus Shape Stage 1:

- Forms, controls, dialogs and responsive Anchor/Dock metadata
- Table/Grid columns, rows and transient `text-list` row-selection events
- persistent text-list state and list-backed native multi-select ListBox semantics
- Menu separators, portable shortcuts and source-backed `enabled` / `checked` projections
- hierarchical TreeView nodes and transient root-to-node text-list selection paths
- Slider range/step plus finite numeric transient `changed` values
- Panel Stage 1 visual grouping
- Timer Stage 1 native scheduling and `ticked` event transport
- StatusBar Stage 1 native/status-style presentation
- PictureBox Stage 1 source transport and control/event shell
- Shape Stage 1 rectangle, rounded, ellipse and line drawing

Toolkit interaction remains transient. Persistent Patch state changes only through explicit semantic `change`.

### PictureBox readiness boundary

Payload v14 carries PictureBox `source`, but beta.36 does not claim complete portable image decoding/loading. The v1.5 desktop runtimes currently restore the PictureBox control shell without proving actual image-source rendering on every platform. The offline compiler therefore treats PictureBox as Stage 1 rather than advertising complete Delphi-style image resource support.

### Panel readiness boundary

Panel Stage 1 provides native visual grouping. Full child-container semantics such as a distinct coordinate space, clipping, inherited lifetime and parent-relative layout are not yet part of the portable contract.

## Offline compiler smoke matrix

The Windows, Linux, Apple Silicon macOS and Intel macOS jobs build/link and execute:

1. a Console application
2. a responsive Window application
3. the Table/Grid example
4. the list-backed multi-select ListBox example
5. the decorated Menu example
6. the hierarchical TreeView example
7. the native Slider example
8. the Chrome Stage 1 example
9. the Shape Stage 1 example
10. the PaintBox Stage 1 example

Every current Window smoke asserts sealed payload **v16**. The native runtime used by these jobs is built from the repository's v1.7 source on the target runner.

## Versioned compatibility

Published formats are not silently redefined:

- Native GUI IR **1.6** / payload **v16** / runtime **v1.7** is the current product line
- Native GUI IR **1.5** / payload **v15** / runtime **v1.6** is the previous Shape compatibility line
- Native GUI IR **1.4** / payload **v14** / runtime **v1.5** is the previous Chrome compatibility line
- Native GUI IR **1.3** / payload **v13** / runtime **v1.4** is the Slider-capable compatibility line
- Native GUI IR **1.2** / payload **v12** / runtime **v1.3** is the frozen TreeView line and stays Slider fail-closed
- payload **v11** / runtime **v1.2** is the frozen Menu+list line
- payload **v10** / runtime **v1.1** is the frozen persistent-list/multi-select line
- payload **v9** / runtime **v1.0** is the frozen Table-capable line
- payload **v8** / runtime **v0.9** is the frozen responsive compatibility line

Explicitly selected older contracts continue to fail closed when source requires a newer feature.

## Platform output

| Host | Console output | Window output | Local runtime requirement |
| --- | --- | --- | --- |
| Windows x64 | `.exe` | native Win32 `.exe`, runtime v1.7 | none for compiler |
| macOS arm64 | `.app` | native AppKit `.app`, runtime v1.7 | none |
| macOS Intel | portable `.app` with embedded Node + Wasm | native AppKit `.app`, runtime v1.7 | none; Intel Node ships in kit |
| Linux x64 | executable | native GTK3 executable, runtime v1.7 | compatible system GTK3/system libraries |
| FreeBSD x64 | executable via C99 + `cc` | unsupported | Node 22+ and `cc` |

The Apple Silicon compiler binary is ad-hoc signed by the build workflow. Neither macOS distribution is claimed to be Developer ID notarized. Windows compiler releases are not claimed to be Authenticode-signed unless separate signing evidence is published.

## Standalone implementation

Windows, Linux and macOS Apple Silicon use Node single-executable application support as a launcher. `scripts/build-offline-compiler.js` embeds the exact Patch source graph plus compressed copies of a plain Node runtime and platform runtime templates. `scripts/offline-compiler-runner.cjs` extracts those assets into a content-addressed temporary cache and starts the ordinary `src/cli-entry.js`.

The macOS Intel distribution deliberately remains a portable tar.gz kit with an Intel Node runtime and x86-64 AppKit runtime v1.7. The offline compiler does not maintain a second parser, compiler, Change IR implementation or native linker model.

## Patch Studio runtime integrity

The offline compiler is self-contained and does not fetch browser Ready runtime templates while linking. Its release assets are covered by `SHA256SUMS`.

Patch Studio's browser Ready path has a separate integrity gate. Pages requires `studio-runtime-v0.6` plus the three native runtime-v1.7 releases, verifies every downloaded release asset against GitHub's recorded SHA-256 digest, publishes `runtime-manifest.json`, and the browser re-hashes the selected runtime with Web Crypto before sealing.

This validates byte consistency inside the existing GitHub Release -> Pages -> browser trust path. It remains separate from code signing/notarization.

## Security and trust boundary

The offline compiler removes the GitHub-token/cloud-build requirement from normal local compilation and supported native linking. It does not remove the ordinary trust boundary in the JavaScript parser/compiler, Native GUI IR lowering, sealed payload adapter, native runtime implementations, Node SEA packaging where used, embedded Node runtimes or the local FreeBSD C compiler.

No claim of a fully verified compiler is implied by the offline distribution. Runtime v1.5 product work does not widen the existing formal assurance boundary.