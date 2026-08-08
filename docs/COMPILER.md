# Patch Compiler Architecture

## Status

Patch 0.2.0-beta.10 has a working compiler front end, Change IR 0.7, semantic Change Signature analysis, Change Capabilities, formal source/range extraction, Lean-checkable certificates, a bootstrap WebAssembly carrier, and a first **directly executable WebAssembly backend** for a numeric console subset.

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
   |       |
   |       +--> PatchRange [Lean]
   |       |      `--> rangeAnalysisSound
   |       |
   |       +--> PatchSource [Lean]
   |       |      +--> normalize add/remove/set/clear
   |       |      `--> check SourceStmt -> EvidenceStmt
   |       |
   |       +--> PatchEvidence [Lean]
   |       |      +--> decode EvidenceStmt -> CoreStmt
   |       |      +--> infer formal Change Signature
   |       |      `--> compare separate production signature claim
   |       |
   |       `--> PatchChecker [Lean]
   |              `--> verify semantic policy
   |
   +--> .patchapp                     [implemented]
   +--> bootstrap .wasm               [implemented]
   +--> direct numeric .wasm          [implemented beta.10 subset]
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

This structure is reused by execution, history, inverse generation, provenance, semantic contracts, formal evidence, and now the first direct Wasm lowering path.

## State-Change Factorization

The compiler/runtime architecture follows the intended property:

> For supported persistent mutation, the state transition is performed through a semantic change rather than through hidden assignment followed by observation.

The Lean formal machine proves State-Change Factorization for its modeled state-changing step. Correspondence with the production interpreter and direct backend remains a separate proof obligation.

## Production semantic analysis

`src/change-analysis.js` infers semantic Change Signatures. It can distinguish, for example:

```text
player.score -> increase by [0,10]
player.score -> decrease by 2
player.score -> set
```

Optional `allow` policies constrain the target, field, operation and maximum amount. The production compiler rejects protected code when it cannot prove that inferred committed effects are inside the declared policy.

## Independent quantitative view

Beta 9 introduced `src/formal-range.js`. For the certifiable integer fragment it independently parses production expression text into a formal-style `RangeExpr` and independently computes the range represented by that expression.

The production interval analyzer and formal-range extractor therefore remain separate paths:

```text
expression -> production range analyzer -> production interval

expression -> formal-range extractor -> RangeExpr -> independent interval
```

A formal range claim is emitted only when the supported independent result agrees with the production result. Lean then proves soundness of its own formal `analyzeRange` for the modeled expression language through `rangeAnalysisSound`.

The formal range fragment currently models integer literals, ranged variables, addition, subtraction, negation and multiplication by a non-negative integer constant. Division, decimal/floating-point semantics and general multiplication are outside the beta.9 Lean range theorem even though the production language supports more arithmetic.

## Formal source and semantic views

The compiler deliberately avoids deriving every formal claim through one producer path.

### `src/formal-source.js`

Preserves source mutation verbs:

```text
add | remove | set | clear
```

and structured control flow:

```text
skip | change | seq | branch | repeat
```

For numeric `add`/`remove`, it includes a range claim only when the formal-range boundary supports and agrees with the production result.

### `src/formal-bridge.js`

Independently reconstructs the semantic formal subset and normalizes operations to semantic effects such as `increase`, `decrease`, `set`, and `clear`.

### `src/change-analysis.js`

Produces the independent production Change Signature claim.

A generated protected certificate can therefore contain separate:

```text
RangeExpr claims
SourceStmt
EvidenceStmt
production Change Signature claim
semantic policy
```

Lean checks the modeled relationships among these artifacts.

## Lean certificate chain

For supported protected recipes the generated artifact carries exact source binding information and the proof-free formal data required for machine checking.

Conceptually:

```text
RangeExpr + range environment
   -> Lean analyzeRange
   -> rangeAnalysisSound

SourceStmt
   -> Lean semantic normalization
   -> EvidenceStmt equality
   -> CoreStmt decoding
   -> inferSignature
   -> compare independent production signature claim
   -> verified semantic policy checker
   -> containment for formal SourceExecutes traces
```

`patch certify` refuses protected code outside its verified subset instead of silently weakening the guarantee.

## Beta 10 direct WebAssembly backend

`src/wasm-direct.js` is the first backend that executes a Patch subset as WebAssembly instructions rather than asking a Patch interpreter to execute an embedded payload.

The backend is intentionally separate from the existing bootstrap target:

```text
patch build app.patch --target wasm
```

produces the existing carrier:

```text
Patch source -> Change IR -> payload inside Wasm -> Patch host/interpreter
```

while:

```text
patch build app.patch --target wasm-direct
```

uses:

```text
Patch source -> compiler -> Change IR -> direct numeric lowering -> Wasm instructions
```

### Direct subset

The first executable subset supports:

```text
console project
create number
change number: set / add / remove / clear
show numeric expression
numeric literals
references to earlier persistent numeric bindings
parentheses
+  -  *  /
```

Persistent numeric bindings are represented by mutable WebAssembly `f64` globals. The module exports:

```text
run()
patch_state_<binding>
```

and imports one host function:

```text
patch.show_number(f64) -> void
```

For example:

```patch
create number base = 2
create number score = base * 3 + 1

