# Patch Studio

Patch Studio is the browser-first IDE for Patch. The product goal is QuickBASIC/Visual-Basic-style immediacy with one readable Patch source format across browser and desktop targets.

## What works in 0.2 beta.22

Patch Studio provides source editing/local autosave, Console and Window Run, the first Designer toolbox, Change Contract/IR views, portable `.patchapp`, bootstrap/direct Wasm where compatible, Console and **Standalone Window Web App** builds, Windows/macOS/Linux Console and Window builds, and **FreeBSD Console builds through the portable C99 backend**.

Advanced research commands stay outside the beginner workflow. `patch formal` reports source/formal coverage; `patch runtime-certify` executes supported direct Wasm and emits Lean-checkable runtime correspondence/capability evidence.

## Window builds and review hardening

A Window project is recognized from normalized Change IR using `code: "WINDOW"`. The shared `src/window-build.js` preflight now also validates the runtime surface before Web or desktop packaging:

- control ids must be unique;
- an event handler must refer to an existing control;
- the portable beta event path is currently **button `clicked`**;
- parsed but not consistently wired events such as input `changed` or window `closed` are rejected instead of being shipped as dead behavior.

This example is supported everywhere in the current Window matrix:

```patch
create number count = 0

window "Counter":
  text "Count: {count}"
  button "Add" as add_button

when add_button clicked:
  change count:
    add 1
```

The **Standalone Window Web App** backend is differentially tested against the reference interpreter. The tests execute the generated single-file HTML runtime and cover sequential operations within one `change`, declared create types, Thing-field validity and actual button-click rerendering.

## Build matrix

```text
Windows App (.exe)   Console or Window
macOS App (.app)     Console or Window
Linux App            Console or Window
FreeBSD Console      Console only
Standalone Web App   Console or Window
```

Console Web Apps use direct Patch Wasm. Window Web Apps use the generated browser Window runtime. Direct WebAssembly itself remains Console-only.

For desktop cloud builds, Studio performs browser preflight first, then sends the current editor source to GitHub Actions. The target-side Window packager repeats the shared runtime-support validation before packaging. A fine-grained GitHub token with Actions read/write access is currently required; it is not saved to the project or `localStorage`.

## iPhone and iPad

Patch Studio can be installed from Safari with **Share → Add to Home Screen**. It can author/preview Window apps, build local Web/portable artifacts and dispatch supported desktop builds remotely.

## PWA updates

HTML and JavaScript use a versioned network-first strategy with cached offline fallback. The beta.22 cache key is `patch-studio-0.2-beta.22`, reducing stale deployed Studio code after releases.

## Source remains truth

The Designer edits ordinary Patch source rather than a hidden proprietary form format:

```patch
window "My App":
  button "Button" as button_1
```

## Next product features

The next GUI feature should give `input` an explicit semantic event value without bypassing State-Change Factorization—for example, an event-local value that source must commit through `change`. Further work includes properties/drag-resize Designer editing, native AppKit/Win32/portable Unix GUI lowering, FreeBSD Window packaging, signing/notarization and a build service that does not require a personal GitHub token.
