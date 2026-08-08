# Patch Studio

Patch Studio is the browser-first IDE for Patch. The product goal is QuickBASIC/Visual-Basic-style immediacy with one readable Patch source format across browser and desktop targets.

## What works in 0.2 beta.23

Patch Studio provides source editing/local autosave, Console and Window Run, the first Designer toolbox, Change Contract/IR views, portable `.patchapp`, bootstrap/direct Wasm where compatible, Console and **Standalone Window Web App** builds, Windows/macOS/Linux Console and Window builds, and **FreeBSD Console builds through the portable C99 backend**.

Change IR **0.9** carries both ordinary source/range translation-validation evidence and the new guard-validation artifact. These research layers remain optional: a beginner can still just write, Run and Build.

Advanced CLI commands stay outside the ordinary Studio workflow. `patch formal` reports semantic/source/range/**guard** coverage separately. `patch runtime-certify` executes the supported direct-Wasm subset and emits a guard-aware Lean certificate for eligible protected recipes.

## Window builds

A Window project is recognized from normalized Change IR using `code: "WINDOW"`. The shared `src/window-build.js` preflight validates the runtime surface before Web or desktop packaging:

- control ids must be unique;
- an event handler must refer to an existing control;
- the portable event path is currently **button `clicked`**;
- input `changed` and window `closed` are rejected until they are implemented consistently rather than being packaged as dead behavior.

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

The **Standalone Window Web App** backend is differentially tested against `PatchInterpreter`. CI executes the generated single-file HTML runtime and covers sequential operations inside one `change`, declared create types, Thing-field validity and actual button-click rerendering.

## Build matrix

```text
Windows App (.exe)   Console or Window
macOS App (.app)     Console or Window
Linux App            Console or Window
FreeBSD Console      Console only
Standalone Web App   Console or Window
```

Console Web Apps use direct Patch Wasm. Window Web Apps use the generated browser Window runtime. Direct WebAssembly itself remains Console-only.

For desktop cloud builds, Studio performs browser preflight first, then sends the current editor source to GitHub Actions. The target-side Window packager repeats the same runtime-support validation. A fine-grained GitHub token with Actions read/write access is currently required; it is not saved to the project or `localStorage`.

## Guard-aware research assurance

Beta.23 does not change the beginner-facing syntax. It strengthens what can be claimed about eligible protected direct-Wasm recipes. For a recipe such as:

```patch
make reward(bonus number 0..5):
  if bonus > 0:
    change score:
      add bonus
```

Patch separately translation-validates the source/control-flow guard artifact. A runtime certificate then carries the concrete recipe parameter value and proof-free `RuntimePath`; Lean checks that `branchThen` or `branchElse` agrees with actual evaluation of the normalized guard in the supported safe-integer parameter fragment.

This is restricted runtime assurance, not a verified compiler, and it stays invisible during normal Studio use.

## iPhone and iPad

Patch Studio can be installed from Safari with **Share → Add to Home Screen**. It can author/preview Window apps, build local Web/portable artifacts and dispatch supported desktop builds remotely.

## PWA updates

HTML and JavaScript use a versioned network-first strategy with cached offline fallback. The beta.23 cache key is `patch-studio-0.2-beta.23`, so compiler modules such as `formal-guard.js` and `guard-validation.js` update with the release rather than remaining stuck in an older PWA cache.

## Source remains truth

The Designer edits ordinary Patch source rather than a hidden form format:

```patch
window "My App":
  button "Button" as button_1
```

## Next product feature

The next GUI slice is an explicit semantic input event. The intended model is that editing an input supplies an **event-local value**; it does not silently mutate persistent state. Source must still commit persistent state through `change`, for example:

```patch
create text name = ""

window "Hello":
  input name

when name changed:
  change name:
    set = value
```

That preserves State-Change Factorization while making forms useful. Further work includes properties/drag-resize Designer editing, native AppKit/Win32/portable Unix GUI lowering, signing/notarization and a build service that does not require a personal GitHub token.
