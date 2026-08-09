# Application builds

Status: **0.2.0-beta.32** · Change IR **0.10**

Patch keeps Console and Window build paths explicit. Beta.32 strengthens research assurance around actually executed direct-Wasm Console programs. Product GUI work stays separate from those research claims.

## Build matrix

```text
Console
  Web     -> direct Patch Wasm + browser host
  Windows -> project-named sealed .exe
  macOS   -> project-named sealed .app
  Linux   -> project-named sealed executable
  FreeBSD -> portable C99 + native cc

Window / GUI
  Web     -> Standalone Window Web App
  Windows -> compiled Patch Window program + packaged desktop runtime
  macOS   -> compiled Patch Window program + .app desktop runtime
  Linux   -> compiled Patch Window program + packaged desktop runtime
  FreeBSD -> not yet supported
```

Windows/macOS/Linux ordinary Studio builds are **Ready app download (no token)**. Console apps use sealed project-specific executables. Window apps compile the current Patch source first and link the resulting source-free compiled Window artifact into the hardened sandboxed desktop runtime.

## Compiled Window application path

Current Window build flow:

```text
.patch source
  -> Patch parser/compiler
  -> Window support validation
  -> patch-compiled-window-program 0.2 / Change IR 0.10
  -> desktop runtime link/package
  -> finished Windows/macOS/Linux GUI application
```

The current compiled artifact contains executable Patch AST, project metadata and the source-backed Form layout manifest. Current Ready GUI payload version **0.4** contains this compiled artifact and does **not** contain Patch source. The runtime executes the compiled program directly instead of reparsing `main.patch` when the app starts.

`patch-build.json` in local/cloud application projects records the artifact/IR versions, Form/control/event/Form-action counts and SHA-256 of the source used during the build.

The current prebuilt runtime release is **`studio-runtime-v0.4`**. It accepts current compiled artifact v0.2 and retains explicit backward compatibility with legacy v0.3 compiled payloads and v0.2 source payloads.

## Named Forms and simple lifecycle

Named Forms use beginner-oriented source syntax:

```patch
window "Main" as main:
  button "Settings" as open_settings

window "Settings" as settings:
  button "Close" as close_settings

when open_settings clicked:
  open settings

when close_settings clicked:
  close settings
```

The first named Form starts visible; later named Forms start hidden. `open name` and `close name` change transient UI visibility only. They do not create persistent Patch state or Change History entries. Legacy un-named Window programs keep their previous visibility behavior.

Window preflight rejects duplicate Form names and unknown `open`/`close` targets before packaging.

## Cross-platform executable tests

Two separate CI paths exercise GUI output on **Windows, macOS and Linux**:

1. The project-specific Native Patch smoke builds `examples/forms-navigation.patch` through `scripts/build-native-window.js`, starts the resulting packaged application, verifies compiled-artifact execution, checks initial Main/Settings visibility, clicks the Settings button and then closes Settings again.
2. The Runtime Templates smoke creates a source-free Ready payload v0.4, launches the prebuilt sandboxed runtime, performs the same open/close navigation and also changes the Checkbox inside the opened Settings Form.

These are renderer-level application starts, not static package-presence checks.

The platform application shell and widgets are still supplied by Electron. This build path is therefore a real Patch compile + runtime-link/package pipeline, but **not** direct Patch-to-x86/ARM GUI AOT compilation and not yet native Win32/AppKit/Unix widget lowering.

## Beta.32 invocation-frame direct-Wasm assurance

The research artifacts can be regenerated with:

```bash
npm run transitive-runtime-certify:example
npm run transitive-runtime-certify:repeated
```

These create:

```text
GeneratedTransitiveRuntimeCertificate.lean
GeneratedRepeatedTransitiveRuntimeCertificate.lean
```

The existing direct-Wasm backend remains unchanged and emits no trusted call-enter/call-exit markers. The independent Change-IR validator executes the expected IR path, validates the complete raw target/before/after transition stream, reconstructs semantic operations/recipe scopes, and also reconstructs every concrete invocation frame.

A frame contains caller/callee identity, dynamic invocation ordinal, parent/depth data, exact parameter bindings and the transition interval dominated by the call. Every validated transition/effect carries the active frame stack.

For an accepted beta.30 witness, beta.32 selects effects by concrete frame identity. The generated Lean certificate then checks the reconstructed frame `BindingList` equals the beta.30 exact callee `BindingList` and re-evaluates the frame-selected effect list through `evalCallTreeStmtEqBool` before caller-signature refinement.

`examples/formal-transitive-calls-repeated.patch` executes two identical `do caller(1)` calls. Beta.32 reconstructs distinct invocation frames and certifies the repeated calls separately.

### Explicit boundary

Beta.32 does not make the direct-Wasm backend a verified compiler. Remaining proof-free/trust boundaries include:

- runtime capture;
- correctness/completeness of the independent JavaScript validator and invocation-frame reconstruction;
- parser/extractor correctness;
- JavaScript-to-Wasm lowering correctness;
- Wasm engine correctness.

`GeneratedTransitiveCallBodyCertificate.lean` remains the beta.30 runtime-independent exact call-tree certificate. The two beta.32 runtime certificates add observed execution/frame evidence.

## Window semantics

The shared Window preflight supports button `clicked` and input/Checkbox `changed`. Input editing exposes transient event-local `value`; source must perform semantic `change` to persist it. Named Form `open`/`close` is also transient UI lifecycle.

The prebuilt Window player uses `sandbox: true`, context isolation, strict payload validation and a minimal IPC bridge. CI smoke-tests the runtime on Windows, macOS and Linux.

## Direct Wasm

Direct Wasm remains a Console backend for the conservative numeric/control-flow/acyclic-recipe subset. Raw direct Wasm imports Patch's small host ABI and is not yet a standalone WASI command module.

Beta.32 uses this existing backend unchanged.

## Portable C99

Portable C99 covers the conservative numeric Console subset and is compile/run tested on Linux, macOS and FreeBSD 15.1.

## Distribution boundary

macOS Developer ID signing/notarization and polished installers remain future distribution work. Window packages are standalone but are not yet native AppKit, Win32 or portable Unix widget lowering.
