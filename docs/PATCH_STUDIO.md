# Patch Studio

Patch Studio is the browser-first IDE for Patch. The product goal is QuickBASIC/Visual-Basic-style immediacy with one readable Patch source format across browser and desktop targets.

## What works in 0.2 beta.24

Patch Studio provides source editing/local autosave, Console and Window Run, the first Designer toolbox, Change Contract/IR views, portable `.patchapp`, bootstrap/direct Wasm where compatible, Console and **Standalone Window Web App** builds, Windows/macOS/Linux Console and Window builds, and **FreeBSD Console builds through the portable C99 backend**.

Change IR **0.9** carries ordinary source/range translation-validation evidence plus the guard-validation artifact introduced in beta.23. Those research layers remain optional: a beginner can still just write, Run and Build.

Advanced CLI commands stay outside the ordinary Studio workflow. `patch formal` reports semantic/source/range/guard coverage separately. `patch runtime-certify` executes the supported direct-Wasm subset and emits a guard-aware Lean certificate for eligible protected recipes.

## Semantic input events

Beta.24 adds the first useful editable input path without creating a hidden persistent assignment mechanism:

```patch
create text name = ""

window "Hello":
  input name
  text "Hello {name}"

when name changed:
  change name:
    set = value
```

When the user edits the control, Patch exposes the current control text as the event-local name `value`. The browser/desktop control edit itself does **not** write `name` in persistent Patch state.

If a handler only runs `show value`, the new input can be observed but Patch state/history remain unchanged. An explicit semantic `change` is required to persist the value. This preserves the same mutation route used by non-GUI Patch code.

Studio uses `src/window-events.js` to route the transient payload. The same semantic contract is implemented by the Standalone Window Web runtime and generated Windows/macOS/Linux desktop Window player.

## Window builds

A Window project is recognized from normalized Change IR using `code: "WINDOW"`. The shared `src/window-build.js` preflight validates the runtime surface before Web or desktop packaging:

- control ids must be unique;
- an event handler must refer to an existing control;
- button `clicked` is supported;
- input `changed` is supported with transient event-local `value`;
- other event/control pairs, including window `closed`, remain rejected until implemented consistently.

Both the Counter button example and the input example above are supported in the current Web/Windows/macOS/Linux Window matrix.

The **Standalone Window Web App** backend is differentially tested against `PatchInterpreter`. CI also executes generated single-file HTML with a fake DOM to verify both input cases: observation without persistent mutation and explicit persistence through `change`.

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

The beta.23 research layer strengthens what can be claimed about eligible protected direct-Wasm recipes. Patch separately translation-validates the supported guard artifact, and Lean checks proof-free branch paths against actual evaluation of concrete safe-integer recipe-parameter guards before composing them with runtime-effect/capability correspondence.

This remains restricted runtime assurance, not a verified compiler, and it stays invisible during normal Studio use.

## iPhone and iPad

Patch Studio can be installed from Safari with **Share → Add to Home Screen**. It can author/preview Window apps, build local Web/portable artifacts and dispatch supported desktop builds remotely.

## PWA updates

HTML and JavaScript use a versioned network-first strategy with cached offline fallback. The beta.24 cache key is `patch-studio-0.2-beta.24`. The cache now includes `window-events.js` as well as the beta.23 formal/guard modules, so the interactive Studio cannot be updated while retaining an older event adapter offline.

## Source remains truth

The Designer edits ordinary Patch source rather than a hidden form format:

```patch
window "My App":
  button "Button" as button_1
```

## Next product work

Next GUI work is richer Designer interaction: control selection/properties, event editing and positioning/resizing while keeping source as truth. Longer-term work includes native AppKit/Win32/portable Unix GUI lowering, signing/notarization and a build service that does not require a personal GitHub token.
