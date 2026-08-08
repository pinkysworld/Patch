# Direct WebAssembly backend

Patch 0.2.0-beta.10 introduces the first backend that executes lowered Patch operations directly as WebAssembly instructions instead of carrying Patch source/Change IR for an interpreter host.

## Current supported subset

The first slice is intentionally small and explicit:

```text
console projects
create number
change number: set / add / remove / clear
show numeric-expression
numeric literals
references to earlier numeric persistent bindings
+  -  *  /
allow declarations as compile-time-only metadata
```

Example:

```patch
create number score = 1

change score:
  add 2

show score
```

Build it directly:

```bash
patch build examples/score.patch --kind console --target wasm-direct --out Score.direct.wasm
```

Or compile and execute the direct backend through the reference host:

```bash
patch run-wasm examples/score.patch
```

The generated module imports one minimal host function:

```text
patch.show_number(f64) -> void
```

and exports:

```text
run()
patch_state_<binding> mutable f64 globals
```

For the supported numeric subset, CI compares direct-Wasm output and final persistent state against the existing Patch interpreter.

## Why a separate target?

The existing `--target wasm` remains the bootstrap carrier backend. It emits a genuine WebAssembly module that embeds Patch source and Change IR for a Patch host, which is useful for the browser-first product while the executable backend grows.

The new target is deliberately named `wasm-direct` so unsupported language constructs never silently fall back to interpretation while being described as direct compilation.

```text
--target wasm
Patch source -> Change IR -> payload in Wasm -> Patch host/interpreter

--target wasm-direct
Patch source -> Change IR -> numeric lowering -> Wasm instructions -> WebAssembly VM
```

## Semantic boundary

The first direct backend uses WebAssembly `f64` for the supported Patch `number` subset, matching JavaScript Number arithmetic for the supported literal and `+ - * /` operations. Remainder `%`, strings, lists, things/fields, control flow, recipes, history operations and GUI operations are rejected with `DirectWasmUnsupportedError` rather than approximated.

The direct backend does not yet prove a compiler-correctness theorem. Beta.10 uses differential execution tests as the first backend validation layer:

```text
same supported Patch source
      |                    |
      v                    v
Patch interpreter     direct Wasm
      |                    |
      +---- compare output + final state ----+
```

The next stages are to extend the executable subset with structured control flow and calls, preserve semantic Change Contract evidence across lowering, and connect the production execution trace to the formal Patch semantics.
