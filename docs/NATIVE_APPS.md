# Application builds

Status: **0.2.0-beta.21**

Patch has separate build paths for Console and Window applications. Beta.21 fixes Studio Window routing and adds a compatible single-file Window Web target without pretending that the Console-only Direct Wasm backend supports GUI instructions.

## Build matrix

```text
Console
  Web     -> one HTML file with direct Patch Wasm + browser host
  Windows -> .exe via native direct-Wasm host
  macOS   -> .app via native direct-Wasm host
  Linux   -> native executable via direct-Wasm host
  FreeBSD -> native executable via portable C99 + FreeBSD cc

Window / GUI
  Web     -> Standalone Window Web App with generated browser runtime
  Windows -> standalone packaged GUI application
  macOS   -> standalone packaged GUI application
  Linux   -> standalone packaged GUI application
  FreeBSD -> not yet supported
```

## Window preflight

Studio's desktop **Window preflight** compiles source to normalized Change IR and checks for the actual representation:

```text
code == "WINDOW"
```

An older browser-side check looked for a nonexistent lower-case `instruction.op` field, which made valid Window source appear to contain no window. Beta.21 centralizes this check in `src/window-build.js` and the regression suite verifies the real `WINDOW` IR instruction.

After preflight, Windows/macOS/Linux Window source is dispatched to the existing dedicated Window packager and smoke-tested on the target runner.

## Browser and WebAssembly

```bash
patch build console.patch --target web --out Console.html
patch build window.patch --target web --out Window.html
patch build console.patch --target wasm-direct --out Console.direct.wasm
```

The CLI now infers Console versus Window when `--kind` is omitted for ordinary builds.

Console Web Apps embed direct Patch Wasm. A **Standalone Window Web App** instead embeds the parsed validated Window program plus a generated browser runtime for the current Window/control/event subset. It does not silently feed `WINDOW` into Direct Wasm.

Raw Direct Wasm remains Console-only and imports:

```text
patch.show_number(f64)
patch.change_number(i32,f64,f64)
```

It is not yet a standalone WASI command module. The older `--target wasm` remains the bootstrap source+IR carrier.

## Research runtime certification

The application packaging path is separate from formal assurance, but beta.21's CLI still supports:

```bash
patch runtime-certify examples/runtime-correspondence.patch \
  --out formal/GeneratedRuntimeCertificate.lean
```

`runtime-certify` executes supported direct Wasm, independently reconstructs concrete semantic effects and an untrusted `RuntimePath`, and emits proof-free evidence. Lean checks branch/repeat witness shape, source execution and concrete effect refinement. Multiple observed protected recipe invocations can now be checked separately.

## Portable C99

```bash
patch build hello.patch --target c99 --out Hello.c
cc -std=c99 -Wall -Wextra -pedantic -O2 -o Hello Hello.c -lm
./Hello
```

Portable C99 uses the conservative numeric Console boundary and independently emits C from normalized Change IR. CI compiles/runs generated C on Linux, macOS and **FreeBSD 15.1**.

## FreeBSD from Patch Studio

Select **FreeBSD Console** with Project Type **Console**:

```text
current Studio source
  -> C99 browser preflight
  -> Patch FreeBSD C99 workflow
  -> FreeBSD 15.1 VM
  -> base-system cc -std=c99
  -> smoke run
  -> native executable artifact
```

FreeBSD Window remains unsupported rather than being silently redirected to a different runtime.

## Windows, macOS and Linux from Studio

```text
Console
  -> direct-Wasm preflight
  -> platform Console host

Window
  -> compiler + normalized WINDOW preflight
  -> dedicated generated desktop GUI player
```

The Window player currently handles `window`, `text`, `button`, `input`, supported events and semantic changes. It is standalone for Windows/macOS/Linux but is **not yet native-widget lowering** to AppKit, Win32 or GTK.

A fine-grained GitHub token with Actions read/write permission is currently required for Studio remote desktop builds. The token stays in the current page and is not saved in project storage.

## Local CLI desktop boundary

`patch build --target app/native` currently remains the local **Console** host. Window desktop packaging is currently exposed through Patch Studio/GitHub Actions and `scripts/build-native-window.js`. The CLI reports this boundary directly instead of failing inside Direct Wasm.

## Portability claim

```text
Linux      portable C99 tested
macOS      portable C99 tested
FreeBSD    portable C99 tested on 15.1
OpenBSD    not yet claimed
NetBSD     not yet claimed
other Unix not yet claimed
```

Additional Unix-family targets should enter the public matrix only after a real compile/run gate exists.
