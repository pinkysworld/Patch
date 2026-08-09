# Application builds

Status: **0.2.0-beta.32** · Change IR **0.10**

Patch keeps Console and Window build paths explicit. Beta.32 strengthens research assurance around actually executed direct-Wasm Console programs; it does not change packaging semantics or the Window event contract.

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
  Windows -> ready packaged desktop player
  macOS   -> ready .app desktop player
  Linux   -> ready packaged desktop player
  FreeBSD -> not yet supported
```

Windows/macOS/Linux ordinary Studio builds are **Ready app download (no token)**. Console apps use sealed project-specific executables. Window apps use the hardened sandboxed desktop player.

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

The shared Window preflight supports button `clicked` and input `changed`. Input editing exposes transient event-local `value`; source must perform semantic `change` to persist it.

The prebuilt Window player uses `sandbox: true`, context isolation, strict payload validation and a minimal IPC bridge. CI smoke-tests the runtime on Windows, macOS and Linux.

## Direct Wasm

Direct Wasm remains a Console backend for the conservative numeric/control-flow/acyclic-recipe subset. Raw direct Wasm imports Patch's small host ABI and is not yet a standalone WASI command module.

Beta.32 uses this existing backend unchanged.

## Portable C99

Portable C99 covers the conservative numeric Console subset and is compile/run tested on Linux, macOS and FreeBSD 15.1.

## Distribution boundary

macOS Developer ID signing/notarization and polished installers remain future distribution work. Window packages are standalone but are not yet native AppKit, Win32 or portable Unix widget lowering.
