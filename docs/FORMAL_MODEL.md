# Patch Core Formal Model

Status: design-stage formalization for the 0.2 research artifact.

This document defines the smallest semantic core needed to state Patch's main research property precisely. It is intentionally smaller than the full surface language. The goal is to mechanize this core before expanding the proof to lists, records, GUI events and I/O.

## 1. Core idea

Patch does not merely *record* that a variable changed. Existing persistent state is changed by constructing and applying a semantic delta.

The intended invariant is:

> **State-Change Factorization.** Every transition that mutates an existing persistent binding factors through a semantic change `delta`; there is no alternative persistent-write rule.

This is the property that distinguishes the research claim from ordinary assignment plus logging.

## 2. Core domains

Let persistent names be `x ∈ Name` and integer values be `n ∈ Int`.

A persistent store is a finite map:

```text
sigma : Name -> Value
```

For the initial mechanized core:

```text
Value ::= Int | Bool | Text
```

A history is an ordered sequence of committed changes:

```text
H ::= [] | H · delta
```

A target version map is:

```text
nu : Name -> Nat
```

## 3. Semantic operations

The first proof should use a deliberately small set of semantic operations:

```text
op ::= Set(v)
     | AddInt(n)
     | RemoveInt(n)
     | AppendText(t)
     | Clear
```

A change is:

```text
delta = <target, baseVersion, newVersion, before, ops, after>
```

with the well-formedness condition:

```text
applyOps(ops, before) = after
newVersion = baseVersion + 1
```

The full implementation additionally carries ids, optional names and inverse operations.

## 4. Applying operations

Representative definitions:

```text
applyOp(AddInt(n), Int(m))       = Int(m + n)
applyOp(RemoveInt(n), Int(m))    = Int(m - n)
applyOp(Set(v), _)               = v
applyOp(AppendText(t), Text(s))  = Text(s ++ t)
```

`applyOps` is left-to-right composition:

```text
applyOps([], v) = v
applyOps(op :: ops, v) = applyOps(ops, applyOp(op, v))
```

Ill-typed operation/value pairs are rejected before commit.

## 5. Surface core

The smallest source language required for the factorization proof is:

```text
s ::= create x = e
    | change x { c* }
    | s ; s
    | if e then s else s
    | repeat n s
    | skip

c ::= set e
    | add e
    | remove e
    | clear
```

`create` introduces a fresh persistent binding. It is explicitly excluded from the post-creation mutation theorem because it extends the domain rather than mutating an existing binding.

There is deliberately **no source form**:

```text
x = e
```

for reassignment of an existing persistent binding.

## 6. Lowering

A `change` block is evaluated against a snapshot of its target value. Each friendly surface operation lowers to one or more semantic operations.

Write:

```text
lowerChanges(c*, sigma, x) = ops
```

and:

```text
before = sigma(x)
after  = applyOps(ops, before)
```

The runtime/compiler constructs:

```text
delta = <x, nu(x), nu(x)+1, before, ops, after>
```

before the committed store is updated.

## 7. Commit function

Define a single store-mutating commit operation:

```text
commit(delta, sigma, nu, H)
  = < sigma[target := delta.after],
      nu[target := delta.newVersion],
      H · delta >
```

subject to:

```text
sigma(target) = delta.before
nu(target)    = delta.baseVersion
applyOps(delta.ops, delta.before) = delta.after
```

No other semantic rule is permitted to update an existing name in `sigma`.

## 8. State-Change Factorization theorem target

Let:

```text
< s, sigma, nu, H > ->* < skip, sigma', nu', H' >
```

be a well-typed execution.

For every existing persistent target `x` for which:

```text
x ∈ dom(sigma)
sigma'(x) != sigma(x)
```

there exists at least one committed change `delta` appended during the derivation such that:

```text
delta.target = x
applyOps(delta.ops, delta.before) = delta.after
```

and the corresponding store transition occurs through `commit(delta, ...)`.

A stronger step-local lemma is preferable:

