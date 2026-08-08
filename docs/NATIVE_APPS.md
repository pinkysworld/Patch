# Simple application builds

Status: **0.2.0-beta.17**

Patch has separate build targets for browser, WebAssembly and desktop applications. The Studio desktop targets now support both Console and Window projects.

## Easiest browser build

For the currently supported direct numeric console subset:

```bash
patch build hello.patch --target web --out Hello.html
```

The result is one HTML file containing the directly compiled Patch WebAssembly module plus the tiny JavaScript host needed for `show` and semantic transition callbacks.

Patch Studio exposes the same target as **Standalone Web App (.html)**.

## Direct WebAssembly

```bash
patch build hello.patch --target wasm-direct --out Hello.direct.wasm
```

This is directly lowered WebAssembly. It currently imports the small Patch host ABI:

```text
patch.show_number(f64)
patch.change_number(i32 targetId, f64 before, f64 after)
```

A raw `.direct.wasm` file is therefore not yet a WASI command module. Use `patch run-wasm`, the standalone Web App target, or a native Patch host.

The older `--target wasm` target remains an advanced bootstrap carrier containing Patch source plus Change IR.

## Native console application on the current OS

```bash
patch build hello.patch --target app --name Hello
```

For the current direct console subset this creates, on the machine performing the build:

```text
macOS   -> Hello.app
Windows -> Hello.exe
Linux   -> Hello
```

The native builder embeds direct Patch Wasm inside the platform host.

## Build desktop applications from Patch Studio

Patch Studio exposes three remote desktop targets directly in the Build menu:

```text
Windows App (.exe)
macOS App (.app)
Linux App
```

Set **Project Type** to either `Console` or `Window`, choose the operating system and press **Build**.

The current source in the editor is base64-encoded and supplied to the **Patch Native Apps** GitHub Actions workflow. It does not have to be committed first.

A fine-grained GitHub token with Actions read/write permission is required. The Studio native-build module keeps it only in the current page and does not store it in local storage.

The workflow checks the Patch source before packaging, builds on the actual target operating system, performs a smoke run and uploads a platform artifact that Studio downloads when the run succeeds.

## Console Studio builds

Console projects use the directly compiled Patch Wasm/native host path. The current direct boundary covers the documented numeric state/change/control-flow/recipe subset.

CI smoke-builds and runs this path on Windows, macOS and Linux.

## Window / GUI Studio builds

Window projects use a separate generated desktop player. The packager:

1. embeds the current Patch source and Patch runtime modules;
2. creates a small Electron desktop host;
3. renders current Patch `window`, `text`, `button` and `input` controls;
4. forwards supported button events back to the Patch runtime;
5. packages the application for the selected desktop OS.

The resulting package is standalone for the target OS. It is **not yet native-widget lowering** to AppKit, Win32 or GTK.

Current package shapes are approximately:

```text
Windows -> packaged application folder containing App.exe
macOS   -> App.app inside a universal Electron bundle
Linux   -> packaged application folder with executable and runtime files
```

The Actions workflow smoke-builds and starts Window packages on all three desktop systems. The Linux smoke run uses a virtual display because GitHub-hosted Linux runners are headless.

## GitHub Actions workflow

The `Patch Native Apps` workflow accepts:

- `source_b64`, used by Studio;
- `source_path`, for a repository file when source_b64 is empty;
- `app_name`;
- `platform`: `windows`, `macos` or `linux`;
- `kind`: `console` or `window`;
- `request_id`, used by Studio to find its workflow run and artifact.

For pull requests touching the native subsystem, the workflow independently tests both Console and Window builds across Windows, macOS and Linux.

## Current boundary

Console packages are true compiled direct-Wasm/native-host applications for the supported direct backend subset.

Window packages are standalone desktop applications, but currently execute through the Patch runtime in the generated GUI player. The longer-term target is native UI lowering while preserving the same Patch source and `change` semantics.

Signing, macOS notarization, Windows code signing and installer formats are intentionally separate release-engineering steps and are not required for development smoke builds.
