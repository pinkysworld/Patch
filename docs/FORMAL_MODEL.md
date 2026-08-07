# Patch Core Formal Model

Status: **beta 4 mechanized core with Change Signature Soundness and end-to-end capability containment proved for the formal control-flow fragment**.

The executable Patch language is larger than this model. The `formal/` directory intentionally starts with a compact semantics whose theorems can be machine checked, then expands toward the production compiler.

## 1. State-Change Factorization

Patch does not merely record that persistent state changed. Existing persistent state is changed by constructing and applying a semantic delta.

> **State-Change Factorization.** Every modeled transition that mutates an existing persistent binding factors through a semantic change `delta`; there is no alternative persistent-write rule in the formal machine.

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

## 2. Lean 4 modules

The formal project is pinned to Lean 4.30.0.

`formal/PatchFormal.lean` defines:

- scalar values `Int`, `Bool`, and `Text`;
- semantic operations `Set`, `AddInt`, and `RemoveInt`;
- `applyOp` / `applyOps`;
- well-formed semantic changes;
- persistent store, target versions, and history;
- one semantic `Step.change` rule;
- intervals and interval containment;
- semantic effects and capability rules;
- signature coverage and policy-admission relations.

`formal/PatchSignature.lean` adds an executable formal control-flow core:

```text
skip
emit effect
seq first second
branch then else
repeat n body
```

and a static `inferSignature` function over that core. Runtime execution is represented by an `Executes stmt trace` relation whose trace contains the semantic effects actually emitted by one execution.

CI builds both modules and rejects `sorry` and `admit`.

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

and the resulting history appends that same change.

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

This supports composition of bounded range evidence.

### Change Signature Soundness

For the structured formal core, Lean now proves:

```text
Executes(stmt, runtime)
-----------------------------------
RuntimeChanges(runtime) subset-of inferSignature(stmt)
```

or, in the paper notation:

```text
RuntimeChanges(stmt) subset-of Signature(stmt)
```

The inferred signature intentionally over-approximates control flow. For a branch, effects from both branches appear in the signature even though only one branch executes. Repetition may emit the same effect multiple times at runtime, but every emitted effect kind remains covered by the body's static signature.

This theorem covers the formal constructs `seq`, `branch`, and bounded `repeat`; it is no longer an assumed premise for this core.

### End-to-end Change Capability Soundness

A protected formal statement satisfies:

```text
PolicyAllows(inferSignature(stmt), policy)
```

Combining that static check with the proved Change Signature Soundness theorem gives:

```text
RuntimeChanges(stmt) subset-of Signature(stmt)
Signature(stmt) admitted-by Capability(stmt)
------------------------------------------------
RuntimeChanges(stmt) admitted-by Capability(stmt)
```

Lean proves this directly as `endToEndCapabilitySoundness` and exposes the corollary `protectedExecutionCannotEscape`.

For the formal core, the key security chain is therefore machine checked rather than conditional on an externally supplied signature-coverage hypothesis.

## 4. What is still not proved

The formal result is intentionally narrower than “the whole Patch implementation is verified.” Open obligations include:

- **production-compiler correspondence**: prove that the JavaScript parser/analyzer/lowering implements the same signature judgments for the supported fragment;
- soundness of the production interval analyzer against expression evaluation;
- recipe-call and parameter-substitution soundness beyond the current formal control-flow core;
- recursive/fixed-point call analysis;
- richer values, records and nested paths;
- inverse correctness for the production change algebra;
- preview equivalence/non-interference;
- deterministic replay consistency;
- commutation/conflict-analysis soundness;
- GUI/event semantics;
- external I/O and irreversible effects.

These are explicit research tasks, not implied claims.

## 5. Semantic Change Signatures

For a recipe or formal statement `f`, the intended signature is:

```text
Sig(f) = { effect_1, ..., effect_n }
```

where effects conceptually contain:

```text
<target, path, operation, amount-or-range?>
```

The production analyzer supports operation-sensitive effects such as `increase`, `decrease`, `set`, `clear`, and bounded amounts. The formal beta-4 theorem proves the central coverage shape on a smaller normalized effect language.

## 6. Change Capabilities

A policy can contain a rule such as:

```text
player.score may increase up to 10
```

The static checker aims to establish:

```text
Sig(f) subset-of Cap(f)
```

where containment is semantic: an `increase` may be permitted while a `set` to the same storage path remains forbidden.

For the formal core, the combination of static policy admission and the newly proved signature theorem now yields the end-to-end runtime containment result without assuming signature coverage.

## 7. Numeric range reasoning

Patch supports ranged recipe parameters:

```patch
make reward(player, bonus number 0..10):
```

The production compiler performs interval analysis over a small arithmetic fragment. The formal model currently proves interval-containment composition, but not yet the analyzer's full expression semantics.

The next range theorem should be:

> If the range analyzer returns interval `I` for expression `e` under environment `Gamma`, every evaluation of `e` satisfying `Gamma` lies inside `I`.

That result would connect the production range evidence directly to semantic Change Capability bounds.

## 8. Causal provenance

The production runtime records source, recipe-call, and GUI-event context with committed changes. The `why` command consumes this history.

This remains outside the Lean model. A future provenance semantics can attach cause metadata to factorized transitions without weakening the core commit theorem.

## 9. Next mechanization order

1. define a correspondence relation between production Change IR effects and Lean `Effect` values;
2. add a machine-readable conformance corpus emitted by the JavaScript analyzer and checked against the formal vocabulary;
3. prove interval-analysis soundness for the ranged expression fragment;
4. formalize non-recursive recipes/calls and parameter substitution;
5. prove production-analyzer correspondence for that recipe fragment;
6. extend end-to-end capability soundness through the compiler boundary;
7. prove inverse correctness;
8. prove preview and replay properties;
9. extend to records, nested paths, and GUI events.

## 10. Research boundary

State transitions, effects, capabilities, range analysis, provenance, undo, edit algebras, and patches all have substantial prior art. The candidate contribution is the **factorization discipline and reuse**: ordinary persistent mutation executes through a structured semantic delta, and the same mandatory representation is used to derive semantic signatures, constrain operation-aware authority, record provenance, and support runtime tooling while the surface language remains deliberately small.

Beta 4 strengthens that claim with a machine-checked result that connects actual runtime effect traces of a formal structured core to the statically inferred signature and then to semantic policy containment.
