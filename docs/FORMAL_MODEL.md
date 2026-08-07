# Patch Core Formal Model

Status: **beta 3 mechanized core plus open implementation-correspondence work**.

The executable Patch language is larger than this model. The `formal/` directory intentionally starts with the smallest semantics needed to make the central research claims precise, then expands only after each layer is proved.

## 1. State-Change Factorization

Patch does not merely record that persistent state changed. Existing persistent state is changed by constructing and applying a semantic delta.

> **State-Change Factorization.** Every transition that mutates an existing persistent binding factors through a semantic change `delta`; there is no alternative persistent-write rule in the formal machine.

For a change

```text
delta = <target, baseVersion, newVersion, before, ops, after>
```

well-formedness requires:

```text
applyOps(ops, before) = after
newVersion = baseVersion + 1
```

and commit is the sole modeled persistent-write operation.

## 2. Lean 4 implementation

`formal/PatchFormal.lean` is pinned to Lean 4.30.0 and currently defines:

- scalar values `Int`, `Bool`, and `Text`;
- semantic operations `Set`, `AddInt`, and `RemoveInt`;
- `applyOp` / `applyOps`;
- well-formed semantic changes;
- persistent store, target versions, and history;
- one semantic `Step.change` rule;
- intervals and interval containment;
- semantic effects and capability rules;
- signature coverage and policy-admission relations.

The repository rejects `sorry` and `admit` in this Lean source.

## 3. Mechanized theorems

### State-Change Factorization

For every formal machine step:

```text
m -> m'
```

Lean proves that there exists a well-formed change `delta` such that:

```text
m' = commit(delta, m)
```

the target contains `delta.after`, and resulting history is:

```text
m.history ++ [delta]
```

### Mutation Transparency

As a corollary, every formal machine step has a well-formed change witness present in resulting history.

### Interval containment transitivity

For intervals:

```text
A within B
B within C
-------------
A within C
```

This is the small formal property underlying composition of bounded range evidence.

### Semantic Change Contract composition

Define:

```text
RuntimeChanges(f) subset-of Signature(f)
Signature(f) admitted-by Capability(f)
```

The Lean theorem proves the composition step:

```text
RuntimeChanges(f) admitted-by Capability(f)
```

This is important but deliberately narrower than claiming the production compiler itself is already verified.

## 4. What is not proved yet

The current Lean model does **not yet prove**:

- that the JavaScript parser/compiler implements the Lean semantics exactly;
- executable Change Signature soundness for all Patch programs;
- capability soundness of the production analyzer without assumptions;
- the interval analyzer's implementation correctness;
- inverse correctness for the production change algebra;
- preview equivalence;
- replay consistency;
- commutation soundness;
- GUI/event semantics;
- I/O or external-effect properties.

These are explicit future proof obligations, not implicit claims.

## 5. Semantic Change Signatures

For a recipe `f`, Patch's intended semantic signature is:

```text
Sig(f) = { effect_1, ..., effect_n }
```

with effects conceptually containing:

```text
<target, path, operation, amount-or-range?>
```

The desired executable soundness theorem is:

```text
RuntimeChanges(f) subset-of Sig(f)
```

The current Lean contract theorem takes this signature-coverage relation as a premise. Proving that the compiler-generated signature satisfies it is the next major formal step.

## 6. Change Capabilities

A policy contains rules such as:

```text
player.score may increase up to 10
```

The static checker aims to establish:

```text
Sig(f) subset-of Cap(f)
```

where containment is semantic: an `increase` can be permitted while a `set` to the same storage path remains forbidden.

When combined with Signature Soundness, the desired end-to-end theorem is:

```text
RuntimeChanges(f) subset-of Sig(f) subset-of Cap(f)
```

therefore:

```text
RuntimeChanges(f) subset-of Cap(f)
```

## 7. Numeric range reasoning

Beta 3 allows ranged recipe parameters:

```patch
make reward(player, bonus number 0..10):
```

The executable compiler performs interval analysis over a small arithmetic fragment. The formal model currently proves only the general transitivity of interval containment. A future mechanization should define the expression language and prove:

> If the range analyzer returns interval `I` for expression `e` under environment `Gamma`, every evaluation of `e` satisfying `Gamma` lies inside `I`.

That theorem would bridge the current compiler's range evidence to Change Capability bounds.

## 8. Causal provenance

The production runtime now records source, recipe-call, and GUI-event context with committed changes. The `why` command consumes this history.

This is not yet part of the Lean model. A future provenance semantics can define a causal/provenance trace as metadata attached to a factorized state transition without changing the core commit theorem.

## 9. Next mechanization order

1. make the executable semantic-operation vocabulary and Lean `Op` vocabulary correspond more closely;
2. formalize the ranged expression fragment and prove interval-analysis soundness;
3. formalize recipes and calls;
4. prove Change Signature soundness for the first non-recursive recipe core;
5. derive end-to-end Change Capability soundness;
6. prove inverse correctness for the supported operation fragment;
7. prove preview non-interference and deterministic replay consistency;
8. extend to records, nested paths, and GUI events;
9. define a compiler/IR correspondence theorem or verified checker boundary.

## 10. Research boundary

State transitions, effects, capabilities, range analysis, provenance, undo, edit algebras, and patches all have substantial prior art. The candidate contribution is the **factorization discipline and reuse**: ordinary persistent mutation executes through a structured semantic delta, and the same mandatory representation is used to derive signatures, constrain semantic authority, record provenance, and support multiple runtime tools while the surface language remains deliberately small.
