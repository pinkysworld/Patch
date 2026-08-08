# Patch Compiler Architecture

## Status

Patch 0.2.0-beta.11 has a working compiler front end, Change IR 0.7, semantic Change Signature analysis, Change Capabilities, formal source/range extraction, Lean-checkable certificates, a bootstrap WebAssembly carrier, and a **directly executable WebAssembly backend** for a numeric console subset with structured `if` and literal `repeat`.

```text
Patch source
   |
   v
JavaScript parser / AST
   |
   +--> production Change Signature analysis
   |       `--> production Change Capability validation
   |
   +--> independent formal-range extractor
   |       `--> RangeExpr + independently reconstructed interval
   |
   +--> formal-source extractor
   |       `--> SourceStmt preserving add/remove/set/clear
   |
   +--> semantic formal bridge
   |       `--> EvidenceStmt-style semantic claim
   |
   v
Change IR 0.7
   |
   +--> generated Lean certificate
   |       +--> PatchRange / PatchSource / PatchEvidence / PatchChecker
   |
   +--> .patchapp                     [implemented]
   +--> bootstrap .wasm               [implemented]
   +--> direct numeric/control .wasm  [implemented beta.11 subset]
   `--> native host packaging         [roadmap]
```

## Why Change IR

Patch does not perform an ordinary persistent assignment and then attach a log record. `change` is the source mutation primitive and `CHANGE` is preserved in IR.

```patch
change score:
  add 1
```

conceptually lowers to:

```json
{
  "code": "CHANGE",
  "target": "score",
  "operations": [{ "op": "add", "expr": "1" }]
}
```

That same representation is reused by execution, history, inverse generation, provenance, semantic contracts, formal evidence, and the direct Wasm lowering path.

## Formal assurance path

The compiler deliberately keeps several claims separate:

```text
src/change-analysis.js  -> production semantic Change Signature
src/formal-range.js     -> independent RangeExpr + range reconstruction
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

This does not yet prove the JavaScript frontend or runtime equivalent to the formal model. The explicit remaining boundary is source/AST extraction plus production/direct-runtime correspondence.

## Direct WebAssembly targets

Patch has two distinct Wasm paths.

### Bootstrap carrier

```bash
patch build app.patch --target wasm
```

```text
Patch source -> Change IR -> payload inside Wasm -> Patch host/interpreter
```

This remains useful for broad language/browser coverage.

### Direct execution

```bash
patch build app.patch --target wasm-direct
```

```text
Patch source -> compiler -> Change IR -> direct lowering -> Wasm instructions
```

The direct backend does not include a hidden Patch interpreter fallback.

## Beta 10 direct numeric core

The first direct slice supports:

```text
console project
create number at top level
change number: set / add / remove / clear
show numeric expression
numeric literals
references to earlier persistent numeric bindings
parentheses
+  -  *  /
```

Persistent numeric bindings become mutable WebAssembly `f64` globals. Modules export:

```text
run()
patch_state_<binding>
```

and import:

```text
patch.show_number(f64) -> void
```

## Beta 11 structured direct control flow

Beta 11 extends `src/wasm-direct.js` with a typed direct expression compiler and real Wasm control structures.

### Direct expression kinds

The backend tracks:

```text
f64-number
i32-bool
```

Supported arithmetic and condition operators include:

```text
+  -  *  /
== != < > <= >=
true false
not and or
```

Arithmetic operands must be numeric. Logical operands must be boolean. Bare numeric truthiness such as `if score:` is deliberately rejected until that broader interpreter behavior has an explicit backend model.

### `if` / `else`

Patch IR:

```text
IF { expr, then, else }
```

is lowered to Wasm structured `if` / `else` with an empty result block type. The condition produces an `i32` boolean.

Example:

```patch
if score >= 3 and not false:
  change score:
    add 1
else:
  change score:
    remove 1
```

The branch is selected by the WebAssembly VM itself.

### Literal `repeat`

Beta 11 supports literal repeat counts from 0 through 100000. A repeat becomes real Wasm structured control flow:

```text
initialize remaining local
initialize Patch count local to 1
block
  loop
    if remaining == 0 -> break block
    execute lowered body
    remaining := remaining - 1
    count := count + 1
    branch loop
```

This uses Wasm `block`, `loop`, `br_if`, and `br`. It is not JavaScript-side unrolling or host-side looping.

Patch's 1-based `count` is represented as an `i32` Wasm local and converted to `f64` when used as a Patch numeric expression.

