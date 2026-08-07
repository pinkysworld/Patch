# Patch Build Targets

Patch uses one source language and one compiler pipeline for console and window applications.

## Current portable targets

Patch 0.2 beta currently builds:

| Target | Status | Purpose |
|---|---|---|
| `.patchapp` | implemented | human-readable portable Patch application bundle containing manifest, source and Change IR |
| `.wasm` bootstrap | implemented | valid WebAssembly module containing Patch source + Change IR for a Patch host |
| browser/Patch Studio execution | implemented | interpreter/runtime path for console and current Patch UI programs |

The bootstrap `.wasm` is intentionally distinguished from the next stage, **direct Change IR-to-Wasm execution**.

## Canonical target matrix

| Application | Windows | macOS | Linux | BSD/Unix | Browser |
|---|---|---|---|---|---|
| Console | `.exe` | native CLI | native CLI | native/C fallback | direct Wasm/runtime |
| Window | GUI `.exe` | `.app` | graphical executable | SDL3 graphical executable | Web/Wasm app |
| Portable | `.patchapp` / `.wasm` | `.patchapp` / `.wasm` | `.patchapp` / `.wasm` | `.patchapp` / `.wasm` where runtime exists | `.patchapp` / `.wasm` |
| IDE | browser/native shell | browser/native shell | browser/native shell | browser | browser/PWA |

## Windows

Patch distinguishes console and graphical application packaging.

Planned native outputs:

- Console: PE executable with console behavior.
- Window: PE graphical application without an unwanted terminal window.
- Architectures: x86-64 first, ARM64 next.

Patch UI should eventually have a native Windows backend for standard windows, controls, menus, dialogs, clipboard, drag/drop and OS integration.

## macOS

Planned native outputs:

- Console: native command-line executable.
- Window: normal `.app` application bundle.
- Release packaging: code-signing/notarization hooks.
- Architecture goal: Universal application/CLI packages when practical, covering Apple Silicon and Intel.

Patch UI should eventually have a native AppKit/Cocoa backend.

## Linux

Planned native outputs:

- Console: native executable.
- Window: graphical executable using the portable Patch UI backend initially.
- Later packaging: AppImage and common distribution formats where useful.

## BSD and other Unix-like systems

Patch should not pretend that there is one universal Unix GUI API. The design therefore separates language UI from host UI.

Strategy:

- SDL3-based Patch UI backend where supported;
- Web/PWA Studio wherever a modern browser exists;
- `.patchapp`/`.wasm` where a Patch host is available;
- C99 code generation as a portability escape hatch, especially for console applications.

Initial native runtime targets are FreeBSD, OpenBSD and NetBSD, followed by other systems as runtime/toolchain support permits.

## Web

The browser target uses the same Change IR and application semantics.

Current path:

```text
Patch source -> Change IR -> bootstrap .wasm payload / JS beta runtime
```

Target path:

```text
Patch source -> typed Change IR -> direct WebAssembly -> Patch Web Runtime
```

Window applications map Patch UI controls to browser primitives while preserving the Patch source model.

## `.patchapp`

`.patchapp` is the canonical transparent portable application unit. It is intended to outlive individual native packaging formats.

The logical bundle contains:

- manifest;
- Patch language/version metadata;
- application kind (`console` or `window`);
- source/IR as appropriate;
- assets;
- declared runtime capabilities.

The 0.2 format is JSON for transparency. A compact archive/container can be introduced later without changing the logical model.

## Bootstrap `.wasm`

`patch build ... --target wasm` now emits an instantiable WebAssembly module with exported memory and metadata locating an embedded compiled Patch payload. Browser/native Patch hosts can recover the same project + Change IR representation from this artifact.

This provides a real portable binary target and tests the Wasm delivery path, but it is not yet equivalent to executing all Patch operations directly as WebAssembly instructions.

## Build from phones/tablets

Patch Studio on iOS/Android can already run browser-compatible programs and generate `.patchapp` and bootstrap `.wasm` artifacts locally. Native desktop artifacts will be produced by remote builders:

```text
Build for Windows -> Windows CI runner
Build for macOS   -> macOS CI runner
Build for Linux   -> Linux CI runner
```

This keeps the IDE universal even when the native target toolchain is platform-specific.
