# Application builds

Status: **0.2.0-beta.24** · Change IR **0.9**

Patch keeps Console and Window build paths explicit. Direct Wasm is a Console backend; Window Web/Desktop packages use the Window runtime/player path. Beta.24 changes Window event execution, not the package formats or formal Change IR schema.

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

Current cross-target event support is deliberately conservative and explicit:

- button `clicked`;
- input `changed`, with the current control text exposed as event-local `value`.

The input edit itself does not write persistent Patch state. Source must still use an ordinary semantic `change` to commit it, for example:

```patch
create text name = ""
window "Hello":
  input name
when name changed:
  change name:
    set = value
```

Duplicate control ids, handlers for nonexistent controls and unsupported event/control pairs such as button `changed` or window `closed` are rejected at build time rather than packaged with inconsistent behavior.

The Standalone Window Web backend has executable differential tests against `PatchInterpreter`, plus fake-DOM tests proving that an observation-only input handler does not persist control edits while an explicit `change` does.

The generated Windows/macOS/Linux desktop player uses the same `src/window-events.js` adapter as interpreter-backed Studio preview, so the event-local-value contract is shared rather than reimplemented as a hidden assignment.

## Browser and WebAssembly

```bash
patch build console.patch --target web --out Console.html
patch build window.patch --target web --out Window.html
patch build console.patch --target wasm-direct --out Console.direct.wasm
```

Console Web Apps embed direct Wasm. A **Standalone Window Web App** embeds the validated Patch Window AST plus a generated browser runtime. Raw direct Wasm is Console-only, imports `patch.show_number` / `patch.change_number`, and is **not yet a standalone WASI command module**.

## Runtime formal assurance

`patch runtime-certify` is independent of packaging. The beta.23 research layer requires eligible protected recipes to pass raw SourceStmt/range validation and independent raw GuardTree/control-flow validation. `PatchGuarded.lean` checks supported branch witnesses against concrete safe-integer parameter guards and composes accepted concrete effects with Change Capabilities.

Beta.24 does not extend this Lean fragment; it is product/semantic-consistency work that preserves the same single persistent-mutation route for GUI input.

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
