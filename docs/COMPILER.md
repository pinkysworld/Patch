# Patch Compiler Architecture

Status: **0.2.0-beta.23** · Change IR **0.9**

Patch combines a working compiler frontend, semantic Change analysis, independent source/guard translation validation, Lean-checkable static/runtime certificates, direct Wasm/C99 Console backends, Standalone Window Web Apps and cross-platform packaging.

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

`formalSource` is version 0.3. Its existing `source`/range artifact is retained; beta.23 adds a parallel `guardTree`, normalized `guardClaims`, `guardVariables`, and separate guard-support diagnostics.

`guardValidation` is a separate artifact from raw-source control-flow extraction. A program can therefore remain supported by the static SourceStmt/signature/capability path while being outside the stricter guard-aware runtime path.

## Source translation validation

Production:

```text
source -> parser.js -> AST -> formalSource SourceStmt/ranges
```

Independent:

```text
source bytes -> source-validation.js -> raw SourceStmt/ranges
```

Exact agreement is required for supported static certification. This is translation validation, not parser verification.

## Guard translation validation

Production:

```text
AST -> formal-source.js -> GuardTree + normalized guard claims
```

Independent:

```text
source bytes -> guard-validation.js -> independent indentation/control-flow tree
                                     -> normalized guard claims
```

The guard validator does not import `parser.js` or consume the AST. It shares the conservative `formal-guard.js` expression normalizer; the independently checked part is source/control-flow extraction, parameter vocabulary and agreement of normalized claims.

## Guard-aware runtime certificate

`runtime-path-witness.js` records, per protected invocation:

```text
recipe name + invocation index
RuntimePath
effectCount
concrete recipe parameter environment
```

These are proof-free inputs. `runtime-certificate.js` additionally requires both source and guard validation before emitting a beta.23 guarded certificate.

Generated Lean data includes:

```text
SourceStmt
GuardTree
IntEnv with concrete used guard parameters
EvidenceEffect list
RuntimePath
Rule policy list
```

`PatchGuarded.checkGuardedSourceRuntimeEvidence` checks SourceStmt/GuardTree shape, concrete guard truth, RuntimePath, formal execution and effect refinement. `checkedGuardedConcreteRuntimeCannotEscape` composes the accepted guarded execution with the verified Change Capability checker.

## Guard fragment

The current guard-aware compiler/formal bridge deliberately accepts only safe-integer recipe parameters with literals, parameter variables, `+`, `-`, unary minus, scale by a non-negative integer literal, comparisons, Boolean literals and `not/and/or`.

Persistent/global state in guards is not yet bound into `IntEnv`; decimal guard values, division and general multiplication are also rejected at this stronger certification layer.

## Window path

`src/window-build.js` detects normalized `WINDOW` IR and validates the current shared runtime surface. `src/window-webapp.js` creates one self-contained Window HTML app and is differentially tested against `PatchInterpreter`. Desktop Window packages use the generated desktop player. Direct Wasm remains Console-only.

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

Lean checks the supplied guard/path/environment evidence against independently validated formal artifacts, but that does not turn the whole compiler into a verified compiler.

## Quality gates

- Windows/macOS/Linux Node 22/24 tests;
- source/range/guard extraction and tamper tests;
- generated Window Web differential execution tests;
- direct-Wasm differential/trace/effect tests;
- guard-aware runtime certificate generation;
- Lean builds through `PatchGuarded.lean`;
- generated static/runtime certificate checking;
- no `sorry`/`admit`;
- native Windows/macOS/Linux Console + Window smoke builds;
- Linux/macOS/FreeBSD C99 compile/run;
- public Studio/site/version consistency checks.
