# Patch offline compiler

Current product version: **0.2.0-beta.36+**  
Offline compiler distribution contract: **0.2**

The Patch offline compiler is the command-line counterpart to Patch Studio's token-free local build path. Windows, macOS and Linux downloads package the Patch source compiler with the runtime pieces needed for local development. Once downloaded, normal source checking, building and supported `patch link` operations do not require GitHub or Patch Studio.

Windows, Linux and macOS Apple Silicon require no installed Node runtime. The macOS Intel kit includes its own Intel Node runtime. FreeBSD uses a portable Console-only kit with local Node and `cc` requirements.

## Downloads and verification

The canonical download page is `https://minh.systems/Patch/downloads.html`.

The rolling beta release tag is `offline-compiler-v0.2` with stable asset names:

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
patch link app.patch --gui-payload-version 17 --out LegacyApp
patch doctor
```

`patch build` preserves the normal compiler targets. `patch link` is the host-local application linker. `patch doctor` reports environment probes and self-checks the interpreter, direct Wasm and C99 numeric subset.

## Current Window contract

Current Windows, macOS and Linux linking defaults to **Native GUI IR 1.9 / payload v19 / runtime v1.10**. Product JavaScript imports `src/native-current-contract.js`, so browser Ready builds and offline linking share one product-facing native contract.

The Current Ready surface contains the established responsive/Table/list/Menu/TreeView/Slider/Chrome/Shape/PaintBox capabilities plus:

- bounded PNG/JPEG PaintBox `draw image`;
- Button `ImageList` native image transport and Win32/AppKit/GTK consumers from the preserved IR1.8/BIMG layer;
- application/Form Window icons from IR1.9/WICO;
- deterministic application-icon packaging for Windows, macOS and Linux.

Toolkit interaction remains transient. Persistent Patch state changes only through explicit semantic `change`.

### Dual-runtime compatibility boundary

Each supported desktop compiler carries two GUI runtime generations:

- **runtime v1.10** for the default Current Ready payload **v19** path;
- **runtime v1.8** for explicit `--gui-payload-version 17` compatibility.

The selector fails closed if the required runtime asset is unavailable. It never attaches payload v19 to runtime v1.8 or payload v17 to runtime v1.10 by accident.

### Ready resource boundary

Picture, PaintBox, Button ImageList and Window-icon project resources use deterministic project-v4 resource metadata. Current native image decoding supports bounded PNG/JPEG through Win32/WIC or GDI+, AppKit/NSImage and GTK/GdkPixbuf. Native WebP/SVG remain deferred and fail closed.

Application-icon packaging is stricter than runtime image decoding. The current Windows PE package path requires the supported deterministic PNG application-icon input and embeds it into the reserved v1.10 resource slot. macOS emits `.icns` plus `CFBundleIconFile`; Linux emits hicolor PNG plus `.desktop` metadata.

### Panel readiness boundary

Panel Stage 1 provides native visual grouping. Full child-container semantics such as a distinct coordinate space, clipping, inherited lifetime and parent-relative layout are not yet part of the portable contract.

## Offline compiler smoke matrix

Windows, Linux, Apple Silicon macOS and Intel macOS exercise both the Current Ready and compatibility boundaries. The normal matrix covers:

1. Console application
2. responsive Window application
3. Table/Grid
4. list-backed multi-select ListBox
5. decorated Menu
6. hierarchical TreeView
7. native Slider
8. Chrome Stage 1
9. Shape Stage 1
10. PaintBox Stage 1
11. PaintBox `draw image`
12. Button/ImageList assets
13. Window/application icons and platform packaging

No-flag Window output is asserted as payload **v19** against runtime **v1.10**. Explicit compatibility output is separately asserted as payload **v17** against runtime **v1.8**. The promotion gate also verifies immutable v1.10 runtime release tags, `SHA256SUMS.txt`, GitHub asset digests and release source-commit binding.

## Versioned compatibility

Published formats are not silently redefined:

- Native GUI IR **1.9** / payload **v19** / runtime **v1.10** is the Current Ready product line
- Native GUI IR **1.8** / payload **v18** / runtime **v1.9** is the Button/ImageList underlay preserved inside Current Ready
- Native GUI IR **1.7** / payload **v17** / runtime **v1.8** is the explicit desktop compatibility line
- Native GUI IR **1.6** / payload **v16** / runtime **v1.7** is the previous PaintBox Stage 1 line
- Native GUI IR **1.5** / payload **v15** / runtime **v1.6** is the previous Shape line
- Native GUI IR **1.4** / payload **v14** / runtime **v1.5** is the previous Chrome line
- Native GUI IR **1.3** / payload **v13** / runtime **v1.4** is the Slider-capable historical line
- Native GUI IR **1.2** / payload **v12** / runtime **v1.3** is the frozen TreeView line and stays Slider fail-closed
- payload **v11** / runtime **v1.2** is the frozen Menu+list line
- payload **v10** / runtime **v1.1** is the frozen persistent-list/multi-select line
- payload **v9** / runtime **v1.0** is the frozen Table line
- payload **v8** / runtime **v0.9** is the frozen responsive compatibility line

Explicitly selected older contracts continue to fail closed when source requires a newer feature.

## Platform output

| Host | Console output | Current Window output | Local runtime requirement |
| --- | --- | --- | --- |
| Windows x64 | `.exe` | native Win32 `.exe`, runtime v1.10 | none for compiler |
| macOS arm64 | `.app` | native AppKit `.app`, runtime v1.10 | none |
| macOS Intel | portable `.app` with embedded Node + Wasm | native AppKit `.app`, runtime v1.10 | none; Intel Node ships in kit |
| Linux x64 | executable | native GTK3 executable, runtime v1.10 | compatible system GTK3/system libraries |
| FreeBSD x64 | executable via C99 + `cc` | unsupported | Node 22+ and `cc` |

The Apple Silicon compiler binary is ad-hoc signed by the build workflow. Neither macOS distribution is claimed to be Developer ID notarized. Windows compiler releases are not claimed to be Authenticode-signed unless separate signing evidence is published.

## Standalone implementation

Windows, Linux and macOS Apple Silicon use Node single-executable application support as a launcher. `scripts/build-offline-compiler.js` embeds the exact Patch source graph plus compressed runtime assets. The desktop bundles include the legacy GUI runtime plus a separately digest-verified Current Ready v1.10 runtime. `scripts/offline-compiler-runner.cjs` extracts those assets into a content-addressed temporary cache and starts the ordinary `src/cli-entry.js`.

The macOS Intel distribution deliberately remains a portable tar.gz kit with an Intel Node runtime and both AppKit runtime generations. The offline compiler does not maintain a second parser, compiler, Change IR implementation or native linker model.

## Patch Studio runtime integrity

The offline compiler is self-contained and does not fetch browser Ready runtime templates while linking. Its release assets are covered by `SHA256SUMS`.

Patch Studio's browser Ready path has a separate integrity gate. Pages requires `studio-runtime-v0.6` plus the three native runtime-v1.10 releases, verifies every downloaded release asset against GitHub's recorded SHA-256 digest, publishes `runtime-manifest.json`, and the browser re-hashes the selected runtime with Web Crypto before sealing.

This validates byte consistency inside the existing GitHub Release -> Pages -> browser trust path. It remains separate from code signing/notarization.

## Security and trust boundary

The offline compiler removes the GitHub-token/cloud-build requirement from normal local compilation and supported native linking. It does not remove the ordinary trust boundary in the JavaScript parser/compiler, Native GUI IR lowering, sealed payload adapters, native runtime implementations, Node SEA packaging where used, embedded Node runtimes or the local FreeBSD C compiler.

No claim of a fully verified compiler is implied by the offline distribution. Current Ready runtime v1.10 product work does not widen the existing beta.32 formal assurance boundary.
