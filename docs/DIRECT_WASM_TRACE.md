# Direct WebAssembly semantic transition trace

Patch 0.2.0-beta.13 extends the direct WebAssembly backend with an explicit numeric transition-trace ABI.

The goal is to validate more than final output equivalence. For the current direct numeric subset, every committed Patch `change` block emits one transition event after its operations have executed.

## Host ABI

Direct modules now import:

```text
patch.show_number(f64) -> void
patch.change_number(i32 targetId, f64 before, f64 after) -> void
```

`targetId` indexes the module metadata `stateTargets` table. The JavaScript reference host converts it back to the Patch binding name and exposes events as:

```json
{
  "target": "score",
  "before": 3,
  "after": 8
}
```

`runDirectWasm` returns:

```text
output
state
trace
instance
```

and callers may also provide a `changeNumber(event)` callback.

## One event per Patch change block

Patch records one history entry per `change` block, not one history entry per operation inside the block.

For example:

```patch
create number score = 1

change score:
  add 2
  add 3
  remove 1
```

has one modeled committed transition:

```text
score: 1 -> 5
```

The direct backend therefore emits one host trace event after all supported numeric operations in the block complete:

```text
{ target: score, before: 1, after: 5 }
```

This deliberately aligns the trace granularity with Patch history rather than with individual Wasm arithmetic instructions.

## Differential transition validation

The direct backend already compared interpreter and Wasm output and final state. Beta.13 adds transition-sequence comparison:

```text
same supported Patch source
        |                         |
        v                         v
Patch interpreter            direct Wasm
        |                         |
        v                         v
history:                  host transition trace:
(target,before,after)*     (target,before,after)*
        |                         |
        +------ exact ordered comparison ------+
```

The parity suite performs this comparison for all successful direct cases, including:

```text
linear changes
multi-operation change blocks
if / else
literal repeat
nested repeat
recipe calls
protected ranged recipes
acyclic recipe-to-recipe calls
```

Thus backend validation now checks three observable layers:

```text
1. program output
2. final persistent numeric state
3. ordered committed numeric transition trace
```

## What this establishes

For the tested supported programs, the direct backend and interpreter agree on the observable numeric transition sequence represented by `(target, before, after)`.

This is materially stronger than final-state-only differential testing because two executions can reach the same final state through different intermediate transitions.

## What this does not establish

This is still not a compiler-correctness theorem.

The current trace does not yet include:

```text
operation vocabulary / normalized operation list
change id / version numbers
source line
recipe call-stack provenance
inverse operations
capability evidence
formal SourceStmt / EvidenceStmt identity
```

The host callback is also part of the direct backend's trusted runtime boundary. A future translation-validation or proof layer should reason about the generated module and its trace relation rather than treating the callback itself as proof.

## Relationship to State-Change Factorization

The Lean model proves State-Change Factorization for its formal machine: modeled persistent transitions occur through a well-formed semantic `Change` and the resulting history contains the witness.

Beta.13 does not yet prove the direct Wasm execution is an instance of that formal machine. It does, however, create an executable observation point at the same conceptual boundary:

```text
Patch CHANGE
    ↓
direct Wasm state transition
    ↓
change_number(target, before, after)
```

That makes the next correspondence step substantially more concrete.

## Next research step

The strongest next increment is to enrich the trace just enough to identify the semantic operation/effect represented by the Change IR node, then independently validate:

```text
Change IR semantic effect
          ↓
      direct lowering
          ↓
Wasm transition event
```

A translation validator could reject a direct artifact if its independently reconstructed transition/effect contract does not match the compiler's expected Change IR contract.

Longer term, this can be connected to the existing Lean `SourceExecutes` / `Executes` relations and Change Signature Soundness results.
