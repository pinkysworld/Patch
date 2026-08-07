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

## Mutation Transparency

**Property MT.** If an execution step changes an already-created persistent value, that step also appends a semantic change record describing the transition.

The beta enforces MT structurally because the AST has no direct persistent-assignment node. Loops, conditions, and recipes can cause state changes only by executing nested `change` statements.

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

## Replay

Given an initial state and ordered history, replay applies normalized change operations in order.

**Replay Consistency target:** in the deterministic fragment, a version-consistent history replayed from the same initial state yields the same final state as the original execution.

## Composition

Two changes to the same target compose when `δ1.newVersion = δ2.baseVersion`. Forward operations concatenate in execution order and inverse operations concatenate in reverse change order.

## Conflict relation

The beta implements a conservative relation:

- different targets do not conflict;
- distinct fields of the same thing from the same base version do not conflict;
- numeric additions to the same path commute;
- competing writes to the same path conflict.

Later work should extend this algebra for lists/maps/sets and user-defined change types, and compare it directly with CRDT and edit-lens approaches.

## Preview

`preview B` evaluates `B` against cloned state/history, computes differences, and discards the clone. Therefore preview observes a proposed transition without committing it.

## Theorem targets

A submission-ready formalization should mechanize at least:

1. Mutation Transparency.
2. Inverse Correctness for the invertible primitive fragment.
3. Replay Consistency for deterministic programs.
4. Commutation Soundness for operations the conflict checker marks as commuting.

These claims are intentionally narrower than general reversibility or conflict-free distribution.
