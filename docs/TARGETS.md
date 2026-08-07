# Patch Build Targets

Patch uses one source language and one compiler pipeline for console and window applications.

## Canonical target matrix

| Application | Windows | macOS | Linux | BSD/Unix | Browser |
|---|---|---|---|---|---|
| Console | `.exe` | native CLI | native CLI | native/C fallback | Wasm terminal/runtime |
| Window | GUI `.exe` | `.app` | graphical executable | SDL3 graphical executable | Web/Wasm app |
| Portable | `.patchapp` | `.patchapp` | `.patchapp` | `.patchapp` where runtime exists | `.patchapp` |
| IDE | browser/native shell | browser/native shell | browser/native shell | browser | browser/PWA |

## Windows

Patch distinguishes console and graphical application packaging.

- Console: PE executable with console behavior.
- Window: PE graphical application without an unwanted terminal window.
- Architectures: x86-64 first, ARM64 next.

Patch UI should eventually have a native Windows backend for standard windows, controls, menus, dialogs, clipboard, drag/drop and OS integration.

## macOS

- Console: native command-line executable.
- Window: normal `.app` application bundle.
- Release packaging: code signing/notarization hooks.
- Architecture goal: Universal application/CLI packages when practical, covering Apple Silicon and Intel.

Patch UI should eventually have a native AppKit/Cocoa backend.

## Linux

- Console: native executable.
- Window: graphical executable using the portable Patch UI backend initially.
- Later packaging: AppImage and common distribution formats where useful.

## BSD and other Unix-like systems

Patch should not pretend that there is one universal Unix GUI API. The design therefore separates language UI from host UI.

Initial strategy:

- SDL3-based Patch UI backend where supported;
- Web/PWA Studio wherever a modern browser exists;
- portable `.patchapp` if a Patch runtime is available;
- C99 code generation as a portability escape hatch, especially for console applications.

Potential targets include FreeBSD, OpenBSD and NetBSD first, followed by other systems as runtime/toolchain support permits.

## Web

The browser target should use the same Change IR and application semantics.

Long-term:

```text
Patch source -> Change IR -> WebAssembly -> Patch Web Runtime
```

Window applications map Patch UI controls to browser UI primitives while preserving the Patch source model.

## `.patchapp`

`.patchapp` is the portable application unit. It is intended to outlive individual native packaging formats.

The logical bundle contains:

- manifest;
- Patch language/version metadata;
- application kind (`console` or `window`);
- source/IR as appropriate;
- assets;
- declared runtime capabilities.

The 0.2 development format is JSON for transparency. A compact archive/container can be introduced later without changing the logical model.

## Build from phones/tablets

Patch Studio on iOS/Android can run browser-compatible targets and generate portable bundles locally. Native desktop artifacts are produced by remote builders:

```text
Build for Windows -> Windows CI runner
Build for macOS   -> macOS CI runner
Build for Linux   -> Linux CI runner
```

This keeps the IDE universal even when the target toolchain itself is platform-specific.
