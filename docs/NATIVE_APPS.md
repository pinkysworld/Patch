# Application builds

Status: **0.2.0-beta.18**

Patch has separate build paths for browser, WebAssembly and desktop applications. Beta.18 adds a portable C99 Console backend and a tested FreeBSD build path.

## Build matrix

```text
Console
  Windows -> .exe via native direct-Wasm host
  macOS   -> .app via native direct-Wasm host
  Linux   -> native executable via direct-Wasm host
  FreeBSD -> native executable via portable C99 + FreeBSD cc

Window / GUI
  Windows -> standalone packaged GUI application
  macOS   -> standalone packaged GUI application
  Linux   -> standalone packaged GUI application
  FreeBSD -> not yet supported
```

## Browser build

For the supported direct numeric Console subset:

```bash
patch build hello.patch --target web --out Hello.html
```

The result is one HTML file containing the directly compiled Patch WebAssembly module plus the small JavaScript host required for `show` and semantic transition callbacks.

Patch Studio exposes this as **Standalone Web App (.html)**.

## Direct WebAssembly

```bash
patch build hello.patch --target wasm-direct --out Hello.direct.wasm
```

This is directly lowered WebAssembly. It currently imports:

```text
patch.show_number(f64)
patch.change_number(i32 targetId, f64 before, f64 after)
```

A raw `.direct.wasm` is therefore not yet a standalone WASI command module. Use `patch run-wasm`, Standalone Web App, or a desktop Patch host.

The older `--target wasm` remains an advanced bootstrap carrier containing Patch source plus Change IR.

## Portable C99

```bash
patch build hello.patch --target c99 --out Hello.c
cc -std=c99 -Wall -Wextra -pedantic -O2 -o Hello Hello.c -lm
./Hello
```

The C99 generator first applies the same conservative language boundary used by the direct numeric Wasm backend. It then independently emits C source from normalized Change IR.

Supported in beta.18:

- top-level numeric state;
- numeric `set`, `add`, `remove`, `clear`;
- numeric `show`;
- supported `+ - * /` expressions and comparisons;
- `if` / `else`;
- literal `repeat` with 1-based Patch `count`;
- non-recursive acyclic numeric recipes;
- ranged numeric recipe guards;
- one block-level transition hook per supported `change` block.

Unsupported constructs fail explicitly rather than falling back to the interpreter.

CI generates the same C99 program and compiles/runs it with the system C compiler on Linux, macOS and **FreeBSD 15.1**.

## FreeBSD from Patch Studio

Select **FreeBSD Console** in Studio and keep Project Type set to **Console**.

The flow is:

```text
current Patch Studio source
        |
        v
C99 preflight in the browser
        |
        v
Patch FreeBSD C99 GitHub workflow
        |
        v
FreeBSD 15.1 virtual machine
        |
        v
cc -std=c99 ...
        |
        v
smoke run
        |
        v
FreeBSD executable artifact
        |
        v
Patch Studio download
```

The source does not need to be committed. It is sent as a workflow input. A fine-grained GitHub token with Actions read/write permission is currently required; Studio does not store it in `localStorage` or the project.

The workflow deliberately uses the compiler supplied by the FreeBSD base system. This keeps the generated C source independent of Node.js, Wasmtime or Rust at runtime.

## Windows, macOS and Linux from Studio

The three existing desktop targets continue to support both Project Types:

```text
Console -> direct Patch Wasm + native host
Window  -> generated Patch desktop GUI player
```

The current source in the editor is sent to **Patch Native Apps**, compiled/packaged on the actual target operating system, smoke-run and returned as an Actions artifact.

## Current GUI boundary

The Window player currently handles the first Patch UI slice: `window`, `text`, `button`, `input` and supported button click events. The package is standalone for Windows, macOS or Linux, but this is **not yet native-widget lowering** to AppKit, Win32 or GTK.

FreeBSD Window packages, a portable Unix GUI backend, signing/notarization and installer formats remain separate future work.

## Portability claim

Beta.18 has executable evidence for portable C99 on:

```text
Linux      tested
macOS      tested
FreeBSD    tested on 15.1
OpenBSD    not yet claimed
NetBSD     not yet claimed
other Unix not yet claimed
```

C99 is the intended fallback architecture for additional Unix-family Console targets, but each platform should be added to the public build matrix only after an actual compile/run gate exists.
