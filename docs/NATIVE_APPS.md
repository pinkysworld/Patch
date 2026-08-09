# Application builds

Status: **0.2.0-beta.30** · Change IR **0.10**

Patch keeps Console and Window build paths explicit. Direct Wasm is a Console backend; Window Web/Desktop packages use the Window runtime/player path. Beta.30 strengthens research certificate coverage and does **not** change Change IR, packaging semantics or the Window event contract.

## Build matrix

```text
Console
  Web     -> one HTML file with direct Patch Wasm + browser host
  Windows -> project-named .exe with sealed direct-Wasm payload
  macOS   -> project-named .app with sealed executable payload
  Linux   -> project-named executable with sealed direct-Wasm payload
  FreeBSD -> native executable via Portable C99 + FreeBSD 15.1 cc

Window / GUI
  Web     -> Standalone Window Web App with generated browser runtime
  Windows -> ready ZIP with prebuilt desktop player + Patch source payload
  macOS   -> ready ZIP with prebuilt .app desktop player + Patch source payload
  Linux   -> ready ZIP with prebuilt desktop player + Patch source payload
  FreeBSD -> not yet supported
```

For Windows, macOS and Linux, the ordinary Studio path is **Ready app download (no token)**. The platform runtime machine code is compiled ahead of time by the Patch project. Studio validates/compiles the project payload in the browser and produces the final project package without a GitHub token or local Node/Rust/compiler toolchain.

## Sealed project-specific Console binaries

Studio fetches a raw Console runtime for the selected OS, compiles the current Patch Console program to direct Wasm, appends a versioned CRC-checked metadata + Wasm payload to the runtime executable, and creates a project-named package.

```text
Patch Console source in Studio
    -> browser direct-Wasm compilation
    -> fetch raw OS runtime binary
    -> append project metadata + Wasm + sealed footer
    -> Windows: MyApp.exe
       Linux:  MyApp
       macOS:  MyApp.app/Contents/MacOS/MyApp
    -> ZIP for download
```

The runner reads the sealed payload from its own executable. The footer records format version, metadata length, Wasm length and CRC32 values so malformed or corrupted payloads fail closed. Legacy `app.wasm` + `patch-app.json` sidecars remain supported for compatibility with earlier downloads.

This is fresh project-specific executable assembly, not a claim that Patch IR is directly lowered to PE/COFF, Mach-O or ELF machine code in the browser. A future direct-native backend would perform that lowering explicitly.

On macOS, Developer ID signing/notarization remains separate release infrastructure.

## One-click Window packaging

Window projects use the generated desktop player architecture:

```text
Patch Window source in Studio
    -> browser compiler/preflight
    -> fetch prebuilt OS Window runtime ZIP
    -> append checked Patch source payload
    -> download ready ZIP
```

`src/prebuilt-native.js` handles sealed executable assembly for Console projects and ZIP payload injection for Window projects.

The generic runtime packages are built by `.github/workflows/runtime-templates.yml` on actual Windows, macOS and Linux runners. CI executes a sealed Console binary on every target OS. The Window player uses `sandbox: true`, strict payload schema/size validation and a minimal IPC bridge; that sandboxed bridge is exercised on all three target OS families before runtime assets are published.

## Window preflight and semantic events

The shared **Window preflight** validates normalized Window IR before Web or desktop packaging. Current cross-target event support is deliberately conservative:

- button `clicked`;
- input `changed`, with current control text exposed as transient event-local `value`.

The input edit itself does not write persistent Patch state. Source must use ordinary semantic `change` to commit it. Duplicate control ids, missing controls and unsupported event/control pairs are rejected before packaging.

## Browser and WebAssembly

```bash
patch build console.patch --target web --out Console.html
patch build window.patch --target web --out Window.html
patch build console.patch --target wasm-direct --out Console.direct.wasm
```

Console Web Apps embed direct Wasm. A **Standalone Window Web App** embeds the validated Patch Window AST plus a generated browser runtime. Raw direct Wasm is Console-only, imports the small Patch host ABI, and is **not yet a standalone WASI command module**.

## Formal assurance is separate from packaging

Research artifacts are reproducible with:

```bash
npm run concrete-call-certify:example
npm run arithmetic-call-certify:example
npm run callee-trace-certify:example
npm run guarded-callee-trace-certify:example
npm run transitive-callee-trace-certify:example
```

Beta.28/29 establish exact call-free structured and guard-selected callee traces. Beta.30 adds finite nested/transitive exact call-tree traces in `PatchCallTree.lean`.

For the supported beta.30 fragment, Lean independently checks:

- exact outer call binding;
- beta.25 abstract interval fit for concrete outer arguments;
- strict outer call rank decrease;
- every nested `RangeExpr` argument and exact positional binding;
- strict rank decrease at every nested edge;
- exact `GuardExpr` choices and literal/static repeats;
- direct quantitative effects;
- nested body coverage by each callee semantic signature;
- edge-by-edge import into enclosing caller signatures;
- equality of the complete selected transitive trace.

`GeneratedTransitiveCallBodyCertificate.lean` is regenerated in focused beta.30 CI and standard Formal CI. The beta.29 guarded certificate remains regression evidence.

This assurance does **not** alter the trust boundary of the platform runtime. Root-program certification, recursion/cycles, dynamic repeat, persistent-state exact guards, returns and **production JavaScript/direct-Wasm call equivalence** remain outside beta.30.

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

Window packages are standalone but are **not yet native-widget lowering** to AppKit, Win32 or a portable Unix widget layer.

## Portability claim

```text
Linux      Portable C99 tested
macOS      Portable C99 tested
FreeBSD    Portable C99 tested on 15.1
OpenBSD    not yet claimed
NetBSD     not yet claimed
```
