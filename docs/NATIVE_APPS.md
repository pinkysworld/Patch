# Application builds

Status: **0.2.0-beta.25** · Change IR **0.10**

Patch keeps Console and Window build paths explicit. Direct Wasm is a Console backend; Window Web/Desktop packages use the Window runtime/player path. Beta.25 adds the `formalCalls` assurance artifact and does **not** change package formats or the Window runtime contract.

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

## Window preflight and semantic events

The shared **Window preflight** compiles source and checks normalized `code == "WINDOW"` IR, then validates the common runtime contract before cloud dispatch and again inside the target-side desktop packager.

Current cross-target event support is deliberately conservative:

- button `clicked`;
- input `changed`, with the current control text exposed as event-local `value`.

The input edit itself does not write persistent Patch state. Source must use an ordinary semantic `change` to commit it. Duplicate control ids, handlers for nonexistent controls and unsupported event/control pairs are rejected at build time.

Generated Window Web HTML is executed in regression tests, including observation-only input and explicit semantic persistence. The Windows/macOS/Linux desktop player uses the shared `src/window-events.js` adapter used by Studio preview.

## Browser and WebAssembly

```bash
patch build console.patch --target web --out Console.html
patch build window.patch --target web --out Window.html
patch build console.patch --target wasm-direct --out Console.direct.wasm
```

Console Web Apps embed direct Wasm. A **Standalone Window Web App** embeds the validated Patch Window AST plus a generated browser runtime. Raw direct Wasm is Console-only, imports `patch.show_number` / `patch.change_number`, and is **not yet a standalone WASI command module**.

## Formal assurance is separate from packaging

`patch runtime-certify` covers the beta.23 guard-aware direct-runtime fragment. Beta.25 adds a separate static/interprocedural command:

```bash
patch call-certify examples/formal-calls.patch --out Calls.patchcert.lean
```

This certificate checks a finite acyclic recipe environment through `PatchCalls.lean`: call resolution, strict rank decrease, safe-integer argument-interval fit and callee-to-caller semantic-signature containment. It does not change the executable package and does not yet prove concrete call argument substitution.

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

Window packages are standalone but are **not yet native-widget lowering** to AppKit, Win32 or GTK. Native AppKit, Win32 and a portable Unix GUI layer remain roadmap items.

## Portability claim

```text
Linux      Portable C99 tested
macOS      Portable C99 tested
FreeBSD    Portable C99 tested on 15.1
OpenBSD    not yet claimed
NetBSD     not yet claimed
```
