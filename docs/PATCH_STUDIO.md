# Patch Studio

Patch Studio is the browser-first IDE for Patch. The product goal is QuickBASIC/Visual-Basic-style immediacy with one readable Patch source format across browser and desktop targets.

## What works in 0.2 beta.31

Patch Studio provides source editing/local autosave, Console and Window Run, source-backed Designer selection/property editing, Change Contract/IR views, portable `.patchapp`, Web/Wasm builds, Windows/macOS/Linux Console and Window builds, and FreeBSD Console through portable C99.

For Windows, macOS and Linux the default desktop workflow is **Ready app download (no token)**. No personal GitHub token, Node.js, Rust/Cargo or local compiler is required.

Change IR **0.10** is unchanged. Beta.31 is a research assurance extension and does not add a second GUI/state model or alter normal Studio runtime semantics.

Research commands remain outside the beginner workflow:

```bash
npm run transitive-callee-trace-certify:example
npm run transitive-runtime-certify:example
```

`GeneratedTransitiveCallBodyCertificate.lean` is the beta.30 exact call-tree certificate. `GeneratedTransitiveRuntimeCertificate.lean` is the beta.31 certificate generated only after the direct-Wasm example has actually executed and the complete transition trace has passed independent validation.

Beta.31 then asks Lean to re-evaluate the runtime-derived observed semantic-effect list against the beta.30 exact call tree. Runtime capture, independent-validator correctness and scoped-slice attribution remain explicit proof-free boundaries.

## Designer property inspector

The Designer derives selectable controls from Patch source rather than a second form file:

- select Text, Button and Input controls;
- edit source-backed ids/text expressions;
- propagate id renames to matching event headers;
- reject invalid/duplicate ids;
- Delete removes matching event-handler blocks;
- Source jumps to the exact declaration.

Persistent GUI state still changes only through semantic `change`.

## Semantic input events

```patch
create text name = ""
window "Hello":
  input name
when name changed:
  change name:
    set = value
```

`value` is transient event-local data. Editing the input does not persist state by itself.

## Build matrix

```text
Windows App (.exe)   Console or Window   ready download
macOS App (.app)     Console or Window   ready download
Linux App            Console or Window   ready download
FreeBSD Console      Console only        portable C99 path
Standalone Web App   Console or Window   browser-local build
```

Console ready builds are project-specific sealed executables. Window builds use the hardened sandboxed desktop player with a checked source payload.

## Beta.31 assurance in relation to Studio

The ordinary Studio does not need to run Lean or expose beta.31 proof machinery. The research artifact uses the same direct-Wasm compiler/runtime path exercised by Console programs, then performs offline/CI correspondence validation.

For the finite transitive example:

```text
caller -> outer -> middle -> leaf
```

beta.31 independently validates the complete direct-Wasm transition stream, reconstructs the exact scoped semantic effects, accepts the call-tree slice only if it is unique, and generates the Lean certificate.

Repeated indistinguishable scoped traces are not guessed. They fail closed until independent invocation-frame reconstruction is added.

## PWA updates

The beta.31 cache key begins with `patch-studio-0.2-beta.31`. Large OS runtime assets remain on-demand rather than part of the core offline cache.

## Source remains truth

The `.patch` file remains the reviewable representation of behavior and current GUI structure. No hidden persistent Designer model is introduced.

## Next work

Product: drag positioning/resizing, richer controls/events, signing/notarization and eventually native AppKit/Win32/portable Unix widget lowering.

Research: replace beta.31's unique **scoped-slice attribution** with independently reconstructed concrete invocation frames so repeated identical calls can be certified without compiler-emitted trusted call events.
