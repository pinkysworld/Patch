# Application builds

Status: **0.2.0-beta.28** · Change IR **0.10**

Patch keeps Console and Window build paths explicit. Direct Wasm is a Console backend; Window Web/Desktop packages use the Window runtime/player path. Beta.28 strengthens research certificate coverage and does **not** change Change IR or the Window event contract.

## Build matrix

```text
Console
  Web     -> one HTML file with direct Patch Wasm + browser host
  Windows -> ready ZIP with prebuilt native runtime + app.wasm payload
  macOS   -> ready ZIP with prebuilt .app runtime + app.wasm payload
  Linux   -> ready ZIP with prebuilt native runtime + app.wasm payload
  FreeBSD -> native executable via Portable C99 + FreeBSD 15.1 cc

Window / GUI
  Web     -> Standalone Window Web App with generated browser runtime
  Windows -> ready ZIP with prebuilt desktop player + Patch source payload
  macOS   -> ready ZIP with prebuilt .app desktop player + Patch source payload
  Linux   -> ready ZIP with prebuilt desktop player + Patch source payload
  FreeBSD -> not yet supported
```

For Windows, macOS and Linux, the ordinary Studio path is **Ready app download (no token)**. The runtime is compiled ahead of time by the Patch project. Studio only validates/compiles the small project payload and inserts it into the already-built runtime archive in the browser. The user does not need a GitHub token or a local Node/Rust/compiler toolchain.

## One-click prebuilt native packaging

The flow is:

```text
Patch source in Studio
    -> browser compiler/preflight
    -> Console: direct Wasm payload
       Window: validated source payload
    -> fetch prebuilt OS runtime ZIP
    -> append patch-app.json (+ app.wasm for Console)
    -> download ready ZIP
```

`src/prebuilt-native.js` performs the ZIP customization without decompressing or recompiling the platform runtime. Existing compressed runtime entries and offsets remain valid; the browser adds stored payload entries and emits a new central directory.

The generic runtime packages are built by `.github/workflows/runtime-templates.yml` on actual Windows, macOS and Linux runners. Both Console and Window templates are built before a PR can merge. On `main`, the six runtime ZIPs are published under the stable `studio-runtime-v0.1` release and the Pages deployment copies them to `runtimes/` so Patch Studio can fetch them from its own origin.

The running app gets the project name from `patch-app.json`. At this stage the generic runtime name may remain visible as the outer executable/app-bundle name inside the ZIP. Project-specific package renaming, signing and notarization are separate polish steps and are not required to run the generated package.

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

This assurance does **not** alter the trust boundary of the platform runtime and does not yet prove branch-aware or nested-call concrete callee execution, complete transitive call traces, or production-Wasm call equivalence.

## Portable C99

```bash
patch build hello.patch --target c99 --out Hello.c
cc -std=c99 -Wall -Wextra -pedantic -O2 -o Hello Hello.c -lm
```

Portable C99 covers the conservative numeric Console subset. CI compile/runs generated C on Linux, macOS and **FreeBSD 15.1**.

## Advanced Studio build modes

The one-click ready-app path is the default. Two advanced alternatives remain available:

```text
GitHub Actions cloud build
    -> local browser preflight
    -> authenticated workflow dispatch
    -> target-side validation/build/smoke check
    -> downloadable artifact

Local toolchain kit
    -> browser-generated source/build scripts
    -> user machine performs platform build
```

Only the cloud mode needs a fine-grained GitHub token with Actions read/write permission; Studio does not save it. The local kit needs the relevant local toolchain. FreeBSD currently remains on these advanced/local paths because a prebuilt FreeBSD runtime is not published yet.

Window packages are standalone but are **not yet native-widget lowering** to AppKit, Win32 or GTK. Native AppKit, Win32 and a portable Unix GUI layer remain roadmap items.

## Portability claim

```text
Linux      Portable C99 tested
macOS      Portable C99 tested
FreeBSD    Portable C99 tested on 15.1
OpenBSD    not yet claimed
NetBSD     not yet claimed
```