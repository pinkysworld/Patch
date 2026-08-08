# Simple application builds

Status: **0.2.0-beta.16**

Patch now has separate build targets for different jobs. The names are intentionally explicit so a valid WebAssembly container is not mistaken for a standalone application.

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

## Native application on the current OS

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

The builder first compiles Patch to the direct Wasm backend, embeds that module inside a small Rust host, and compiles the host as a standalone native program. The native host currently uses Wasmtime 47.0.2.

On macOS the output is a real `.app` bundle with `Contents/MacOS` and `Info.plist`. For the current console subset, Finder launches show program output in a simple system dialog as well as standard output. Windows application builds similarly surface `show` output in a desktop dialog. Linux currently remains a native console executable.

For a terminal-style native binary without the desktop presentation wrapper:

```bash
patch build hello.patch --target native --out Hello
```

## Build all three platforms in GitHub Actions

The repository includes **Patch Native Apps** under GitHub Actions. Run the workflow manually and provide:

- `source_path`, for example `examples/direct-wasm-recipes.patch`
- `app_name`, for example `MyPatchApp`

The matrix builds artifacts on macOS, Windows and Linux. This avoids pretending that macOS can be reliably cross-compiled from Windows or vice versa.

## Current boundary

The native and standalone-Web builders deliberately use the same subset as the direct Wasm backend. At beta.16 this is the numeric console subset: top-level numeric state, numeric `change`, `show`, arithmetic, supported `if`/`else`, literal `repeat`, non-recursive numeric recipes and ranged parameter guards.

The existing Patch Window/Designer model still runs through the Patch runtime and is not yet lowered to native desktop widgets. Native GUI output is the next major product step. The long-term goal is that the same simple `patch build ... --target app` command can package both console and Window projects without exposing backend complexity to the programmer.
