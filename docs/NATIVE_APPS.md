# Simple application builds

Status: **0.2.0-beta.17**

Patch has separate build targets for different jobs. The names are intentionally explicit so a valid WebAssembly container is not mistaken for a standalone application.

## Easiest browser build

For the currently supported direct numeric console subset:

```bash
patch build hello.patch --target web --out Hello.html
```

The result is one HTML file. It contains the directly compiled Patch WebAssembly module plus the tiny JavaScript host needed for `show` and semantic transition callbacks. Open the file in a modern browser.

Patch Studio exposes the same target as **Standalone Web App (.html)**.

## Direct WebAssembly

```bash
patch build hello.patch --target wasm-direct --out Hello.direct.wasm
```

This is real directly lowered WebAssembly. It executes supported Patch state, arithmetic, control flow and non-recursive recipes as Wasm instructions. It currently imports the small Patch host ABI:

```text
patch.show_number(f64)
patch.change_number(i32 targetId, f64 before, f64 after)
```

Therefore a raw `.direct.wasm` file is not yet a WASI command module. Use `patch run-wasm`, the standalone Web App target, or a native Patch host.

The older `--target wasm` target remains an advanced bootstrap carrier containing Patch source plus Change IR. It is not advertised as a standalone executable.

## Native console application on the current OS

Install Rust once on the machine that performs native packaging, then run:

```bash
patch build hello.patch --target app --name Hello
```

Output:

```text
macOS   -> Hello.app
Windows -> Hello.exe
Linux   -> Hello
```

The builder first compiles Patch to the direct Wasm backend, embeds that module inside a small Rust host, and compiles the host as a standalone native program. The native host pins Wasmtime 47.0.3 for reproducible packaging.

On macOS the output is a real `.app` bundle with `Contents/MacOS` and `Info.plist`. For the current console subset, Finder launches show program output in a simple system dialog as well as standard output. Windows application builds similarly surface `show` output in a desktop dialog. Linux currently remains a native console executable.

For a terminal-style native binary without the desktop presentation wrapper:

```bash
patch build hello.patch --target native --out Hello
```

## Build Windows, macOS and Linux directly from Patch Studio

Beta.17 connects Patch Studio to the **Patch Native Apps** GitHub Actions workflow.

Choose **Windows / macOS / Linux desktop** in Studio, press **Build**, then select one operating system or all three. The Studio build dialog can submit either a Console project or a Window / GUI project.

The source currently open in the editor is base64-encoded and sent as a `workflow_dispatch` input. It does not need to be committed to the repository first.

A GitHub token is required to start and inspect the Actions workflow. Studio keeps the token only in memory in the current browser tab. It is not saved in the Patch project or browser local storage.

The workflow run is tagged with a unique request ID. Studio polls the Actions API, shows queued/running/completed status and lists the build artifacts when the run completes.

## Console cloud builds

Console cloud builds use the same direct-Wasm + Rust/Wasmtime host as the CLI native target.

For pull requests and relevant pushes, CI smoke-builds and executes the console target on:

```text
Windows
macOS
Linux
```

## Window / GUI cloud builds

Window projects are packaged using a generated minimal Electron host. The package contains:

- the current Patch source;
- the Patch interpreter/runtime modules;
- a small desktop player that renders `window`, `text`, `button` and `input` controls;
- supported button-event forwarding back into Patch.

The resulting application is standalone on the target OS. It is not yet a native-widget lowering of Patch UI to AppKit, Win32 or GTK.

The macOS GUI packager requests a universal bundle. Windows and Linux use the architecture provided by the GitHub-hosted runner.

The native build workflow smoke-checks both **console and window** packaging on Windows, macOS and Linux before changes to this subsystem are considered green.

## Build all three platforms manually in GitHub Actions

The workflow remains usable directly from GitHub Actions. It accepts:

- `source_path`, for repository files;
- optional `source_b64`, used by Patch Studio;
- `app_name`;
- `target`: `all`, `windows`, `macos` or `linux`;
- `kind`: `console` or `window`;
- `request_id` for Studio run correlation.

## Current boundary

The compact native console builder deliberately uses the same subset as the direct Wasm backend: top-level numeric state, numeric `change`, `show`, arithmetic, supported `if`/`else`, literal `repeat`, non-recursive numeric recipes and ranged parameter guards.

Window/Designer projects can now be packaged as standalone desktop GUI applications, but they currently execute through the Patch runtime inside the generated desktop player rather than through native UI code generation. Native GUI lowering remains a later compiler/runtime step.