Nested repeats allocate separate locals. The current local mapping lets inner `count` shadow outer `count`, matching interpreter scope behavior.

Dynamic repeat expressions are still rejected explicitly.

## Example

```patch
create number score = 0

repeat 4:
  if count == 2 or count == 4:
    change score:
      add count

show score
```

The direct build:

```bash
patch build examples/direct-wasm-control.patch --target wasm-direct --out DirectControl.wasm
```

contains Wasm arithmetic, globals, conditionals and loop control instructions that execute the program without a Patch interpreter host.

## Direct backend support boundary

Still unsupported in direct execution include:

```text
dynamic repeat counts
create inside control-flow bodies
make / do / return
things and field access
text and lists
%
watch / history / undo / redo / why / preview
window / controls / events
```

Unsupported constructs throw `DirectWasmUnsupportedError`; they are not silently routed through the bootstrap path.

Protected `allow recipe:` programs also remain outside direct execution until `make` / `do` lowering exists, because a valid policy declaration must correspond to its recipe.

## Differential backend validation

Patch does not yet claim a compiler-correctness theorem for this backend. Instead, CI performs differential execution:

```text
same supported Patch program
        |                 |
        v                 v
   interpreter       direct Wasm
        |                 |
        +--> compare output
        +--> compare final persistent state
```

The beta.11 suite covers:

```text
linear numeric mutations
multiple numeric bindings
decimal f64 arithmetic
if / else
boolean composition
literal repeat
1-based count
nested repeat count shadowing
if inside repeat
explicit failure for dynamic repeat and non-boolean conditions
```

Cross-platform CI builds and executes the direct control-flow example on Windows, macOS and Linux with Node 22 and 24.

## Numeric-model caveat

The direct backend uses WebAssembly `f64` to match the current JavaScript `Number` implementation for its ordinary supported arithmetic. The beta.9 Lean `rangeAnalysisSound` theorem is different: it reasons about an explicitly modeled integer fragment.

Therefore direct decimal execution, division, and general Wasm numeric comparisons must not be described as covered by the Lean integer range theorem.

Likewise, direct numeric equality is differentially tested for ordinary finite values but is not presented as a proof of every edge case induced by the interpreter's JSON-based `deepEqual` behavior for non-finite values.

## IR representation

Patch IR 0.7 contains:

```text
instructions
capabilities
changeSignatures
changeCapabilities
formalBridge
formalSource
```

Expressions are still stored as strings in the general IR. The direct backend therefore parses its supported expression subset again during lowering. A typed expression/core IR is an important next step because it would reduce duplicated parsing and make translation validation easier.

## Outputs

Current compiler outputs include:

- portable `.patchapp`;
- bootstrap `.wasm` carrier;
- direct numeric/control-flow `.wasm` for the beta.11 subset;
- generated Lean `.patchcert.lean` range/source/evidence certificates.

## Remaining trusted boundary

Still unproved:

```text
Patch source bytes
   -> JavaScript parser / AST
   -> RangeExpr / SourceStmt extraction
```

and:

```text
production interpreter / direct Wasm execution
   -> formal evalRangeExpr / SourceExecutes / Executes
```

A particularly strong next backend/research milestone is to expose a semantic change trace from direct Wasm execution and validate or prove that supported Change IR lowering preserves the expected semantic effects.

## Next backend stages

1. non-recursive `make` / `do` with numeric parameters;
2. semantic direct-execution change-trace ABI;
3. typed expression/core IR;
4. lowering translation validation or machine-checked correspondence;
5. dynamic repeat only with explicit bounded runtime semantics;
6. broader value representations and strings;
7. browser/WASI direct execution hosts;
8. GUI host-call lowering and native packaging.

## Quality gates

JavaScript CI runs on Windows, macOS and Linux with Node 22/24. It checks syntax, tests, examples, formal coverage, certificates, `.patchapp`, bootstrap Wasm, direct Wasm build/execution and the public site.

Formal CI explicitly builds:

```text
PatchFormal
PatchSignature
PatchChecker
PatchEvidence
PatchSource
PatchRange
```

with Lean 4.30, compiles a certificate generated by the production compiler, and rejects unfinished proof placeholders.

## Design constraint

Formal and compiler machinery must remain optional from the beginner's perspective. Ordinary Patch code still looks like:

```patch
change score:
  add 1
```

without requiring users to understand Change IR, Wasm opcodes, SourceStmt, EvidenceStmt, Lean or the checker architecture.
