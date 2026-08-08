# Application builds

Status: **0.2.0-beta.22**

Patch keeps Console and Window build paths explicit. Direct Wasm is a Console backend; Window Web/Desktop packages use the Window runtime/player path.

## Build matrix

```text
Console
  Web     -> one HTML file with direct Patch Wasm + browser host
  Windows -> .exe via direct-Wasm host
  macOS   -> .app via direct-Wasm host
  Linux   -> native executable via direct-Wasm host
  FreeBSD -> native executable via Portable C99 + FreeBSD 15.1 cc

Window / GUI
  Web     -> Standalone Window Web App with generated browser runtime
  Windows -> standalone packaged GUI application
  macOS   -> standalone packaged GUI application
  Linux   -> standalone packaged GUI application
  FreeBSD -> not yet supported
```

## Window preflight

The shared **Window preflight** compiles source and checks normalized `code == "WINDOW"` IR. Beta.22 additionally validates the common runtime contract before cloud dispatch and again inside the target-side desktop packager.

Current cross-target event support is deliberately conservative: button `clicked` only. Duplicate control ids, handlers for nonexistent controls, input `changed`, and window `closed` are rejected at build time rather than packaged with inconsistent behavior.

The Standalone Window Web backend has executable differential tests against `PatchInterpreter`, including multi-operation semantic changes and actual button clicks.

## Browser and WebAssembly

```bash
patch build console.patch --target web --out Console.html
patch build window.patch --target web --out Window.html
patch build console.patch --target wasm-direct --out Console.direct.wasm
```

Console Web Apps embed direct Wasm. A **Standalone Window Web App** embeds the validated Patch Window AST plus a generated browser runtime. Raw direct Wasm is Console-only, imports `patch.show_number` / `patch.change_number`, and is **not yet a standalone WASI command module**.

## Runtime formal assurance

`patch runtime-certify` is independent of packaging. It executes supported direct Wasm, reconstructs concrete semantic effects and an untrusted `RuntimePath`, then generates Lean evidence. Beta.22 also emits the declared policy and checks `checkedConcreteRuntimeCannotEscape`, proving the decoded concrete runtime effects of an accepted protected invocation stay within the verified Change Capability.

## Portable C99

```bash
patch build hello.patch --target c99 --out Hello.c
cc -std=c99 -Wall -Wextra -pedantic -O2 -o Hello Hello.c -lm
```

Portable C99 covers the conservative numeric Console subset. CI compile/runs generated C on Linux, macOS and **FreeBSD 15.1**.

## Studio remote desktop builds

```text
current editor source
    -> local browser preflight
    -> GitHub Actions platform runner
    -> target-side validation/build/smoke check
    -> downloadable artifact
```

A fine-grained GitHub token with Actions read/write permission is currently required; Studio does not save it.

Window packages are standalone but are **not yet native-widget lowering** to AppKit, Win32 or GTK. A native AppKit Window backend, native Win32 backend and portable Unix GUI layer remain roadmap items.

## Portability claim

```text
Linux      Portable C99 tested
macOS      Portable C99 tested
FreeBSD    Portable C99 tested on 15.1
OpenBSD    not yet claimed
NetBSD     not yet claimed
```