change score:
  add base * (4 - 1)

show score
```

lowers to executable Wasm arithmetic and global operations. No Patch source or Change IR interpreter is required to perform those state transitions at runtime.

### Direct backend support boundary

The first slice rejects unsupported constructs with `DirectWasmUnsupportedError`. It does not silently route them through the interpreter.

Not directly lowered yet include:

```text
if / else
repeat
make / do / return
things and field access
text and lists
watch / history / undo / redo / why / preview
window / controls / events
```

A valid protected `allow recipe:` declaration requires its matching recipe. Because `make`/`do` are not yet in the direct subset, protected recipe programs are also not yet directly executable.

## Differential backend validation

Beta 10 does not claim a compiler-correctness theorem for the Wasm backend. Instead, the implementation starts with a strict differential validation layer:

```text
same supported Patch program
        |                 |
        v                 v
   interpreter       direct Wasm
        |                 |
        +--> compare output
        +--> compare final persistent state
```

Tests cover basic changes, multiple numeric bindings, expression lowering and decimal `f64` behavior. Cross-platform CI additionally builds and executes a direct module on Windows, macOS and Linux with Node 22 and 24.

This is stronger evidence than merely validating the Wasm binary, but it remains empirical validation rather than a proof of lowering correctness.

## Numeric model

The beta.10 direct backend uses WebAssembly `f64` for the supported Patch `number` subset. This deliberately matches the current JavaScript `Number` execution model for the supported arithmetic operators.

This direct-backend choice is separate from the beta.9 Lean range model. The Lean range theorem currently reasons about an explicit integer fragment. Therefore decimal direct-Wasm execution must not be described as covered by `rangeAnalysisSound`.

## Remaining trusted boundary

Patch does **not** yet verify the whole compiler.

Still trusted/unproved include:

```text
Patch source bytes
   -> JavaScript parser / AST
   -> RangeExpr / SourceStmt extraction
```

and:

```text
production interpreter / direct Wasm execution
   -> correspondence with formal evalRangeExpr / SourceExecutes / Executes
```

For the direct backend specifically, a future high-value theorem or translation-validation layer should connect supported Change IR operations with their Wasm execution effects.

## IR representation

Patch IR **0.7** includes:

```text
instructions
capabilities
changeSignatures
changeCapabilities
formalBridge
formalSource
```

Expressions are still strings inside the general IR. The direct backend currently parses the supported numeric expression subset independently during lowering. A typed expression IR remains an important next step for broader and easier-to-verify compilation.

Host/runtime capabilities such as `ui.window` remain distinct from semantic Change Capabilities.

## Current formal subset

Covered by the source/evidence certificate path:

- direct `add`, `remove`, `set`, `clear` changes;
- supported proven non-mixed-sign numeric ranges for `add`/`remove`;
- sequence;
- `if` alternatives;
- literal non-negative repetition;
- preview as no committed effect.

Explicitly unsupported today include recipe calls/substitution, dynamic loops, `return`, undo/redo, GUI/event execution, mixed-sign numeric updates, and operations outside the current formal vocabulary.

The formal subset and direct-Wasm subset are deliberately not presented as identical. They serve different current purposes and have different boundaries.

## Outputs

Current outputs include:

- portable `.patchapp`;
- bootstrap `.wasm` carrier;
- direct numeric `.wasm` for the beta.10 subset;
- generated Lean `.patchcert.lean` range/source/evidence certificate.

## Quality gates

JavaScript CI runs on Windows, macOS and Linux with Node 22/24. It checks syntax, language/compiler/formal tests, examples, certificate generation, `.patchapp`, bootstrap Wasm, direct Wasm build, direct Wasm execution and the public site.

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

## Next backend stages

The highest-value direct-backend sequence is:

1. structured `if` lowering;
2. bounded/literal `repeat` lowering;
3. non-recursive `make` / `do` lowering with parameters;
4. explicit semantic change-trace ABI so direct execution still exposes Patch changes;
5. typed expression/core IR;
6. lowering correspondence or independently checked translation validation;
7. WASI/browser hosts and broader value representations;
8. native application packaging around the portable runtime.

## Design constraint

Formal and compiler machinery must remain optional from the beginner's perspective. Ordinary Patch code still looks like:

```patch
change score:
  add 1
```

without requiring users to understand Change IR, Wasm opcodes, SourceStmt, EvidenceStmt, Lean or the checker architecture.
