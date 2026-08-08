# Patch Compiler Architecture

## Status

Patch 0.2.0-beta.12 has a working compiler front end, Change IR 0.7, semantic Change Signature analysis, Change Capabilities, formal source/range extraction, Lean-checkable certificates, a bootstrap WebAssembly carrier, and a **directly executable WebAssembly backend** for a numeric console subset with structured control flow and non-recursive recipes.

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
   +--> .patchapp                         [implemented]
   +--> bootstrap .wasm                   [implemented]
   +--> direct numeric/control/recipe wasm [implemented beta.12 subset]
   `--> native host packaging             [roadmap]
```

## Why Change IR

Patch does not perform an ordinary persistent assignment and then attach a log record. `change` is the source mutation primitive and `CHANGE` remains explicit in IR.

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

The same representation supports execution, history, inverse generation, provenance, semantic contracts, formal evidence, and direct Wasm lowering.

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

This does not yet prove the JavaScript frontend or direct runtime equivalent to the formal model.

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
Patch source -> compiler -> Change IR -> direct lowering -> Wasm instructions
```

The direct target never silently falls back to a Patch interpreter.

## Beta 10 numeric core

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

Persistent numeric bindings become mutable WebAssembly `f64` globals. Modules export `run()` plus `patch_state_<binding>` globals and import:

```text
patch.show_number(f64) -> void
```

## Beta 11 structured control flow

The direct expression compiler tracks:

```text
f64-number
i32-bool
```

and supports arithmetic, numeric comparisons, `true`, `false`, `not`, `and`, and `or` for its explicit subset.

`IF` lowers to Wasm `if` / `else`.

Literal `REPEAT` lowers to:

```text
block
  loop
    remaining == 0 ? break
    lowered body
    remaining--
    count++
    branch loop
```

Patch's 1-based `count` is an `i32` local converted to `f64` when used as a Patch number. Nested repeats allocate independent locals.

## Beta 12 direct recipe lowering

Beta.12 compiles supported top-level `MAKE` definitions to separate Wasm functions.

The backend first scans all recipes and assigns function/type indices before lowering bodies. This allows acyclic forward recipe calls without depending on declaration order.

For:

```patch
make add_points(amount):
  change score:
    add amount
```

the module gets a function conceptually typed:

```text
(f64 amount) -> void
```

and:

```patch
do add_points(3)
```

lowers to:

```text
f64.const 3
call <add_points function index>
```

Recipe parameters are Wasm `f64` parameters and are available to the same direct expression compiler as persistent numeric globals and repeat `count`.

### Acyclic call graph

Before code generation, the backend traverses `DO` instructions inside recipe bodies, including calls nested beneath supported `if` and `repeat`. A DFS rejects recursive cycles explicitly.

Supported:

```patch
make add_points(amount):
  change score:
    add amount

make twice(amount):
  do add_points(amount)
  do add_points(amount)
```

Rejected for now:

```text
self recursion
mutual recursion
return-valued recipes
nested recipe definitions
wrong call arity
```

## Semantic Change Contracts and direct recipes

A protected recipe remains validated by the production compiler before direct lowering:

```patch
create number score = 0

allow reward:
  score may increase up to 10

make reward(bonus number 0..5):
  change score:
    add bonus * 2

do reward(4)
```

The compiler first infers and checks the recipe's semantic Change Signature against the declared capability. Only a source program that passes normal Patch compilation reaches `wasm-direct` lowering.

The `allow` declaration itself emits no runtime Wasm instruction; its authority has already been checked by the production compiler.

## Ranged recipe parameter runtime guards

Beta.12 additionally preserves ranged recipe parameter checks in direct execution.

For:

```patch
make reward(bonus number 0..5):
```

the generated Wasm function begins with two guards:

```text
if bonus < 0: unreachable
if bonus > 5: unreachable
```

This creates two enforcement layers:

```text
statically provable bad call
      -> production compiler rejects

argument whose range is not statically known
      -> direct Wasm call
      -> generated range guard
      -> recipe body only when admitted
```

The runtime guard is not a replacement for Change Capability checking and does not imply full compiler verification. It preserves an important existing Patch runtime invariant in the direct backend.

## Direct backend support boundary

Currently supported directly:

```text
top-level numeric persistent creation
numeric semantic changes
numeric show
arithmetic + - * /
explicit boolean/comparison conditions
if / else
literal repeat with count
non-recursive numeric recipes
acyclic recipe calls
ranged numeric recipe parameter guards
```

Currently excluded:

```text
dynamic repeat counts
create inside control flow
recursive recipe cycles
return-valued recipes
things and fields
text and lists
%
history / undo / redo / why / preview / watch
GUI windows / controls / events
```

Unsupported constructs throw `DirectWasmUnsupportedError` rather than being routed through the bootstrap backend.

## Differential backend validation

The direct backend still uses differential execution as its implementation validation layer:

```text
same supported Patch source
        |                 |
        v                 v
   interpreter       direct Wasm
        |                 |
        +--> compare output
        +--> compare final persistent state
```

Beta.12 coverage includes:

```text
linear numeric mutations
multiple numeric bindings
decimal f64 arithmetic
if / else and boolean composition
literal repeat / count / nested count
protected ranged recipes
acyclic recipe-to-recipe calls
repeat count passed to recipes
recipe-parameter conditions
runtime ranged-parameter trap
explicit unsupported-boundary failures
```

Cross-platform CI builds and executes `examples/direct-wasm-recipes.patch` on Windows, macOS, and Linux with Node 22 and 24.

This is strong validation evidence but **not a compiler-correctness theorem**.

## Numeric-model caveat

The direct backend uses WebAssembly `f64` to match the current JavaScript `Number` implementation for ordinary supported arithmetic. The beta.9 Lean `rangeAnalysisSound` theorem instead reasons about an explicit integer fragment.

Therefore direct decimal execution, division, and general Wasm numeric behavior must not be described as covered by the Lean integer range theorem.

## IR representation

Patch IR 0.7 currently contains:

```text
instructions
capabilities
changeSignatures
changeCapabilities
formalBridge
formalSource
```

Expressions are still strings in the general IR. The direct backend re-parses its supported expression subset during lowering. A typed expression/core IR is now one of the highest-value compiler improvements because it would reduce duplicate parsing and make translation validation easier.

## Outputs

Current outputs include:

- portable `.patchapp`;
- bootstrap `.wasm` carrier;
- direct numeric/control-flow/recipe `.wasm` for the beta.12 subset;
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

The direct recipe backend also lacks a theorem that a Wasm `call` preserves the semantic effects inferred for the corresponding `DO` instruction.

## Next backend/research stages

1. explicit semantic change-trace ABI from direct Wasm execution;
2. typed expression/core IR;
3. translation validation or machine-checked correspondence from supported Change IR to Wasm effects;
4. connect direct recipe calls to formal call/substitution semantics;
5. return-valued recipes where semantics are explicit;
6. bounded dynamic loops;
7. browser/WASI direct execution hosts;
8. broader values, GUI host calls, and native packaging.

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

Compiler and formal machinery must remain optional from the beginner's perspective. Ordinary Patch code still looks like:

```patch
change score:
  add 1
```

without requiring users to understand Change IR, Wasm opcodes, SourceStmt, EvidenceStmt, Lean or the checker architecture.
