# Direct WebAssembly backend

Patch has two intentionally distinct WebAssembly targets:

```text
--target wasm
Patch source -> Change IR -> payload in Wasm -> Patch host/interpreter

--target wasm-direct
Patch source -> Change IR -> direct lowering -> Wasm instructions -> WebAssembly VM
```

The first direct numeric backend arrived in beta.10, structured `if` and literal `repeat` in beta.11, and beta.12 adds non-recursive numeric recipes plus ranged-parameter runtime guards.

## Current direct subset

```text
console projects
create number at top level
change number: set / add / remove / clear
show numeric-expression
numeric literals and earlier numeric persistent bindings
recipe parameters and repeat count
+  -  *  /
true / false
numeric == != < > <= >=
not / and / or
if / else
literal repeat 0..100000
Patch repeat local: count
non-recursive make / do with numeric arguments
acyclic recipe-to-recipe calls
ranged numeric recipe parameters
```

Unsupported constructs fail explicitly with `DirectWasmUnsupportedError`; the direct target never silently falls back to the Patch interpreter.

## Direct recipe example

```patch
create number score = 0

allow reward:
  score may increase up to 10

make reward(bonus number 0..5):
  change score:
    add bonus * 2

do reward(4)
show score
```

Build and execute it:

```bash
patch build examples/direct-wasm-recipes.patch --kind console --target wasm-direct --out DirectRecipes.wasm
patch run-wasm examples/direct-wasm-recipes.patch
```

The production compiler first validates the Change Capability and call-range information. The direct backend then emits a separate Wasm function for `reward` and compiles `do reward(4)` to a real Wasm `call`.

## Generated Wasm structure

The module imports only:

```text
patch.show_number(f64) -> void
```

and contains:

```text
run()                         main Patch program
recipe functions              one Wasm function per supported make
patch_state_<binding>         exported mutable f64 state globals
```

Top-level persistent Patch numbers are mutable Wasm `f64` globals. Recipe parameters are Wasm `f64` function parameters. Loop bookkeeping and Patch's 1-based `count` use Wasm `i32` locals.

## Control flow

Supported `if` conditions compile to Wasm `i32` booleans and structured `if` / `else`. Numeric comparisons use Wasm `f64` comparisons and boolean composition uses Wasm `i32` operations.

Literal repeats compile to real Wasm `block`, `loop`, `br_if`, and `br` instructions. They are not JavaScript-side unrolling or host-side loops. Nested repeats allocate independent locals so the inner Patch `count` shadows the outer one.

Dynamic repeat expressions remain outside the direct subset.

## Recipes

Beta.12 supports non-recursive numeric recipes:

```patch
make add_points(amount):
  change score:
    add amount

make twice(amount):
  do add_points(amount)
  do add_points(amount)
```

Each recipe receives its own Wasm function type and function body. `do` pushes the numeric arguments and emits a Wasm `call` instruction. Acyclic recipe-to-recipe calls are supported even when the callee is declared later, because function indices are assigned before bodies are lowered.

The direct backend rejects:

```text
recursive recipe cycles
return-valued recipes
wrong call arity
nested recipe definitions
calls before required persistent numeric state is created
```

## Ranged parameter enforcement

For:

```patch
make reward(bonus number 0..5):
  change score:
    add bonus * 2
```

the generated Wasm recipe begins with explicit lower- and upper-bound checks. An out-of-range value reaches `unreachable` before the recipe body, producing a Wasm runtime trap.

This complements compile-time reasoning rather than replacing it:

```text
statically known bad call
        -> rejected by production compiler

not statically range-provable call
        -> direct Wasm function receives value
        -> generated runtime range guard
        -> body runs only when in range
```

The differential suite separately exercises both the ordinary valid path and runtime enforcement using a persistent argument whose value is not proven by the production call-range analysis.

## Numeric and boolean representation

The direct expression compiler currently tracks:

```text
f64-number
i32-bool
```

The direct backend uses Wasm `f64` to match the current JavaScript `Number` implementation for ordinary supported arithmetic. This is separate from the beta.9 Lean range theorem, which models an explicit integer fragment. Decimal direct execution and division must therefore not be described as formally covered by `rangeAnalysisSound`.

## Differential validation

Patch currently validates the growing direct subset by running the same supported program through both implementations:

```text
same Patch source
      |                    |
      v                    v
Patch interpreter     direct Wasm
      |                    |
      +---- compare output + final state ----+
```

The suite covers numeric mutation, expressions, branches, boolean composition, literal loops, nested `count`, protected ranged recipes, acyclic calls, recipe parameters, and runtime range traps. Cross-platform CI builds and executes direct Wasm on Windows, macOS, and Linux with Node 22 and 24.

This is strong implementation validation but **not a compiler-correctness theorem**.

## Current direct exclusions

```text
dynamic repeat counts
create inside control-flow bodies
recursive recipes
return values
things and field access
text and lists
%
watch / history / undo / redo / why / preview
window / controls / events
```

## Formal boundary

Lean already checks State-Change Factorization, Change Signature Soundness, capability containment, source/evidence correspondence, and integer range-analysis soundness for their modeled subsets. Beta.12 does not yet prove the direct Wasm execution equivalent to `SourceExecutes` or `Executes`.

The strongest next backend/research step is to expose semantic change events from direct execution and then validate or prove that supported Change IR operations and recipe calls preserve the modeled effect trace.

## Next stages

1. semantic direct-execution change-trace ABI;
2. typed expression/core IR instead of re-parsing expression strings during lowering;
3. translation validation or machine-checked lowering correspondence;
4. return-valued recipes where semantics are clear;
5. bounded dynamic loops;
6. broader value representations;
7. browser/WASI direct execution hosts;
8. GUI host-call lowering and native packaging.
