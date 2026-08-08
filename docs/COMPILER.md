# Patch Compiler Architecture

Status: **0.2.0-beta.18** · Change IR **0.7**

Patch has a working compiler front end, semantic Change analysis, formal-evidence extraction, two executable Console backends, browser/native packaging, and a separate Window/GUI packaging path.

## Architecture at a glance

```text
Patch source
   |
   v
JavaScript parser / AST
   |
   +--> production Change Signature analysis
   |       `--> Change Capability validation
   |
   +--> independent formal-range extractor -> RangeExpr
   +--> formal-source extractor            -> SourceStmt
   +--> semantic formal bridge              -> Evidence view
   |
   v
Change IR 0.7
   |
   +--> .patchapp                         implemented
   +--> bootstrap Wasm carrier            implemented
   +--> direct numeric Wasm               implemented
   +--> portable C99                      implemented beta.18
   +--> standalone Web App                implemented
   +--> native Console hosts              Windows/macOS/Linux
   +--> desktop Window player             Windows/macOS/Linux
   `--> Lean certificate                  supported formal fragment
```

## Why Change IR matters

Patch does not perform an ordinary persistent assignment and then attach a log record. `change` is the source mutation primitive and `CHANGE` remains explicit in IR.

```patch
change score:
  add 1
```

conceptually remains:

```json
{
  "code": "CHANGE",
  "target": "score",
  "operations": [{ "op": "add", "expr": "1" }]
}
```

The same semantic representation feeds execution, history, inverse generation, provenance, Change Contracts, formal evidence and compiled backends.

## Formal-assurance path

The production implementation deliberately keeps several claims separate:

```text
src/change-analysis.js  -> production Change Signature
src/formal-range.js     -> independent RangeExpr + interval reconstruction
src/formal-source.js    -> source mutation vocabulary
src/formal-bridge.js    -> independent semantic evidence view
```

For the supported certificate fragment, Lean checks:

```text
RangeExpr + environment
   -> analyzeRange
   -> rangeAnalysisSound

SourceStmt
   -> semantic normalization
   -> EvidenceStmt equality
   -> CoreStmt decoding
   -> formal inferSignature
   -> compare production signature claim
   -> verified semantic policy check
```

This does not yet prove the complete JavaScript frontend or runtime equivalent to the formal model.

## WebAssembly targets

Patch keeps bootstrap and direct compilation distinct.

### Bootstrap carrier

```bash
patch build app.patch --target wasm
```

```text
Patch source -> Change IR -> payload inside Wasm -> Patch host/interpreter
```

### Direct execution

```bash
patch build app.patch --target wasm-direct
```

```text
Patch source -> Change IR -> direct lowering -> Wasm instructions
```

The direct target never silently falls back to the interpreter.

Current direct numeric Console support:

```text
top-level numeric create
numeric set/add/remove/clear
numeric show
+ - * /
comparisons / booleans
if / else
literal repeat + 1-based count
non-recursive / acyclic numeric recipes
ranged numeric parameter guards
block-level change transition callback
```

The Wasm module exports `run()` and numeric state globals, and imports:

```text
patch.show_number(f64)
patch.change_number(i32 targetId, f64 before, f64 after)
```

A raw direct module is executable Wasm but is not yet a standalone WASI command.

## Portable C99 backend

Beta.18 adds:

```bash
patch build app.patch --target c99 --out App.c
```

The implementation in `src/c99.js` first asks the direct-Wasm compiler to enforce the conservative compiled-Console support boundary, then independently lowers the normalized Change IR into C99.

```text
Patch source
   -> normal compiler / Change IR
   -> direct-subset validation
   -> independent C99 lowering
   -> system C compiler
   -> native Unix executable
```

It supports the same current numeric Console concepts: persistent numeric state, semantic changes, numeric output, supported expressions/conditions, literal loops, acyclic numeric recipes and ranged runtime guards.

Generated numeric literals are forced into C floating-point semantics so `1 / 2` does not accidentally become C integer division. Each supported `CHANGE` block also keeps a `patch_change_number(target,before,after)` hook in the generated C source.

C99 compile/run gates currently exist on:

```text
Linux
macOS
FreeBSD 15.1
```

