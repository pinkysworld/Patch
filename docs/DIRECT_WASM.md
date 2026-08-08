# Direct WebAssembly backend

Patch 0.2.0-beta.10 introduced the first backend that executes lowered Patch operations directly as WebAssembly instructions instead of carrying Patch source/Change IR for an interpreter host. Beta.11 extends that executable core with structured conditions and loops.

## Current supported subset

```text
console projects
create number at top level
change number: set / add / remove / clear
show numeric-expression
numeric literals
references to earlier numeric persistent bindings
+  -  *  /
true / false
numeric == != < > <= >=
not / and / or over supported boolean expressions
if / else
literal repeat 0..100000
Patch repeat local: count
```

Example:

```patch
create number score = 0

repeat 4:
  if count == 2 or count == 4:
    change score:
      add count

show score
```

Build it directly:

```bash
patch build examples/direct-wasm-control.patch --kind console --target wasm-direct --out DirectControl.wasm
```

Or compile and execute the direct backend through the reference host:

```bash
patch run-wasm examples/direct-wasm-control.patch
```

## What is actually generated

The module imports one minimal host function:

```text
patch.show_number(f64) -> void
```

and exports:

```text
run()
patch_state_<binding> mutable f64 globals
```

Persistent numeric state uses mutable Wasm `f64` globals. Beta.11 additionally allocates Wasm `i32` locals for loop bookkeeping and Patch's 1-based `count` value.

Conditions compile to Wasm `i32` booleans and structured `if` instructions. Literal repeats compile to real Wasm `block` / `loop` / `br_if` / `br` control flow. They are not host-side loops and are not interpreted Patch source.

## Why a separate target?

The existing `--target wasm` remains the bootstrap carrier backend. It emits a genuine WebAssembly module that embeds Patch source and Change IR for a Patch host, which is useful for broad product coverage while the executable backend grows.

The direct target remains explicit:

```text
--target wasm
Patch source -> Change IR -> payload in Wasm -> Patch host/interpreter

--target wasm-direct
Patch source -> Change IR -> direct lowering -> Wasm instructions -> WebAssembly VM
```

Unsupported constructs never silently fall back to the bootstrap/interpreter path while being described as direct compilation.

## Control-flow semantics

### `if` / `else`

For the supported condition subset:

```patch
if score >= 3 and not false:
  change score:
    add 1
else:
  change score:
    remove 1
```

lowers to a Wasm `if` with an optional `else` arm. Numeric comparisons use Wasm `f64` comparison operations; boolean composition uses Wasm `i32` boolean operations.

Bare numeric truthiness such as `if score:` is deliberately rejected in beta.11. The production interpreter supports broader JavaScript-like truthiness, but the direct backend requires an explicit boolean/comparison until that semantic corner is modeled precisely.

### `repeat`

Beta.11 supports literal non-negative repeat counts from 0 to 100000:

```patch
repeat 3:
  show count
```

The direct backend creates loop-local Wasm counters and preserves Patch's existing 1-based `count` behavior, so this outputs `1`, `2`, `3`.

Nested repeats allocate independent Wasm locals. The inner `count` shadows the outer `count` exactly as the Patch interpreter's local environment does.

Dynamic repeats such as:

```patch
repeat times:
```

remain outside the beta.11 direct subset and fail explicitly.

## Numeric and boolean expression boundary

The direct expression compiler tracks two internal result kinds:

```text
f64-number
i32-bool
```

Arithmetic requires numbers. `not`, `and`, and `or` require booleans. Comparisons convert supported numeric operands into booleans. Equality is supported when both operands have the same direct expression kind.

For ordinary finite numeric values these operations match the current interpreter behavior used by the differential suite. Edge cases involving JavaScript `deepEqual` behavior for non-finite numeric values are not presented as a proved semantic equivalence.

## Still unsupported in direct execution

The direct backend remains intentionally narrower than the Patch language. Current exclusions include:

```text
dynamic repeat counts
create inside conditional/loop bodies
make / do / return
things and field access
text and lists
%
watch / history / undo / redo / why / preview
window / controls / events
```

`allow` declarations remain part of the production compiler, but a valid protected `allow recipe:` contract requires a corresponding `make recipe(...)`. Because recipe lowering is not yet in the direct subset, protected recipe programs are not yet directly executable.

## Differential validation

The direct backend does not yet have a compiler-correctness theorem. Beta.10 introduced differential execution tests and beta.11 broadens them to control flow:

```text
same supported Patch source
      |                    |
      v                    v
Patch interpreter     direct Wasm
      |                    |
      +---- compare output + final state ----+
```

The suite now covers:

```text
linear numeric mutation
multiple persistent numeric bindings
decimal f64 arithmetic
if / else
boolean composition
literal repeat
Patch count
nested repeat count shadowing
if inside repeat
explicit rejection of dynamic repeat and non-boolean conditions
```

Cross-platform CI also builds and executes a direct control-flow module on Windows, macOS and Linux with Node 22 and 24.

## Formal boundary

Direct compilation and formal verification are currently complementary but not yet connected by a lowering-correctness theorem.

Lean already checks State-Change Factorization, Change Signature Soundness, policy containment, source/evidence correspondence, and integer range-analysis soundness for their modeled subsets. Beta.11 does **not** claim that Wasm execution has been proved equivalent to `SourceExecutes` or `Executes`.

The next research-strength backend step is to expose a structured direct-execution change trace and validate or prove that supported Change IR lowering preserves the modeled semantic effects.

## Next stages

1. non-recursive `make` / `do` with numeric parameters;
2. dynamic repeat only after its runtime semantics and bounds are represented cleanly;
3. semantic change-trace ABI for direct execution;
4. typed expression/core IR instead of re-parsing expression strings in the backend;
5. lowering translation validation or machine-checked correspondence;
6. broader value representations and strings;
7. browser/WASI execution hosts;
8. GUI host-call lowering and native packaging.
