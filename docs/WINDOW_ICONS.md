# Window and application icons

`window-icon/1.0` is the source, Studio and Standalone Web contract for Form and application icons.

The native implementation is deliberately versioned separately from the current product-facing Ready line. This keeps existing builds reproducible and prevents experimental native work from becoming a product claim before its cross-platform release gates are complete.

## Canonical source

```patch
window "Counter" as counter size 520, 360 icon "patch-resource:app.icon":
  text "Count: {count}"
```

`icon` is optional. Project icons use the existing project-v4 `patch-resource:<id>` inventory.

The **first Form that declares an icon** is the application icon. Later Forms may declare their own Form icon. This rule is shared by Web and the experimental native contract.

## Current product status

The Current Ready native product contract remains:

**Native GUI IR 1.7 / payload v17 / runtime v1.8**

That line deliberately fails closed when a Form declares `icon`. It is not silently reinterpreted as supporting a newer resource contract.

## Experimental native stack

Native Window-icon support is implemented as an additive stack above the current and Button/ImageList contracts:

| Layer | Contract | Status |
|---|---|---|
| Source / Studio / Web | `window-icon/1.0` | implemented |
| Resource planning | `native-window-icon-asset-plan/0.1` | implemented |
| Native GUI IR | **1.9** | implemented, exact icon-free projection to IR 1.8 |
| Sealed payload | **v19 / `WICO`** | implemented, exact payload-v18 compatibility prefix |
| Desktop runtime | **v1.10** | implemented and runtime-smoked on Win32/AppKit/GTK |
| Current product promotion | IR 1.7 / payload v17 / runtime v1.8 remains current | not promoted yet |

The v19 payload keeps the entire payload-v18 Button/ImageList (`BIMG`) transport intact underneath `WICO`.

## Resource policy

The native Window-icon transport reuses the explicit native picture format policy:

- PNG: supported by the experimental native icon line;
- JPEG: supported by the experimental native icon line;
- WebP: deferred on native targets;
- SVG: deferred on native targets.

WebP and SVG remain valid Studio/Web project resources, but native icon builds fail closed instead of depending on platform-specific decoder availability.

Native icon transport is bounded and deduplicated. Shared project resources are transported once and referenced by stable asset index from Form consumers.

## Desktop semantics

Runtime v1.10 uses one common `WICO` contract with native platform APIs:

- **Win32:** application/class icon plus per-Form `WM_SETICON`; Forms without their own icon inherit the application icon at runtime.
- **AppKit:** application icon through `NSApplication`; explicit Form icons are surfaced in native titlebar chrome.
- **GTK:** application default icon plus per-Form `gtk_window_set_icon`; Forms without their own icon use the application icon.

The dedicated v1.10 workflow now builds and smokes the Window-icon layer on Windows, macOS and Linux while preserving the complete runtime-v1.9 Button/ImageList layer underneath it.

## Packaging versus runtime consumption

Runtime consumption and application packaging are separate gates.

Runtime v1.10 proves that a sealed v19 application can decode and display the versioned Window-icon resources. Product promotion still requires the distribution path to decide and validate platform packaging, including:

1. Windows executable/application `.ico` resource generation and embedding;
2. macOS application icon/resource packaging for distributed app bundles;
3. Linux desktop/application icon packaging where a desktop package is produced;
4. cross-platform release asset and digest verification;
5. Offline Compiler linking against the promoted runtime line;
6. capability-matrix, roadmap, public-site and release documentation updates.

Until those gates are complete, README and product-facing capability metadata must keep the current Ready line distinct from the experimental IR 1.9 / payload v19 / runtime v1.10 work.

## Authoritative modules

- `src/window-icon.js` owns source/Web icon semantics.
- `src/native-window-icon-asset-plan.js` owns deterministic pretransport resource planning.
- `src/native-gui-ir-v19.js` owns native Form/application icon metadata.
- `src/sealed-native-gui-v19.js` owns bounded `WICO` transport.
- `native-runtime/sealed-window-icon-v110.hpp` and the v1.10 platform runtimes own the experimental desktop consumer contract.

See also [`NATIVE_COMPATIBILITY.md`](NATIVE_COMPATIBILITY.md), [`NATIVE_GUI.md`](NATIVE_GUI.md) and [`RAD_STUDIO_MASTER_BACKLOG.md`](RAD_STUDIO_MASTER_BACKLOG.md).
