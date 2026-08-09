# Patch Studio

Patch Studio is the browser-first IDE for Patch. The product goal is QuickBASIC/Visual-Basic-style immediacy with one readable Patch source format across browser and desktop targets.

## What works in 0.2 beta.26

Patch Studio provides source editing/local autosave, Console and Window Run, the first Designer toolbox, Change Contract/IR views, portable `.patchapp`, bootstrap/direct Wasm where compatible, Console and **Standalone Window Web App** builds, Windows/macOS/Linux Console and Window builds, and **FreeBSD Console builds through the portable C99 backend**.

Change IR **0.10** remains unchanged from beta.25. The compiler still carries `formalCalls` alongside source/range/guard assurance artifacts. Beta.26 adds a separate concrete-call certificate path rather than expanding beginner-facing syntax or the IR schema.

Research commands remain outside the ordinary beginner workflow:

```bash
patch formal program.patch
patch certify program.patch
patch runtime-certify program.patch
patch call-certify program.patch
npm run concrete-call-certify:example
```

The beta.26 concrete-call certificate re-evaluates supported safe-integer inter-recipe variable arguments in Lean, checks exact positional parameter binding and, for a conservative direct quantitative leaf Change, proves the exact bound effect refines an effect represented by the caller semantic signature.

This research layer is intentionally invisible during normal editing/running/building.

## Semantic input events

Editable inputs preserve Patch's explicit persistent mutation route:

```patch
create text name = ""

window "Hello":
  input name
  text "Hello {name}"

when name changed:
  change name:
    set = value
```

The current control text is event-local `value`. The browser/desktop edit does **not** write persistent Patch state by itself. Source must execute an ordinary semantic `change` to commit it.

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
Windows App (.exe)   Console or Window
macOS App (.app)     Console or Window
Linux App            Console or Window
FreeBSD Console      Console only
Standalone Web App   Console or Window
```

Console Web Apps use direct Patch Wasm. Window Web Apps use the generated browser Window runtime. Direct WebAssembly remains Console-only.

For cloud desktop builds, Studio performs browser preflight, sends the current source to GitHub Actions, and the target-side packager repeats validation. The current workflow requires a fine-grained GitHub token with Actions read/write permission; Studio does not save it.

## Research assurance layers

The beta.23 guard-aware layer checks eligible direct-Wasm branch witnesses against normalized source guards and concrete safe-integer recipe parameter environments before composing runtime effects with Change Capabilities.

Beta.25 adds abstract acyclic recipe-call interval/signature composition through `formalCalls` and `PatchCalls.lean`.

Beta.26 adds `PatchCallSubstitution.lean`, `PatchCallRefinement.lean` and `PatchCallEffect.lean`. The supported concrete subset is inter-recipe variable pass-through binding plus direct quantitative leaf-effect refinement. Root-program concrete calls, richer arithmetic substitution, arbitrary callee-body execution and production-Wasm call equivalence remain outside the theorem.

These layers do not alter normal Studio syntax and are not presented as full compiler verification.

## iPhone and iPad

Patch Studio can be installed from Safari with **Share → Add to Home Screen**. It can author/preview Window apps, build local Web/portable artifacts and dispatch supported desktop builds remotely.

## PWA updates

The beta.26 cache key is `patch-studio-0.2-beta.26`. The browser compiler dependencies remain the same because beta.26's concrete-call certificate modules are Node/Lean research tooling rather than Studio runtime imports. The cache continues to include `formal-calls.js`, source/guard compiler modules and `window-events.js` for consistent offline Studio compilation with Change IR 0.10.

## Source remains truth

The Designer edits ordinary Patch source rather than a hidden form format:

```patch
window "My App":
  button "Button" as button_1
```

## Next product work

Next GUI work is richer Designer interaction: control selection/properties, event editing and positioning/resizing while keeping source as truth. Longer-term work includes native AppKit/Win32/portable Unix GUI lowering, signing/notarization and a build service that does not require a personal GitHub token.
