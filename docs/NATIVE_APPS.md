# Application builds

Status: **0.2.0-beta.19**

Patch has separate build paths for browser, WebAssembly and desktop applications. The portable C99/FreeBSD Console path introduced in beta.18 remains part of beta.19 alongside the new source-validation work.

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

## Browser and WebAssembly

```bash
patch build hello.patch --target web --out Hello.html
patch build hello.patch --target wasm-direct --out Hello.direct.wasm
```

The Web App is one HTML file containing direct Patch Wasm plus its small browser host. Raw direct Wasm imports `patch.show_number(f64)` and `patch.change_number(i32,f64,f64)`, so it is not yet a standalone WASI command module. The older `--target wasm` remains the bootstrap source+IR carrier.

## Portable C99

```bash
patch build hello.patch --target c99 --out Hello.c
cc -std=c99 -Wall -Wextra -pedantic -O2 -o Hello Hello.c -lm
./Hello
```

Portable C99 uses the same conservative numeric Console boundary as direct Wasm and independently emits C from normalized Change IR. It covers top-level numeric state, `set/add/remove/clear`, `show`, supported arithmetic/comparisons, `if/else`, literal `repeat` + Patch `count`, acyclic numeric recipes, ranged runtime guards and a block-level transition hook.

CI compiles/runs the generated C with system compilers on Linux, macOS and **FreeBSD 15.1**.

## FreeBSD from Patch Studio

Select **FreeBSD Console** and keep Project Type set to **Console**:

```text
current Studio source
  -> C99 browser preflight
  -> Patch FreeBSD C99 workflow
  -> FreeBSD 15.1 VM
  -> base-system cc -std=c99
  -> smoke run
  -> native executable artifact
  -> Studio download
```

The source need not be committed. A fine-grained GitHub token with Actions read/write permission is currently required; Studio does not save it in `localStorage` or the project.

## Windows, macOS and Linux from Studio

Both Project Types are supported:

```text
Console -> direct Patch Wasm + native host
Window  -> generated Patch desktop GUI player
```

The target runner compiles/packages the current editor source, smoke-runs the result and returns an Actions artifact.

## Current GUI boundary

The Window player currently handles `window`, `text`, `button`, `input` and supported button click events. It is standalone for Windows/macOS/Linux, but is **not yet native-widget lowering** to AppKit, Win32 or GTK. FreeBSD Window packages and a portable Unix GUI backend remain future work.

## Portability claim

```text
Linux      portable C99 tested
macOS      portable C99 tested
FreeBSD    portable C99 tested on 15.1
OpenBSD    not yet claimed
NetBSD     not yet claimed
other Unix not yet claimed
```

Additional Unix-family targets should enter the public build matrix only after an actual compile/run gate exists.
