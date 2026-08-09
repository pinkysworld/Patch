# Patch Studio

Patch Studio is the browser-first IDE for Patch. The product goal is QuickBASIC/Visual-Basic/Delphi-style immediacy with one readable Patch source format across browser and desktop targets.

## What works in 0.2 beta.32

Patch Studio provides source editing/local autosave, Console and Window Run, source-backed Designer selection/property editing, source-backed Form layout with drag/resize, Change Contract/IR views, portable `.patchapp`, Web/Wasm builds, Windows/macOS/Linux Console and Window builds, and FreeBSD Console through portable C99.

For Windows, macOS and Linux the default desktop workflow is **Ready app download (no token)**. No personal GitHub token, Node.js, Rust/Cargo or local compiler is required.

Change IR **0.10** is unchanged. Beta.32 is a research assurance extension and does not alter normal Studio runtime semantics. Form geometry is UI/source metadata rather than a new persistent-mutation semantics claim.

Research commands remain outside the beginner workflow:

```bash
npm run transitive-callee-trace-certify:example
npm run transitive-runtime-certify:example
npm run transitive-runtime-certify:repeated
```

`GeneratedTransitiveCallBodyCertificate.lean` is the beta.30 exact call-tree certificate. `GeneratedTransitiveRuntimeCertificate.lean` is the single-call runtime certificate. `GeneratedRepeatedTransitiveRuntimeCertificate.lean` exercises repeated identical invocation-frame correspondence.

## Beta.32 invocation-frame assurance

The ordinary Studio does not need Lean or expose beta.32 proof machinery. The research artifact uses the same direct-Wasm compiler/runtime path exercised by Console programs, then performs offline/CI correspondence validation.

The direct-Wasm backend is unchanged and emits no trusted call-enter/call-exit markers. The independent Change-IR validator reconstructs concrete invocation frames containing caller/callee identity, dynamic invocation ordinal, parent/depth information, exact arguments/bindings and transition ranges.

For each accepted beta.30 call witness, beta.32 selects observed effects by concrete frame identity. The generated Lean certificate then checks:

```text
independently reconstructed frame BindingList
=
beta.30 exact callee BindingList
```

and re-evaluates the frame-selected observed semantic effects against the beta.30 exact call tree.

`examples/formal-transitive-calls-repeated.patch` contains two identical `do caller(1)` invocations. Beta.32 certifies them as separate invocation frames instead of rejecting them as beta.31 ambiguity.

Runtime capture and independent-validator/invocation-frame reconstruction correctness remain explicit proof-free boundaries.

## Forms and RAD-style Designer

Patch now has a source-backed Form layout path intended to provide the productive visual workflow associated with classic Delphi and Visual Basic while keeping Patch source as the reviewable truth.

A form can carry an explicit design size:

```patch
window "Customer editor" size 640, 420:
```

Controls can carry position and dimensions:

```patch
window "Customer editor" size 640, 420:
  text "Customer name" at 24, 24 size 180, 30
  input customer_name at 24, 64 size 260, 36
  button "Save" as save_button at 24, 116 size 120, 36
```

In Studio:

- select the active Form from the Form selector;
- create additional blank Forms with **+ Form**;
- edit source-backed Form title, width and height;
- add Text, Button and Input controls to the selected Form;
- select a control and edit X, Y, width and height in Properties;
- drag a selected control directly on the Form;
- resize it from the bottom-right handle;
- every visual edit rewrites the corresponding declaration in `main.patch`;
- Standalone Window Web builds and Windows/macOS/Linux Window players preserve the same geometry.

Legacy flow-layout source remains valid. A project is not required to use explicit pixel geometry.

There is deliberately no hidden `.dfm`, `.frm` or second persistent form document. Future richer Form metadata should follow the same rule unless a separate artifact can be losslessly and visibly derived from Patch source.

## Designer property inspector

The Designer derives selectable controls from Patch source rather than a second form file:

- select Text, Button and Input controls;
- edit source-backed ids/text expressions;
- propagate id renames to matching event headers;
- edit X/Y/width/height for positioned controls;
- reject invalid/duplicate ids and invalid geometry;
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

Console ready builds are project-specific sealed executables. Window builds use the hardened sandboxed desktop player with a checked source payload. The desktop player parses the same source-backed Form geometry and applies it after each UI render.

## PWA updates

The beta.32 Forms cache key begins with `patch-studio-0.2-beta.32-forms1`. Large OS runtime assets remain on-demand rather than part of the core offline cache.

## Source remains truth

The `.patch` file remains the reviewable representation of behavior and current GUI structure. Form dimensions and control geometry live in that same source. No hidden persistent Designer model is introduced.

## Next work

Product: richer controls/events such as Checkbox, List, Combo, tabs, menus, dialogs and table/grid; project tree/source files; alignment guides, anchors/docking and multi-select; project import/export; signing/notarization; eventually native AppKit/Win32/portable Unix widget lowering.

Research: controlled overhead measurements, systematic related work, broader application/security corpus, reproducibility, and further reduction of parser/lowering/runtime trust boundaries without overstating full verification.