> If one operational step changes the value of an already-existing persistent binding, that step is the `CHANGE-COMMIT` rule and appends exactly one well-formed change describing the transition.

The global theorem then follows by induction over the execution derivation.

## 9. Mutation Transparency corollary

From the factorization theorem:

> Every committed post-creation persistent mutation has an inspectable change record whose `before` and `after` values match the store transition.

This is a corollary, not the deepest theorem.

## 10. Inverse fragment

Define partial `inverseOp`:

```text
inverseOp(AddInt(n), before)      = AddInt(-n)
inverseOp(RemoveInt(n), before)   = AddInt(n)
inverseOp(Set(v), before)         = Set(before)
inverseOp(AppendText(t), before)  = Set(before)
inverseOp(Clear, before)          = Set(before)
```

For an operation sequence, inverses are generated in reverse order using the intermediate states required for state-dependent inverses.

The target theorem is:

> For every change in the supported invertible fragment, applying its generated inverse to its `after` state recovers its `before` state.

```text
applyOps(inverse(delta), delta.after) = delta.before
```

## 11. Preview non-interference

`preview s` evaluates against cloned `(sigma, nu, H)` and returns proposed changes/output while discarding the cloned committed state.

Two properties should be separated:

### Preview non-interference

```text
committedStateAfter(preview s) = committedStateBefore(preview s)
```

### Preview/commit agreement

For deterministic `s` under the same initial state and inputs, the proposed changes produced by preview equal the changes produced by subsequent commit execution.

This property must be restricted when time, randomness, nondeterministic I/O or concurrency are introduced.

## 12. Replay consistency

For deterministic histories:

```text
replay(sigma0, [delta1, ..., deltan]) = sigman
```

when every `delta_i` is version-consistent and applicable to the state produced by the previous delta.

The proof is straightforward from sequential `apply`, but future external effects require a distinction between replaying state changes and replaying real-world I/O.

## 13. Commutation relation

The initial relation should be conservative.

Two changes commute when Patch can prove:

```text
apply(delta2, apply(delta1, sigma))
=
apply(delta1, apply(delta2, sigma))
```

Initial decidable cases:

- different persistent targets;
- different independent record paths;
- additive integer changes on the same numeric path.

Competing `Set` operations on the same path are conflicts.

The proof obligation is **soundness**, not completeness: Patch may report “unknown/conflict” for changes that actually commute, but must not classify a non-commuting pair as safely commuting.

## 14. GUI semantics

Patch UI should not need a separate mutation model.

A button event handler executes ordinary Patch statements. If it changes bound application state, the same factorization theorem applies. GUI rendering is a projection:

```text
render : Store x UIModel -> View
```

and is not itself allowed to mutate persistent state behind the Change IR.

This lets a future theorem state that programmatic GUI state evolution has the same mutation transparency as console applications.

## 15. External effects

Files, networking, clocks and operating-system calls are intentionally outside the first theorem.

A later effect model must distinguish:

```text
persistent Patch state changes
external irreversible effects
external reversible/compensatable effects
```

The first paper should avoid claiming replay/undo of arbitrary external reality.

## 16. Mechanization plan

Preferred initial target: Lean 4.

Suggested order:

1. define values, stores and semantic operations;
2. define `applyOp` / `applyOps`;
3. define well-formed deltas and commit;
4. define the tiny source syntax and small-step semantics;
5. prove type preservation for the core;
6. prove the step-local factorization lemma;
7. derive State-Change Factorization / Mutation Transparency;
8. prove inverse correctness for the primitive fragment;
9. prove preview non-interference;
10. prove commutation soundness for the initial relation.

Only then expand to lists, records, nested paths and GUI events.

## 17. Research boundary

This model does not claim that state transitions, first-class state, undo, edit algebras or patches are novel. Plaid, Worlds, XMF, edit lenses, patch theory, event sourcing, change structures and live programming all cover important neighboring ideas.

The proposed contribution is specifically the **factorization discipline**: ordinary persistent mutation in a low-complexity general-purpose language is executed through a structured semantic delta, and that exact delta representation is reused across multiple language/runtime facilities.
