# Patch Studio

Patch Studio is the browser-first IDE for Patch. Its product goal is the immediacy of QuickBASIC and Visual Basic with one readable Patch source format across browser and desktop targets.

## What works in 0.2 beta.21

Patch Studio includes:

- source editor and local autosave;
- Run for Console and Window programs;
- live Patch UI preview and first Designer toolbox;
- Change IR and Change Contract views;
- portable `.patchapp` and bootstrap Wasm artifacts;
- direct Wasm for the supported **Console** subset;
- Standalone Console Web Apps with embedded direct Wasm;
- **Standalone Window Web App** builds with a generated browser Window runtime;
- Windows, macOS and Linux Console and Window/GUI builds initiated directly from Studio;
- **FreeBSD Console builds through the portable C99 backend**;
- responsive phone/tablet layout and installable PWA.

Advanced research commands remain optional. `patch formal` exposes source/formal coverage and `patch runtime-certify` executes supported direct Wasm and creates a Lean-checkable runtime correspondence certificate with explicit branch/repeat path witnesses.

## Beta.21 Window build fix

A normalized Window instruction in Change IR is represented as:

```text
code: "WINDOW"
```

An earlier Studio preflight incorrectly searched for a lower-case `instruction.op`, so a valid program could be rejected with “does not define a Patch window.” Beta.21 moves Window recognition into `src/window-build.js` and validates the actual normalized IR field.

Therefore this program is a valid Window project:

```patch
create number count = 0

window "Counter":
  text "Count: {count}"
  button "Add" as add_button

when add_button clicked:
  change count:
    add 1
```

For Windows, macOS and Linux, Studio now validates the Window and submits the source to the dedicated Window packaging workflow.

## Standalone Window Web Apps

A second beta.21 correction separates Window Web Apps from Console Direct Wasm. The build routes are now:

```text
Console + Standalone Web App
  -> direct Patch Wasm
  -> tiny browser host
  -> one HTML file

Window + Standalone Web App
  -> parsed/validated Patch Window program
  -> generated browser Window runtime
  -> controls + events + semantic changes
  -> one HTML file
```

Window projects therefore no longer fail merely because `WINDOW` is outside the Console-only Direct Wasm execution subset.

`Direct WebAssembly (.wasm)` itself remains Console-only. If it is selected for a Window project, Studio gives a direct compatibility message and recommends Standalone Web App or Windows/macOS/Linux App instead of exposing a lower-level backend error.

## Desktop Build menu

```text
Windows App (.exe)   Console or Window
macOS App (.app)     Console or Window
Linux App            Console or Window
FreeBSD Console      Console only
```

The current editor source is submitted as workflow input and does not have to be committed. Remote targets require a fine-grained GitHub token with Actions read/write access to `pinkysworld/Patch`; Studio keeps the token only in the current page and does not store it in the project or `localStorage`.

### Window preflight and packaging

```text
current Studio source
        ↓
compile -> normalized Change IR
        ↓
Window preflight: code == WINDOW
        ↓
Patch Native Apps workflow
        ↓
Windows / macOS / Linux runner
        ↓
dedicated Window packager + smoke check
        ↓
artifact downloaded by Studio
```

The current desktop player covers `window`, `text`, `button`, `input`, supported events and semantic `change` execution. Packages are standalone, but this is **not yet native-widget lowering** to AppKit, Win32 or GTK.

## FreeBSD Console path

```text
Patch source
    ↓
portable C99 backend
    ↓
FreeBSD 15.1 VM
    ↓
base-system cc -std=c99
    ↓
native FreeBSD executable
```

FreeBSD remains Console-only. The C99 path covers the conservative numeric Console subset with supported state/change/show, arithmetic/conditions, literal repeat/count, acyclic numeric recipes and ranged guards.

## iPhone and iPad

Patch Studio can be installed from Safari with **Share → Add to Home Screen**. Locally it can edit, run/preview, use Designer tools, inspect Changes/IR, build `.patchapp`, bootstrap/direct Wasm where compatible, and build Console or Window single-file Web Apps. With network access and the GitHub build token it can request Windows/macOS/Linux artifacts remotely.

## PWA update behavior

Beta.21 changes same-origin Studio HTML/JavaScript to a **network-first** service-worker strategy with cached fallback. This is specifically intended to reduce stale deployed JavaScript after a new beta while retaining offline operation. The cache key is versioned per beta.

## Source-preserving design

The Designer keeps ordinary Patch source as truth. Adding a button should still produce readable source such as:

```patch
window "My App":
  button "Button" as button_1
```

## Remaining product work

- Designer selection, properties, drag positioning/resizing and richer controls;
- stronger two-way input binding and event editing;
- native AppKit/Win32 and portable Unix GUI lowering instead of the current player;
- FreeBSD Window packaging and separately tested OpenBSD/NetBSD targets;
- Windows signing, macOS Developer ID/notarization and installers;
- optional build service so end users do not need a personal GitHub token.
