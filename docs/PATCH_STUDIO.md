# Patch Studio

Patch Studio is the browser-first IDE for Patch. The product goal is QuickBASIC/Visual-Basic-style immediacy with one readable Patch source format across browser and desktop targets.

## What works in 0.2 beta.28

Patch Studio provides source editing/local autosave, Console and Window Run, the first Designer toolbox, Change Contract/IR views, portable `.patchapp`, bootstrap/direct Wasm where compatible, Console and **Standalone Window Web App** builds, Windows/macOS/Linux Console and Window builds, and **FreeBSD Console builds through the portable C99 backend**.

For Windows, macOS and Linux, the default desktop workflow is now **Ready app download (no token)**. Patch Studio performs the relevant browser preflight, compiles the Console subset to direct Wasm when needed, loads a prebuilt generic runtime for the selected OS and inserts the current project payload into that runtime package in the browser. The downloaded ZIP is ready to unzip and run. No personal GitHub token, Node.js, Rust/Cargo or local compiler is required.

Change IR **0.10** is unchanged. Beta.28 extends research certificate coverage rather than beginner-facing syntax, Studio runtime semantics or the IR schema.

Research commands remain outside the ordinary beginner workflow:

```bash
patch formal program.patch
patch certify program.patch
patch runtime-certify program.patch
patch call-certify program.patch
npm run concrete-call-certify:example
npm run arithmetic-call-certify:example
npm run callee-trace-certify:example
```

`npm run callee-trace-certify:example` generates `GeneratedConcreteCallBodyCertificate.lean` from `examples/formal-callee-trace.patch`. Lean re-evaluates exact call binding and the complete supported sequence/static-repeat callee effect trace, checks the trace against the callee signature and imports it into the caller signature.

This research machinery is intentionally invisible during normal editing, Run and Build.

## Semantic input events

Editable inputs preserve Patch's explicit persistent mutation route:

```patch
create text name = ""
window "Hello":
  input name
when name changed:
  change name:
    set = value
```

The current control text is event-local `value`. The browser/desktop edit does **not** write persistent Patch state by itself. Source must execute ordinary semantic `change` to commit it.

Studio uses `src/window-events.js`; the standalone Window Web runtime and generated Windows/macOS/Linux desktop player implement the same contract. Generated HTML is executed in regression tests to distinguish observation-only input from explicit persistence.

## Window builds

The shared `src/window-build.js` preflight validates normalized Window IR before Web or desktop packaging:

- control ids must be unique;
- handlers must refer to existing controls;
- button `clicked` is supported;
- input `changed` is supported with transient `value`;
- unsupported control/event combinations remain rejected.

## Build matrix

```text
Windows App (.exe)   Console or Window   ready download in Studio
macOS App (.app)     Console or Window   ready download in Studio
Linux App            Console or Window   ready download in Studio
FreeBSD Console      Console only        local/cloud build path
Standalone Web App   Console or Window   browser-local build
```

Console Web Apps use direct Patch Wasm. Window Web Apps use the generated browser Window runtime. Direct WebAssembly remains Console-only.

### Ready app download

The default Windows/macOS/Linux path does not start a per-project remote build:

```text
current editor source
    -> browser preflight
    -> Console: direct Wasm payload
       Window: validated Patch source payload
    -> prebuilt OS runtime template
    -> browser inserts payload into runtime ZIP
    -> ready-to-run download
```

The prebuilt runtime templates are built and smoke-tested on Windows, macOS and Linux by `.github/workflows/runtime-templates.yml`, then published as stable project runtime assets and copied into the Patch Studio Pages deployment. `src/prebuilt-native.js` customizes the ZIP without decompressing or recompiling the runtime.

This keeps user source out of GitHub Actions for the default path. The generic desktop runtime name is currently visible inside the downloaded package; the project name is carried in the payload and used by the running app. App signing/notarization and project-specific outer package naming remain later polish work.

### Advanced build modes

Studio still exposes two advanced alternatives:

- **GitHub Actions cloud build**: builds a project-specific platform package and requires a fine-grained GitHub token with Actions read/write permission. Studio never saves the token.
- **Local toolchain kit**: keeps source local but requires the relevant Node/Rust/C compiler toolchain.

FreeBSD currently uses these advanced paths because a stable prebuilt FreeBSD runtime is not published yet.

## Research assurance layers

Beta.23 provides guard-aware direct-runtime correspondence for an explicit safe-integer fragment. Beta.25 adds abstract acyclic recipe-call interval/signature composition. Beta.26 adds exact positional call binding and direct quantitative leaf-effect refinement. Beta.27 carries the already mechanized integer `RangeExpr` grammar through the concrete production certificate boundary.

Beta.28 adds `PatchCallBody.lean` and `PatchCallBodyImport.lean`. For a deliberately conservative exact-body fragment consisting of direct quantitative emits, sequence and static repeat, Lean evaluates the whole body, validates the proof-free claimed trace and proves every concrete occurrence is represented by the caller semantic signature.

The generated `GeneratedConcreteCallBodyCertificate.lean` checks a real `caller -> award` example where `award` emits one score effect and two repeated coin effects.

Branches/guard choices, nested calls, dynamic repeats, complete transitive call trees and production JavaScript/direct-Wasm call equivalence remain outside beta.28. These layers are not presented as full compiler verification.

## iPhone and iPad

Patch Studio can be installed from Safari with **Share → Add to Home Screen**. It can author/preview Window apps and produce the same browser-generated ready-app ZIPs for Windows/macOS/Linux. The downloaded desktop package is of course run on its target desktop OS, not on iOS.

## PWA updates

The beta.28 cache key begins with `patch-studio-0.2-beta.28`. The Studio cache includes the browser-side prebuilt native packager together with compiler, formal-call, guard-validation and Window-event modules. The large OS runtime ZIPs are fetched only when a user asks for a native build rather than being forced into the offline PWA cache.

## Source remains truth

The Designer edits ordinary Patch source rather than a hidden form format:

```patch
window "My App":
  button "Button" as button_1
```

## Next product work

Next GUI work is richer Designer interaction: control selection/properties, event editing and positioning/resizing while keeping source as truth. Desktop packaging work should focus on project-specific outer package naming, signing/notarization and eventually native AppKit/Win32/portable Unix widget lowering. The normal Studio path no longer needs a personal GitHub token or a user-installed build toolchain.