FreeBSD uses its base-system `cc` under `.github/workflows/freebsd-c99.yml`. OpenBSD and NetBSD are not claimed until equivalent compile/run gates exist.

## Recipes and range guards

For:

```patch
allow reward:
  score may increase up to 10

make reward(bonus number 0..5):
  change score:
    add bonus * 2
```

normal Patch compilation first checks the semantic Change Signature against the capability.

The direct Wasm function preserves the `0..5` range at its function boundary. The C99 recipe emits a corresponding runtime condition and exits with an explicit range error before the recipe body if the value is outside the declared interval.

These runtime guards complement static analysis; they are not a proof of backend correctness.

## Independent direct-Wasm validation

The production interpreter and Wasm lowerer are not the only comparison path.

The direct validator independently executes the supported Change IR subset and reconstructs:

```text
ordered state transitions
concrete increase/decrease/set/clear effects
concrete magnitudes
```

Observed direct-Wasm transitions are compared with that independent model, then concrete effects are checked against static Change Signatures and protected Change Capabilities.

See [DIRECT_TRACE_VALIDATION.md](DIRECT_TRACE_VALIDATION.md) and [DIRECT_EFFECT_VALIDATION.md](DIRECT_EFFECT_VALIDATION.md).

This is translation/runtime validation evidence, not a compiler-correctness theorem.

## Application packaging

### Browser

`--target web` emits one HTML file containing direct Wasm and its small browser host.

### Windows/macOS/Linux Console

The current native Console path embeds direct Patch Wasm in a native host and packages on the actual target OS.

### Windows/macOS/Linux Window

The current Window path packages the Patch UI model in a generated desktop player. It is standalone, but is not native AppKit/Win32/GTK widget lowering.

### FreeBSD Console

Patch Studio uses the C99 backend, sends the generated/validated source through the FreeBSD workflow, compiles it with FreeBSD `cc`, smoke-runs it, and returns the executable artifact.

FreeBSD GUI packaging is not yet implemented.

## Current unsupported compiled-Console constructs

```text
dynamic repeat counts
create inside control flow
recursive recipes
return-valued recipes
things and fields
text and lists
%
history / undo / redo / why / preview / watch
GUI windows / controls / events
```

These remain available to the interpreter where supported, but direct Wasm/C99 compilation fails explicitly rather than silently choosing a different semantics.

## Numeric-model caveat

Production interpreter/direct Wasm/C99 numeric execution is based on JavaScript/Wasm/C `double`-like floating-point behavior for the supported runtime subset.

The Lean `rangeAnalysisSound` theorem reasons about an explicit **integer** expression fragment. Decimal execution, division and general floating-point behavior must therefore not be described as covered by that theorem.

## IR representation and next compiler step

Change IR 0.7 includes:

```text
instructions
capabilities
changeSignatures
changeCapabilities
formalBridge
formalSource
```

General expressions are still strings. Direct Wasm and C99 both consume a deliberately restricted expression subset. A typed expression/core IR is one of the highest-value future compiler improvements because it can reduce duplicate parsing/lowering logic and give translation validation a smaller input language.

## Remaining trusted boundary

Still unproved:

```text
Patch source bytes
   -> JavaScript parser / AST
   -> RangeExpr / SourceStmt extraction
```

and:

```text
production/direct runtime effects
   -> formal SourceExecutes / Executes
```

The next formal/compiler milestones should reduce these gaps rather than adding broad unverifiable surface syntax.

## Quality gates

Current repository gates include:

- JavaScript tests on Windows/macOS/Linux with Node 22/24;
- explicit Lean module and generated-certificate builds;
- direct-Wasm build/execution and independent transition/effect validation;
- C99 generation tests;
- C99 native compile/run on Linux and macOS;
- C99 compile/run on FreeBSD 15.1;
- native Windows/macOS/Linux Console and Window smoke builds;
- deterministic Patch Studio site build and project-surface consistency checks.

## Design constraint

Compiler and formal machinery remain optional from the beginner's perspective. Ordinary Patch still looks like:

```patch
change score:
  add 1
```

without requiring the programmer to understand Change IR, Wasm opcodes, C99, evidence schemas or Lean.
