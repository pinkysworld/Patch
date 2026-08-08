# Patch Compiler Architecture

Status: **0.2.0-beta.22** · Change IR **0.8**

Patch has a working compiler frontend, semantic Change analysis, independent source translation validation, static/runtime Lean certificates, direct Wasm/C99 Console backends, a **Standalone Window Web App** backend and cross-platform packaging.

## Architecture

```text
exact Patch source
   ├─ production parser / AST ──> Change Signatures / Capabilities
   │                           └─> formalSource / range claims
   └─ independent raw-source parser ────────────────┘ compare
                                      ↓
                               sourceValidation
                                      ↓
                                  Change IR 0.8
          ┌──────────────┬────────────┼───────────┬──────────────┐
       .patchapp      bootstrap     direct       C99         Window Web
                       Wasm          Wasm                    generated runtime
                                      ↓
                              observed transitions
                                      ↓
                          independent effect validation
                                      + untrusted RuntimePath
                                      ↓
                              runtime Lean certificate
```

`sourceValidation` is translation validation, not parser verification. The independent path does not import `parser.js` or consume the production AST.

## Change IR 0.8

```text
instructions
capabilities
changeSignatures
changeCapabilities
formalBridge
formalSource
sourceValidation
```

Persistent semantic mutation is normalized as explicit `CHANGE`; Windows are normalized as `WINDOW`.

## Window build/runtime path

`src/window-build.js` provides normalized Window detection plus shared runtime-support validation. Current portable GUI events are button `clicked`; duplicate control ids, missing control references and other parsed event forms fail before packaging.

```text
Window source
 -> compile
 -> normalized WINDOW preflight
 -> shared runtime-support validation
 -> Window Web or Windows/macOS/Linux desktop player
```

`src/window-webapp.js` builds one self-contained HTML file. Beta.22 hardens its runtime against the reference interpreter: later operations inside a single `change` see prior operations in that same semantic change; declared create types and Thing fields are checked; generated HTML is executed in differential tests.

This backend is **not direct Wasm lowering of GUI instructions**. Direct Wasm remains Console-only.

## Static formal path

```text
formal RangeExpr -> analyzeRange -> rangeAnalysisSound
SourceStmt -> semantic normalization -> EvidenceStmt -> CoreStmt
           -> inferSignature -> verified policy checker
```

`patch certify` emits the static Lean artifact after independent source extraction validation.

## Runtime Lean certificate

`patch runtime-certify` executes the direct-Wasm artifact, independently reconstructs concrete effects and emits proof-free runtime occurrences plus an untrusted `RuntimePath`.

`PatchRuntime.lean` checks:

```text
EffectRefines
RuntimePath
checkSourceRuntimeEvidence
checkSourceRuntimeEvidence_sound
```

Successful checking yields a real `SourceExecutes` trace and ordered `TraceRefines` relation.

Beta.22 adds `PatchRuntimeCapability.lean`:

```text
allowsRefinedEffect
traceRefinesPreservesPolicy
checkedConcreteRuntimeCannotEscape
```

The generated runtime certificate now also contains the declared semantic policy and Lean checks `checkSourceProtected`. Therefore an accepted concrete runtime trace is not only tied to a formal execution: every decoded concrete effect is formally shown to be admitted by the declared Change Capability.

The theorem composes existing mechanisms; it does **not** verify the JavaScript/Wasm compiler.

## Current formal branch boundary

`CoreStmt.branch` currently stores only then/else bodies. Its `Executes` relation is intentionally nondeterministic between `branchThen` and `branchElse`. Thus RuntimePath checking proves structural branch execution but not yet evaluation of the original source Boolean guard.

The next compiler/formal feature is a smaller typed, guard-aware execution core retaining integer/Boolean expressions and a state environment. That core should prove the chosen branch follows guard evaluation, then refine to the existing effect-only core used for signatures.

## Console backends

Direct Wasm supports the conservative numeric Console subset: numeric create/change/show, supported arithmetic/comparisons, `if/else`, literal repeat/count, acyclic numeric recipes and ranged guards. It imports `patch.show_number` and `patch.change_number`; raw direct Wasm is not yet a standalone WASI command.

Portable C99 independently lowers the same conservative subset and is compile/run tested on Linux, macOS and FreeBSD 15.1.

## Trust boundaries

Not machine proved:

```text
production parser correctness
independent raw-source parser correctness
JavaScript -> Wasm lowering correctness
Wasm engine correctness
before/after -> semantic effect reconstruction correctness
RuntimePath producer correctness
source guard -> branch-choice correspondence
full floating-point semantics
full Patch language semantics
```

The untrusted RuntimePath producer is deliberately outside the theorem base; Lean accepts only witnesses structurally valid for the formal core.

## Quality gates

- Windows/macOS/Linux Node 22/24 tests;
- source/evidence/tamper tests;
- generated Window Web execution differential tests;
- real Counter Window Web build;
- runtime certificate generation;
- Lean builds including `PatchRuntime.lean` and `PatchRuntimeCapability.lean`;
- generated static/runtime certificate checking;
- no `sorry`/`admit`;
- native Console/Window platform smoke packages;
- Linux/macOS/FreeBSD C99 compile/run;
- public Studio/site consistency checks.
