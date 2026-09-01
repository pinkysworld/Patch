# Window and application icons

`window-icon/1.0` is the source, Studio, Standalone Web and Current Ready native contract for Form and application icons.

## Canonical source

```patch
window "Counter" as counter size 520, 360 icon "patch-resource:app.icon":
  text "Count: {count}"
```

`icon` is optional. Project icons use the existing project-v4 `patch-resource:<id>` inventory.

The **first Form that declares an icon** is the application icon. Later Forms may declare their own Form icon. This rule is shared by Web and native desktop builds.

## Current product status

The Current Ready native product contract is:

**Native GUI IR 1.9 / payload v19 / runtime v1.10**

Window/application icons are therefore Current Ready on Windows, macOS and Linux. The complete Button/ImageList payload-v18 (`BIMG`) layer remains underneath the v19 `WICO` extension, and older v17/runtime-v1.8 output remains an explicit Offline Compiler compatibility path.

## Native stack

| Layer | Contract | Status |
|---|---|---|
| Source / Studio / Web | `window-icon/1.0` | Current Ready |
| Resource planning | `native-window-icon-asset-plan/0.1` | implemented |
| Native GUI IR | **1.9** | Current Ready, exact icon-free projection to IR 1.8 |
| Sealed payload | **v19 / `WICO`** | Current Ready, exact payload-v18 compatibility prefix |
| Desktop runtime | **v1.10** | Current Ready and runtime-smoked on Win32/AppKit/GTK |
| Cross-platform packaging | `native-window-icon-packaging/0.1` | implemented |
| Runtime-v1.10 package plan | `native-window-icon-package-v110/0.2` | Current Ready |
| Windows PE embedding | `windows-pe-icon-v110/0.1` | implemented and verified with real MSVC/`rc.exe` + Windows icon extraction |
| Product promotion | **IR 1.9 / payload v19 / runtime v1.10** | complete |

## Resource policy

The native Window-icon runtime transport reuses the explicit native picture format policy:

- PNG: supported;
- JPEG: supported for runtime Form/icon transport;
- WebP: deferred on native targets;
- SVG: deferred on native targets.

WebP and SVG remain valid Studio/Web project resources, but native icon builds fail closed instead of depending on platform-specific decoder availability.

Native icon transport is bounded and deduplicated. Shared project resources are transported once and referenced by stable asset index from Form consumers.

Application packaging is intentionally stricter. `native-window-icon-packaging/0.1` requires one square PNG at a supported standard size so the same project resource can be represented deterministically without platform image-conversion dependencies. The Windows PE embedding contract `windows-pe-icon-v110/0.1` currently requires an exact **256x256 PNG** and fails closed otherwise. JPEG remains valid for runtime-v1.10 Form icons but is not silently converted into a packaged application icon.

## Desktop semantics

Runtime v1.10 uses one common `WICO` contract with native platform APIs:

- **Win32:** application/class icon plus per-Form `WM_SETICON`; Forms without their own icon inherit the application icon at runtime.
- **AppKit:** application icon through `NSApplication`; explicit Form icons are surfaced in native titlebar chrome.
- **GTK:** application default icon plus per-Form `gtk_window_set_icon`; Forms without their own icon use the application icon.

The dedicated v1.10 workflow builds and smokes the Window-icon layer on Windows, macOS and Linux while preserving the complete runtime-v1.9 Button/ImageList layer underneath it.

## Packaging

Runtime consumption and application packaging remain separate implementation contracts, but both are part of Current Ready v1.10:

- **Windows:** `native-window-icon-package-v110/0.2` seals payload v19 and then uses `windows-pe-icon-v110/0.1` to replace a fixed reserved `RT_ICON` slot in place. The executable length and PE section layout do not move. `RT_ICON` and matching `RT_GROUP_ICON` size metadata are updated, and a sentinel keeps the slot deterministically repatchable. The ordinary v1.10 Windows runtime artifact is built with this reserved slot. CI verifies the packaged EXE with Windows `ExtractAssociatedIcon` and `--patch-smoke`.
- **macOS:** the package plan emits an `.app` layout with a PNG-backed `.icns` resource under `Contents/Resources` and `CFBundleIconFile` in `Info.plist`.
- **Linux:** the package plan emits hicolor application PNG metadata plus a `.desktop` entry alongside the sealed runtime.

Promotion evidence also includes immutable v1.10 runtime releases, SHA-256 and GitHub asset-digest verification, source-commit binding, and dual-runtime Offline Compiler smoke tests on Windows, Linux, macOS Apple Silicon and macOS Intel.

## Authoritative modules

- `src/window-icon.js` owns source/Web icon semantics.
- `src/native-window-icon-asset-plan.js` owns deterministic pretransport resource planning.
- `src/native-gui-ir-v19.js` owns native Form/application icon metadata.
- `src/sealed-native-gui-v19.js` owns bounded `WICO` transport.
- `src/native-window-icon-packaging.js` owns deterministic cross-platform application-icon artifacts.
- `src/native-window-icon-package-v110.js` owns Current Ready runtime-v1.10 package plans.
- `src/windows-pe-icon-v110.js` owns bounded in-place Windows PE application-icon embedding.
- `native-runtime/sealed-window-icon-v110.hpp` and the v1.10 platform runtimes own the desktop consumer contract.

See also [`NATIVE_COMPATIBILITY.md`](NATIVE_COMPATIBILITY.md), [`NATIVE_GUI.md`](NATIVE_GUI.md) and [`RAD_STUDIO_MASTER_BACKLOG.md`](RAD_STUDIO_MASTER_BACKLOG.md).
