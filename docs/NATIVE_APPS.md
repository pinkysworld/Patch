# Application builds

Status: **0.2.0-beta.31** · Change IR **0.10**

Patch keeps Console and Window build paths explicit. Beta.31 strengthens research assurance around an actually executed direct-Wasm Console program; it does not change packaging semantics or the Window event contract.

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

## Beta.31 call-aware direct-Wasm assurance

The research artifact can be regenerated with:

```bash
npm run transitive-runtime-certify:example
```

This creates `GeneratedTransitiveRuntimeCertificate.lean` only after:

1. the existing direct-Wasm backend has compiled the transitive recipe example;
2. the real Wasm module has executed;
3. the complete raw transition stream has matched the independent Change-IR execution validator;
4. semantic operation identity and recipe scope have been reconstructed by the independent validator;
5. one exact scoped beta.30 effect sequence has been found unambiguously.

Lean then re-evaluates the runtime-derived observed effect list against the beta.30 call tree using `PatchCallRuntime.lean` and `evalCallTreeStmtEqBool` before caller-signature refinement is derived.

For the depth-2 example:

```text
caller -> outer -> middle -> leaf
```

the observed validated semantic effects are:

```text
leaf   : score increase [4,4]
middle : coins increase [3,3]
```

Repeated identical scoped traces are marked ambiguous and beta.31 refuses certification.

### Explicit boundary

Beta.31 does not make the direct-Wasm backend a verified compiler. Remaining proof-free/trust boundaries include:

- runtime capture;
- correctness/completeness of the independent JavaScript validator;
- **scoped-slice attribution**;
- parser/extractor correctness;
- JavaScript-to-Wasm lowering correctness;
- Wasm engine correctness.

`GeneratedTransitiveCallBodyCertificate.lean` remains the beta.30 runtime-independent exact call-tree certificate. `GeneratedTransitiveRuntimeCertificate.lean` adds the beta.31 observed-runtime bridge.

## Window semantics

The shared Window preflight supports button `clicked` and input `changed`. Input editing exposes transient event-local `value`; source must perform semantic `change` to persist it.

The prebuilt Window player uses `sandbox: true`, context isolation, strict payload validation and a minimal IPC bridge. CI smoke-tests the runtime on Windows, macOS and Linux.

## Direct Wasm

Direct Wasm remains a Console backend for the conservative numeric/control-flow/acyclic-recipe subset. Raw direct Wasm imports Patch's small host ABI and is not yet a standalone WASI command module.

Beta.31 uses this existing backend unchanged. It intentionally does not add compiler-emitted trusted call-enter/call-exit events.

## Portable C99

Portable C99 covers the conservative numeric Console subset and is compile/run tested on Linux, macOS and FreeBSD 15.1.

## Distribution boundary

macOS Developer ID signing/notarization and polished installers remain future distribution work. Window packages are standalone but are not yet native AppKit, Win32 or portable Unix widget lowering.
