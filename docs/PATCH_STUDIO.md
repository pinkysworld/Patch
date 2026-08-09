# Patch Studio

Patch Studio is the browser-first IDE for Patch. The product goal is QuickBASIC/Visual-Basic-style immediacy with one readable Patch source format across browser and desktop targets.

## What works in 0.2 beta.29

Patch Studio provides source editing/local autosave, Console and Window Run, the Designer toolbox plus source-backed control selection/property editing, Change Contract/IR views, portable `.patchapp`, bootstrap/direct Wasm where compatible, Console and **Standalone Window Web App** builds, Windows/macOS/Linux Console and Window builds, and **FreeBSD Console builds through the portable C99 backend**.

For Windows, macOS and Linux, the default desktop workflow is **Ready app download (no token)**. Patch Studio performs browser preflight, compiles the Console subset to direct Wasm when needed, loads a stable runtime asset for the selected OS and produces the current project package in the browser. No personal GitHub token, Node.js, Rust/Cargo or local compiler is required.

Console ready builds are project-specific sealed executables. Studio appends the checked direct-Wasm payload and project metadata to the raw runtime executable and emits a project-named `.exe`, Linux executable or macOS `.app`. Window projects use the hardened prebuilt desktop player with a checked source payload.

Change IR **0.10** is unchanged. Beta.29 extends research certificate coverage rather than beginner-facing syntax, Studio runtime semantics or the IR schema.

Research commands remain outside the ordinary beginner workflow:

```bash
patch formal program.patch
patch certify program.patch
patch runtime-certify program.patch
patch call-certify program.patch
npm run concrete-call-certify:example
npm run arithmetic-call-certify:example
npm run callee-trace-certify:example
npm run guarded-callee-trace-certify:example
```

`npm run callee-trace-certify:example` still generates `GeneratedConcreteCallBodyCertificate.lean` from `examples/formal-callee-trace.patch` as the beta.28 regression certificate. `npm run guarded-callee-trace-certify:example` generates `GeneratedGuardedCallBodyCertificate.lean` from `examples/formal-callee-guard.patch`. Lean re-evaluates exact call binding, exact `GuardExpr` branch truth and the selected complete branch/sequence/static-repeat callee effect trace, checks both branch arms against the callee signature and imports the selected trace into the caller signature.

This research machinery is intentionally invisible during normal editing, Run and Build.

## Designer property inspector

The Designer derives selectable controls from parsed Patch source instead of keeping a second form file or hidden GUI model.

- click or keyboard-select Text, Button and Input controls on the Designer canvas;
- inspect the control type and exact source location;
- edit button/input control ids;
- edit Text/Button text expressions directly as Patch expressions;
- Apply writes the changed declaration back to `main.patch`;
- renaming a control id updates matching `when ...` event headers;
- invalid or duplicate control ids are rejected before source is changed;
- Delete removes the control and its associated event-handler blocks;
- Source jumps to the selected declaration in the editor.

Selection uses parsed `(windowIndex, controlIndex)` coordinates, so even Text controls without ids remain selectable without inventing persistent designer metadata.

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

The shared `src/window-build.js` **Window preflight** validates normalized Window IR before Web or desktop packaging:

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

### Ready Console build

```text
current editor source
    -> browser direct-Wasm compilation
    -> raw prebuilt OS runtime binary
    -> append metadata + Wasm + versioned CRC footer
    -> project-named executable/app bundle
    -> ready ZIP download
```

The executable itself contains the project payload. There is no `app.wasm` or `patch-app.json` that the user must keep beside the program. This is intentionally **sealed native packaging**, not a claim that Patch IR is directly lowered to PE/COFF, Mach-O or ELF machine code in the browser.

For macOS, the sealed Console runtime asset is unsigned before browser assembly because changing an already-signed Mach-O would invalidate its code signature. Developer ID signing and notarization remain a distribution concern.

### Ready Window build

```text
current editor source
    -> browser compiler/preflight
    -> prebuilt OS Window runtime template
    -> browser inserts checked Patch source payload
    -> ready ZIP download
```

The generic Window player uses an Electron sandbox with a minimal IPC payload bridge and strict payload validation. CI smoke-tests that sandboxed bridge on Windows, macOS and Linux. `src/prebuilt-native.js` performs sealed Console assembly and Window ZIP customization.

### Advanced build modes

Studio still exposes two advanced alternatives:

- **GitHub Actions cloud build**: builds a project-specific platform package and requires a fine-grained GitHub token with Actions read/write permission. Studio never saves the token.
- **Local toolchain kit**: keeps source local but requires the relevant Node/Rust/C compiler toolchain.

FreeBSD currently uses these advanced paths because a stable prebuilt FreeBSD runtime is not published yet.

## Research assurance layers

Beta.23 provides guard-aware direct-runtime correspondence for an explicit safe-integer fragment. Beta.25 adds abstract acyclic recipe-call interval/signature composition. Beta.26 adds exact positional call binding and direct quantitative leaf-effect refinement. Beta.27 carries the already mechanized integer `RangeExpr` grammar through the concrete production certificate boundary.

Beta.28 adds `PatchCallBody.lean` and `PatchCallBodyImport.lean`. For a deliberately conservative exact-body fragment consisting of direct quantitative emits, sequence and static repeat, Lean evaluates the whole body, validates the proof-free claimed trace and proves every concrete occurrence is represented by the caller semantic signature. `GeneratedConcreteCallBodyCertificate.lean` remains verified as the regression baseline.

Beta.29 extends that **same** `BoundStmt` semantics with a branch constructor. It reuses `GuardExpr`/`evalGuard` from the existing verified guard layer and `envOfBindings` from exact call substitution. The selected branch is determined in Lean under the exact callee bindings, while `BoundBodyCovered` requires both branch arms to be in the callee semantic signature. `GeneratedGuardedCallBodyCertificate.lean` checks both a true and a false branch.

State-dependent guard variables, nested calls, dynamic repeats, complete transitive call trees and production JavaScript/direct-Wasm call equivalence remain outside beta.29. These layers are not presented as full compiler verification.

## iPhone and iPad

Patch Studio can be installed from Safari with **Share → Add to Home Screen**. It can author/preview Window apps and produce the same browser-generated ready-app ZIPs for Windows/macOS/Linux. The downloaded desktop package is run on its target desktop OS, not on iOS.

## PWA updates

The beta.29 cache key begins with `patch-studio-0.2-beta.29`. The Studio cache includes the browser-side native packager, Designer property-inspector stylesheet and source editor helpers together with compiler, formal-call, guard-validation and Window-event modules. Large OS runtime assets are fetched only when a user asks for a native build.

## Source remains truth

The Designer edits ordinary Patch source rather than a hidden form format:

```patch
window "My App":
  button "Button" as button_1
```

Selecting that button and changing its text or id updates this declaration directly. The `.patch` file remains the reviewable, diffable representation of both behavior and current GUI structure.

## Next product work

Next GUI work is drag positioning/resizing, richer controls and event editing while keeping source as truth. Desktop work should focus on signing/notarization, project-specific Window package metadata, and eventually a direct-native AOT backend plus native AppKit/Win32/portable Unix widget lowering. The normal Studio path no longer needs a personal GitHub token or a user-installed build toolchain.
