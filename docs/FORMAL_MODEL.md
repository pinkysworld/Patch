# Patch Core Formal Model

Status: **beta 5: mechanized core plus an executable production-to-formal validation bridge**.

The executable Patch language is larger than the Lean model. The `formal/` directory defines a compact semantics whose theorems are machine checked. Beta 5 adds `src/formal-bridge.js`, which begins connecting real compiler output to that model without pretending the whole JavaScript compiler is verified.

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

`formal/PatchFormal.lean` defines scalar values, semantic operations, `applyOp`/`applyOps`, well-formed changes, persistent store/version/history state, one semantic `Step.change` rule, intervals, semantic effects, capability rules, and signature/policy relations.

`formal/PatchSignature.lean` defines a structured formal control-flow core:

```text
skip
emit effect
seq first second
branch then else
repeat n body
```

plus static `inferSignature` and runtime `Executes stmt trace` definitions.

CI builds both modules and rejects `sorry` and `admit`.

## 3. Mechanized theorems

### State-Change Factorization

For every formal machine step `m -> m'`, Lean proves there exists a well-formed semantic change `delta` such that the resulting machine is the defined commit of that delta and history appends the same witness.

### Mutation Transparency

Every formal machine step has a well-formed semantic change witness in resulting history.

### Interval containment transitivity

```text
A within B
B within C
-------------
A within C
```

### Change Signature Soundness

For the structured formal core, Lean proves:

```text
Executes(stmt, runtime)
=> RuntimeChanges(runtime) subset-of inferSignature(stmt)
```

The inferred signature intentionally over-approximates branch alternatives. Bounded repetition can emit an effect multiple times, but every emitted effect remains represented by the static body signature.

### End-to-end Change Capability Soundness

If the inferred signature of a formal statement is admitted by its policy, Lean proves that every runtime semantic effect of an execution is admitted by that policy:

```text
RuntimeChanges(stmt) subset-of Signature(stmt)
Signature(stmt) admitted-by Capability(stmt)
------------------------------------------------
RuntimeChanges(stmt) admitted-by Capability(stmt)
```

The relevant theorem is `endToEndCapabilitySoundness` with `protectedExecutionCannotEscape` as a direct corollary.

## 4. Beta 5 production-to-formal bridge

`src/formal-bridge.js` is a conservative translation-validation layer over the real production AST and production Change Signature analyzer.

For each top-level program entry or recipe, it performs two paths:

```text
production AST ----------------------> production Change Signature
      |
      v
independent bridge lowering
      |
      v
Lean-like CoreStmt representation
      |
      v
independent formal-style signature
      |
      +------------------------------> compare
```

If an entry is inside the currently supported bridge subset and the two signatures differ, compilation fails. This turns accidental divergence between the production analyzer and the formal signature shape into a CI-visible failure.

The bridge output is embedded in Change IR as:

```text
formalBridge
```

and records, per entry:

```text
supported
reasons
abstractions
core
formalSignature
productionSignature
signatureMatchesProduction
```

The CLI command:

```bash
patch formal program.patch
```

prints the same coverage boundary in human-readable form.

### Current supported bridge subset

The bridge currently handles:

- direct semantic changes that classify as `increase`, `decrease`, `set`, or `clear`;
- sequential statements;
- both alternatives of `if` control flow;
- literal non-negative `repeat` counts;
- numeric range-derived amounts within the current formal effect representation;
- preview as an explicit no-committed-effect abstraction.

### Explicitly unsupported today

The bridge marks these as outside the correspondence subset rather than treating them as verified:

- recipe calls and parameter substitution across calls;
- dynamic repeat counts;
- `undo` / `redo` state transitions;
- GUI/window/event execution;
- `return` control flow;
- semantic operations outside the current Lean effect vocabulary;
- unproven or transitive production effects.

This conservative behavior is important: **unsupported is not the same as unsafe, and supported is not the same as fully compiler-verified.**

## 5. What beta 5 establishes and does not establish

Beta 5 gives reproducible **translation-validation/conformance evidence** for a real production subset. It establishes that, for entries accepted as bridge-supported, the production Change Signature agrees with an independently reconstructed signature shaped like the current Lean core.

It does **not** yet prove:

- that the JavaScript implementation of `buildFormalBridge` is itself correct with respect to Lean;
- that production execution follows the Lean `Executes` relation;
- that all Patch language constructs are covered;
- soundness of production interval analysis;
- recipe-call/substitution correspondence;
- full production capability soundness as a machine-checked theorem.

A stronger endpoint can be reached in one of three ways:

1. prove a formal correspondence theorem for the production compiler subset;
2. generate semantic evidence and validate it with a small verified checker;
3. move the relevant compiler analysis into a verified/extracted component.

The verified-checker boundary is currently the most attractive engineering/research compromise.

## 6. Semantic Change Signatures and capabilities

Production signatures conceptually contain:

```text
<target, path, operation, amount-or-range?>
```

The production analyzer supports operation-sensitive effects such as `increase`, `decrease`, `set`, `clear`, and bounded amounts. Policies admit selected semantic transitions, for example:

```text
player.score may increase up to 10
```

which can permit a bounded increase while rejecting an arbitrary replacement to the same path.

The formal theorem proves runtime-signature-policy containment for the normalized core. Beta 5 makes the gap between that theorem and production analysis explicit and machine-testable.

## 7. Numeric range reasoning

Patch supports ranged recipe parameters such as:

```patch
make reward(player, bonus number 0..10):
```

The production compiler performs interval analysis over a small arithmetic fragment. The formal model currently proves interval-containment composition, but not the full expression analyzer.

The next range theorem should be:

> If the range analyzer returns interval `I` for expression `e` under environment `Gamma`, every supported evaluation of `e` satisfying `Gamma` lies inside `I`.

## 8. Causal provenance

The production runtime records source, recipe-call, and GUI-event context with committed changes. The `why` command consumes this history. Provenance remains outside the Lean model for now.

## 9. Next mechanization / validation order

1. define a stable JSON/evidence schema mapping production Change IR effects to Lean `Effect` values;
2. add a small checker whose accepted evidence can be related directly to Lean definitions;
3. extend bridge coverage to non-recursive recipe calls and parameter substitution;
4. formalize the ranged expression language and prove interval-analysis soundness;
5. connect actual production execution traces to formal `Executes` traces for a restricted core;
6. derive end-to-end production capability soundness for that restricted core;
7. then move to inverse, preview, replay and commutation proofs;
8. extend to records, nested paths, GUI events and external effects.

## 10. Research boundary

State transitions, effects, capabilities, range analysis, translation validation, provenance, undo, edit algebras and patches all have substantial prior art. The candidate contribution is the **factorization discipline and reuse**: ordinary persistent mutation executes through a structured semantic delta, semantic contracts are derived from the same mandatory representation, and the project now connects a production implementation to machine-checked semantics through an explicit conservative validation boundary while preserving a deliberately small source language.
