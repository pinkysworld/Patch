# Patch Compiler Architecture

Status: **0.2.0-beta.25** · Change IR **0.10**

Patch combines a working compiler frontend, semantic Change analysis, independent source/guard translation validation, Lean-checkable static/runtime/call certificates, direct Wasm/C99 Console backends, Standalone Window Web Apps and cross-platform packaging.

## Architecture

```text
exact Patch source
   ├─ production parser / AST
   │    ├─ Change Signatures / Capabilities
   │    ├─ SourceStmt + ranges + GuardTree
   │    └─ finite formalCalls recipe environment
   │
   ├─ independent raw SourceStmt/range parser ----┐
   └─ independent raw GuardTree/control parser ---┤ compare
                                                  ↓
                                      sourceValidation + guardValidation
                                                  ↓
                                           Change IR 0.10
       ┌─────────────┬───────────┬──────────┬────────────┬─────────────┐
    .patchapp     bootstrap    direct      C99       Window Web    certificates
                  Wasm         Wasm                 generated runtime
                                ↓                              ├─ static
                       observed transitions                   ├─ runtime/guard
                                ↓                              └─ formal calls
                    independent effect validation
                    + RuntimePath + invocation env
                                ↓
                         PatchGuarded Lean check
```

## Change IR 0.10

```text
instructions
capabilities
changeSignatures
changeCapabilities
formalBridge
formalSource
formalCalls
sourceValidation
guardValidation
```

`formalCalls` version 0.1 is a separate assurance artifact rather than an extension of the older SourceStmt semantics. This preserves the claim boundary: beta.25 does not pretend the existing source/runtime theorem already models recipe calls.

## Source and guard assurance

Production source/guard artifacts originate from the normal AST. Independent `source-validation.js` and `guard-validation.js` reconstruct the supported SourceStmt/range and GuardTree/control-flow views from raw source bytes. Agreement is required at the relevant certification boundary.

`PatchGuarded` checks proof-free branch paths against normalized guards over concrete safe-integer recipe-parameter environments and composes accepted runtime effects with Change Capabilities. This remains separate from the beta.25 static/interprocedural call layer.

## Beta.25 `formalCalls`

`src/formal-calls.js` takes the production AST and semantic Change Signatures and emits a conservative per-recipe representation:

```text
recipe name
parameter intervals
rank
semantic signature
CallStmt body
support diagnostics
```

The call body vocabulary is intentionally small:

```text
skip
emit semantic-effect
seq
branch
literal repeat
call name argument-intervals
```

The producer requires bounded safe-integer formal parameters, argument expressions supported by the existing formal integer range fragment, concrete formal semantic effects and a rank-decreasing acyclic call graph. Unknown calls, duplicate recipes, recursion/cycles, unbounded parameters, returns and other unsupported body constructs are reported as outside the beta.25 call layer.

The JavaScript artifact is **not trusted as a proof**. `src/call-certificate.js` encodes it into a generated Lean `RecipeEnv`.

## `PatchCalls` checker

The Lean module `PatchCalls.lean`, stored at `formal/PatchCalls.lean`, defines:

```text
CallStmt
RecipeDef
RecipeEnv
ArgsFit / argsFitBool_sound
effectMemberBool / signatureCoversBool
BodyComposes / checkCallStmt_sound
checkRecipeEnv / checkRecipeEnv_sound
CallExec
callSignatureSoundness
checkedRecipeExecutionCannotEscape
```

For each call, the executable checker independently verifies:

```text
callee exists
callee.rank < caller.rank
actual argument intervals fit callee parameter intervals
callee.signature ⊆ caller.signature
```

Direct emitted effects must also occur in the caller signature.

The production-generated `GeneratedCallCertificate.lean` requires:

```text
checkRecipeEnv callEnv = true
```

and Formal CI proves it with `native_decide`. The same generated file derives `EnvironmentChecked callEnv` through `checkRecipeEnv_sound`.

`callSignatureSoundness` is stronger than the checker statement alone: for a modeled `CallExec`, every effect in the resulting trace remains inside the caller semantic signature.

## Exact call boundary

Beta.25 proves abstract interprocedural composition over intervals and semantic signatures. It does **not** yet prove:

```text
caller expression -> exact concrete integer
exact integer -> callee parameter binding
callee body under that concrete environment -> production runtime execution
```

Those concrete substitution/binding steps are the next formal refinement. Recursive recipes, floating-point parameter correspondence, dynamic loops and the wider language also remain outside the call theorem.

## CLI boundary

The installed `patch` command uses `src/cli-entry.js`, a thin dispatcher. Existing commands delegate unchanged to the mature `src/cli.js`; only the new research command is handled by the dispatcher:

```bash
patch call-certify examples/formal-calls.patch --out Calls.patchcert.lean
```

This avoids a broad rewrite of the existing CLI solely to expose the new certificate path.

## Beta.24 Window event path

The shared Window preflight supports button `clicked` and input `changed`. Input control editing supplies transient event-local `value`; persistent Patch state still changes only through an explicit semantic `change`. Studio, Standalone Window Web and generated Windows/macOS/Linux players implement the same contract.

## Console backends

Direct Wasm supports the conservative numeric Console subset with control flow, literal repeats, acyclic numeric recipes and ranged guards. It imports a small Patch host ABI; raw direct Wasm is not yet a standalone WASI command.

Portable C99 independently lowers the conservative numeric Console subset and is compile/run tested on Linux, macOS and FreeBSD 15.1.

## Trust boundaries

Not machine proved:

```text
production parser correctness
independent raw source/guard parser correctness
formalCalls JavaScript extractor correctness
JavaScript -> Wasm lowering correctness
Wasm engine correctness
before/after -> semantic-effect reconstruction correctness
runtime path/environment producer correctness
concrete call argument binding/substitution correspondence
full floating-point semantics
full Patch language semantics
```

`formalCalls` is therefore treated as proof-free certificate data: the executable Lean checker accepts or rejects the generated finite environment.

## Quality gates

- Windows/macOS/Linux Node 22/24 tests;
- formalCalls positive/negative/cycle/duplicate tests;
- CLI-dispatch and call-certificate tests;
- generated static/runtime/call certificate generation;
- `PatchCalls` and all previous Lean modules under pinned Lean;
- generated `GeneratedCallCertificate.lean` checked with `native_decide`;
- no `sorry`/`admit`;
- direct-Wasm/C99/Window build and execution gates;
- native Windows/macOS/Linux Console + Window smoke builds;
- Linux/macOS/FreeBSD C99 compile/run;
- public Studio/PWA/site/version consistency checks.
