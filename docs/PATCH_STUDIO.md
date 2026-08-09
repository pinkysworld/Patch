# Patch Studio

Patch Studio is the browser-first IDE for Patch. The product goal is QuickBASIC/Visual-Basic-style immediacy with one readable Patch source format across browser and desktop targets.

## What works in 0.2 beta.27

Patch Studio provides source editing/local autosave, Console and Window Run, the first Designer toolbox, Change Contract/IR views, portable `.patchapp`, bootstrap/direct Wasm where compatible, Console and **Standalone Window Web App** builds, Windows/macOS/Linux Console and Window builds, and **FreeBSD Console builds through the portable C99 backend**.

Change IR **0.10** is unchanged. Beta.27 extends research certificate coverage rather than beginner-facing syntax, Studio runtime semantics or the IR schema.

Research commands remain outside the ordinary beginner workflow:

```bash
patch formal program.patch
patch certify program.patch
patch runtime-certify program.patch
patch call-certify program.patch
npm run concrete-call-certify:example
npm run arithmetic-call-certify:example
```

The arithmetic command generates a concrete call certificate from `examples/formal-calls-arithmetic.patch`. Lean re-evaluates supported `RangeExpr` argument arithmetic, reconstructs exact positional bindings and checks a direct quantitative leaf effect through the existing caller-signature refinement theorem.

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
Windows App (.exe)   Console or Window
macOS App (.app)     Console or Window
Linux App            Console or Window
FreeBSD Console      Console only
Standalone Web App   Console or Window
```

Console Web Apps use direct Patch Wasm. Window Web Apps use the generated browser Window runtime. Direct WebAssembly remains Console-only.

For cloud desktop builds, Studio performs browser preflight, sends the current source to GitHub Actions, and the target-side packager repeats validation. The current workflow requires a fine-grained GitHub token with Actions read/write permission; Studio does not save it.

## Research assurance layers

Beta.23 provides guard-aware direct-runtime correspondence for an explicit safe-integer fragment. Beta.25 adds abstract acyclic recipe-call interval/signature composition. Beta.26 adds exact positional call binding and direct quantitative leaf-effect refinement.

Beta.27 carries the already mechanized integer `RangeExpr` grammar through the concrete production certificate boundary: literals, variables, addition, subtraction, unary negation and non-negative constant scaling. The generated `GeneratedArithmeticCallCertificate.lean` is checked under pinned Lean.

Division, decimals, variable-by-variable multiplication, root-program concrete calls, arbitrary structured callee-body execution and production-Wasm call equivalence remain outside the concrete certificate claim. These layers are not presented as full compiler verification.

## iPhone and iPad

Patch Studio can be installed from Safari with **Share → Add to Home Screen**. It can author/preview Window apps, build local Web/portable artifacts and dispatch supported desktop builds remotely.

## PWA updates

The beta.27 cache key is `patch-studio-0.2-beta.27`. Beta.27's concrete certificate changes are Node/Lean research tooling, so browser compiler dependencies remain the same. The cache still includes `formal-calls.js`, source/guard compiler modules and `window-events.js` for consistent offline Studio compilation with Change IR 0.10.

## Source remains truth

The Designer edits ordinary Patch source rather than a hidden form format:

```patch
window "My App":
  button "Button" as button_1
```

## Next product work

Next GUI work is richer Designer interaction: control selection/properties, event editing and positioning/resizing while keeping source as truth. Longer-term work includes native AppKit/Win32/portable Unix GUI lowering, signing/notarization and a build service that does not require a personal GitHub token.
