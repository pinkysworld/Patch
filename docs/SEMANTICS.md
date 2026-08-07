# Core Semantics

Patch's research semantics treats mutation as a semantic object rather than an incidental machine operation.

## State

Let program state be a finite mapping `σ : Name -> Value`, history be `H = [δ1, δ2, ..., δn]`, and `ν(x)` be the current version of target `x`.

A normalized committed change is:

```text
δ = <id, target, baseVersion, newVersion, operations, inverse, before, after>
```

Current primitive operations include `Set`, `AddNumber`, `RemoveNumber`, `Append`, `AppendText`, `RemoveAt`, `InsertAt`, `Clear`, and an internal `Restore` fallback.

Write `apply(Δ, v) = v'` for applying an operation sequence to a value. A `change x` block computes `v = σ(x)`, `v' = apply(Δ, v)`, updates `σ[x -> v']`, increments `ν(x)`, and appends the corresponding change record to `H`.

## State-Change Factorization and Mutation Transparency

**State-Change Factorization.** If an execution step in the formal machine changes an already-created persistent value, the step is witnessed by a well-formed semantic change and updates through the single commit path.

**Mutation Transparency.** Every such modeled mutation has an inspectable semantic change record describing the transition and present in resulting history.

Both properties are machine checked in `formal/PatchFormal.lean` for the current formal machine model. The production interpreter is richer, so compiler/runtime correspondence remains a separate obligation.

The source language enforces the same design structurally because the AST has no ordinary persistent-assignment node. Loops, conditions, recipes and GUI handlers can change persistent state only by executing nested `change` statements.

## Semantic Change Signatures

Beta 4 adds a structured formal control-flow core in `formal/PatchSignature.lean`:

```text
skip
emit effect
seq first second
branch then else
repeat n body
```

A static function `inferSignature(stmt)` over-approximates the semantic effects a statement may emit. Runtime behavior is modeled by `Executes stmt trace`.

Lean proves **Change Signature Soundness**:

```text
Executes(stmt, runtime)
=> RuntimeChanges(runtime) subset-of inferSignature(stmt)
```

For branches, the static signature includes effects from both alternatives. For bounded repetition, the same effect can appear multiple times at runtime, but every emitted effect remains covered by the body's static signature.

This theorem is currently about the formal normalized effect language, not yet the complete JavaScript analyzer.

## Semantic Change Capabilities

A semantic policy admits operation-aware effects rather than generic writes. Conceptually:

```text
player.score may increase up to 10
```

can allow a bounded increase while rejecting `set player.score` or a decrease to the same storage location.

For the structured formal core, Lean now proves end-to-end containment:

```text
RuntimeChanges(stmt) subset-of Signature(stmt)
Signature(stmt) admitted-by Capability(stmt)
------------------------------------------------
RuntimeChanges(stmt) admitted-by Capability(stmt)
```

This closes the signature-coverage assumption inside the formal core. The next step is to relate production Change IR/analyzer output to the Lean `Effect` and `Rule` representations.

## Inversion

Representative generated inverses:

```text
inv(AddNumber(n)) = AddNumber(-n)
inv(RemoveNumber(n)) = AddNumber(n)
inv(Set(new), old) = Set(old)
inv(Append(v), oldList) = RemoveAt(|oldList|)
inv(RemoveAt(i), oldList) = InsertAt(i, oldList[i])
```

For a sequence, inverse order is reversed.

**Inverse Correctness target:** for the supported invertible fragment, `apply(inv(Δ,v), apply(Δ,v)) = v`.

This remains an open mechanized theorem.

## Replay

Given an initial state and ordered history, replay applies normalized change operations in order.

**Replay Consistency target:** in the deterministic fragment, a version-consistent history replayed from the same initial state yields the same final state as the original execution.

This remains an open mechanized theorem.

## Composition

Two changes to the same target compose when `δ1.newVersion = δ2.baseVersion`. Forward operations concatenate in execution order and inverse operations concatenate in reverse change order.

## Conflict relation

The beta implements a conservative relation:

- different targets do not conflict;
- distinct fields of the same thing from the same base version do not conflict;
- numeric additions to the same path commute;
- competing writes to the same path conflict.

Later work should extend this algebra for lists/maps/sets and user-defined change types, prove soundness for certified commuting cases, and compare it directly with CRDT and edit-lens approaches.

## Preview

`preview B` evaluates `B` against cloned state/history, computes differences, and discards the clone. Therefore preview observes a proposed transition without committing it.

## Current theorem status

Machine checked now:

1. State-Change Factorization for the formal machine step.
2. Mutation Transparency.
3. Interval-containment transitivity.
4. Change Signature Soundness for the structured formal control-flow core.
5. Semantic Change Contract composition.
6. End-to-end Capability Soundness for the structured formal core.

Open next:

1. production compiler/formal correspondence;
2. interval-analyzer soundness;
3. inverse correctness;
4. preview non-interference/agreement;
5. replay consistency;
6. commutation/conflict-analysis soundness;
7. records, nested paths, calls and GUI-event semantics.

These claims are intentionally narrower than general reversibility, complete causal inference, or conflict-free distribution.
