# Patch Compiler Architecture

Status: **0.2.0-beta.24** · Change IR **0.9**

Patch combines a working compiler frontend, semantic Change analysis, independent source/guard translation validation, Lean-checkable static/runtime certificates, direct Wasm/C99 Console backends, Standalone Window Web Apps and cross-platform packaging.

Beta.24 does not change Change IR. It strengthens the Window runtime boundary so GUI input cannot become a second persistent-write mechanism.

## Architecture

```text
exact Patch source
   ├─ production parser / AST
   │    ├─ Change Signatures / Capabilities
   │    ├─ SourceStmt + range claims
   │    └─ GuardTree + guard claims
   │
   ├─ independent raw SourceStmt/range parser ----┐
   └─ independent raw GuardTree/control parser ---┤ compare
                                                  ↓
                                      sourceValidation + guardValidation
                                                  ↓
                                           Change IR 0.9
       ┌─────────────┬───────────┬──────────┬────────────┬─────────────┐
    .patchapp     bootstrap    direct      C99       Window Web    certificates
                  Wasm         Wasm                 generated runtime
                                ↓
                       observed transitions
                                ↓
                    independent effect validation
                    + RuntimePath + invocation env
                                ↓
                         PatchGuarded Lean check
```

## Change IR 0.9

```text
instructions
capabilities
changeSignatures
changeCapabilities
formalBridge
formalSource
sourceValidation
guardValidation
```

`formalSource` is version 0.3. Its existing `source`/range artifact is retained; beta.23 added a parallel `guardTree`, normalized `guardClaims`, `guardVariables`, and separate guard-support diagnostics.

`guardValidation` is a separate artifact from raw-source control-flow extraction. A program can therefore remain supported by the static SourceStmt/signature/capability path while being outside the stricter guard-aware runtime path.

## Source and guard translation validation

Production source artifacts originate from the normal AST. Independent `source-validation.js` and `guard-validation.js` reconstruct the supported SourceStmt/range and GuardTree/control-flow views from raw source bytes. Agreement is required at the relevant certification boundary.

This is translation validation, not parser verification. The guard validator shares the conservative `formal-guard.js` expression normalizer; the independently checked part is source/control-flow extraction, parameter vocabulary and agreement of normalized claims.

## Guard-aware runtime certificate

`runtime-path-witness.js` records per protected invocation the recipe/index, RuntimePath, effect count and concrete recipe parameter environment. These remain proof-free inputs.

`PatchGuarded.checkGuardedSourceRuntimeEvidence` checks SourceStmt/GuardTree shape, concrete guard truth, RuntimePath, formal execution and effect refinement. `checkedGuardedConcreteRuntimeCannotEscape` composes accepted guarded execution with the verified Change Capability checker.

The current guard-aware fragment deliberately accepts only safe-integer recipe parameters with the documented integer/Boolean expression subset. Persistent/global state guards, floating-point guard correspondence and general multiplication/division remain outside this stronger certification layer.

## Beta.24 Window event path

`src/window-build.js` detects normalized `WINDOW` IR and validates the shared portable event surface. The accepted pairs are currently:

```text
button + clicked
input  + changed
```

For input events, the current control text is **transient event payload**, not persistent state. Interpreter-backed targets call `src/window-events.js`, which exposes the payload as local `value` to the Patch event body. A source handler must still execute `change` to commit persistent state.

```text
DOM input
   ↓ transient { value }
window-events.js
   ↓ event-local Patch value
when input changed
   ↓ optional explicit change
persistent Patch state/history
```

Patch Studio uses this adapter directly. The generated Windows/macOS/Linux desktop player imports the same adapter. `src/window-webapp.js` creates a self-contained HTML runtime and implements the same rule internally because it intentionally has no external Patch interpreter dependency.

The generated Window Web runtime is version 0.3. Executable fake-DOM tests verify that:

- a handler may observe the new `value` while persistent state remains unchanged;
- `change target: set = value` commits the new value and the rerender then reflects it.

Unsupported event/control pairs still fail during shared Window preflight. Direct Wasm remains Console-only.

## Console backends

Direct Wasm supports the conservative numeric Console subset with control flow, literal repeats, acyclic numeric recipes and ranged guards. It imports the small Patch host ABI; raw direct Wasm is not yet a standalone WASI command.

Portable C99 independently lowers the conservative numeric Console subset and is compile/run tested on Linux, macOS and FreeBSD 15.1.

## Trust boundaries

Not machine proved:

```text
production parser correctness
independent raw source/guard parser correctness
JavaScript -> Wasm lowering correctness
Wasm engine correctness
before/after -> semantic-effect reconstruction correctness
runtime path/environment producer correctness
binding of proof-free invocation values to machine-level Wasm parameters
full floating-point semantics
full Patch language semantics
```

Beta.24's input-event regression tests are implementation evidence that supported GUI input preserves the single semantic persistent-mutation route. They are not a new formal compiler-correctness theorem.

## Quality gates

- Windows/macOS/Linux Node 22/24 tests;
- source/range/guard extraction and tamper tests;
- generated Window Web differential execution tests;
- generated Window Web input fake-DOM tests;
- cross-target Studio/Web/Desktop input-wiring tests;
- direct-Wasm differential/trace/effect tests;
- guard-aware runtime certificate generation;
- Lean builds through `PatchGuarded.lean`;
- generated static/runtime certificate checking;
- no `sorry`/`admit`;
- native Windows/macOS/Linux Console + Window smoke builds;
- Linux/macOS/FreeBSD C99 compile/run;
- public Studio/PWA/site/version consistency checks.
