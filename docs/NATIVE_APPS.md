# Application builds

Status: **0.2.0-beta.28** · Change IR **0.10**

Patch keeps Console and Window build paths explicit. Direct Wasm is a Console backend; Window Web/Desktop packages use the Window runtime/player path. Beta.28 strengthens research certificate coverage and does **not** change package formats, Change IR or the Window runtime contract.

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
  macOS   -> standalone .app package
  Linux   -> standalone GUI application
  FreeBSD -> not yet supported
```

## Window preflight and semantic events

The shared **Window preflight** validates normalized Window IR before Web or desktop packaging. Current cross-target event support is deliberately conservative:

- button `clicked`;
- input `changed`, with current control text exposed as transient event-local `value`.

The input edit itself does not write persistent Patch state. Source must use ordinary semantic `change` to commit it. Duplicate control ids, missing controls and unsupported event/control pairs are rejected before packaging.

Generated Window Web HTML is executed in regression tests. Windows/macOS/Linux desktop players use the shared `src/window-events.js` semantic adapter.

## Browser and WebAssembly

```bash
patch build console.patch --target web --out Console.html
patch build window.patch --target web --out Window.html
patch build console.patch --target wasm-direct --out Console.direct.wasm
```

Console Web Apps embed direct Wasm. A **Standalone Window Web App** embeds the validated Patch Window AST plus a generated browser runtime. Raw direct Wasm is Console-only, imports the small Patch host ABI, and is **not yet a standalone WASI command module**.

## Formal assurance is separate from packaging

`patch runtime-certify` covers the beta.23 guard-aware direct-runtime fragment. `patch call-certify` covers beta.25 abstract finite acyclic recipe composition.

Concrete call research artifacts are reproducible with:

```bash
npm run concrete-call-certify:example
npm run arithmetic-call-certify:example
npm run callee-trace-certify:example
```

Beta.26 checks exact binding and direct quantitative leaf refinement. Beta.27 preserves formal arithmetic such as `bonus + 1` and `amount * 2` through the production certificate path. Beta.28 extends the exact call layer to a complete semantic-effect trace for direct quantitative sequence/static-repeat callee bodies.

`GeneratedConcreteCallBodyCertificate.lean` is generated from `examples/formal-callee-trace.patch`. Lean checks exact caller-to-callee binding, evaluates the supported structured callee body, checks the full claimed effect trace, checks callee signature coverage and imports that trace into the caller signature.

This assurance does **not** alter executable packages and does not yet prove branch-aware or nested-call concrete callee execution, complete transitive call traces, or production-Wasm call equivalence.

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
