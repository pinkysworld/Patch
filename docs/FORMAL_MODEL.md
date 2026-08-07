# Patch Core Formal Model

Status: design-stage formalization for the 0.2 research artifact.

This document defines the smallest semantic core needed to state Patch's main research properties precisely. It is intentionally smaller than the full surface language. The goal is to mechanize this core before expanding the proof to lists, records, GUI events and I/O.

## 1. Core idea

Patch does not merely *record* that a variable changed. Existing persistent state is changed by constructing and applying a semantic delta.

The intended invariant is:

> **State-Change Factorization.** Every transition that mutates an existing persistent binding factors through a semantic change `delta`; there is no alternative persistent-write rule.

This is the property that distinguishes the research claim from ordinary assignment plus logging.

Patch 0.2 beta.2 adds a second layer:

> **Semantic Change Contract.** The compiler may infer the set of semantic changes a recipe can produce and verify that this set is contained in a declared set of allowed semantic changes.

The intended proof shape is:

```text
ProducedChanges(f) subset-of AllowedChanges(f)
```

for each capability-protected recipe `f` that the compiler accepts.

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

The proof obligation is **soundness**, not completeness.

## 14. GUI semantics

Patch UI should not need a separate mutation model. A button event handler executes ordinary Patch statements. If it changes bound application state, the same factorization theorem applies.

GUI rendering is a projection:

```text
render : Store x UIModel -> View
```

and is not itself allowed to mutate persistent state behind the Change IR.

## 15. External effects

Files, networking, clocks and operating-system calls are intentionally outside the first theorem.

A later effect model must distinguish:

```text
persistent Patch state changes
external irreversible effects
external reversible/compensatable effects
```

## 16. Semantic Change Signatures

For a recipe `f`, define an inferred signature:

```text
Sig(f) = { effect_1, ..., effect_n }
```

where an effect is initially:

```text
effect = <target, path, operation, amount?>
```

and:

```text
operation ::= increase | decrease | add | remove | set | clear
```

`amount` is present only when the compiler can prove a concrete numeric magnitude.

For the first formal core, inference can be syntax-directed:

```text
change x { add 5 }      => <x, x, increase, 5>
change x { remove 2 }   => <x, x, decrease, 2>
change x { set e }      => <x, x, set, none>
```

Record paths and transitive recipe calls can be added after the base proof.

A **signature soundness** theorem should state:

> Every committed semantic change that can arise from executing a well-typed recipe is represented by an effect admitted by its inferred signature.

The signature may over-approximate behavior; soundness is more important than minimality.

## 17. Change Capabilities

A declared policy is a set of allowed effects:

```text
Cap(f) = { rule_1, ..., rule_m }
```

A rule is:

```text
rule = <target, path, operation, maxAmount?>
```

The acceptance judgment is:

```text
Sig(f) <= Cap(f)
```

where `<=` means every inferred committed effect is covered by at least one policy rule and every statically known amount respects the rule's bound.

For bounded rules, an unknown/dynamic amount is **not** accepted until the compiler has a proof that it respects the bound.

The key theorem target is:

> **Capability Soundness.** If a capability-protected recipe type-checks/compiles under policy `Cap(f)`, then every committed persistent change produced by that recipe during a supported execution satisfies `Cap(f)`.

The planned proof decomposes into:

1. Change Signature soundness: runtime committed changes are covered by `Sig(f)`;
2. static policy validation: `Sig(f) <= Cap(f)`;
3. therefore runtime committed changes satisfy `Cap(f)`.

For calls, the first mechanized version should require an explicit compositional substitution rule for simple identifier arguments. Recursive/dynamic cases may be rejected conservatively until a sound fixed-point/range analysis is added.

This is deliberately more semantic than a binary write capability. Two operations that write the same location may have different authority:

```text
increase score by <= 10     allowed
set score = 999             forbidden
```

## 18. Mechanization plan

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
10. prove commutation soundness for the initial relation;
11. define semantic effects and `Sig(f)`;
12. prove Change Signature soundness;
13. define capability policies and the coverage relation;
14. prove Capability Soundness for the first non-recursive core.

Only then expand to lists, records, nested paths, richer call graphs and GUI events.

## 19. Research boundary

This model does not claim that state transitions, first-class state, effect systems, capabilities, typestate, undo, edit algebras or patches are novel. Plaid, Worlds, XMF, effect systems, capability systems, edit lenses, patch theory, event sourcing, change structures and live programming all cover important neighboring ideas.

The proposed contribution is the **combination and factorization discipline**: ordinary persistent mutation is executed through a structured semantic delta; the compiler can derive semantic Change Signatures from those same operations; optional Change Capabilities constrain the *kind* and magnitude of changes rather than merely granting generic write permission; and all of this is exposed through a deliberately low-complexity language surface.
